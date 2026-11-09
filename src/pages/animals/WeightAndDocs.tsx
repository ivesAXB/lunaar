import { useRef, useState, type FormEvent } from 'react';
import { Download, ExternalLink, FileText, Paperclip, Trash2 } from 'lucide-react';
import { openDocument, useData } from '@/data/store';
import { userById, WEIGHT_LOSS_ALERT, weightLoss, weightsOf } from '@/data/selectors';
import type { Animal, AnimalDocument, DocumentKind } from '@/data/types';
import { isRemote } from '@/lib/supabase';
import { useToast } from '@/components/toast';
import { Button, ConfirmDialog, Field, Notice, SectionLabel } from '@/components/ui';
import { WeightChart } from '@/components/WeightChart';
import { fmtDate, fmtDateTime, fmtKg, fmtNumber, todayIso } from '@/lib/format';
import { DOCUMENT_KIND } from '@/lib/labels';

// ─── Peso ────────────────────────────────────────────────────

export function WeightTab({ animal }: { animal: Animal }) {
  const { db, actions } = useData();
  const toast = useToast();
  const list = weightsOf(db, animal.id);
  const loss = weightLoss(list);
  const [form, setForm] = useState({ date: todayIso(), kg: '', notes: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const kg = Number(form.kg.replace(',', '.'));
    if (!form.kg.trim() || Number.isNaN(kg) || kg <= 0 || kg > 120) {
      setError('Peso inválido. Use apenas números, ex.: 12,5.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      await actions.addWeight({ animalId: animal.id, measuredOn: form.date, weightKg: Math.round(kg * 100) / 100, notes: form.notes.trim() || undefined });
      setForm({ date: todayIso(), kg: '', notes: '' });
      toast('Peso registrado.');
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const rows = [...list].reverse();

  return (
    <div className="stack-lg">
      {loss && loss.pct >= WEIGHT_LOSS_ALERT && (
        <Notice tone="red">
          <strong>Perda de peso:</strong> {fmtKg(loss.from.weightKg)} em {fmtDate(loss.from.measuredOn)} → {fmtKg(loss.to.weightKg)} em {fmtDate(loss.to.measuredOn)} (−
          {Math.round(loss.pct * 100)}% em até 30 dias). Avalie com a veterinária.
        </Notice>
      )}

      {list.length > 0 ? <WeightChart data={list} /> : <p className="muted">Nenhuma pesagem registrada ainda.</p>}

      <form onSubmit={submit} className="form-grid weight-form" noValidate>
        <Field label="Data" required className="col-2 keep">
          {(p) => <input {...p} type="date" className="input" value={form.date} max={todayIso()} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />}
        </Field>
        <Field label="Peso" required error={error} className="col-2 keep">
          {(p) => (
            <div className="input-affix">
              <input {...p} className="input" inputMode="decimal" value={form.kg} onChange={(e) => setForm((f) => ({ ...f, kg: e.target.value }))} placeholder="12,5" />
              <span className="input-affix__unit">kg</span>
            </div>
          )}
        </Field>
        <Field label="Observação" optional className="col-2">
          {(p) => <input {...p} className="input" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Ex.: após vermifugação" />}
        </Field>
        <div className="weight-form__actions">
          <Button type="submit" variant="dark" size="sm" loading={busy}>
            Registrar peso
          </Button>
        </div>
      </form>

      {rows.length > 0 && (
        <div>
          <SectionLabel as="h3" count={rows.length}>
            Pesagens
          </SectionLabel>
          <div className="table-wrap">
            <table className="table table--stack">
              <thead>
                <tr>
                  <th scope="col">Data</th>
                  <th scope="col" className="num">
                    Peso
                  </th>
                  <th scope="col" className="num">
                    Variação
                  </th>
                  <th scope="col">Observação</th>
                  <th scope="col">
                    <span className="visually-hidden">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((w, i) => {
                  const prev = rows[i + 1];
                  const diff = prev ? w.weightKg - prev.weightKg : null;
                  const who = userById(db, w.userId)?.name;
                  return (
                    <tr key={w.id}>
                      <td data-primary className="tnum">
                        <strong style={{ fontWeight: 600 }}>{fmtDate(w.measuredOn)}</strong>
                        {who && <div className="cell-primary__sub">{who}</div>}
                      </td>
                      <td data-label="Peso" className="num tnum">
                        {fmtKg(w.weightKg)}
                      </td>
                      <td data-label="Variação" className="num tnum" style={diff != null && diff < 0 ? { color: 'var(--danger)' } : undefined}>
                        {diff == null || diff === 0 ? '—' : `${diff > 0 ? '+' : '−'}${fmtNumber(Math.abs(diff), 1)} kg`}
                      </td>
                      <td data-label="Observação">{w.notes ?? '—'}</td>
                      <td style={{ textAlign: 'right' }}>
                        <Button size="sm" variant="ghost" iconOnly icon={<Trash2 aria-hidden />} aria-label={`Excluir pesagem de ${fmtDate(w.measuredOn)}`} onClick={() => setRemoving(w.id)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        title="Excluir esta pesagem?"
        description="O peso do cadastro passa a ser o da pesagem anterior."
        confirmLabel="Excluir"
        onConfirm={async () => {
          await actions.deleteWeight(removing!);
          toast('Pesagem excluída.');
        }}
      />
    </div>
  );
}

// ─── Documentos ──────────────────────────────────────────────

const ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp,.doc,.docx';
const MAX_MB = isRemote ? 10 : 2;

export function DocumentsTab({ animal }: { animal: Animal }) {
  const { db, actions } = useData();
  const toast = useToast();
  const docs = db.documents.filter((d) => d.animalId === animal.id).sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<DocumentKind>('exame');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<AnimalDocument | null>(null);

  const pick = (f: File | null) => {
    setFile(f);
    setError('');
    if (f && !name) setName(f.name);
    if (f?.type.startsWith('image/')) setKind((k) => (k === 'exame' ? 'foto' : k));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Escolha o arquivo.');
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`Arquivo grande demais. O limite é ${MAX_MB} MB.`);
      return;
    }
    setBusy(true);
    try {
      const ext = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')) : '';
      const finalName = name.trim() ? (name.trim().toLowerCase().endsWith(ext.toLowerCase()) ? name.trim() : `${name.trim()}${ext}`) : file.name;
      await actions.addDocument({ animalId: animal.id, file, name: finalName, kind });
      setFile(null);
      setName('');
      if (inputRef.current) inputRef.current.value = '';
      toast('Documento anexado.');
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const open = async (doc: AnimalDocument, download = false) => {
    try {
      await openDocument(doc, download);
    } catch (err) {
      toast((err as Error).message, 'error');
    }
  };

  return (
    <div className="stack-lg">
      <form onSubmit={submit} className="form-grid doc-form" noValidate>
        <Field label="Arquivo" required error={error} hint={`PDF, imagem ou Word, até ${MAX_MB} MB.`}>
          {(p) => <input {...p} ref={inputRef} type="file" accept={ACCEPT} className="input doc-form__file" onChange={(e) => pick(e.target.files?.[0] ?? null)} />}
        </Field>
        <Field label="Nome" optional className="col-4">
          {(p) => <input {...p} className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Hemograma de entrada" />}
        </Field>
        <Field label="Tipo" className="col-2">
          {(p) => (
            <select {...p} className="select" value={kind} onChange={(e) => setKind(e.target.value as DocumentKind)}>
              {Object.entries(DOCUMENT_KIND).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
          )}
        </Field>
        <div>
          <Button type="submit" variant="dark" size="sm" icon={<Paperclip aria-hidden />} loading={busy}>
            Anexar documento
          </Button>
        </div>
      </form>

      <div>
        <SectionLabel as="h3" count={docs.length}>
          Documentos
        </SectionLabel>
        {docs.length === 0 ? (
          <p className="muted">Nenhum documento anexado. Exames, receitas, laudos e termos de adoção ficam guardados aqui.</p>
        ) : (
          <ul className="doc-list">
            {docs.map((d) => (
              <li key={d.id} className="doc">
                <FileText aria-hidden className="doc__icon" />
                <div className="doc__main">
                  <button type="button" className="doc__name" onClick={() => open(d)}>
                    {d.name}
                  </button>
                  <p className="doc__meta">
                    {DOCUMENT_KIND[d.kind]} · {fmtDateTime(d.uploadedAt)}
                    {d.sizeKb != null && ` · ${d.sizeKb >= 1024 ? `${fmtNumber(d.sizeKb / 1024, 1)} MB` : `${d.sizeKb} KB`}`}
                    {userById(db, d.userId) && ` · ${userById(db, d.userId)!.name}`}
                  </p>
                </div>
                <div className="doc__actions">
                  <Button size="sm" variant="ghost" iconOnly icon={<ExternalLink aria-hidden />} aria-label={`Abrir ${d.name}`} title="Abrir" onClick={() => open(d)} />
                  <Button size="sm" variant="ghost" iconOnly icon={<Download aria-hidden />} aria-label={`Baixar ${d.name}`} title="Baixar" onClick={() => open(d, true)} />
                  <Button size="sm" variant="ghost" iconOnly icon={<Trash2 aria-hidden />} aria-label={`Excluir ${d.name}`} title="Excluir" onClick={() => setRemoving(d)} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ConfirmDialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        title={`Excluir ${removing?.name ?? 'documento'}?`}
        description="O arquivo é apagado e não pode ser recuperado."
        confirmLabel="Excluir"
        onConfirm={async () => {
          await actions.deleteDocument(removing!);
          toast('Documento excluído.');
        }}
      />
    </div>
  );
}
