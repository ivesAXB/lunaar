import { useState, type FormEvent } from 'react';
import type { Animal, AnimalStatus, HealthRecordType, TreatmentStatus } from '@/data/types';
import { useData, useMe } from '@/data/store';
import { useToast } from '@/components/toast';
import { Button, Choices, Dialog, Field } from '@/components/ui';
import { ANIMAL_STATUS, ANIMAL_STATUS_ORDER, HEALTH_RECORD } from '@/lib/labels';
import { isValidCpf, maskCpf, maskPhone, todayIso } from '@/lib/format';

interface Base {
  open: boolean;
  onClose: () => void;
  animal: Animal;
}

function useSubmit(onClose: () => void) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<unknown>, success: string) => {
    setBusy(true);
    try {
      await fn();
      toast(success);
      onClose();
    } catch (err) {
      toast((err as Error).message || 'Não foi possível salvar. Tente de novo.', 'error');
    } finally {
      setBusy(false);
    }
  };
  return { busy, run };
}

const vetName = (name?: string) => name ?? '';

export function StatusDialog({ open, onClose, animal }: Base) {
  const { actions } = useData();
  const [status, setStatus] = useState<AnimalStatus>(animal.status);
  const { busy, run } = useSubmit(onClose);
  const options = ANIMAL_STATUS_ORDER.filter((s) => s !== 'adotado');
  return (
    <Dialog
      open={open}
      onClose={onClose}
      busy={busy}
      title={`Situação de ${animal.name}`}
      description="Para registrar uma adoção, use a aba Adoção."
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button variant="dark" loading={busy} disabled={status === animal.status} onClick={() => run(() => actions.setAnimalStatus(animal.id, status), 'Situação atualizada.')}>
            Salvar situação
          </Button>
        </>
      }
    >
      <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
        <legend className="visually-hidden">Nova situação</legend>
        <div className="status-options">
          {options.map((s) => {
            const meta = ANIMAL_STATUS[s];
            const Icon = meta.icon;
            return (
              <label key={s} className="status-option" data-tone={meta.tone}>
                <input type="radio" name="status" value={s} checked={status === s} onChange={() => setStatus(s)} />
                <Icon aria-hidden />
                <span>
                  <strong>{meta.label}</strong>
                  <small>{meta.description}</small>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>
    </Dialog>
  );
}

export function TreatmentDialog({ open, onClose, animal }: Base) {
  const { actions, db } = useData();
  const user = useMe();
  const vet = db.users.find((u) => u.role === 'veterinaria');
  const [form, setForm] = useState({ title: '', medication: '', dosage: '', startDate: todayIso(), endDate: '', status: 'ativo' as TreatmentStatus, vet: vetName(vet?.name), notes: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { busy, run } = useSubmit(onClose);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!form.title.trim()) next.title = 'Descreva o tratamento. Ex.: “Tratamento de sarna”.';
    if (form.endDate && form.endDate < form.startDate) next.endDate = 'O fim não pode ser antes do início.';
    setErrors(next);
    if (Object.keys(next).length) return;
    run(
      () =>
        actions.saveTreatment({
          animalId: animal.id,
          title: form.title.trim(),
          medication: form.medication || undefined,
          dosage: form.dosage || undefined,
          startDate: form.startDate,
          endDate: form.endDate || undefined,
          status: form.status,
          vet: form.vet || user?.name,
          notes: form.notes || undefined,
        }),
      'Tratamento registrado.',
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      busy={busy}
      wide
      title="Novo tratamento"
      description={animal.name}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button variant="dark" type="submit" form="treatment-form" loading={busy}>
            Registrar tratamento
          </Button>
        </>
      }
    >
      <form id="treatment-form" className="form-grid" onSubmit={submit} noValidate>
        <Field label="Tratamento" required error={errors.title}>
          {(p) => <input {...p} data-autofocus className="input" value={form.title} onChange={set('title')} />}
        </Field>
        <Field label="Medicamento" optional className="col-3">
          {(p) => <input {...p} className="input" value={form.medication} onChange={set('medication')} placeholder="Ex.: Doxiciclina 100 mg" />}
        </Field>
        <Field label="Posologia" optional className="col-3">
          {(p) => <input {...p} className="input" value={form.dosage} onChange={set('dosage')} placeholder="Ex.: a cada 12h" />}
        </Field>
        <Field label="Início" required className="col-2 keep">
          {(p) => <input {...p} type="date" className="input" value={form.startDate} onChange={set('startDate')} />}
        </Field>
        <Field label="Previsão de fim" optional className="col-2 keep" error={errors.endDate}>
          {(p) => <input {...p} type="date" className="input" value={form.endDate} onChange={set('endDate')} />}
        </Field>
        <Field label="Situação" className="col-2">
          {(p) => (
            <select {...p} className="select" value={form.status} onChange={set('status')}>
              <option value="ativo">Em andamento</option>
              <option value="pendente">Pendente (a iniciar)</option>
            </select>
          )}
        </Field>
        <Field label="Veterinário(a)" optional>
          {(p) => <input {...p} className="input" value={form.vet} onChange={set('vet')} />}
        </Field>
        <Field label="Observações" optional>
          {(p) => <textarea {...p} className="textarea" value={form.notes} onChange={set('notes')} />}
        </Field>
      </form>
    </Dialog>
  );
}

export function VaccineDialog({ open, onClose, animal }: Base) {
  const { actions, db } = useData();
  const vet = db.users.find((u) => u.role === 'veterinaria');
  const suggestions = animal.species === 'cao' ? ['V10 (polivalente)', 'V8 (polivalente)', 'Antirrábica', 'Gripe canina', 'Giárdia'] : ['V4 felina', 'V5 felina', 'Antirrábica', 'FeLV'];
  const [form, setForm] = useState({ name: '', date: todayIso(), nextDue: '', batch: '', vet: vetName(vet?.name) });
  const [error, setError] = useState('');
  const { busy, run } = useSubmit(onClose);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError('Informe qual vacina foi aplicada.');
      return;
    }
    run(() => actions.addVaccine({ animalId: animal.id, name: form.name.trim(), date: form.date, nextDue: form.nextDue || undefined, batch: form.batch || undefined, vet: form.vet || undefined }), 'Vacina registrada.');
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      busy={busy}
      title="Registrar vacina"
      description={animal.name}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button variant="dark" type="submit" form="vaccine-form" loading={busy}>
            Registrar vacina
          </Button>
        </>
      }
    >
      <form id="vaccine-form" className="form-grid" onSubmit={submit} noValidate>
        <Field label="Vacina" required error={error}>
          {(p) => (
            <>
              <input {...p} data-autofocus className="input" list="vaccine-options" value={form.name} onChange={set('name')} />
              <datalist id="vaccine-options">
                {suggestions.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </>
          )}
        </Field>
        <Field label="Aplicada em" required className="col-3 keep">
          {(p) => <input {...p} type="date" className="input" value={form.date} max={todayIso()} onChange={set('date')} />}
        </Field>
        <Field label="Próxima dose" optional className="col-3 keep" hint="Gera alerta 7 dias antes.">
          {(p) => <input {...p} type="date" className="input" value={form.nextDue} min={form.date} onChange={set('nextDue')} />}
        </Field>
        <Field label="Lote" optional className="col-3">
          {(p) => <input {...p} className="input" value={form.batch} onChange={set('batch')} />}
        </Field>
        <Field label="Aplicada por" optional className="col-3">
          {(p) => <input {...p} className="input" value={form.vet} onChange={set('vet')} />}
        </Field>
      </form>
    </Dialog>
  );
}

export function RecordDialog({ open, onClose, animal }: Base) {
  const { actions, db } = useData();
  const vet = db.users.find((u) => u.role === 'veterinaria');
  const [type, setType] = useState<HealthRecordType>('consulta');
  const [form, setForm] = useState({ title: '', description: '', date: todayIso(), vet: vetName(vet?.name) });
  const [error, setError] = useState('');
  const { busy, run } = useSubmit(onClose);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      setError('Dê um título ao registro. Ex.: “Retorno dermatológico”.');
      return;
    }
    run(() => actions.addHealthRecord({ animalId: animal.id, type, title: form.title.trim(), description: form.description || undefined, date: form.date, vet: form.vet || undefined }), 'Registro clínico salvo.');
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      busy={busy}
      wide
      title="Registro clínico"
      description={`Consulta, exame, cirurgia ou observação de ${animal.name}.`}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button variant="dark" type="submit" form="record-form" loading={busy}>
            Salvar registro
          </Button>
        </>
      }
    >
      <form id="record-form" className="form-grid" onSubmit={submit} noValidate>
        <Choices legend="Tipo" name="record-type" value={type} onChange={setType} options={Object.entries(HEALTH_RECORD).map(([value, label]) => ({ value: value as HealthRecordType, label }))} />
        <Field label="Título" required error={error} className="col-4">
          {(p) => <input {...p} className="input" value={form.title} onChange={set('title')} />}
        </Field>
        <Field label="Data" required className="col-2">
          {(p) => <input {...p} type="date" className="input" value={form.date} max={todayIso()} onChange={set('date')} />}
        </Field>
        <Field label="Descrição" optional>
          {(p) => <textarea {...p} className="textarea" rows={4} value={form.description} onChange={set('description')} />}
        </Field>
        <Field label="Profissional" optional>
          {(p) => <input {...p} className="input" value={form.vet} onChange={set('vet')} />}
        </Field>
      </form>
    </Dialog>
  );
}

export function AdoptionDialog({ open, onClose, animal }: Base) {
  const { actions } = useData();
  const [form, setForm] = useState({ adopterName: '', adopterPhone: '', adopterCpf: '', date: todayIso(), notes: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { busy, run } = useSubmit(onClose);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (form.adopterName.trim().split(/\s+/).length < 2) next.adopterName = 'Informe nome e sobrenome de quem adotou.';
    if (form.adopterPhone.replace(/\D/g, '').length < 10) next.adopterPhone = 'Telefone incompleto. Use DDD + número.';
    if (form.adopterCpf && !isValidCpf(form.adopterCpf)) next.adopterCpf = 'CPF inválido. Confira os dígitos.';
    setErrors(next);
    if (Object.keys(next).length) return;
    run(
      () =>
        actions.registerAdoption(animal.id, {
          adopterName: form.adopterName.trim(),
          adopterPhone: form.adopterPhone,
          adopterCpf: form.adopterCpf || undefined,
          date: form.date,
          notes: form.notes || undefined,
        }),
      `Adoção de ${animal.name} registrada.`,
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      busy={busy}
      wide
      title={`Registrar adoção de ${animal.name}`}
      description="O animal sai do canil e passa para a lista de adotados."
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" form="adoption-form" loading={busy}>
            Confirmar adoção
          </Button>
        </>
      }
    >
      <form id="adoption-form" className="form-grid" onSubmit={submit} noValidate>
        <Field label="Nome de quem adotou" required error={errors.adopterName}>
          {(p) => <input {...p} data-autofocus className="input" autoComplete="off" value={form.adopterName} onChange={(e) => setForm((f) => ({ ...f, adopterName: e.target.value }))} />}
        </Field>
        <Field label="Telefone / WhatsApp" required error={errors.adopterPhone} className="col-3">
          {(p) => <input {...p} className="input" inputMode="tel" value={form.adopterPhone} onChange={(e) => setForm((f) => ({ ...f, adopterPhone: maskPhone(e.target.value) }))} />}
        </Field>
        <Field label="CPF" optional error={errors.adopterCpf} className="col-3">
          {(p) => <input {...p} className="input" inputMode="numeric" value={form.adopterCpf} onChange={(e) => setForm((f) => ({ ...f, adopterCpf: maskCpf(e.target.value) }))} />}
        </Field>
        <Field label="Data da adoção" required className="col-3">
          {(p) => <input {...p} type="date" className="input" max={todayIso()} value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />}
        </Field>
        <Field label="Observações" optional hint="Ex.: termo de castração, visita de acompanhamento.">
          {(p) => <textarea {...p} className="textarea" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />}
        </Field>
      </form>
    </Dialog>
  );
}
