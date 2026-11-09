import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Check,
  CheckCircle2,
  Circle,
  FilePlus2,
  HeartHandshake,
  MoreHorizontal,
  Pencil,
  Phone,
  Plus,
  Repeat2,
  Syringe,
  Trash2,
} from 'lucide-react';
import { useData } from '@/data/store';
import { kennelById, latestDoses, missingInfo, userById, vaccineDue } from '@/data/selectors';
import type { Animal, Kennel } from '@/data/types';
import { useToast } from '@/components/toast';
import {
  AnimalStatusTag,
  Button,
  ButtonLink,
  ConfirmDialog,
  EmptyState,
  MenuButton,
  Notice,
  Photo,
  SectionLabel,
  Skeleton,
  Tag,
} from '@/components/ui';
import { ageInMonths, daysFromToday, fmtAge, fmtDate, fmtDateTime, fmtKg, fmtRelativeDay, plural, whatsappLink } from '@/lib/format';
import { EVENT_TYPE, HEALTH_RECORD, ORIGIN, SEX, SIZE, SPECIES, TREATMENT_STATUS } from '@/lib/labels';
import { kennelName, kennelShort, kennelTag } from '@/lib/kennel';
import { AdoptionDialog, RecordDialog, StatusDialog, TreatmentDialog, VaccineDialog } from './AnimalDialogs';
import { NotFoundPage } from '../NotFoundPage';
import './profile.css';

const TABS = [
  { key: 'geral', label: 'Geral' },
  { key: 'saude', label: 'Saúde' },
  { key: 'historico', label: 'Histórico' },
  { key: 'adocao', label: 'Adoção' },
] as const;
type TabKey = (typeof TABS)[number]['key'];
type DialogKey = 'status' | 'treatment' | 'vaccine' | 'record' | 'adoption' | 'delete' | null;

export function AnimalProfilePage() {
  const { id } = useParams();
  const { db, ready, actions } = useData();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [dialog, setDialog] = useState<DialogKey>(null);

  const animal = db.animals.find((a) => a.id === id);
  if (!animal) return ready ? <NotFoundPage what="Animal" back="/animais" /> : <ProfileSkeleton />;

  const tab = (TABS.find((t) => t.key === params.get('aba'))?.key ?? 'geral') as TabKey;
  const kennel = kennelById(db, animal.kennelId);
  const responsible = userById(db, animal.responsibleId);
  const months = ageInMonths(animal.birthDate, animal.ageApproxMonths);
  const daysIn = -daysFromToday(animal.intakeDate);
  const treatments = db.treatments.filter((t) => t.animalId === animal.id);
  const openTreatments = treatments.filter((t) => t.status !== 'concluido');
  const dueVaccines = vaccineDue(db, animal.id);
  const missing = missingInfo(animal);
  const close = () => setDialog(null);

  const facts: [string, ReactNode][] = [
    ['Espécie', SPECIES[animal.species]],
    ['Sexo', `${SEX[animal.sex]}${animal.neutered ? ' · castrado' : ''}`],
    ['Idade', `${fmtAge(months, !animal.birthDate)}${animal.birthDate ? ` (${fmtDate(animal.birthDate)})` : ''}`],
    ['Porte', SIZE[animal.size]],
    ['Peso', fmtKg(animal.weightKg)],
    ['Cor', animal.color],
  ];

  return (
    <div className="page profile">
      <div className="profile__crumbs">
        <Link to="/animais">Animais</Link>
        <span aria-hidden>/</span>
        <span>{animal.name}</span>
      </div>

      <div className="profile__layout">
        <aside className="profile__aside">
          <Photo src={animal.photo} alt={`Foto de ${animal.name}`} name={animal.name} ratio="4 / 5" className="profile__photo" eager>
            {kennel && <span className="kennel-tag">{kennelTag(kennel)}</span>}
          </Photo>
          {!animal.photo && (
            <Link to={`/animais/${animal.id}/editar#foto`} className="link profile__add-photo">
              Adicionar foto
            </Link>
          )}
        </aside>

        <div className="profile__main">
          <header className="profile__header">
            <div>
              <p className="profile__kicker">
                {SPECIES[animal.species]} · {animal.breed}
              </p>
              <h1 className="profile__name" id="page-title" tabIndex={-1}>
                {animal.name}
              </h1>
              <div className="profile__status">
                <AnimalStatusTag status={animal.status} />
                <span className="muted">
                  {animal.status === 'adotado' && animal.adoption
                    ? `Adotado ${fmtRelativeDay(animal.adoption.date)}`
                    : `${plural(daysIn, 'dia', 'dias')} na LUNAAR${kennel ? ` · ${kennelShort(kennel)}` : ''}`}
                </span>
              </div>
            </div>
            <div className="profile__actions">
              {animal.status !== 'adotado' && (
                <Button icon={<Repeat2 aria-hidden />} onClick={() => setDialog('status')}>
                  Alterar situação
                </Button>
              )}
              <ButtonLink to={`/animais/${animal.id}/editar`} icon={<Pencil aria-hidden />}>
                Editar
              </ButtonLink>
              <MenuButton label="Mais ações" icon={<MoreHorizontal aria-hidden />}>
                {(closeMenu) => (
                  <>
                    <button type="button" role="menuitem" onClick={() => (closeMenu(), setDialog('record'))}>
                      <FilePlus2 aria-hidden /> Registro clínico
                    </button>
                    <button type="button" role="menuitem" onClick={() => (closeMenu(), setDialog('vaccine'))}>
                      <Syringe aria-hidden /> Registrar vacina
                    </button>
                    <hr />
                    <button type="button" role="menuitem" className="menu__danger" onClick={() => (closeMenu(), setDialog('delete'))}>
                      <Trash2 aria-hidden /> Excluir cadastro
                    </button>
                  </>
                )}
              </MenuButton>
            </div>
          </header>

          <dl className="profile__facts">
            {facts.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>

          <nav className="tabs profile__tabs" role="tablist" aria-label="Seções do prontuário">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={tab === t.key}
                aria-controls={`panel-${t.key}`}
                id={`tab-${t.key}`}
                onClick={() => setParams(t.key === 'geral' ? {} : { aba: t.key }, { replace: true })}
              >
                {t.label}
                {t.key === 'saude' && openTreatments.length + dueVaccines.length > 0 && <span className="count">{openTreatments.length + dueVaccines.length}</span>}
              </button>
            ))}
          </nav>

          <section role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="profile__panel">
            {tab === 'geral' && (
              <GeneralTab animal={animal} missing={missing} kennel={kennel} responsible={responsible?.name} openTreatments={openTreatments.length} dueVaccines={dueVaccines.length} onTab={(k) => setParams({ aba: k }, { replace: true })} />
            )}
            {tab === 'saude' && <HealthTab animal={animal} onDialog={setDialog} />}
            {tab === 'historico' && <HistoryTab animal={animal} />}
            {tab === 'adocao' && <AdoptionTab animal={animal} missing={missing} openTreatments={openTreatments.length} onAdopt={() => setDialog('adoption')} />}
          </section>
        </div>
      </div>

      {dialog === 'status' && <StatusDialog open onClose={close} animal={animal} />}
      {dialog === 'treatment' && <TreatmentDialog open onClose={close} animal={animal} />}
      {dialog === 'vaccine' && <VaccineDialog open onClose={close} animal={animal} />}
      {dialog === 'record' && <RecordDialog open onClose={close} animal={animal} />}
      {dialog === 'adoption' && <AdoptionDialog open onClose={close} animal={animal} />}
      <ConfirmDialog
        open={dialog === 'delete'}
        onClose={close}
        title={`Excluir ${animal.name}?`}
        description="O cadastro, os registros de saúde e o histórico serão apagados. Esta ação não pode ser desfeita."
        confirmLabel="Excluir definitivamente"
        onConfirm={async () => {
          await actions.deleteAnimal(animal.id);
          toast(`Cadastro de ${animal.name} excluído.`);
          navigate('/animais', { replace: true });
        }}
      >
        {animal.status !== 'adotado' && (
          <Notice tone="amber">
            Se {animal.name} foi adotado(a) ou transferido(a), prefira <strong>registrar a adoção</strong> ou alterar a situação. Assim o histórico fica guardado.
          </Notice>
        )}
      </ConfirmDialog>
    </div>
  );
}

function GeneralTab({
  animal,
  missing,
  kennel,
  responsible,
  openTreatments,
  dueVaccines,
  onTab,
}: {
  animal: Animal;
  missing: string[];
  kennel?: Kennel;
  responsible?: string;
  openTreatments: number;
  dueVaccines: number;
  onTab: (k: TabKey) => void;
}) {
  return (
    <div className="stack-lg">
      {(animal.status === 'atencao' || openTreatments > 0 || dueVaccines > 0 || missing.length > 0) && (
        <div className="stack-sm">
          {animal.status === 'atencao' && animal.vetNotes && (
            <Notice tone="red">
              <strong>Atenção:</strong> {animal.vetNotes}
            </Notice>
          )}
          {(openTreatments > 0 || dueVaccines > 0) && (
            <Notice tone="amber">
              {openTreatments > 0 && `${plural(openTreatments, 'tratamento em aberto', 'tratamentos em aberto')}. `}
              {dueVaccines > 0 && `${plural(dueVaccines, 'vacina vencida ou vencendo', 'vacinas vencidas ou vencendo')}. `}
              <button type="button" className="link" style={{ background: 'none', border: 0, padding: 0, color: 'inherit' }} onClick={() => onTab('saude')}>
                Ver saúde
              </button>
            </Notice>
          )}
          {missing.length > 0 && (
            <Notice tone="neutral">
              Cadastro incompleto. Falta: {missing.join(', ')}.{' '}
              <Link to={`/animais/${animal.id}/editar`} className="link" style={{ color: 'inherit' }}>
                Completar
              </Link>
            </Notice>
          )}
        </div>
      )}

      {animal.temperament && (
        <div>
          <SectionLabel as="h3">Temperamento</SectionLabel>
          <p className="prose">{animal.temperament}</p>
        </div>
      )}

      <div>
        <SectionLabel as="h3">Na LUNAAR</SectionLabel>
        <dl className="kv kv--rows">
          <KV label="Entrada">{fmtDate(animal.intakeDate)}</KV>
          <KV label="Origem">
            {ORIGIN[animal.origin]}
            {animal.originNotes && <span className="kv-note">{animal.originNotes}</span>}
          </KV>
          {kennel ? (
            <>
              <KV label="Localização">{kennel.location}</KV>
              <KV label="Setor">{kennel.sector}</KV>
              <KV label="Ala">Ala {kennel.wing}</KV>
              <KV label="Canil">
                {kennelName(kennel)} <span className="kennel-tag" style={{ position: 'static', marginLeft: 8, verticalAlign: '1px' }}>{kennelTag(kennel)}</span>
                {kennel.notes && <span className="kv-note">{kennel.notes}</span>}
              </KV>
            </>
          ) : (
            <KV label="Localização">{animal.status === 'adotado' ? 'Com a família adotante' : undefined}</KV>
          )}
          <KV label="Responsável">{responsible}</KV>
          <KV label="Última consulta">{animal.lastVetVisit ? `${fmtDate(animal.lastVetVisit)} (${fmtRelativeDay(animal.lastVetVisit)})` : undefined}</KV>
        </dl>
      </div>
    </div>
  );
}

function KV({ label, children }: { label: string; children?: ReactNode }) {
  const empty = children == null || children === '';
  return (
    <div>
      <dt>{label}</dt>
      <dd className={empty ? 'is-empty' : undefined}>{empty ? 'Não informado' : children}</dd>
    </div>
  );
}

function HealthTab({ animal, onDialog }: { animal: Animal; onDialog: (d: DialogKey) => void }) {
  const { db, actions } = useData();
  const toast = useToast();
  const treatments = db.treatments.filter((t) => t.animalId === animal.id).sort((a, b) => (a.status === 'concluido' ? 1 : 0) - (b.status === 'concluido' ? 1 : 0) || b.startDate.localeCompare(a.startDate));
  const vaccines = db.vaccines.filter((v) => v.animalId === animal.id).sort((a, b) => b.date.localeCompare(a.date));
  const latest = new Set(latestDoses(db, animal.id).map((v) => v.id));
  const records = db.healthRecords.filter((h) => h.animalId === animal.id).sort((a, b) => b.date.localeCompare(a.date));
  const [busyId, setBusyId] = useState<string | null>(null);

  const setStatus = async (id: string, status: 'ativo' | 'concluido') => {
    setBusyId(id);
    await actions.setTreatmentStatus(id, status);
    setBusyId(null);
    toast(status === 'concluido' ? 'Tratamento concluído.' : 'Tratamento iniciado.');
  };

  return (
    <div className="stack-lg">
      <div>
        <SectionLabel as="h3">Resumo clínico</SectionLabel>
        <dl className="kv kv--rows">
          <KV label="Doenças">{animal.diseases}</KV>
          <KV label="Alergias">{animal.allergies}</KV>
          <KV label="Castração">{animal.neutered ? 'Castrado(a)' : 'Não castrado(a)'}</KV>
          <KV label="Observações veterinárias">{animal.vetNotes}</KV>
          <KV label="Última consulta">{animal.lastVetVisit && fmtDate(animal.lastVetVisit)}</KV>
        </dl>
      </div>

      <div>
        <SectionLabel
          as="h3"
          count={treatments.length}
          action={
            <button type="button" onClick={() => onDialog('treatment')}>
              <Plus size={14} aria-hidden style={{ verticalAlign: '-2px' }} /> Novo tratamento
            </button>
          }
        >
          Tratamentos
        </SectionLabel>
        {treatments.length === 0 ? (
          <p className="muted">Nenhum tratamento registrado.</p>
        ) : (
          <ul className="records">
            {treatments.map((t) => (
              <li key={t.id} className="record" data-done={t.status === 'concluido' || undefined}>
                <div className="record__main">
                  <div className="record__title">
                    <strong>{t.title}</strong>
                    <Tag tone={TREATMENT_STATUS[t.status].tone} dot>
                      {TREATMENT_STATUS[t.status].label}
                    </Tag>
                  </div>
                  {(t.medication || t.dosage) && (
                    <p>
                      {t.medication}
                      {t.medication && t.dosage && ' · '}
                      {t.dosage}
                    </p>
                  )}
                  <p className="record__meta">
                    {t.status === 'pendente' ? `Previsto para ${fmtDate(t.startDate)}` : `Desde ${fmtDate(t.startDate)}`}
                    {t.endDate && ` · até ${fmtDate(t.endDate)}`}
                    {t.vet && ` · ${t.vet}`}
                  </p>
                  {t.notes && <p className="record__notes">{t.notes}</p>}
                </div>
                {t.status !== 'concluido' && (
                  <div className="record__actions">
                    {t.status === 'pendente' && (
                      <Button size="sm" onClick={() => setStatus(t.id, 'ativo')} loading={busyId === t.id}>
                        Iniciar
                      </Button>
                    )}
                    {t.status === 'ativo' && (
                      <Button size="sm" icon={<Check aria-hidden />} onClick={() => setStatus(t.id, 'concluido')} loading={busyId === t.id}>
                        Concluir
                      </Button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <SectionLabel
          as="h3"
          count={vaccines.length}
          action={
            <span style={{ order: 3, display: 'inline-flex', gap: 16 }}>
              <Link to={`/animais/${animal.id}/editar#vacinas`}>Editar histórico</Link>
              <button type="button" onClick={() => onDialog('vaccine')}>
                <Plus size={14} aria-hidden style={{ verticalAlign: '-2px' }} /> Registrar vacina
              </button>
            </span>
          }
        >
          Histórico de vacinas
        </SectionLabel>
        {vaccines.length === 0 ? (
          <p className="muted">Nenhuma vacina registrada.</p>
        ) : (
          <div className="table-wrap">
            <table className="table table--stack">
              <thead>
                <tr>
                  <th scope="col">Vacina</th>
                  <th scope="col">Aplicação</th>
                  <th scope="col">Próxima dose</th>
                  <th scope="col">Responsável</th>
                </tr>
              </thead>
              <tbody>
                {vaccines.map((v) => {
                  const due = v.nextDue ? daysFromToday(v.nextDue) : null;
                  // Dose antiga já reforçada: mostra só a data, sem alerta.
                  const superseded = !latest.has(v.id);
                  return (
                    <tr key={v.id}>
                      <td data-primary>
                        <strong>{v.name}</strong>
                        {v.batch && <div className="cell-primary__sub">Lote {v.batch}</div>}
                      </td>
                      <td data-label="Aplicação" className="tnum">
                        {fmtDate(v.date)}
                      </td>
                      <td data-end>
                        {due == null ? (
                          <span className="muted">—</span>
                        ) : superseded ? (
                          <span className="muted tnum">{fmtDate(v.nextDue!)} · reforçada</span>
                        ) : due < 0 ? (
                          <Tag tone="red" dot>
                            Vencida em {fmtDate(v.nextDue!)}
                          </Tag>
                        ) : due <= 7 ? (
                          <Tag tone="amber" dot>
                            {due === 0 ? 'Vence hoje' : `Em ${due} dias`}
                          </Tag>
                        ) : (
                          <span className="tnum">{fmtDate(v.nextDue!)}</span>
                        )}
                      </td>
                      <td data-label="Responsável">{v.vet ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <SectionLabel
          as="h3"
          count={records.length}
          action={
            <button type="button" onClick={() => onDialog('record')}>
              <Plus size={14} aria-hidden style={{ verticalAlign: '-2px' }} /> Novo registro
            </button>
          }
        >
          Consultas e exames
        </SectionLabel>
        {records.length === 0 ? (
          <p className="muted">Nenhuma consulta ou exame registrado.</p>
        ) : (
          <ul className="records">
            {records.map((r) => (
              <li key={r.id} className="record">
                <div className="record__date tnum">{fmtDate(r.date)}</div>
                <div className="record__main">
                  <div className="record__title">
                    <span className="record__type">{HEALTH_RECORD[r.type]}</span>
                    <strong>{r.title}</strong>
                  </div>
                  {r.description && <p>{r.description}</p>}
                  {r.vet && <p className="record__meta">{r.vet}</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function HistoryTab({ animal }: { animal: Animal }) {
  const { db, actions } = useData();
  const toast = useToast();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const items = [
    // reverse(): em empates de horário, o evento registrado por último aparece primeiro
    ...db.events.filter((e) => e.animalId === animal.id).reverse().map((e) => ({ id: e.id, at: e.at, type: e.type as string, label: EVENT_TYPE[e.type], text: e.text, who: userById(db, e.userId)?.name })),
    ...db.healthRecords
      .filter((h) => h.animalId === animal.id)
      .map((h) => ({ id: h.id, at: `${h.date}T12:00:00`, type: 'saude', label: HEALTH_RECORD[h.type], text: h.title, who: h.vet })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!note.trim()) {
      setError('Escreva a anotação antes de salvar.');
      return;
    }
    setError('');
    setBusy(true);
    await actions.addAnimalNote(animal.id, note.trim());
    setBusy(false);
    setNote('');
    toast('Anotação adicionada ao histórico.');
  };

  return (
    <div className="stack-lg">
      <form onSubmit={submit} className="note-form" noValidate>
        <label htmlFor="note" className="field__label">
          Nova anotação
        </label>
        <textarea
          id="note"
          className="textarea"
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Ex.: Passeou bem, comeu toda a ração, visita de interessados…"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'note-error' : undefined}
        />
        {error && (
          <p className="field__error" id="note-error">
            {error}
          </p>
        )}
        <div>
          <Button type="submit" variant="dark" size="sm" loading={busy}>
            Adicionar ao histórico
          </Button>
        </div>
      </form>

      {items.length === 0 ? (
        <EmptyState title="Sem histórico ainda" />
      ) : (
        <ol className="timeline">
          {items.map((i) => (
            <li key={i.id} data-type={i.type}>
              <div className="timeline__date">
                {fmtDate(i.at.slice(0, 10))}
                {!i.at.endsWith('T12:00:00') && (
                  <>
                    <br />
                    <span style={{ color: 'var(--ink-3)' }}>{fmtDateTime(i.at).slice(-5)}</span>
                  </>
                )}
              </div>
              <div className="timeline__body">
                <div className="timeline__type">{i.label}</div>
                <div className="timeline__text">{i.text}</div>
                {i.who && <div className="timeline__who">{i.who}</div>}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function AdoptionTab({ animal, missing, openTreatments, onAdopt }: { animal: Animal; missing: string[]; openTreatments: number; onAdopt: () => void }) {
  const { db } = useData();
  if (animal.status === 'adotado' && animal.adoption) {
    const a = animal.adoption;
    return (
      <div className="stack-lg">
        <div className="adoption-card">
          <HeartHandshake aria-hidden />
          <div>
            <p className="adoption-card__title">
              Adotado(a) por <strong>{a.adopterName}</strong>
            </p>
            <p className="muted">
              em {fmtDate(a.date)} · {fmtRelativeDay(a.date)}
            </p>
          </div>
        </div>
        <dl className="kv kv--rows">
          <KV label="Telefone">
            <a className="link" href={whatsappLink(a.adopterPhone)} target="_blank" rel="noreferrer">
              <Phone size={14} aria-hidden style={{ verticalAlign: '-2px' }} /> {a.adopterPhone}
            </a>
          </KV>
          <KV label="CPF">{a.adopterCpf}</KV>
          <KV label="Observações">{a.notes}</KV>
          <KV label="Tempo na LUNAAR">{plural(Math.max(0, Math.round((new Date(a.date).getTime() - new Date(animal.intakeDate).getTime()) / 86_400_000)), 'dia', 'dias')}</KV>
        </dl>
      </div>
    );
  }

  const vaccinated = db.vaccines.some((v) => v.animalId === animal.id) && vaccineDue(db, animal.id, 0).length === 0;
  const checks = [
    { ok: animal.status === 'disponivel' || animal.status === 'reservado', label: 'Situação liberada para adoção', hint: 'Disponível ou reservado.' },
    { ok: openTreatments === 0, label: 'Sem tratamentos em aberto', hint: openTreatments ? plural(openTreatments, 'tratamento em aberto', 'tratamentos em aberto') : undefined },
    { ok: vaccinated, label: 'Vacinas registradas e em dia' },
    { ok: animal.neutered, label: 'Castrado(a)', hint: animal.neutered ? undefined : 'Pode ser adotado com termo de compromisso de castração.' },
    { ok: missing.length === 0, label: 'Cadastro completo', hint: missing.length ? `Falta: ${missing.join(', ')}` : undefined },
  ];
  const ready = checks.filter((c) => c.ok).length;

  return (
    <div className="stack-lg">
      <div>
        <SectionLabel as="h3">
          Prontidão para adoção · {ready}/{checks.length}
        </SectionLabel>
        <ul className="checklist">
          {checks.map((c) => (
            <li key={c.label} data-ok={c.ok}>
              {c.ok ? <CheckCircle2 aria-hidden /> : <Circle aria-hidden />}
              <span>
                <span className="visually-hidden">{c.ok ? 'Cumprido: ' : 'Pendente: '}</span>
                {c.label}
                {c.hint && <small>{c.hint}</small>}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="adoption-cta">
        <p>Quando a família assinar o termo, registre a adoção aqui. {animal.name} sai do canil e o histórico fica guardado.</p>
        <Button variant="primary" icon={<HeartHandshake aria-hidden />} onClick={onAdopt}>
          Registrar adoção
        </Button>
      </div>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="page profile">
      <div className="profile__layout">
        <Skeleton h="auto" style={{ aspectRatio: '4 / 5' }} />
        <div style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
          <Skeleton w={160} h={14} />
          <Skeleton w={260} h={40} />
          <Skeleton w={200} h={24} />
          <Skeleton h={120} style={{ marginTop: 20 }} />
        </div>
      </div>
    </div>
  );
}
