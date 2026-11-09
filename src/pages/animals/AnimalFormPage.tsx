import { useCallback, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useData, useMe } from '@/data/store';
import { inCare } from '@/data/selectors';
import type { Animal, AnimalOrigin, AnimalStatus, Sex, Size, Species } from '@/data/types';
import { useToast } from '@/components/toast';
import { Button, Choices, Field, PageHeader } from '@/components/ui';
import { PhotoInput } from '@/components/PhotoInput';
import { ErrorSummary, useForm } from '@/lib/useForm';
import { ANIMAL_STATUS, ANIMAL_STATUS_ORDER, ORIGIN, SEX, SIZE, SPECIES } from '@/lib/labels';
import { todayIso } from '@/lib/format';
import { NotFoundPage } from '../NotFoundPage';
import { KennelPicker } from './KennelPicker';
import { newRow, rowsToDrafts, validateVaccineRows, VaccineHistoryEditor, type VaccineRow, type VaccineRowErrors } from './VaccineHistoryEditor';
import './animal-form.css';

type FormValues = {
  photo: string;
  name: string;
  species: Species;
  sex: Sex;
  breed: string;
  color: string;
  size: Size;
  weightKg: string;
  ageMode: 'exata' | 'aproximada';
  birthDate: string;
  ageYears: string;
  ageMonths: string;
  neutered: boolean;
  temperament: string;
  intakeDate: string;
  origin: AnimalOrigin;
  originNotes: string;
  kennelId: string;
  responsibleId: string;
  status: AnimalStatus;
  diseases: string;
  allergies: string;
  vetNotes: string;
  lastVetVisit: string;
};

const LABELS: Partial<Record<keyof FormValues, string>> = {
  name: 'Nome',
  breed: 'Raça',
  color: 'Cor',
  weightKg: 'Peso',
  birthDate: 'Data de nascimento',
  ageYears: 'Idade aproximada',
  intakeDate: 'Data de entrada',
  kennelId: 'Canil',
  lastVetVisit: 'Última consulta',
};

function toForm(a?: Animal, userId?: string): FormValues {
  const months = a?.ageApproxMonths;
  return {
    photo: a?.photo ?? '',
    name: a?.name ?? '',
    species: a?.species ?? 'cao',
    sex: a?.sex ?? 'femea',
    breed: a?.breed ?? 'SRD',
    color: a?.color ?? '',
    size: a?.size ?? 'medio',
    weightKg: a?.weightKg != null ? String(a.weightKg).replace('.', ',') : '',
    ageMode: a?.birthDate ? 'exata' : 'aproximada',
    birthDate: a?.birthDate ?? '',
    ageYears: months != null ? String(Math.floor(months / 12)) : '',
    ageMonths: months != null ? String(months % 12) : '',
    neutered: a?.neutered ?? false,
    temperament: a?.temperament ?? '',
    intakeDate: a?.intakeDate ?? todayIso(),
    origin: a?.origin ?? 'resgate',
    originNotes: a?.originNotes ?? '',
    kennelId: a?.kennelId ?? '',
    responsibleId: a?.responsibleId ?? userId ?? '',
    status: a?.status ?? 'observacao',
    diseases: a?.diseases ?? '',
    allergies: a?.allergies ?? '',
    vetNotes: a?.vetNotes ?? '',
    lastVetVisit: a?.lastVetVisit ?? '',
  };
}

const parseNum = (v: string) => (v.trim() === '' ? undefined : Number(v.replace(',', '.')));

export function AnimalFormPage() {
  const { id } = useParams();
  const { db, actions, ready } = useData();
  const user = useMe();
  const navigate = useNavigate();
  const toast = useToast();
  const existing = id ? db.animals.find((a) => a.id === id) : undefined;
  const [saving, setSaving] = useState(false);

  const validate = useCallback((v: FormValues) => {
    const e: Partial<Record<keyof FormValues, string>> = {};
    if (!v.name.trim()) e.name = 'Informe o nome. Se ainda não tiver, use um provisório.';
    if (!v.breed.trim()) e.breed = 'Informe a raça ou “SRD” (sem raça definida).';
    if (!v.color.trim()) e.color = 'Informe a cor predominante.';
    const w = parseNum(v.weightKg);
    if (v.weightKg && (w === undefined || Number.isNaN(w) || w <= 0 || w > 120)) e.weightKg = 'Peso inválido. Use apenas números, ex.: 12,5.';
    if (v.ageMode === 'exata' && v.birthDate && v.birthDate > todayIso()) e.birthDate = 'A data de nascimento não pode ser no futuro.';
    if (v.ageMode === 'aproximada' && v.ageYears && (Number(v.ageYears) < 0 || Number(v.ageYears) > 30)) e.ageYears = 'Idade fora do esperado (0 a 30 anos).';
    if (!v.intakeDate) e.intakeDate = 'Informe a data de entrada na ONG.';
    else if (v.intakeDate > todayIso()) e.intakeDate = 'A entrada não pode ser no futuro.';
    if (v.status !== 'adotado' && !v.kennelId) e.kennelId = 'Escolha localização, setor, ala e número do canil.';
    if (v.lastVetVisit && v.lastVetVisit > todayIso()) e.lastVetVisit = 'A consulta não pode ser no futuro.';
    return e;
  }, []);

  const form = useForm<FormValues>(toForm(existing, user?.id), validate);
  const v = form.values;
  const vet = db.users.find((u) => u.role === 'veterinaria' && u.active)?.name;
  const [vaccineRows, setVaccineRows] = useState<VaccineRow[]>(() =>
    existing
      ? db.vaccines
          .filter((x) => x.animalId === existing.id)
          .sort((a, b) => a.date.localeCompare(b.date))
          .map((x) => newRow({ id: x.id, name: x.name, date: x.date, nextDue: x.nextDue ?? '', batch: x.batch ?? '', vet: x.vet ?? '' }))
      : [],
  );
  const [vaccineErrors, setVaccineErrors] = useState<VaccineRowErrors>({});
  const [vaccinesChecked, setVaccinesChecked] = useState(false);

  if (id && !existing) return ready ? <NotFoundPage what="Animal" back="/animais" /> : null;

  const occupancy = (kennelId: string) => inCare(db).filter((a) => a.kennelId === kennelId && a.id !== existing?.id).length;

  const changeVaccines = (rows: VaccineRow[]) => {
    setVaccineRows(rows);
    if (vaccinesChecked) setVaccineErrors(validateVaccineRows(rows));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const formOk = form.check();
    const vacErrors = validateVaccineRows(vaccineRows);
    setVaccineErrors(vacErrors);
    setVaccinesChecked(true);
    if (!formOk) return;
    const firstVac = Object.keys(vacErrors)[0];
    if (firstVac) {
      const field = Object.keys(vacErrors[firstVac])[0] === 'nextDue' ? 'next' : Object.keys(vacErrors[firstVac])[0];
      const el = document.getElementById(`vac-${firstVac}-${field}`);
      el?.focus();
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }
    setSaving(true);
    try {
      const months = v.ageMode === 'aproximada' && (v.ageYears || v.ageMonths) ? Number(v.ageYears || 0) * 12 + Number(v.ageMonths || 0) : undefined;
      const saved = await actions.saveAnimal({
        ...(existing ?? {}),
        id: existing?.id,
        name: v.name.trim(),
        species: v.species,
        sex: v.sex,
        breed: v.breed.trim(),
        color: v.color.trim(),
        size: v.size,
        weightKg: parseNum(v.weightKg),
        birthDate: v.ageMode === 'exata' ? v.birthDate || undefined : undefined,
        ageApproxMonths: v.ageMode === 'aproximada' ? months : undefined,
        neutered: v.neutered,
        photo: v.photo || undefined,
        temperament: v.temperament.trim() || undefined,
        intakeDate: v.intakeDate,
        origin: v.origin,
        originNotes: v.originNotes.trim() || undefined,
        kennelId: v.kennelId || undefined,
        responsibleId: v.responsibleId || undefined,
        status: v.status,
        diseases: v.diseases.trim() || undefined,
        allergies: v.allergies.trim() || undefined,
        vetNotes: v.vetNotes.trim() || undefined,
        lastVetVisit: v.lastVetVisit || undefined,
        vaccines: rowsToDrafts(vaccineRows),
      });
      toast(existing ? 'Alterações salvas.' : `${saved.name} cadastrado(a) na LUNAAR.`);
      navigate(`/animais/${saved.id}`, { replace: true });
    } catch (err) {
      toast((err as Error).message || 'Não foi possível salvar.', 'error');
      setSaving(false);
    }
  };

  const statusOptions = ANIMAL_STATUS_ORDER.filter((s) => s !== 'adotado' || existing?.status === 'adotado');

  return (
    <div className="page">
      <PageHeader
        back={existing ? { to: `/animais/${existing.id}`, label: existing.name } : { to: '/animais', label: 'Animais' }}
        title={existing ? `Editar ${existing.name}` : 'Cadastrar animal'}
        sub={existing ? undefined : 'Registre a entrada de um cão ou gato no abrigo. Dá para completar depois.'}
      />

      <form onSubmit={submit} noValidate>
        {form.showSummary && <ErrorSummary errors={form.errors} labels={LABELS} />}

        <section className="form-section" id="foto">
          <div className="form-section__intro">
            <h2>Foto</h2>
            <p>A foto principal aparece na listagem e na divulgação para adoção.</p>
          </div>
          <PhotoInput value={v.photo || undefined} onChange={(p) => form.set('photo', p ?? '')} name={v.name} />
        </section>

        <section className="form-section">
          <div className="form-section__intro">
            <h2>Identificação</h2>
            <p>Como reconhecer o animal no dia a dia.</p>
          </div>
          <div className="form-grid">
            <Field label="Nome" required error={form.errors.name} className="col-3" htmlFor="f-name">
              {(p) => <input {...p} {...form.bind('name')} className="input" autoComplete="off" />}
            </Field>
            <div className="col-3" />
            <Choices legend="Espécie" name="species" value={v.species} onChange={(x) => form.set('species', x)} options={Object.entries(SPECIES).map(([value, label]) => ({ value: value as Species, label }))} />
            <Choices legend="Sexo" name="sex" value={v.sex} onChange={(x) => form.set('sex', x)} options={Object.entries(SEX).map(([value, label]) => ({ value: value as Sex, label }))} />
            <Field label="Raça" required error={form.errors.breed} className="col-3" htmlFor="f-breed" hint="Use “SRD” para sem raça definida.">
              {(p) => (
                <>
                  <input {...p} {...form.bind('breed')} className="input" list="breed-list" />
                  <datalist id="breed-list">
                    {[...new Set(db.animals.map((a) => a.breed))].map((b) => (
                      <option key={b} value={b} />
                    ))}
                  </datalist>
                </>
              )}
            </Field>
            <Field label="Cor" required error={form.errors.color} className="col-3" htmlFor="f-color">
              {(p) => <input {...p} {...form.bind('color')} className="input" placeholder="Ex.: Caramelo, preto e branco" />}
            </Field>
            <Choices legend="Porte" name="size" value={v.size} onChange={(x) => form.set('size', x)} options={Object.entries(SIZE).map(([value, label]) => ({ value: value as Size, label }))} />
            <Field label="Peso" optional error={form.errors.weightKg} className="col-2" htmlFor="f-weightKg">
              {(p) => (
                <div className="input-affix">
                  <input {...p} {...form.bind('weightKg')} className="input" inputMode="decimal" />
                  <span className="input-affix__unit">kg</span>
                </div>
              )}
            </Field>
            <div className="col-4" />
            <Choices
              legend="Idade"
              name="ageMode"
              value={v.ageMode}
              onChange={(x) => form.set('ageMode', x)}
              options={[
                { value: 'aproximada', label: 'Idade aproximada' },
                { value: 'exata', label: 'Sei a data de nascimento' },
              ]}
            />
            {v.ageMode === 'exata' ? (
              <Field label="Data de nascimento" optional error={form.errors.birthDate} className="col-3" htmlFor="f-birthDate">
                {(p) => <input {...p} {...form.bind('birthDate')} type="date" className="input" max={todayIso()} />}
              </Field>
            ) : (
              <>
                <Field label="Anos" optional error={form.errors.ageYears} className="col-2 keep" htmlFor="f-ageYears">
                  {(p) => <input {...p} {...form.bind('ageYears')} type="number" min={0} max={30} className="input" inputMode="numeric" />}
                </Field>
                <Field label="Meses" optional className="col-2 keep" htmlFor="f-ageMonths">
                  {(p) => <input {...p} {...form.bind('ageMonths')} type="number" min={0} max={11} className="input" inputMode="numeric" />}
                </Field>
              </>
            )}
            <label className="checkbox">
              <input type="checkbox" checked={v.neutered} onChange={(e) => form.set('neutered', e.target.checked)} />
              Castrado(a)
            </label>
            <Field label="Temperamento" optional htmlFor="f-temperament" hint="Aparece no perfil de adoção. Ex.: “Dócil, convive bem com gatos”.">
              {(p) => <textarea {...p} {...form.bind('temperament')} className="textarea" rows={3} />}
            </Field>
          </div>
        </section>

        <section className="form-section">
          <div className="form-section__intro">
            <h2>Na LUNAAR</h2>
            <p>Entrada, origem, onde está e quem acompanha.</p>
          </div>
          <div className="form-grid">
            <Field label="Data de entrada" required error={form.errors.intakeDate} className="col-2" htmlFor="f-intakeDate">
              {(p) => <input {...p} {...form.bind('intakeDate')} type="date" className="input" max={todayIso()} />}
            </Field>
            <Field label="Origem" required className="col-2" htmlFor="f-origin">
              {(p) => (
                <select {...p} {...form.bind('origin')} className="select">
                  {Object.entries(ORIGIN).map(([k, l]) => (
                    <option key={k} value={k}>
                      {l}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="Situação" required className="col-2" htmlFor="f-status">
              {(p) => (
                <select {...p} {...form.bind('status')} className="select">
                  {statusOptions.map((s) => (
                    <option key={s} value={s}>
                      {ANIMAL_STATUS[s].label}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="Detalhes da origem" optional htmlFor="f-originNotes" hint="Onde e como foi encontrado, quem entregou, número de denúncia…">
              {(p) => <textarea {...p} {...form.bind('originNotes')} className="textarea" rows={2} />}
            </Field>
            <p className="form-subhead">Onde está alojado</p>
            <KennelPicker
              kennels={db.kennels}
              value={v.kennelId}
              onChange={(kid) => form.set('kennelId', kid)}
              occupancy={occupancy}
              error={form.errors.kennelId}
              required={v.status !== 'adotado'}
            />
            <Field label="Responsável" optional className="col-3" htmlFor="f-responsibleId">
              {(p) => (
                <select {...p} {...form.bind('responsibleId')} className="select">
                  <option value="">Sem responsável</option>
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
          </div>
        </section>

        <section className="form-section">
          <div className="form-section__intro">
            <h2>Saúde</h2>
            <p>Tratamentos e consultas são registrados depois, no prontuário.</p>
          </div>
          <div className="form-grid">
            <Field label="Doenças" optional className="col-3" htmlFor="f-diseases">
              {(p) => <input {...p} {...form.bind('diseases')} className="input" />}
            </Field>
            <Field label="Alergias" optional className="col-3" htmlFor="f-allergies">
              {(p) => <input {...p} {...form.bind('allergies')} className="input" />}
            </Field>
            <Field label="Última consulta" optional error={form.errors.lastVetVisit} className="col-2" htmlFor="f-lastVetVisit">
              {(p) => <input {...p} {...form.bind('lastVetVisit')} type="date" className="input" max={todayIso()} />}
            </Field>
            <Field label="Observações veterinárias" optional htmlFor="f-vetNotes">
              {(p) => <textarea {...p} {...form.bind('vetNotes')} className="textarea" rows={3} />}
            </Field>
          </div>
        </section>

        <section className="form-section" id="vacinas">
          <div className="form-section__intro">
            <h2>Histórico de vacinas</h2>
            <p>Lance as doses da carteirinha, inclusive as antigas. A próxima dose gera alerta 7 dias antes.</p>
          </div>
          <VaccineHistoryEditor rows={vaccineRows} onChange={changeVaccines} errors={vaccineErrors} species={v.species} defaultVet={vet} />
        </section>

        <div className="form-actions">
          <span className="form-actions__note">
            Campos com <span style={{ color: 'var(--danger)' }}>*</span> são obrigatórios.
          </span>
          <Button onClick={() => navigate(-1)} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" loading={saving}>
            {existing ? 'Salvar alterações' : 'Cadastrar animal'}
          </Button>
        </div>
      </form>
    </div>
  );
}
