import type { Animal, AnimalVaccine, Booking, BookingStatus, Client, ClientPet, Database, ID } from './types';
import { daysFromToday, nightsBetween, normalize, todayIso } from '@/lib/format';

export const OPEN_BOOKING: BookingStatus[] = ['reserva', 'confirmada', 'hospedado'];

/** Animais que estão fisicamente sob cuidado da ONG (exclui adotados). */
export const inCare = (db: Database) => db.animals.filter((a) => a.status !== 'adotado');

export const kennelById = (db: Database, id?: ID) => db.kennels.find((k) => k.id === id);
export const userById = (db: Database, id?: ID) => db.users.find((u) => u.id === id);
export const petById = (db: Database, id?: ID) => db.pets.find((p) => p.id === id);
export const clientById = (db: Database, id?: ID) => db.clients.find((c) => c.id === id);
export const accommodationById = (db: Database, id?: ID) => db.accommodations.find((a) => a.id === id);

export interface BookingView extends Booking {
  pet: ClientPet;
  client: Client;
  nights: number;
  estimated: number;
}

export function bookingView(db: Database, b: Booking): BookingView | null {
  const pet = petById(db, b.petId);
  const client = pet && clientById(db, pet.clientId);
  if (!pet || !client) return null;
  const nights = Math.max(1, nightsBetween(b.checkIn, b.checkOut));
  return { ...b, pet, client, nights, estimated: nights * b.dailyRate };
}

export const bookingViews = (db: Database, list = db.bookings) =>
  list.map((b) => bookingView(db, b)).filter((b): b is BookingView => b !== null);

/** Hospedagens que ocupam vaga em uma data (entrada inclusiva, saída exclusiva). */
export function occupyingOn(db: Database, date: string, accommodationId?: ID, ignoreId?: ID) {
  return db.bookings.filter(
    (b) =>
      b.id !== ignoreId &&
      (accommodationId ? b.accommodationId === accommodationId : true) &&
      ['confirmada', 'hospedado', 'reserva'].includes(b.status) &&
      b.checkIn <= date &&
      b.checkOut > date,
  );
}

/** Maior ocupação de uma acomodação ao longo de um período — usada para checar disponibilidade. */
export function peakOccupancy(db: Database, accommodationId: ID, from: string, to: string, ignoreId?: ID) {
  let peak = 0;
  const cursor = new Date(`${from}T12:00:00`);
  const end = new Date(`${to}T12:00:00`);
  while (cursor < end) {
    const iso = cursor.toISOString().slice(0, 10);
    peak = Math.max(peak, occupyingOn(db, iso, accommodationId, ignoreId).length);
    cursor.setDate(cursor.getDate() + 1);
  }
  return peak;
}

/** Agrupa doses da mesma vacina: "V4 felina (1ª dose)" e "V4 felina (2ª dose)" → "v4 felina". */
export const vaccineKey = (name: string) => normalize(name).replace(/\(.*?\)/g, '').replace(/\s+/g, ' ').trim();

/** Última dose de cada vacina do animal — doses antigas já reforçadas não geram alerta. */
export function latestDoses(db: Database, animalId: ID): AnimalVaccine[] {
  const latest = new Map<string, AnimalVaccine>();
  for (const v of db.vaccines) {
    if (v.animalId !== animalId) continue;
    const key = vaccineKey(v.name);
    const cur = latest.get(key);
    if (!cur || v.date > cur.date) latest.set(key, v);
  }
  return [...latest.values()];
}

export const vaccineDue = (db: Database, animalId: ID, withinDays = 7) =>
  latestDoses(db, animalId).filter((v) => v.nextDue && daysFromToday(v.nextDue) <= withinDays);

/** Um cadastro é considerado incompleto quando faltam dados que a equipe precisa no dia a dia ou para a adoção. */
export function missingInfo(a: Animal) {
  const missing: string[] = [];
  if (!a.photo) missing.push('foto');
  if (a.weightKg == null) missing.push('peso');
  if (!a.birthDate && a.ageApproxMonths == null) missing.push('idade');
  if (!a.responsibleId) missing.push('responsável');
  if (!a.lastVetVisit) missing.push('última consulta');
  else if (daysFromToday(a.lastVetVisit) < -180) missing.push('consulta há mais de 6 meses');
  return missing;
}

export type AlertSeverity = 'critical' | 'warning' | 'info';

export interface Alert {
  id: string;
  severity: AlertSeverity;
  title: string;
  items: { id: ID; label: string; detail?: string; href: string; photo?: string }[];
  action?: { label: string; href: string };
}

/**
 * Alertas do painel. Cada um responde a uma pergunta operacional real
 * ("o que a equipe precisa resolver hoje?") e aponta para onde agir.
 */
export function buildAlerts(db: Database): Alert[] {
  const today = todayIso();
  const alerts: Alert[] = [];
  const care = inCare(db);
  const views = bookingViews(db);

  const attention = care.filter((a) => a.status === 'atencao');
  if (attention.length)
    alerts.push({
      id: 'attention',
      severity: 'critical',
      title: `${attention.length === 1 ? '1 animal precisa' : `${attention.length} animais precisam`} de atenção imediata`,
      items: attention.map((a) => ({ id: a.id, label: a.name, detail: a.vetNotes, href: `/animais/${a.id}`, photo: a.photo })),
    });

  const overdue = views.filter((b) => b.status === 'hospedado' && b.checkOut < today);
  if (overdue.length)
    alerts.push({
      id: 'overdue',
      severity: 'critical',
      title: `${overdue.length === 1 ? '1 hospedagem passou' : `${overdue.length} hospedagens passaram`} da data de saída`,
      items: overdue.map((b) => ({ id: b.id, label: b.pet.name, detail: `Tutor(a): ${b.client.name}`, href: `/hospedagem/${b.id}`, photo: b.pet.photo })),
    });

  const pending = db.treatments.filter((t) => t.status === 'pendente' && care.some((a) => a.id === t.animalId));
  const pendingAnimals = [...new Set(pending.map((t) => t.animalId))];
  if (pendingAnimals.length)
    alerts.push({
      id: 'treatments',
      severity: 'warning',
      title: `${pendingAnimals.length === 1 ? '1 animal possui' : `${pendingAnimals.length} animais possuem`} tratamento veterinário pendente`,
      items: pendingAnimals.map((id) => {
        const a = db.animals.find((x) => x.id === id)!;
        const t = pending.filter((x) => x.animalId === id);
        return { id, label: a.name, detail: t.map((x) => x.title).join(' · '), href: `/animais/${id}?aba=saude`, photo: a.photo };
      }),
    });

  const endingToday = views.filter((b) => b.status === 'hospedado' && b.checkOut === today);
  if (endingToday.length)
    alerts.push({
      id: 'ending',
      severity: 'warning',
      title: `${endingToday.length === 1 ? '1 hospedagem termina' : `${endingToday.length} hospedagens terminam`} hoje`,
      items: endingToday.map((b) => ({ id: b.id, label: b.pet.name, detail: `Check-out · ${b.client.name}`, href: `/hospedagem/${b.id}`, photo: b.pet.photo })),
    });

  const vaccines = care
    .map((a) => ({ a, due: vaccineDue(db, a.id) }))
    .filter((x) => x.due.length);
  if (vaccines.length)
    alerts.push({
      id: 'vaccines',
      severity: 'warning',
      title: `${vaccines.length === 1 ? '1 animal tem' : `${vaccines.length} animais têm`} vacina vencida ou vencendo em 7 dias`,
      items: vaccines.map(({ a, due }) => ({
        id: a.id,
        label: a.name,
        detail: due.map((v) => `${v.name} · ${daysFromToday(v.nextDue!) < 0 ? 'vencida' : daysFromToday(v.nextDue!) === 0 ? 'vence hoje' : `vence em ${daysFromToday(v.nextDue!)}d`}`).join(' · '),
        href: `/animais/${a.id}?aba=saude`,
        photo: a.photo,
      })),
    });

  const unconfirmed = views.filter((b) => b.status === 'reserva' && daysFromToday(b.checkIn) <= 3);
  if (unconfirmed.length)
    alerts.push({
      id: 'unconfirmed',
      severity: 'info',
      title: `${unconfirmed.length === 1 ? '1 reserva começa' : `${unconfirmed.length} reservas começam`} em até 3 dias sem confirmação`,
      items: unconfirmed.map((b) => ({ id: b.id, label: b.pet.name, detail: `${b.client.name} · ${b.client.whatsapp ?? b.client.phone}`, href: `/hospedagem/${b.id}`, photo: b.pet.photo })),
    });

  const incomplete = care.map((a) => ({ a, missing: missingInfo(a) })).filter((x) => x.missing.length);
  if (incomplete.length)
    alerts.push({
      id: 'incomplete',
      severity: 'info',
      title: `${incomplete.length === 1 ? '1 animal precisa' : `${incomplete.length} animais precisam`} de atualização cadastral`,
      items: incomplete.map(({ a, missing }) => ({ id: a.id, label: a.name, detail: `Falta: ${missing.join(', ')}`, href: `/animais/${a.id}/editar`, photo: a.photo })),
    });

  return alerts;
}
