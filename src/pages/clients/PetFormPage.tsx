import { useCallback, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useData } from '@/data/store';
import type { ClientPet, Sex, Size, Species } from '@/data/types';
import { useToast } from '@/components/toast';
import { Button, Choices, Field, PageHeader } from '@/components/ui';
import { PhotoInput } from '@/components/PhotoInput';
import { ErrorSummary, useForm } from '@/lib/useForm';
import { SEX, SIZE, SPECIES } from '@/lib/labels';
import { NotFoundPage } from '../NotFoundPage';

type V = {
  photo: string;
  name: string;
  species: Species;
  sex: Sex;
  breed: string;
  color: string;
  size: Size;
  weightKg: string;
  ageYears: string;
  vaccines: string;
  allergies: string;
  medications: string;
  feeding: string;
  behavior: string;
  notes: string;
};

const LABELS: Partial<Record<keyof V, string>> = { name: 'Nome', breed: 'Raça', color: 'Cor', weightKg: 'Peso', ageYears: 'Idade' };

function toForm(p?: ClientPet): V {
  return {
    photo: p?.photo ?? '',
    name: p?.name ?? '',
    species: p?.species ?? 'cao',
    sex: p?.sex ?? 'macho',
    breed: p?.breed ?? '',
    color: p?.color ?? '',
    size: p?.size ?? 'medio',
    weightKg: p?.weightKg != null ? String(p.weightKg).replace('.', ',') : '',
    ageYears: p?.ageYears != null ? String(p.ageYears) : '',
    vaccines: p?.vaccines ?? '',
    allergies: p?.allergies ?? '',
    medications: p?.medications ?? '',
    feeding: p?.feeding ?? '',
    behavior: p?.behavior ?? '',
    notes: p?.notes ?? '',
  };
}

export function PetFormPage() {
  const { id, clientId } = useParams();
  const { db, actions, ready } = useData();
  const navigate = useNavigate();
  const toast = useToast();
  const existing = id ? db.pets.find((p) => p.id === id) : undefined;
  const owner = db.clients.find((c) => c.id === (existing?.clientId ?? clientId));
  const [saving, setSaving] = useState(false);

  const validate = useCallback((v: V) => {
    const e: Partial<Record<keyof V, string>> = {};
    if (!v.name.trim()) e.name = 'Informe o nome do pet.';
    if (!v.breed.trim()) e.breed = 'Informe a raça ou “SRD”.';
    if (!v.color.trim()) e.color = 'Informe a cor.';
    const w = Number(v.weightKg.replace(',', '.'));
    if (v.weightKg && (Number.isNaN(w) || w <= 0 || w > 120)) e.weightKg = 'Peso inválido. Ex.: 8,5.';
    if (v.ageYears && (Number(v.ageYears) < 0 || Number(v.ageYears) > 30)) e.ageYears = 'Idade entre 0 e 30 anos.';
    return e;
  }, []);

  const form = useForm<V>(toForm(existing), validate);
  const v = form.values;

  if (!owner) return ready ? <NotFoundPage what={id ? 'Pet' : 'Cliente'} back="/clientes" /> : null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.check()) return;
    setSaving(true);
    const saved = await actions.savePet({
      id: existing?.id,
      clientId: owner.id,
      name: v.name.trim(),
      species: v.species,
      sex: v.sex,
      breed: v.breed.trim(),
      color: v.color.trim(),
      size: v.size,
      weightKg: v.weightKg ? Number(v.weightKg.replace(',', '.')) : undefined,
      ageYears: v.ageYears ? Number(v.ageYears) : undefined,
      photo: v.photo || undefined,
      vaccines: v.vaccines.trim() || undefined,
      allergies: v.allergies.trim() || undefined,
      medications: v.medications.trim() || undefined,
      feeding: v.feeding.trim() || undefined,
      behavior: v.behavior.trim() || undefined,
      notes: v.notes.trim() || undefined,
    });
    toast(existing ? 'Ficha do pet atualizada.' : `${saved.name} cadastrado(a).`);
    navigate(existing ? `/pets/${saved.id}` : `/clientes/${owner.id}`, { replace: true });
  };

  return (
    <div className="page">
      <PageHeader
        back={existing ? { to: `/pets/${existing.id}`, label: existing.name } : { to: `/clientes/${owner.id}`, label: owner.name }}
        title={existing ? `Editar ${existing.name}` : 'Cadastrar pet'}
        sub={`Tutor(a): ${owner.name}`}
      />
      <form onSubmit={submit} noValidate>
        {form.showSummary && <ErrorSummary errors={form.errors} labels={LABELS} />}

        <section className="form-section">
          <div className="form-section__intro">
            <h2>Foto</h2>
            <p>Ajuda a equipe a identificar o pet no hotelzinho.</p>
          </div>
          <PhotoInput value={v.photo || undefined} onChange={(p) => form.set('photo', p ?? '')} name={v.name} />
        </section>

        <section className="form-section">
          <div className="form-section__intro">
            <h2>Identificação</h2>
          </div>
          <div className="form-grid">
            <Field label="Nome" required error={form.errors.name} className="col-3" htmlFor="f-name">
              {(p) => <input {...p} {...form.bind('name')} className="input" autoComplete="off" />}
            </Field>
            <div className="col-3" />
            <Choices legend="Espécie" name="species" value={v.species} onChange={(x) => form.set('species', x)} options={Object.entries(SPECIES).map(([value, label]) => ({ value: value as Species, label }))} />
            <Choices legend="Sexo" name="sex" value={v.sex} onChange={(x) => form.set('sex', x)} options={Object.entries(SEX).map(([value, label]) => ({ value: value as Sex, label }))} />
            <Field label="Raça" required error={form.errors.breed} className="col-3" htmlFor="f-breed">
              {(p) => <input {...p} {...form.bind('breed')} className="input" />}
            </Field>
            <Field label="Cor" required error={form.errors.color} className="col-3" htmlFor="f-color">
              {(p) => <input {...p} {...form.bind('color')} className="input" />}
            </Field>
            <Choices legend="Porte" name="size" value={v.size} onChange={(x) => form.set('size', x)} options={Object.entries(SIZE).map(([value, label]) => ({ value: value as Size, label }))} />
            <Field label="Peso" optional error={form.errors.weightKg} className="col-2 keep" htmlFor="f-weightKg">
              {(p) => (
                <div className="input-affix">
                  <input {...p} {...form.bind('weightKg')} className="input" inputMode="decimal" />
                  <span className="input-affix__unit">kg</span>
                </div>
              )}
            </Field>
            <Field label="Idade" optional error={form.errors.ageYears} className="col-2 keep" htmlFor="f-ageYears">
              {(p) => (
                <div className="input-affix">
                  <input {...p} {...form.bind('ageYears')} type="number" min={0} max={30} className="input" inputMode="numeric" />
                  <span className="input-affix__unit">anos</span>
                </div>
              )}
            </Field>
          </div>
        </section>

        <section className="form-section">
          <div className="form-section__intro">
            <h2>Saúde e rotina</h2>
            <p>Essas informações aparecem automaticamente no check-in.</p>
          </div>
          <div className="form-grid">
            <Field label="Vacinas" optional htmlFor="f-vaccines" hint="Ex.: V10 e antirrábica em dia (mar/2026).">
              {(p) => <input {...p} {...form.bind('vaccines')} className="input" />}
            </Field>
            <Field label="Alergias" optional className="col-3" htmlFor="f-allergies">
              {(p) => <input {...p} {...form.bind('allergies')} className="input" />}
            </Field>
            <Field label="Medicamentos" optional className="col-3" htmlFor="f-medications" hint="Nome, dose e horários.">
              {(p) => <input {...p} {...form.bind('medications')} className="input" />}
            </Field>
            <Field label="Alimentação" optional htmlFor="f-feeding" hint="Ração, quantidade e horários.">
              {(p) => <textarea {...p} {...form.bind('feeding')} className="textarea" rows={2} />}
            </Field>
            <Field label="Comportamento" optional htmlFor="f-behavior" hint="Como reage a outros animais, medos, hábitos.">
              {(p) => <textarea {...p} {...form.bind('behavior')} className="textarea" rows={2} />}
            </Field>
            <Field label="Observações" optional htmlFor="f-notes">
              {(p) => <textarea {...p} {...form.bind('notes')} className="textarea" rows={2} />}
            </Field>
          </div>
        </section>

        <div className="form-actions">
          <Button onClick={() => navigate(-1)} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" loading={saving}>
            {existing ? 'Salvar alterações' : 'Cadastrar pet'}
          </Button>
        </div>
      </form>
    </div>
  );
}
