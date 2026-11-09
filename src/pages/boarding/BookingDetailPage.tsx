import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowDownRight, ArrowUpRight, Check, CheckCircle2, MessageCircle, Phone, Mail, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { useData, useMe } from '@/data/store';
import { accommodationById, bookingView, userById, type BookingView } from '@/data/selectors';
import type { PetCondition } from '@/data/types';
import { useToast } from '@/components/toast';
import { BookingStatusTag, Button, Choices, ConfirmDialog, Dialog, Field, Notice, Photo, SectionLabel, Skeleton, Tag } from '@/components/ui';
import { fmtDate, fmtDateTime, fmtMoney, fmtWeekday, nightsBetween, todayIso, whatsappLink } from '@/lib/format';
import { BOOKING_STATUS, CHECKIN_ITEMS, CONDITION, SEX, SPECIES } from '@/lib/labels';
import { NotFoundPage } from '../NotFoundPage';
import './boarding.css';
import '../animals/profile.css';

const FLOW = ['reserva', 'confirmada', 'hospedado', 'finalizada'] as const;

export function BookingDetailPage() {
  const { id } = useParams();
  const { db, ready, actions } = useData();
  const toast = useToast();
  const [dialog, setDialog] = useState<'checkin' | 'checkout' | 'cancel' | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const raw = db.bookings.find((b) => b.id === id);
  const b = raw && bookingView(db, raw);
  if (!b) return ready ? <NotFoundPage what="Hospedagem" back="/hospedagem" /> : <div className="page"><Skeleton h={300} /></div>;

  const acc = accommodationById(db, b.accommodationId);
  const checkin = db.checkins.find((c) => c.bookingId === b.id);
  const checkout = db.checkouts.find((c) => c.bookingId === b.id);
  const today = todayIso();
  const step = BOOKING_STATUS[b.status].step;
  const open = ['reserva', 'confirmada', 'hospedado'].includes(b.status);

  const primary =
    b.status === 'reserva' ? (
      <Button
        variant="dark"
        icon={<Check aria-hidden />}
        loading={confirming}
        onClick={async () => {
          setConfirming(true);
          await actions.updateBooking(b.id, { status: 'confirmada' });
          setConfirming(false);
          toast('Reserva confirmada.');
        }}
      >
        Confirmar reserva
      </Button>
    ) : b.status === 'confirmada' ? (
      <Button variant="primary" icon={<ArrowDownRight aria-hidden />} onClick={() => setDialog('checkin')}>
        Fazer check-in
      </Button>
    ) : b.status === 'hospedado' ? (
      <Button variant="primary" icon={<ArrowUpRight aria-hidden />} onClick={() => setDialog('checkout')}>
        Fazer check-out
      </Button>
    ) : null;

  return (
    <div className="page">
      <div className="profile__crumbs">
        <Link to="/hospedagem">Hospedagens</Link>
        <span aria-hidden>/</span>
        <span>{b.code}</span>
      </div>

      <header className="booking-head">
        <Photo src={b.pet.photo} alt={`Foto de ${b.pet.name}`} name={b.pet.name} size={88} />
        <div className="booking-head__text">
          <p className="profile__kicker">
            Hospedagem {b.code} · {acc?.name}
          </p>
          <h1 className="page-title" id="page-title" tabIndex={-1}>
            {b.pet.name}
          </h1>
          <div className="profile__status">
            <BookingStatusTag status={b.status} />
            {b.status === 'hospedado' && b.checkOut < today && <Tag tone="red">Saída atrasada</Tag>}
            {b.status === 'hospedado' && b.checkOut === today && <Tag tone="amber">Sai hoje</Tag>}
            {b.status === 'confirmada' && b.checkIn === today && <Tag tone="green">Chega hoje</Tag>}
          </div>
        </div>
        <div className="booking-head__actions">
          {open && (
            <Button variant="danger-ghost" icon={<XCircle aria-hidden />} onClick={() => setDialog('cancel')}>
              Cancelar
            </Button>
          )}
          {primary}
        </div>
      </header>

      {b.status !== 'cancelada' ? (
        <ol className="stepper booking-flow" aria-label="Andamento da hospedagem">
          {FLOW.map((s, i) => (
            <li key={s} data-state={i < step ? 'done' : i === step ? (s === 'finalizada' ? 'done' : 'current') : 'todo'} aria-current={i === step ? 'step' : undefined}>
              <span className="stepper__n">{i < step || s === 'finalizada' && i === step ? <Check aria-hidden /> : i + 1}</span>
              <span className="stepper__label">{BOOKING_STATUS[s].label}</span>
            </li>
          ))}
        </ol>
      ) : (
        <Notice tone="red">
          <strong>Hospedagem cancelada.</strong> {b.cancelReason}
        </Notice>
      )}

      <div className="booking-grid">
        <div className="stack-lg">
          <section aria-labelledby="b-period">
            <SectionLabel id="b-period">Período</SectionLabel>
            <div className="period">
              <div>
                <span className="period__label">Entrada</span>
                <span className="period__date tnum">{fmtDate(b.checkIn, 'dd/MM')}</span>
                <span className="muted">{fmtWeekday(b.checkIn)}</span>
              </div>
              <div className="period__line" aria-hidden>
                <span>
                  {b.nights} {b.nights === 1 ? 'noite' : 'noites'}
                </span>
              </div>
              <div>
                <span className="period__label">Saída</span>
                <span className="period__date tnum">{fmtDate(b.checkOut, 'dd/MM')}</span>
                <span className="muted">{fmtWeekday(b.checkOut)}</span>
              </div>
            </div>
            <dl className="kv kv--rows">
              <KV label="Acomodação">{acc ? `${acc.name} · ${fmtMoney(b.dailyRate)}/dia` : undefined}</KV>
              <KV label={checkout ? 'Valor final' : 'Valor estimado'}>
                <span className="tnum">{fmtMoney(checkout?.finalValue ?? b.estimated)}</span>
              </KV>
              <KV label="Necessidades especiais">{b.specialNeeds}</KV>
              <KV label="Observações">{b.notes}</KV>
              <KV label="Criada em">{fmtDateTime(b.createdAt)}</KV>
            </dl>
          </section>

          {checkin && (
            <section aria-labelledby="b-in">
              <SectionLabel id="b-in">Check-in</SectionLabel>
              <dl className="kv kv--rows">
                <KV label="Horário">{fmtDateTime(checkin.at)}</KV>
                <KV label="Recebido por">{userById(db, checkin.userId)?.name}</KV>
                <KV label="Condição do animal">
                  <Tag tone={CONDITION[checkin.condition].tone} dot>
                    {CONDITION[checkin.condition].label}
                  </Tag>
                  {checkin.conditionNotes && <span className="kv-note">{checkin.conditionNotes}</span>}
                </KV>
                <KV label="Itens entregues">{checkin.items.length ? checkin.items.join(', ') : undefined}</KV>
                <KV label="Alimentação">{checkin.feeding}</KV>
                <KV label="Medicamentos">{checkin.medications}</KV>
                <KV label="Observações">{checkin.notes}</KV>
              </dl>
            </section>
          )}

          {checkout && (
            <section aria-labelledby="b-out">
              <SectionLabel id="b-out">Check-out</SectionLabel>
              <dl className="kv kv--rows">
                <KV label="Horário">{fmtDateTime(checkout.at)}</KV>
                <KV label="Entregue por">{userById(db, checkout.userId)?.name}</KV>
                <KV label="Condição do animal">
                  <Tag tone={CONDITION[checkout.condition].tone} dot>
                    {CONDITION[checkout.condition].label}
                  </Tag>
                  {checkout.conditionNotes && <span className="kv-note">{checkout.conditionNotes}</span>}
                </KV>
                <KV label="Pendências">{checkout.pendencies}</KV>
                <KV label="Observações">{checkout.notes}</KV>
                <KV label="Valor final">
                  <strong className="tnum">{fmtMoney(checkout.finalValue)}</strong>
                </KV>
              </dl>
            </section>
          )}
        </div>

        <aside className="stack-lg">
          <section aria-labelledby="b-pet">
            <SectionLabel id="b-pet" action={<Link to={`/pets/${b.pet.id}`}>Ficha do pet</Link>}>
              Pet
            </SectionLabel>
            <p className="muted" style={{ marginBottom: 8 }}>
              {SPECIES[b.pet.species]} · {b.pet.breed} · {SEX[b.pet.sex]}
              {b.pet.ageYears != null && ` · ${b.pet.ageYears} anos`}
            </p>
            <dl className="kv kv--rows kv--compact">
              <KV label="Alimentação">{b.pet.feeding}</KV>
              <KV label="Medicamentos">{b.pet.medications}</KV>
              <KV label="Alergias">{b.pet.allergies}</KV>
              <KV label="Comportamento">{b.pet.behavior}</KV>
              <KV label="Vacinas">{b.pet.vaccines}</KV>
            </dl>
          </section>

          <section aria-labelledby="b-client">
            <SectionLabel id="b-client" action={<Link to={`/clientes/${b.client.id}`}>Ver cliente</Link>}>
              Tutor(a)
            </SectionLabel>
            <p className="client-name">{b.client.name}</p>
            <ul className="contact-list">
              {b.client.whatsapp && (
                <li>
                  <a href={whatsappLink(b.client.whatsapp)} target="_blank" rel="noreferrer" className="link-plain">
                    <MessageCircle aria-hidden /> WhatsApp {b.client.whatsapp}
                  </a>
                </li>
              )}
              <li>
                <a href={`tel:${b.client.phone.replace(/\D/g, '')}`} className="link-plain">
                  <Phone aria-hidden /> {b.client.phone}
                </a>
              </li>
              {b.client.email && (
                <li>
                  <a href={`mailto:${b.client.email}`} className="link-plain">
                    <Mail aria-hidden /> {b.client.email}
                  </a>
                </li>
              )}
            </ul>
          </section>
        </aside>
      </div>

      {dialog === 'checkin' && <CheckinDialog booking={b} onClose={() => setDialog(null)} />}
      {dialog === 'checkout' && <CheckoutDialog booking={b} onClose={() => setDialog(null)} />}
      <ConfirmDialog
        open={dialog === 'cancel'}
        onClose={() => setDialog(null)}
        title={`Cancelar hospedagem ${b.code}?`}
        description={`A vaga de ${b.pet.name} será liberada. A hospedagem continua no histórico como cancelada.`}
        confirmLabel="Cancelar hospedagem"
        onConfirm={async () => {
          await actions.updateBooking(b.id, { status: 'cancelada', cancelReason: cancelReason.trim() || undefined });
          toast('Hospedagem cancelada.');
        }}
      >
        <Field label="Motivo" optional>
          {(p) => <input {...p} className="input" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Ex.: tutor desistiu da viagem" />}
        </Field>
      </ConfirmDialog>
    </div>
  );
}

function KV({ label, children }: { label: string; children?: ReactNode }) {
  const empty = children == null || children === '';
  return (
    <div>
      <dt>{label}</dt>
      <dd className={empty ? 'is-empty' : undefined}>{empty ? '—' : children}</dd>
    </div>
  );
}

const nowLocal = () => format(new Date(), "yyyy-MM-dd'T'HH:mm");

function StaffSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { db } = useData();
  return (
    <Field label="Responsável" required className="col-3">
      {(p) => (
        <select {...p} className="select" value={value} onChange={(e) => onChange(e.target.value)}>
          {db.users
            .filter((u) => u.active)
            .map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
        </select>
      )}
    </Field>
  );
}

function CheckinDialog({ booking: b, onClose }: { booking: BookingView; onClose: () => void }) {
  const { actions } = useData();
  const user = useMe();
  const toast = useToast();
  const [at, setAt] = useState(nowLocal());
  const [userId, setUserId] = useState(user?.id ?? '');
  const [condition, setCondition] = useState<PetCondition>('boa');
  const [conditionNotes, setConditionNotes] = useState('');
  const [items, setItems] = useState<string[]>(['Coleira', 'Guia']);
  const [otherItem, setOtherItem] = useState('');
  const [feeding, setFeeding] = useState(b.pet.feeding ?? '');
  const [medications, setMedications] = useState(b.pet.medications ?? '');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const early = b.checkIn > todayIso();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (condition === 'atencao' && !conditionNotes.trim()) {
      setError('Descreva o que chamou atenção (ferimento, apatia, pulgas…).');
      document.getElementById('ci-cond-notes')?.focus();
      return;
    }
    setBusy(true);
    await actions.checkIn({
      bookingId: b.id,
      at: new Date(at).toISOString(),
      userId,
      condition,
      conditionNotes: conditionNotes.trim() || undefined,
      items: [...items, ...otherItem.split(',').map((s) => s.trim()).filter(Boolean)],
      feeding: feeding.trim() || undefined,
      medications: medications.trim() || undefined,
      notes: notes.trim() || undefined,
    });
    toast(`Check-in de ${b.pet.name} registrado.`);
    onClose();
  };

  return (
    <Dialog
      open
      wide
      busy={busy}
      onClose={onClose}
      title={`Check-in de ${b.pet.name}`}
      description={`${b.client.name} · saída prevista ${fmtDate(b.checkOut)}`}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Voltar
          </Button>
          <Button type="submit" form="checkin-form" variant="primary" icon={<CheckCircle2 aria-hidden />} loading={busy}>
            Registrar entrada
          </Button>
        </>
      }
    >
      <form id="checkin-form" className="form-grid" onSubmit={submit} noValidate>
        {early && (
          <Notice tone="amber">
            A entrada estava prevista para {fmtDate(b.checkIn)}. Confira se o período continua correto.
          </Notice>
        )}
        <Field label="Horário de entrada" required className="col-3">
          {(p) => <input {...p} data-autofocus type="datetime-local" className="input" value={at} onChange={(e) => setAt(e.target.value)} />}
        </Field>
        <StaffSelect value={userId} onChange={setUserId} />
        <Choices legend="Condição do animal na chegada" name="ci-cond" value={condition} onChange={setCondition} options={Object.entries(CONDITION).map(([v, c]) => ({ value: v as PetCondition, label: c.label }))} />
        <Field label="Detalhes da condição" required={condition === 'atencao'} optional={condition !== 'atencao'} error={error} htmlFor="ci-cond-notes">
          {(p) => <input {...p} className="input" value={conditionNotes} onChange={(e) => (setConditionNotes(e.target.value), setError(''))} placeholder="Ex.: pequena ferida na pata dianteira esquerda" />}
        </Field>
        <fieldset className="field" style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
          <legend className="field__label" style={{ padding: 0, marginBottom: 6 }}>
            Itens entregues
          </legend>
          <div className="choices">
            {CHECKIN_ITEMS.map((item) => (
              <label key={item} className="choice">
                <input type="checkbox" checked={items.includes(item)} onChange={(e) => setItems((list) => (e.target.checked ? [...list, item] : list.filter((i) => i !== item)))} />
                <span>{item}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <Field label="Outros itens" optional hint="Separe por vírgula.">
          {(p) => <input {...p} className="input" value={otherItem} onChange={(e) => setOtherItem(e.target.value)} />}
        </Field>
        <Field label="Alimentação" optional className="col-3">
          {(p) => <textarea {...p} className="textarea" rows={2} value={feeding} onChange={(e) => setFeeding(e.target.value)} />}
        </Field>
        <Field label="Medicamentos" optional className="col-3">
          {(p) => <textarea {...p} className="textarea" rows={2} value={medications} onChange={(e) => setMedications(e.target.value)} />}
        </Field>
        <Field label="Observações" optional>
          {(p) => <textarea {...p} className="textarea" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />}
        </Field>
      </form>
    </Dialog>
  );
}

function CheckoutDialog({ booking: b, onClose }: { booking: BookingView; onClose: () => void }) {
  const { actions } = useData();
  const user = useMe();
  const toast = useToast();
  const [at, setAt] = useState(nowLocal());
  const [userId, setUserId] = useState(user?.id ?? '');
  const [condition, setCondition] = useState<PetCondition>('boa');
  const [conditionNotes, setConditionNotes] = useState('');
  const [pendencies, setPendencies] = useState('');
  const [notes, setNotes] = useState('');
  const realNights = Math.max(1, nightsBetween(b.checkIn, at.slice(0, 10)));
  const [value, setValue] = useState(String(realNights * b.dailyRate).replace('.', ','));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    const num = Number(value.replace(/\./g, '').replace(',', '.'));
    if (value.trim() === '' || Number.isNaN(num) || num < 0) next.value = 'Informe o valor final (use 0 se não houver cobrança).';
    if (condition === 'atencao' && !conditionNotes.trim()) next.cond = 'Descreva o que o tutor precisa saber.';
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    await actions.checkOut({
      bookingId: b.id,
      at: new Date(at).toISOString(),
      userId,
      condition,
      conditionNotes: conditionNotes.trim() || undefined,
      pendencies: pendencies.trim() || undefined,
      notes: notes.trim() || undefined,
      finalValue: num,
    });
    toast(`Check-out de ${b.pet.name} registrado.`);
    onClose();
  };

  return (
    <Dialog
      open
      wide
      busy={busy}
      onClose={onClose}
      title={`Check-out de ${b.pet.name}`}
      description={`Entregar para ${b.client.name}`}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Voltar
          </Button>
          <Button type="submit" form="checkout-form" variant="primary" icon={<CheckCircle2 aria-hidden />} loading={busy}>
            Finalizar hospedagem
          </Button>
        </>
      }
    >
      <form id="checkout-form" className="form-grid" onSubmit={submit} noValidate>
        <Field label="Horário de saída" required className="col-3">
          {(p) => <input {...p} data-autofocus type="datetime-local" className="input" value={at} onChange={(e) => setAt(e.target.value)} />}
        </Field>
        <StaffSelect value={userId} onChange={setUserId} />
        <Choices legend="Condição do animal na saída" name="co-cond" value={condition} onChange={setCondition} options={Object.entries(CONDITION).map(([v, c]) => ({ value: v as PetCondition, label: c.label }))} />
        <Field label="Detalhes da condição" optional={condition !== 'atencao'} required={condition === 'atencao'} error={errors.cond}>
          {(p) => <input {...p} className="input" value={conditionNotes} onChange={(e) => setConditionNotes(e.target.value)} />}
        </Field>
        <Field label="Pendências" optional hint="Ex.: tutor ficou de trazer a guia esquecida; pagamento parcial.">
          {(p) => <textarea {...p} className="textarea" rows={2} value={pendencies} onChange={(e) => setPendencies(e.target.value)} />}
        </Field>
        <Field label="Observações" optional>
          {(p) => <textarea {...p} className="textarea" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />}
        </Field>
        <Field
          label="Valor final"
          required
          error={errors.value}
          className="col-3"
          hint={`${realNights} ${realNights === 1 ? 'diária' : 'diárias'} × ${fmtMoney(b.dailyRate)} = ${fmtMoney(realNights * b.dailyRate)}. Some extras aqui.`}
        >
          {(p) => (
            <div className="input-affix" style={{ flexDirection: 'row-reverse' }}>
              <input {...p} className="input" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} style={{ borderRadius: '0 var(--r-sm) var(--r-sm) 0' }} />
              <span className="input-affix__unit" style={{ borderLeft: '1px solid var(--line-strong)', borderRight: 0, borderRadius: 'var(--r-sm) 0 0 var(--r-sm)' }}>
                R$
              </span>
            </div>
          )}
        </Field>
      </form>
    </Dialog>
  );
}
