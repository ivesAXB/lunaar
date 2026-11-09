import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, Check, ChevronLeft, ChevronRight, Search, UserPlus } from 'lucide-react';
import { useData } from '@/data/store';
import { peakOccupancy } from '@/data/selectors';
import type { BookingStatus, Client, ClientPet } from '@/data/types';
import { useToast } from '@/components/toast';
import { Button, ButtonLink, Choices, Field, Notice, PageHeader, Photo } from '@/components/ui';
import { fmtDate, fmtMoney, fmtWeekday, nightsBetween, normalize, todayIso } from '@/lib/format';
import { SIZE, SPECIES } from '@/lib/labels';
import { addDays, format } from 'date-fns';
import './boarding.css';

const STEPS = ['Pet', 'Período', 'Cuidados', 'Revisão'];

export function BookingNewPage() {
  const { db, actions } = useData();
  const navigate = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();
  const presetPet = db.pets.find((p) => p.id === params.get('pet'));

  const [step, setStep] = useState(presetPet ? 1 : 0);
  const [clientQuery, setClientQuery] = useState('');
  const [clientId, setClientId] = useState(presetPet?.clientId ?? '');
  const [petId, setPetId] = useState(presetPet?.id ?? '');
  const [checkIn, setCheckIn] = useState(todayIso());
  const [checkOut, setCheckOut] = useState(format(addDays(new Date(), 3), 'yyyy-MM-dd'));
  const [accommodationId, setAccommodationId] = useState('');
  const [specialNeeds, setSpecialNeeds] = useState(presetPet ? defaultNeeds(presetPet) : '');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<BookingStatus>('confirmada');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const client = db.clients.find((c) => c.id === clientId);
  const pets = db.pets.filter((p) => p.clientId === clientId);
  const pet = db.pets.find((p) => p.id === petId);
  const nights = nightsBetween(checkIn, checkOut);

  const accommodations = db.accommodations.map((a) => {
    const compatible = !pet || a.species === 'ambos' || a.species === pet.species;
    const used = checkIn && checkOut > checkIn ? peakOccupancy(db, a.id, checkIn, checkOut) : 0;
    return { ...a, compatible, free: Math.max(0, a.capacity - used) };
  });
  const acc = accommodations.find((a) => a.id === accommodationId);
  const total = acc ? acc.dailyRate * Math.max(1, nights) : 0;

  const clients = useMemo(() => {
    const term = normalize(clientQuery.trim());
    return db.clients
      .filter((c) => !term || normalize(`${c.name} ${c.cpf} ${c.phone} ${c.whatsapp ?? ''}`).includes(term) || db.pets.some((p) => p.clientId === c.id && normalize(p.name).includes(term)))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 8);
  }, [db, clientQuery]);

  const validateStep = (s: number) => {
    const e: Record<string, string> = {};
    if (s === 0) {
      if (!clientId) e.client = 'Selecione o cliente (tutor).';
      else if (!petId) e.pet = 'Selecione qual pet será hospedado.';
    }
    if (s === 1) {
      if (!checkIn) e.checkIn = 'Informe a data de entrada.';
      else if (checkIn < todayIso()) e.checkIn = 'A entrada não pode ser no passado.';
      if (!checkOut) e.checkOut = 'Informe a data de saída.';
      else if (checkIn && checkOut <= checkIn) e.checkOut = 'A saída precisa ser depois da entrada.';
      if (!accommodationId) e.accommodation = 'Escolha a acomodação.';
      else if (acc && !acc.compatible) e.accommodation = `${acc.name} não recebe ${SPECIES[pet!.species].toLowerCase()}s.`;
      else if (acc && acc.free === 0) e.accommodation = `${acc.name} está lotada em algum dia desse período.`;
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => {
    if (!validateStep(step)) return;
    if (step === 0 && pet && !specialNeeds) setSpecialNeeds(defaultNeeds(pet));
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
    document.getElementById('page-title')?.focus();
  };

  const confirm = async () => {
    if (!validateStep(0) || !validateStep(1) || !pet || !acc) return;
    setSaving(true);
    try {
      const b = await actions.createBooking({
        petId: pet.id,
        accommodationId: acc.id,
        checkIn,
        checkOut,
        status,
        dailyRate: acc.dailyRate,
        specialNeeds: specialNeeds.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      toast(`Hospedagem ${b.code} criada para ${pet.name}.`);
      navigate(`/hospedagem/${b.id}`, { replace: true });
    } catch (err) {
      toast((err as Error).message, 'error');
      setSaving(false);
    }
  };

  return (
    <div className="page">
      <PageHeader back={{ to: '/hospedagem', label: 'Hospedagens' }} title="Nova hospedagem" />

      <ol className="stepper" aria-label="Etapas">
        {STEPS.map((label, i) => (
          <li key={label} data-state={i < step ? 'done' : i === step ? 'current' : 'todo'} aria-current={i === step ? 'step' : undefined}>
            <span className="stepper__n">{i < step ? <Check aria-hidden /> : i + 1}</span>
            <span className="stepper__label">{label}</span>
          </li>
        ))}
      </ol>

      <div className="wizard">
        <div className="wizard__main">
          {step === 0 && (
            <section aria-labelledby="s0">
              <h2 id="s0" className="wizard__title">
                Quem vai se hospedar?
              </h2>
              <Field label="Cliente (tutor)" error={errors.client} htmlFor="client-search">
                {(p) => (
                  <div className="input-group">
                    <Search aria-hidden />
                    <input {...p} className="input" type="search" placeholder="Nome, CPF, telefone ou nome do pet" value={clientQuery} onChange={(e) => setClientQuery(e.target.value)} />
                  </div>
                )}
              </Field>
              <ul className="pick-list" role="radiogroup" aria-label="Clientes">
                {clients.map((c) => (
                  <ClientOption
                    key={c.id}
                    client={c}
                    pets={db.pets.filter((p) => p.clientId === c.id)}
                    selected={c.id === clientId}
                    onSelect={() => {
                      setClientId(c.id);
                      const own = db.pets.filter((p) => p.clientId === c.id);
                      setPetId(own.length === 1 ? own[0].id : '');
                      setErrors({});
                    }}
                  />
                ))}
                {clients.length === 0 && <li className="muted" style={{ padding: '12px 0' }}>Nenhum cliente encontrado.</li>}
              </ul>
              <ButtonLink to="/clientes/novo" size="sm" variant="ghost" icon={<UserPlus aria-hidden />}>
                Cadastrar novo cliente
              </ButtonLink>

              {client && (
                <div style={{ marginTop: 'var(--sp-8)' }}>
                  <h3 className="wizard__subtitle">Pets de {client.name.split(' ')[0]}</h3>
                  {pets.length === 0 ? (
                    <Notice tone="neutral">
                      Este cliente ainda não tem pets cadastrados.{' '}
                      <Link className="link" style={{ color: 'inherit' }} to={`/clientes/${client.id}/pets/novo`}>
                        Cadastrar pet
                      </Link>
                    </Notice>
                  ) : (
                    <div className="pet-options" role="radiogroup" aria-label="Pet">
                      {pets.map((p) => (
                        <label key={p.id} className="pet-option">
                          <input type="radio" name="pet" checked={petId === p.id} onChange={() => (setPetId(p.id), setErrors({}))} />
                          <Photo src={p.photo} alt="" name={p.name} ratio="1" />
                          <span>
                            <strong>{p.name}</strong>
                            <small>
                              {p.breed} · {SIZE[p.size].toLowerCase()}
                            </small>
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                  {errors.pet && <p className="field__error" role="alert" style={{ marginTop: 8 }}><AlertCircle aria-hidden />{errors.pet}</p>}
                </div>
              )}
            </section>
          )}

          {step === 1 && (
            <section aria-labelledby="s1">
              <h2 id="s1" className="wizard__title">
                Quando e onde?
              </h2>
              <div className="form-grid">
                <Field label="Entrada" required error={errors.checkIn} className="col-3 keep" hint={checkIn ? cap(fmtWeekday(checkIn)) : undefined}>
                  {(p) => <input {...p} type="date" className="input" min={todayIso()} value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />}
                </Field>
                <Field label="Saída" required error={errors.checkOut} className="col-3 keep" hint={checkOut && nights > 0 ? `${cap(fmtWeekday(checkOut))} · ${nights} ${nights === 1 ? 'noite' : 'noites'}` : undefined}>
                  {(p) => <input {...p} type="date" className="input" min={checkIn || todayIso()} value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />}
                </Field>
              </div>

              <fieldset className="acc-options">
                <legend className="field__label">Acomodação</legend>
                {accommodations.map((a) => {
                  const disabled = !a.compatible;
                  return (
                    <label key={a.id} className="acc-option" data-disabled={disabled || undefined}>
                      <input type="radio" name="acc" disabled={disabled} checked={accommodationId === a.id} onChange={() => (setAccommodationId(a.id), setErrors((e) => ({ ...e, accommodation: '' })))} />
                      <span className="acc-option__main">
                        <strong>{a.name}</strong>
                        <small>{a.description}</small>
                      </span>
                      <span className="acc-option__side">
                        <span className="tnum">{fmtMoney(a.dailyRate)}/dia</span>
                        <small className={a.free === 0 ? 'acc-full' : undefined}>
                          {disabled ? `Não recebe ${SPECIES[pet!.species].toLowerCase()}s` : a.free === 0 ? 'Lotado no período' : `${a.free} ${a.free === 1 ? 'vaga livre' : 'vagas livres'}`}
                        </small>
                      </span>
                    </label>
                  );
                })}
                {errors.accommodation && (
                  <p className="field__error" role="alert">
                    <AlertCircle aria-hidden />
                    {errors.accommodation}
                  </p>
                )}
              </fieldset>
            </section>
          )}

          {step === 2 && pet && (
            <section aria-labelledby="s2">
              <h2 id="s2" className="wizard__title">
                Cuidados com {pet.name}
              </h2>
              <div className="form-grid">
                <Field label="Necessidades especiais" optional hint="Medicamentos e horários, restrições, cuidados de saúde. Preenchido a partir do cadastro do pet.">
                  {(p) => <textarea {...p} className="textarea" rows={4} value={specialNeeds} onChange={(e) => setSpecialNeeds(e.target.value)} />}
                </Field>
                <Field label="Observações" optional hint="Ex.: buscará às 18h, trará a própria ração, autoriza banho.">
                  {(p) => <textarea {...p} className="textarea" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />}
                </Field>
                <Choices
                  legend="Situação inicial"
                  name="status"
                  value={status}
                  onChange={setStatus}
                  options={[
                    { value: 'confirmada', label: 'Confirmada com o tutor' },
                    { value: 'reserva', label: 'Reserva (aguardando confirmação)' },
                  ]}
                />
              </div>
            </section>
          )}

          {step === 3 && pet && client && acc && (
            <section aria-labelledby="s3">
              <h2 id="s3" className="wizard__title">
                Confira antes de confirmar
              </h2>
              <div className="review">
                <div className="review__pet">
                  <Photo src={pet.photo} alt={`Foto de ${pet.name}`} name={pet.name} size={88} />
                  <div>
                    <p className="review__name">{pet.name}</p>
                    <p className="muted">
                      {SPECIES[pet.species]} · {pet.breed} · {SIZE[pet.size].toLowerCase()}
                    </p>
                    <p>Tutor(a): {client.name}</p>
                  </div>
                </div>
                <dl className="kv kv--rows">
                  <div>
                    <dt>Entrada</dt>
                    <dd>
                      {fmtDate(checkIn)} · {fmtWeekday(checkIn)}
                    </dd>
                  </div>
                  <div>
                    <dt>Saída</dt>
                    <dd>
                      {fmtDate(checkOut)} · {fmtWeekday(checkOut)}
                    </dd>
                  </div>
                  <div>
                    <dt>Acomodação</dt>
                    <dd>{acc.name}</dd>
                  </div>
                  <div>
                    <dt>Necessidades especiais</dt>
                    <dd className={specialNeeds ? undefined : 'is-empty'}>{specialNeeds || 'Nenhuma'}</dd>
                  </div>
                  <div>
                    <dt>Observações</dt>
                    <dd className={notes ? undefined : 'is-empty'}>{notes || 'Nenhuma'}</dd>
                  </div>
                  <div>
                    <dt>Situação</dt>
                    <dd>{status === 'confirmada' ? 'Confirmada' : 'Reserva (aguardando confirmação)'}</dd>
                  </div>
                </dl>
                <div className="review__total">
                  <span>
                    {nights} {nights === 1 ? 'diária' : 'diárias'} × {fmtMoney(acc.dailyRate)}
                  </span>
                  <strong className="tnum">{fmtMoney(total)}</strong>
                </div>
                <p className="muted" style={{ fontSize: 'var(--fs-sm)' }}>
                  Valor estimado. O valor final é registrado no check-out (extras como banho entram lá).
                </p>
              </div>
            </section>
          )}

          <div className="form-actions">
            {step > 0 ? (
              <Button icon={<ChevronLeft aria-hidden />} onClick={() => setStep((s) => s - 1)} disabled={saving}>
                Voltar
              </Button>
            ) : (
              <Button onClick={() => navigate(-1)}>Cancelar</Button>
            )}
            {step < STEPS.length - 1 ? (
              <Button variant="dark" onClick={next}>
                Continuar <ChevronRight aria-hidden />
              </Button>
            ) : (
              <Button variant="primary" icon={<Check aria-hidden />} onClick={confirm} loading={saving}>
                Confirmar hospedagem
              </Button>
            )}
          </div>
        </div>

        {step < 3 && (
          <aside className="wizard__summary" aria-label="Resumo">
            <p className="wizard__summary-title">Resumo</p>
            {pet ? (
              <div className="summary-pet">
                <Photo src={pet.photo} alt="" name={pet.name} size={48} round />
                <div>
                  <strong>{pet.name}</strong>
                  <small>{client?.name}</small>
                </div>
              </div>
            ) : (
              <p className="muted">Escolha o cliente e o pet.</p>
            )}
            {step >= 1 && (
              <dl className="summary-list">
                <div>
                  <dt>Período</dt>
                  <dd className="tnum">{checkIn && checkOut > checkIn ? `${fmtDate(checkIn, 'dd/MM')} → ${fmtDate(checkOut, 'dd/MM')} · ${nights}n` : '—'}</dd>
                </div>
                <div>
                  <dt>Acomodação</dt>
                  <dd>{acc?.name ?? '—'}</dd>
                </div>
                <div>
                  <dt>Estimado</dt>
                  <dd className="tnum">{acc && nights > 0 ? fmtMoney(total) : '—'}</dd>
                </div>
              </dl>
            )}
            {pet && (pet.medications || pet.allergies) && (
              <p className="summary-warn">
                <AlertCircle aria-hidden />
                <span>{[pet.medications && `Medicação: ${pet.medications}`, pet.allergies && `Alergia: ${pet.allergies}`].filter(Boolean).join(' · ')}</span>
              </p>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}

function ClientOption({ client, pets, selected, onSelect }: { client: Client; pets: ClientPet[]; selected: boolean; onSelect: () => void }) {
  return (
    <li>
      <label className="pick" data-selected={selected || undefined}>
        <input type="radio" name="client" checked={selected} onChange={onSelect} />
        <span className="pick__main">
          <strong>{client.name}</strong>
          <small>
            {client.whatsapp ?? client.phone} · {pets.length ? pets.map((p) => p.name).join(', ') : 'sem pets'}
          </small>
        </span>
        {selected && <Check aria-hidden className="pick__check" />}
      </label>
    </li>
  );
}

function defaultNeeds(p: ClientPet) {
  return [p.medications && `Medicação: ${p.medications}`, p.allergies && `Alergia: ${p.allergies}`, p.feeding && `Alimentação: ${p.feeding}`].filter(Boolean).join('\n');
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
