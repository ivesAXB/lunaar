import type { Animal, AnimalTreatment, AnimalVaccine, AnimalWeight, Booking, BookingStatus, Client, ClientPet, Database, ID, MedicationDose, Task } from './types';
import type { DoseStatus } from '@/lib/labels';
import { daysFromToday, fmtKg, fmtTime, isoDate, nightsBetween, normalize, toDate, todayIso } from '@/lib/format';

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

// ─── Agenda de doses ─────────────────────────────────────────

export interface DoseSlot {
  key: string;
  date: string;
  time: string;
  treatment: AnimalTreatment;
  animal: Animal;
  given?: MedicationDose;
  status: DoseStatus;
}

const nowHHMM = () => new Date().toTimeString().slice(0, 5);

/** Tratamentos com horário que valem numa data (em andamento e dentro do período). */
export const scheduledOn = (db: Database, date: string) =>
  db.treatments.filter((t) => t.status === 'ativo' && t.times.length > 0 && t.startDate <= date && (!t.endDate || t.endDate >= date));

/** Todas as doses previstas para um dia, com a situação de cada uma. */
export function doseSlots(db: Database, date: string): DoseSlot[] {
  const today = todayIso();
  const now = nowHHMM();
  const care = new Map(inCare(db).map((a) => [a.id, a]));
  const given = new Map(db.doses.filter((d) => d.scheduledOn === date).map((d) => [`${d.treatmentId}|${d.scheduledTime}`, d]));
  const slots: DoseSlot[] = [];
  for (const t of scheduledOn(db, date)) {
    const animal = care.get(t.animalId);
    if (!animal) continue;
    for (const time of t.times) {
      const g = given.get(`${t.id}|${time}`);
      const late = date < today || (date === today && time < now);
      slots.push({ key: `${t.id}|${date}|${time}`, date, time, treatment: t, animal, given: g, status: g ? 'administrada' : late ? 'atrasada' : 'pendente' });
    }
  }
  return slots.sort((a, b) => a.time.localeCompare(b.time) || a.animal.name.localeCompare(b.animal.name));
}

// ─── Peso ────────────────────────────────────────────────────

export const weightsOf = (db: Database, animalId: ID) =>
  db.weights.filter((w) => w.animalId === animalId).sort((a, b) => a.measuredOn.localeCompare(b.measuredOn));

/** Perda de peso: última medição comparada ao maior peso dos 30 dias anteriores. */
export function weightLoss(list: AnimalWeight[]) {
  const last = list[list.length - 1];
  if (!last) return null;
  const from = new Date(`${last.measuredOn}T12:00:00`);
  from.setDate(from.getDate() - 30);
  const fromIso = from.toISOString().slice(0, 10);
  const window = list.filter((w) => w !== last && w.measuredOn >= fromIso);
  if (!window.length) return null;
  const peak = window.reduce((m, w) => (w.weightKg > m.weightKg ? w : m));
  const pct = (peak.weightKg - last.weightKg) / peak.weightKg;
  return pct > 0 ? { pct, from: peak, to: last } : null;
}

export const WEIGHT_LOSS_ALERT = 0.1;

// ─── Tarefas ─────────────────────────────────────────────────

// dueAt pode vir com fuso (Supabase: "…+00:00") ou sem (dados de exemplo, hora local):
// comparar como data, nunca como texto, e tirar o dia no fuso local.
export const isTaskOverdue = (t: Task) => t.status !== 'concluida' && toDate(t.dueAt).getTime() < Date.now();

/** Dia (yyyy-MM-dd) de um horário no fuso local. */
export const localDay = (iso: string) => isoDate(toDate(iso));

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

  const careIds = new Set(care.map((a) => a.id));
  const lateDoses = doseSlots(db, today).filter((s) => s.status === 'atrasada');
  if (lateDoses.length)
    alerts.push({
      id: 'doses',
      severity: 'critical',
      title: `${lateDoses.length === 1 ? '1 dose de medicação está atrasada' : `${lateDoses.length} doses de medicação estão atrasadas`}`,
      items: lateDoses.map((s) => ({
        id: s.key,
        label: s.animal.name,
        detail: `${s.time} · ${s.treatment.medication ?? s.treatment.title}${s.treatment.dosage ? ` · ${s.treatment.dosage}` : ''}`,
        href: '/medicamentos',
        photo: s.animal.photo,
      })),
      action: { label: 'Abrir agenda de doses', href: '/medicamentos' },
    });

  const lateTasks = db.tasks.filter(isTaskOverdue).sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  if (lateTasks.length)
    alerts.push({
      id: 'tasks',
      severity: 'warning',
      title: `${lateTasks.length === 1 ? '1 tarefa passou' : `${lateTasks.length} tarefas passaram`} do prazo`,
      items: lateTasks.map((t) => {
        const a = db.animals.find((x) => x.id === t.animalId);
        return {
          id: t.id,
          label: t.title,
          detail: `Prazo ${daysFromToday(localDay(t.dueAt)) === 0 ? 'hoje' : `em ${localDay(t.dueAt).slice(8, 10)}/${localDay(t.dueAt).slice(5, 7)}`} às ${fmtTime(t.dueAt)}${a ? ` · ${a.name}` : ''}${t.assigneeId ? ` · ${userById(db, t.assigneeId)?.name ?? ''}` : ''}`,
          href: '/tarefas',
          photo: a?.photo,
        };
      }),
      action: { label: 'Abrir tarefas', href: '/tarefas' },
    });

  const losing = care
    .map((a) => ({ a, loss: weightLoss(weightsOf(db, a.id)) }))
    .filter((x) => x.loss && x.loss.pct >= WEIGHT_LOSS_ALERT && careIds.has(x.a.id));
  if (losing.length)
    alerts.push({
      id: 'weight',
      severity: 'warning',
      title: `${losing.length === 1 ? '1 animal perdeu' : `${losing.length} animais perderam`} 10% ou mais do peso em 30 dias`,
      items: losing.map(({ a, loss }) => ({
        id: a.id,
        label: a.name,
        detail: `${fmtKg(loss!.from.weightKg)} → ${fmtKg(loss!.to.weightKg)} (−${Math.round(loss!.pct * 100)}%)`,
        href: `/animais/${a.id}?aba=peso`,
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

  const rank: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2 };
  return alerts.sort((x, y) => rank[x.severity] - rank[y.severity]);
}
