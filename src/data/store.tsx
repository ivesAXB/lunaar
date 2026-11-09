import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createSeed, SEED_VERSION } from './seed';
import type {
  Accommodation,
  Adoption,
  Animal,
  AnimalHealthRecord,
  AnimalStatus,
  AnimalTreatment,
  AnimalVaccine,
  Booking,
  BookingCheckin,
  BookingCheckout,
  Client,
  ClientPet,
  Database,
  ID,
  Kennel,
  Organization,
  TreatmentStatus,
  User,
} from './types';
import { ANIMAL_STATUS } from '@/lib/labels';
import { getCurrentUserId } from './session';
import { kennelPath } from '@/lib/kennel';
import { isRemote } from '@/lib/supabase';
import { createStaffUser, loadRemote, syncRemote } from './remote';

/**
 * Camada de dados.
 *
 * As ações alteram um rascunho do banco em memória e, em seguida:
 * • modo Supabase: a diferença é gravada nas tabelas (remote.ts);
 * • modo demonstração (sem variáveis do Supabase): tudo fica no navegador.
 * As telas não sabem em qual modo estão.
 */

const STORAGE_KEY = 'lunaar.db.v1';
const LATENCY = 420;

const wait = (ms = LATENCY) => new Promise((r) => setTimeout(r, ms));
/** IDs no formato UUID (compatível com o banco). O prefixo é ignorado. */
export const uid = (_prefix = '') =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/** Banco local do modo demonstração. */
export function loadDb(): Database {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Database;
      if (parsed.version === SEED_VERSION) return parsed;
    }
  } catch {
    /* armazenamento indisponível: usa dados de exemplo em memória */
  }
  return createSeed();
}

function persist(db: Database) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    /* cota excedida ou modo privado: segue em memória */
  }
}

const EMPTY: Database = {
  version: SEED_VERSION,
  organization: { name: 'Associação LUNAAR', city: '', phone: '', pix: '' },
  users: [], kennels: [], animals: [], treatments: [], vaccines: [], healthRecords: [], events: [],
  clients: [], pets: [], accommodations: [], bookings: [], checkins: [], checkouts: [],
};

/**
 * Dados de exemplo para um banco Supabase vazio: sem usuários fictícios —
 * responsáveis e registros ficam no nome de quem carregou.
 */
function demoForRemote(userId: string): Omit<Database, 'users' | 'version'> {
  const seed = createSeed();
  const fix = <T extends Record<string, any>>(list: T[], keys: string[]) =>
    list.map((o) => {
      const copy: Record<string, any> = { ...o };
      keys.forEach((k) => copy[k] && /^u\d$/.test(copy[k]) && (copy[k] = userId));
      return copy as T;
    });
  // IDs curtos do seed viram UUIDs para não colidir com dados reais.
  const map = new Map<string, string>();
  const idOf = (id: string) => (id.startsWith('ac') ? id : map.get(id) ?? (map.set(id, uid()), map.get(id)!));
  const remap = <T extends Record<string, any>>(list: T[], fields: string[]) =>
    list.map((o) => {
      const copy: Record<string, any> = { ...o };
      fields.forEach((f) => copy[f] && (copy[f] = idOf(copy[f])));
      return copy as T;
    });
  return {
    organization: seed.organization,
    kennels: remap(seed.kennels, ['id']),
    accommodations: seed.accommodations,
    clients: remap(seed.clients, ['id']),
    pets: remap(seed.pets, ['id', 'clientId']),
    animals: fix(remap(seed.animals, ['id', 'kennelId']), ['responsibleId']),
    treatments: remap(seed.treatments, ['id', 'animalId']),
    vaccines: remap(seed.vaccines, ['id', 'animalId']),
    healthRecords: remap(seed.healthRecords, ['id', 'animalId']),
    events: fix(remap(seed.events, ['id', 'animalId']), ['userId']),
    bookings: remap(seed.bookings, ['id', 'petId']),
    checkins: fix(remap(seed.checkins, ['bookingId']), ['userId']),
    checkouts: fix(remap(seed.checkouts, ['bookingId']), ['userId']),
  };
}
type Mutator<T> = (draft: Database) => T;
type Mutate = <T>(fn: Mutator<T>, opts?: { skipSync?: boolean }) => Promise<T>;

/** Dose de vacina editada no formulário do animal (id presente = dose já existente). */
export type VaccineDraft = Omit<AnimalVaccine, 'id' | 'animalId'> & { id?: ID };

export interface AnimalInput extends Omit<Animal, 'id' | 'updatedAt'> {
  id?: ID;
  /** Quando informado, substitui o histórico de vacinas do animal. */
  vaccines?: VaccineDraft[];
}

function useActions(mutate: Mutate, currentUserId: () => ID | undefined) {
  return useMemo(() => {
    const logEvent = (db: Database, animalId: ID, type: Database['events'][number]['type'], text: string) => {
      db.events.push({ id: uid('e'), animalId, at: new Date().toISOString(), type, text, userId: currentUserId() });
    };

    return {
      // ─── Animais ───────────────────────────────────────────
      saveAnimal: ({ vaccines, ...input }: AnimalInput) =>
        mutate((db) => {
          const now = new Date().toISOString();
          let saved: Animal;
          if (input.id) {
            const idx = db.animals.findIndex((a) => a.id === input.id);
            if (idx < 0) throw new Error('Animal não encontrado.');
            const prev = db.animals[idx];
            saved = { ...prev, ...input, id: prev.id, updatedAt: now };
            if (prev.status !== saved.status) logEvent(db, saved.id, 'status', `Status alterado para ${ANIMAL_STATUS[saved.status].label}`);
            if (prev.kennelId !== saved.kennelId) {
              const k = db.kennels.find((x) => x.id === saved.kennelId);
              logEvent(db, saved.id, 'canil', k ? `Transferido para ${kennelPath(k)}` : 'Removido do canil');
            }
            db.animals[idx] = saved;
          } else {
            saved = { ...input, id: uid('a'), updatedAt: now };
            db.animals.push(saved);
            const k = db.kennels.find((x) => x.id === saved.kennelId);
            logEvent(db, saved.id, 'entrada', `Entrada na ONG${k ? ` · alocado em ${kennelPath(k)}` : ''}`);
          }

          if (vaccines) {
            const before = db.vaccines.filter((v) => v.animalId === saved.id).length;
            db.vaccines = db.vaccines
              .filter((v) => v.animalId !== saved.id)
              .concat(vaccines.map((v) => ({ ...v, id: v.id ?? uid('v'), animalId: saved.id })));
            const added = vaccines.filter((v) => !v.id).length;
            const removed = before - (vaccines.length - added);
            if (added || removed) {
              const parts = [added && `${added} ${added === 1 ? 'dose registrada' : 'doses registradas'}`, removed && `${removed} ${removed === 1 ? 'removida' : 'removidas'}`].filter(Boolean);
              logEvent(db, saved.id, 'saude', `Histórico de vacinas atualizado: ${parts.join(', ')}`);
            }
          }
          return saved;
        }),

      deleteAnimal: (id: ID) =>
        mutate((db) => {
          db.animals = db.animals.filter((a) => a.id !== id);
          db.treatments = db.treatments.filter((t) => t.animalId !== id);
          db.vaccines = db.vaccines.filter((v) => v.animalId !== id);
          db.healthRecords = db.healthRecords.filter((h) => h.animalId !== id);
          db.events = db.events.filter((e) => e.animalId !== id);
        }),

      setAnimalStatus: (id: ID, status: AnimalStatus) =>
        mutate((db) => {
          const a = db.animals.find((x) => x.id === id);
          if (!a || a.status === status) return;
          a.status = status;
          a.updatedAt = new Date().toISOString();
          logEvent(db, id, 'status', `Status alterado para ${ANIMAL_STATUS[status].label}`);
        }),

      registerAdoption: (id: ID, adoption: Adoption) =>
        mutate((db) => {
          const a = db.animals.find((x) => x.id === id);
          if (!a) throw new Error('Animal não encontrado.');
          a.status = 'adotado';
          a.adoption = adoption;
          a.kennelId = undefined;
          a.updatedAt = new Date().toISOString();
          logEvent(db, id, 'adocao', `Adotado por ${adoption.adopterName}`);
        }),

      addAnimalNote: (animalId: ID, text: string) => mutate((db) => logEvent(db, animalId, 'nota', text)),

      saveTreatment: (t: Omit<AnimalTreatment, 'id'> & { id?: ID }) =>
        mutate((db) => {
          if (t.id) {
            const idx = db.treatments.findIndex((x) => x.id === t.id);
            db.treatments[idx] = { ...db.treatments[idx], ...t } as AnimalTreatment;
            return db.treatments[idx];
          }
          const created = { ...t, id: uid('t') } as AnimalTreatment;
          db.treatments.push(created);
          logEvent(db, t.animalId, 'saude', `Tratamento registrado: ${t.title}`);
          return created;
        }),

      setTreatmentStatus: (id: ID, status: TreatmentStatus) =>
        mutate((db) => {
          const t = db.treatments.find((x) => x.id === id);
          if (!t) return;
          t.status = status;
          if (status === 'concluido' && !t.endDate) t.endDate = new Date().toISOString().slice(0, 10);
          if (status === 'concluido') logEvent(db, t.animalId, 'saude', `Tratamento concluído: ${t.title}`);
        }),

      deleteTreatment: (id: ID) => mutate((db) => void (db.treatments = db.treatments.filter((t) => t.id !== id))),

      addVaccine: (v: Omit<AnimalVaccine, 'id'>) =>
        mutate((db) => {
          db.vaccines.push({ ...v, id: uid('v') });
          const a = db.animals.find((x) => x.id === v.animalId);
          if (a && (!a.lastVetVisit || a.lastVetVisit < v.date)) a.lastVetVisit = v.date;
          logEvent(db, v.animalId, 'saude', `Vacina aplicada: ${v.name}`);
        }),

      deleteVaccine: (id: ID) => mutate((db) => void (db.vaccines = db.vaccines.filter((v) => v.id !== id))),

      addHealthRecord: (h: Omit<AnimalHealthRecord, 'id'>) =>
        mutate((db) => {
          db.healthRecords.push({ ...h, id: uid('h') });
          const a = db.animals.find((x) => x.id === h.animalId);
          if (a && h.type !== 'observacao' && (!a.lastVetVisit || a.lastVetVisit < h.date)) a.lastVetVisit = h.date;
        }),

      // ─── Clientes e pets ──────────────────────────────────
      saveClient: (c: Omit<Client, 'id' | 'createdAt'> & { id?: ID; createdAt?: string }) =>
        mutate((db) => {
          const cpfTaken = db.clients.some((x) => x.cpf === c.cpf && x.id !== c.id);
          if (cpfTaken) throw new Error('Já existe um cliente com este CPF.');
          if (c.id) {
            const idx = db.clients.findIndex((x) => x.id === c.id);
            db.clients[idx] = { ...db.clients[idx], ...c } as Client;
            return db.clients[idx];
          }
          const created: Client = { ...c, id: uid('c'), createdAt: new Date().toISOString().slice(0, 10) };
          db.clients.push(created);
          return created;
        }),

      deleteClient: (id: ID) =>
        mutate((db) => {
          const petIds = db.pets.filter((p) => p.clientId === id).map((p) => p.id);
          const open = db.bookings.some((b) => petIds.includes(b.petId) && ['reserva', 'confirmada', 'hospedado'].includes(b.status));
          if (open) throw new Error('Este cliente tem hospedagens em aberto. Finalize ou cancele antes de excluir.');
          if (db.bookings.some((b) => petIds.includes(b.petId)))
            throw new Error('Este cliente tem histórico de hospedagens, que precisa ser mantido. Edite o cadastro em vez de excluir.');
          db.clients = db.clients.filter((c) => c.id !== id);
          db.pets = db.pets.filter((p) => p.clientId !== id);
        }),

      savePet: (p: Omit<ClientPet, 'id'> & { id?: ID }) =>
        mutate((db) => {
          if (p.id) {
            const idx = db.pets.findIndex((x) => x.id === p.id);
            db.pets[idx] = { ...db.pets[idx], ...p } as ClientPet;
            return db.pets[idx];
          }
          const created = { ...p, id: uid('p') } as ClientPet;
          db.pets.push(created);
          return created;
        }),

      deletePet: (id: ID) =>
        mutate((db) => {
          const open = db.bookings.some((b) => b.petId === id && ['reserva', 'confirmada', 'hospedado'].includes(b.status));
          if (open) throw new Error('Este pet tem hospedagem em aberto.');
          if (db.bookings.some((b) => b.petId === id)) throw new Error('Este pet tem histórico de hospedagens, que precisa ser mantido.');
          db.pets = db.pets.filter((p) => p.id !== id);
        }),

      // ─── Hospedagens ──────────────────────────────────────
      createBooking: (input: Omit<Booking, 'id' | 'code' | 'createdAt'>) =>
        mutate((db) => {
          const max = db.bookings.reduce((m, b) => Math.max(m, Number(b.code.replace(/\D/g, '')) || 0), 1040);
          const created: Booking = { ...input, id: uid('b'), code: `H-${max + 1}`, createdAt: new Date().toISOString() };
          db.bookings.push(created);
          return created;
        }),

      updateBooking: (id: ID, patch: Partial<Booking>) =>
        mutate((db) => {
          const b = db.bookings.find((x) => x.id === id);
          if (!b) throw new Error('Hospedagem não encontrada.');
          Object.assign(b, patch);
          return b;
        }),

      checkIn: (data: BookingCheckin) =>
        mutate((db) => {
          const b = db.bookings.find((x) => x.id === data.bookingId);
          if (!b) throw new Error('Hospedagem não encontrada.');
          b.status = 'hospedado';
          db.checkins = db.checkins.filter((c) => c.bookingId !== b.id).concat(data);
        }),

      checkOut: (data: BookingCheckout) =>
        mutate((db) => {
          const b = db.bookings.find((x) => x.id === data.bookingId);
          if (!b) throw new Error('Hospedagem não encontrada.');
          b.status = 'finalizada';
          db.checkouts = db.checkouts.filter((c) => c.bookingId !== b.id).concat(data);
        }),

      // ─── Configurações ────────────────────────────────────
      saveUser: async (u: Omit<User, 'id'> & { id?: ID }) => {
        if (isRemote && !u.id) {
          // Criar login exige a chave de serviço: feito pela função /api/create-user.
          const profile = await createStaffUser({ name: u.name, email: u.email, role: u.role, password: u.password ?? '' });
          await mutate((db) => void db.users.push(profile as User), { skipSync: true });
          return;
        }
        const { password: _pw, ...rest } = u;
        return mutate((db) => {
          const taken = db.users.some((x) => x.email.toLowerCase() === u.email.toLowerCase() && x.id !== u.id);
          if (taken) throw new Error('Já existe um usuário com este e-mail.');
          if (u.id) {
            const idx = db.users.findIndex((x) => x.id === u.id);
            db.users[idx] = { ...db.users[idx], ...(isRemote ? rest : u) } as User;
            return;
          }
          db.users.push({ ...u, id: uid('u') });
        });
      },

      saveKennel: (k: Omit<Kennel, 'id'> & { id?: ID }) =>
        mutate((db) => {
          if (k.id) {
            const idx = db.kennels.findIndex((x) => x.id === k.id);
            db.kennels[idx] = { ...db.kennels[idx], ...k } as Kennel;
            return;
          }
          db.kennels.push({ ...k, id: uid('k') });
        }),

      saveAccommodation: (a: Accommodation) =>
        mutate((db) => {
          const idx = db.accommodations.findIndex((x) => x.id === a.id);
          db.accommodations[idx] = a;
        }),

      saveOrganization: (o: Organization) => mutate((db) => void (db.organization = o)),

      /** Local: recria os dados de exemplo. Supabase: carrega exemplos num banco vazio. */
      resetDemo: () =>
        mutate((db) => {
          if (!isRemote) return void Object.assign(db, createSeed());
          if (db.animals.length || db.clients.length) throw new Error('O banco já tem cadastros. Os dados de exemplo só podem ser carregados num sistema vazio.');
          Object.assign(db, demoForRemote(currentUserId() ?? ''));
        }),
    };
  }, [mutate, currentUserId]);
}

export type Actions = ReturnType<typeof useActions>;

interface DataContextValue {
  db: Database;
  ready: boolean;
  actions: Actions;
  reload: () => Promise<void>;
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<Database>(() => (isRemote ? EMPTY : loadDb()));
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState('');
  const dbRef = useRef(db);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const lastLoad = useRef(0);

  const reload = useCallback(async () => {
    if (!isRemote) return;
    try {
      // Logo após o login o token pode chegar alguns segundos "no futuro" para a API
      // (pequena diferença de relógio entre serviços): tenta de novo antes de desistir.
      let data: Awaited<ReturnType<typeof loadRemote>> | undefined;
      for (let attempt = 0; !data; attempt++) {
        try {
          data = await loadRemote();
        } catch (err) {
          if (attempt >= 4 || !/issued at future|JWT|Failed to fetch/i.test((err as Error).message)) throw err;
          await wait(1500 * (attempt + 1));
        }
      }
      const next = { ...data, version: SEED_VERSION } as Database;
      dbRef.current = next;
      setDb(next);
      setLoadError('');
      lastLoad.current = Date.now();
    } catch (err) {
      setLoadError((err as Error).message);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    if (isRemote) {
      reload();
      // Ao voltar para a aba, busca o que a equipe alterou (no máximo a cada 30 s).
      const onVisible = () => document.visibilityState === 'visible' && Date.now() - lastLoad.current > 30_000 && (queue.current = queue.current.then(reload));
      document.addEventListener('visibilitychange', onVisible);
      return () => document.removeEventListener('visibilitychange', onVisible);
    }
    // Modo demonstração: simula a primeira carga (exibe skeletons).
    const t = setTimeout(() => setReady(true), 550);
    return () => clearTimeout(t);
  }, [reload]);

  // As gravações entram numa fila para que cada diferença parta do estado já salvo.
  const mutate = useCallback(<T,>(fn: Mutator<T>, opts: { skipSync?: boolean } = {}): Promise<T> => {
    const run = async () => {
      if (!isRemote) await wait();
      const prev = dbRef.current;
      const draft = structuredClone(prev);
      const result = fn(draft);
      if (isRemote && !opts.skipSync) await syncRemote(prev, draft);
      dbRef.current = draft;
      setDb(draft);
      if (!isRemote) persist(draft);
      return result;
    };
    const p = queue.current.then(run, run);
    queue.current = p.catch(() => undefined);
    return p;
  }, []);

  const currentUserId = useCallback(() => getCurrentUserId(), []);
  const actions = useActions(mutate, currentUserId);

  const value = useMemo(() => ({ db, ready, actions, reload }), [db, ready, actions, reload]);

  if (loadError && !db.users.length) {
    return (
      <div className="page" role="alert" style={{ maxWidth: 560 }}>
        <h1 className="page-title">Não foi possível carregar os dados</h1>
        <p className="page-header__sub" style={{ margin: '12px 0 20px' }}>{loadError}</p>
        <button type="button" className="btn btn--dark" onClick={() => (setLoadError(''), reload())}>
          Tentar de novo
        </button>
      </div>
    );
  }
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData precisa estar dentro de <DataProvider>');
  return ctx;
}

/** Usuário logado (perfil da equipe). */
export function useMe() {
  const { db } = useData();
  const id = getCurrentUserId();
  return db.users.find((u) => u.id === id) ?? null;
}