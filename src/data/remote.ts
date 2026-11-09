import { supabase } from '@/lib/supabase';
import type { Database } from './types';

/**
 * Sincronização com o Supabase.
 *
 * As ações do app continuam alterando um rascunho do banco em memória
 * (ver store.tsx). Aqui comparamos o estado anterior com o novo, tabela
 * por tabela, e enviamos só o que mudou: upsert das linhas novas/alteradas
 * e delete das removidas. Assim a lógica de negócio fica num lugar só.
 */

type Row = Record<string, unknown>;
type CollectionKey = Exclude<keyof Database, 'version' | 'organization'>;

interface TableSpec {
  key: CollectionKey;
  table: string;
  pk: string; // coluna da chave no banco
  appPk: string; // campo da chave no app
  toRow: (o: any) => Row;
  fromRow: (r: Row) => any;
}

const snake = (s: string) => s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
const camel = (s: string) => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());

/** undefined → null (para limpar a coluna) e datas locais → ISO com fuso. */
function plainToRow(o: Row, rename: Record<string, string> = {}, omit: string[] = [], timestamps: string[] = []): Row {
  const row: Row = {};
  for (const [k, v] of Object.entries(o)) {
    if (omit.includes(k)) continue;
    let value = v === undefined ? null : v;
    if (timestamps.includes(k) && typeof value === 'string' && !/[zZ]|[+-]\d\d:?\d\d$/.test(value)) value = new Date(value).toISOString();
    row[rename[k] ?? snake(k)] = value;
  }
  return row;
}

/** null → campo ausente (o app usa campos opcionais) e numeric em string → number. */
function plainFromRow(r: Row, rename: Record<string, string> = {}, numeric: string[] = []): Row {
  const o: Row = {};
  const inverse = Object.fromEntries(Object.entries(rename).map(([a, b]) => [b, a]));
  for (const [k, v] of Object.entries(r)) {
    if (v === null) continue;
    const key = inverse[k] ?? camel(k);
    o[key] = numeric.includes(key) && typeof v === 'string' ? Number(v) : v;
  }
  return o;
}

const simple = (key: CollectionKey, table: string, opts: { rename?: Record<string, string>; omit?: string[]; numeric?: string[]; timestamps?: string[]; pk?: string; appPk?: string } = {}): TableSpec => ({
  key,
  table,
  pk: opts.pk ?? 'id',
  appPk: opts.appPk ?? 'id',
  toRow: (o) => plainToRow(o, opts.rename, opts.omit, opts.timestamps),
  fromRow: (r) => plainFromRow(r, opts.rename, opts.numeric),
});

// Ordem importa: pais antes dos filhos (upsert) e o inverso (delete).
export const TABLES: TableSpec[] = [
  {
    key: 'users',
    table: 'profiles',
    pk: 'id',
    appPk: 'id',
    toRow: (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, active: u.active }),
    fromRow: (r) => ({ id: r.id, name: r.name, email: r.email, role: r.role, active: r.active }),
  },
  simple('kennels', 'kennels'),
  simple('accommodations', 'accommodations', { numeric: ['dailyRate'] }),
  simple('clients', 'clients', {}),
  simple('pets', 'client_pets', { numeric: ['weightKg'] }),
  {
    key: 'animals',
    table: 'animals',
    pk: 'id',
    appPk: 'id',
    toRow: ({ adoption, ...a }) => ({
      ...plainToRow(a, {}, [], ['updatedAt']),
      adopter_name: adoption?.adopterName ?? null,
      adopter_phone: adoption?.adopterPhone ?? null,
      adopter_cpf: adoption?.adopterCpf ?? null,
      adoption_date: adoption?.date ?? null,
      adoption_notes: adoption?.notes ?? null,
    }),
    fromRow: ({ adopter_name, adopter_phone, adopter_cpf, adoption_date, adoption_notes, ...r }) => ({
      ...plainFromRow(r, {}, ['weightKg']),
      ...(adopter_name
        ? { adoption: plainFromRow({ adopter_name, adopter_phone, adopter_cpf, date: adoption_date, notes: adoption_notes }) }
        : {}),
    }),
  },
  simple('treatments', 'animal_treatments'),
  simple('doses', 'medication_doses', { timestamps: ['givenAt'] }),
  simple('weights', 'animal_weights', { numeric: ['weightKg'] }),
  simple('documents', 'animal_documents', { timestamps: ['uploadedAt'] }),
  simple('tasks', 'tasks', { timestamps: ['dueAt', 'createdAt', 'doneAt'] }),
  simple('vaccines', 'animal_vaccines', { rename: { date: 'applied_on' } }),
  simple('healthRecords', 'animal_health_records', { rename: { date: 'record_date' } }),
  simple('events', 'animal_events', { timestamps: ['at'] }),
  simple('bookings', 'bookings', { numeric: ['dailyRate'], timestamps: ['createdAt'] }),
  simple('checkins', 'booking_checkins', { pk: 'booking_id', appPk: 'bookingId', timestamps: ['at'] }),
  simple('checkouts', 'booking_checkouts', { pk: 'booking_id', appPk: 'bookingId', numeric: ['finalValue'], timestamps: ['at'] }),
];

// Cliente: endereço aninhado no app, colunas no banco.
const clientSpec = TABLES.find((t) => t.key === 'clients')!;
clientSpec.toRow = ({ address, ...c }) => ({ ...plainToRow(c), ...plainToRow(address ?? {}) });
clientSpec.fromRow = (r) => {
  const { street, number, complement, district, city, state, zip, ...rest } = r;
  return { ...plainFromRow(rest), address: plainFromRow({ street, number, complement, district, city, state, zip }) };
};

// Tratamentos gravados antes da agenda de doses não têm horários.
const treatmentSpec = TABLES.find((t) => t.key === 'treatments')!;
const treatmentFromRow = treatmentSpec.fromRow;
treatmentSpec.fromRow = (r) => ({ times: [], ...treatmentFromRow(r) });

function db() {
  if (!supabase) throw new Error('Supabase não configurado.');
  return supabase;
}

/** Carrega todas as tabelas (volume de uma ONG cabe tranquilamente em memória). */
export async function loadRemote(): Promise<Omit<Database, 'version'>> {
  const client = db();
  const results = await Promise.all(TABLES.map((t) => client.from(t.table).select('*').limit(10000)));
  const org = await client.from('organization').select('*').eq('id', 1).maybeSingle();
  const out: Record<string, unknown> = {};
  results.forEach((res, i) => {
    if (res.error) throw new Error(`Erro ao carregar ${TABLES[i].table}: ${res.error.message}`);
    out[TABLES[i].key] = (res.data ?? []).map(TABLES[i].fromRow);
  });
  if (org.error) throw new Error(org.error.message);
  const o = org.data ?? { name: 'Associação LUNAAR', city: '', phone: '', pix_key: '' };
  out.organization = { name: o.name, city: o.city ?? '', phone: o.phone ?? '', pix: o.pix_key ?? '' };
  return out as Omit<Database, 'version'>;
}

/** Envia fotos em data URL para o Storage e troca pelo endereço público. */
async function uploadPhotos(next: Database) {
  const client = db();
  for (const list of [next.animals, next.pets] as { id: string; photo?: string }[][]) {
    for (const item of list) {
      if (!item.photo?.startsWith('data:')) continue;
      const blob = await (await fetch(item.photo)).blob();
      const folder = list === next.animals ? 'animais' : 'pets';
      const path = `${folder}/${item.id}-${Date.now()}.jpg`;
      const { error } = await client.storage.from('photos').upload(path, blob, { contentType: 'image/jpeg', upsert: true });
      if (error) throw new Error(`Não foi possível enviar a foto: ${error.message}`);
      item.photo = client.storage.from('photos').getPublicUrl(path).data.publicUrl;
    }
  }
}

/** Grava no Supabase a diferença entre dois estados. Muta `next` apenas para trocar fotos por URLs. */
export async function syncRemote(prev: Database, next: Database) {
  const client = db();
  await uploadPhotos(next);

  const deletes: { spec: TableSpec; ids: string[] }[] = [];
  for (const spec of TABLES) {
    const before = new Map((prev[spec.key] as any[]).map((o) => [o[spec.appPk], JSON.stringify(o)]));
    const after = next[spec.key] as any[];
    const changed = after.filter((o) => before.get(o[spec.appPk]) !== JSON.stringify(o));
    if (changed.length) {
      const { error } = await client.from(spec.table).upsert(changed.map(spec.toRow), { onConflict: spec.pk });
      if (error) throw new Error(friendly(error.message, spec.table));
    }
    const afterIds = new Set(after.map((o) => o[spec.appPk]));
    const removed = [...before.keys()].filter((id) => !afterIds.has(id));
    if (removed.length) deletes.push({ spec, ids: removed });
  }
  for (const { spec, ids } of deletes.reverse()) {
    const { error } = await client.from(spec.table).delete().in(spec.pk, ids);
    if (error) throw new Error(friendly(error.message, spec.table));
  }

  if (JSON.stringify(prev.organization) !== JSON.stringify(next.organization)) {
    const o = next.organization;
    const { error } = await client.from('organization').update({ name: o.name, city: o.city, phone: o.phone, pix_key: o.pix }).eq('id', 1);
    if (error) throw new Error(friendly(error.message, 'organization'));
  }
}

function friendly(message: string, table: string) {
  if (/row-level security|permission denied/i.test(message)) return 'Você não tem permissão para esta alteração.';
  if (/duplicate key/i.test(message) && table === 'clients') return 'Já existe um cliente com este CPF.';
  if (/Failed to fetch|NetworkError/i.test(message)) return 'Sem conexão com o servidor. Verifique a internet e tente de novo.';
  return `Não foi possível salvar (${message}).`;
}

/** Cria um membro da equipe via função do servidor (precisa da chave de serviço, que nunca vai ao navegador). */
export async function createStaffUser(input: { name: string; email: string; role: string; password: string }) {
  const client = db();
  const { data } = await client.auth.getSession();
  const res = await fetch('/api/create-user', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token ?? ''}` },
    body: JSON.stringify(input),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? 'Não foi possível criar o acesso.');
  return body.profile as { id: string; name: string; email: string; role: string; active: boolean };
}

// ─── Documentos (bucket privado "documents") ───────────────────

const safeName = (name: string) =>
  name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '-').slice(-80);

/** Envia o arquivo e devolve o caminho dentro do bucket. */
export async function uploadDocumentFile(animalId: string, id: string, file: File) {
  const path = `animais/${animalId}/${id}-${safeName(file.name)}`;
  const { error } = await db().storage.from('documents').upload(path, file, { contentType: file.type || undefined, upsert: false });
  if (error) throw new Error(`Não foi possível enviar o arquivo: ${error.message}`);
  return path;
}

/** Link temporário (5 min) para abrir ou baixar um documento privado. */
export async function documentUrl(path: string, download?: string) {
  const { data, error } = await db().storage.from('documents').createSignedUrl(path, 300, download ? { download } : undefined);
  if (error || !data) throw new Error(`Não foi possível abrir o documento: ${error?.message ?? 'link indisponível'}`);
  return data.signedUrl;
}

export async function removeDocumentFile(path: string) {
  const { error } = await db().storage.from('documents').remove([path]);
  if (error) throw new Error(`Não foi possível apagar o arquivo: ${error.message}`);
}
