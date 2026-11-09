import { AlertCircle, Plus, Trash2 } from 'lucide-react';
import type { Species } from '@/data/types';
import type { VaccineDraft } from '@/data/store';
import { Button } from '@/components/ui';
import { todayIso } from '@/lib/format';

export type VaccineRow = { key: string; id?: string; name: string; date: string; nextDue: string; batch: string; vet: string };
export type VaccineRowErrors = Record<string, Partial<Record<'name' | 'date' | 'nextDue', string>>>;

export const VACCINE_SUGGESTIONS: Record<Species, string[]> = {
  cao: ['V10 (polivalente)', 'V8 (polivalente)', 'Antirrábica', 'Gripe canina (tosse dos canis)', 'Giárdia', 'Leishmaniose'],
  gato: ['V4 felina', 'V5 felina', 'Antirrábica', 'FeLV (leucemia felina)'],
};

let seq = 0;
export const newRow = (partial: Partial<VaccineRow> = {}): VaccineRow => ({ key: `r${++seq}`, name: '', date: '', nextDue: '', batch: '', vet: '', ...partial });

export function validateVaccineRows(rows: VaccineRow[]): VaccineRowErrors {
  const errors: VaccineRowErrors = {};
  for (const r of rows) {
    const e: VaccineRowErrors[string] = {};
    if (!r.name.trim()) e.name = 'Informe a vacina.';
    if (!r.date) e.date = 'Informe a data da aplicação.';
    else if (r.date > todayIso()) e.date = 'A aplicação não pode ser no futuro.';
    if (r.nextDue && r.date && r.nextDue <= r.date) e.nextDue = 'A próxima dose precisa ser depois da aplicação.';
    if (Object.keys(e).length) errors[r.key] = e;
  }
  return errors;
}

export const rowsToDrafts = (rows: VaccineRow[]): VaccineDraft[] =>
  rows.map((r) => ({
    id: r.id,
    name: r.name.trim(),
    date: r.date,
    nextDue: r.nextDue || undefined,
    batch: r.batch.trim() || undefined,
    vet: r.vet.trim() || undefined,
  }));

/**
 * Histórico de vacinas editável no cadastro do animal.
 * Serve para lançar a carteirinha que chega com o animal (doses antigas)
 * e corrigir registros. Doses novas do dia a dia também podem ser
 * registradas pelo prontuário (aba Saúde).
 */
export function VaccineHistoryEditor({
  rows,
  onChange,
  errors,
  species,
  defaultVet,
}: {
  rows: VaccineRow[];
  onChange: (rows: VaccineRow[]) => void;
  errors: VaccineRowErrors;
  species: Species;
  defaultVet?: string;
}) {
  const update = (key: string, patch: Partial<VaccineRow>) => onChange(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const add = () => {
    const row = newRow({ vet: defaultVet ?? '' });
    onChange([...rows, row]);
    setTimeout(() => document.getElementById(`vac-${row.key}-name`)?.focus(), 30);
  };

  return (
    <div className="vac-editor">
      {rows.length === 0 ? (
        <p className="muted">Nenhuma vacina lançada. Se o animal chegou com carteirinha, registre as doses aqui.</p>
      ) : (
        <ol className="vac-rows">
          {rows.map((r, i) => {
            const e = errors[r.key] ?? {};
            const id = (f: string) => `vac-${r.key}-${f}`;
            return (
              <li key={r.key} className="vac-row">
                <span className="vac-row__n tnum" aria-hidden>
                  {i + 1}
                </span>
                <div className="vac-row__fields">
                  <div className="field vac-row__name">
                    <label className="field__label" htmlFor={id('name')}>
                      Vacina<span className="req" aria-hidden>*</span>
                    </label>
                    <input
                      id={id('name')}
                      className="input"
                      list={`vac-suggest-${species}`}
                      value={r.name}
                      onChange={(ev) => update(r.key, { name: ev.target.value })}
                      aria-invalid={e.name ? true : undefined}
                      aria-describedby={e.name ? id('name-err') : undefined}
                    />
                    {e.name && <FieldError id={id('name-err')} msg={e.name} />}
                  </div>
                  <div className="field">
                    <label className="field__label" htmlFor={id('date')}>
                      Aplicação<span className="req" aria-hidden>*</span>
                    </label>
                    <input
                      id={id('date')}
                      type="date"
                      className="input"
                      max={todayIso()}
                      value={r.date}
                      onChange={(ev) => update(r.key, { date: ev.target.value })}
                      aria-invalid={e.date ? true : undefined}
                      aria-describedby={e.date ? id('date-err') : undefined}
                    />
                    {e.date && <FieldError id={id('date-err')} msg={e.date} />}
                  </div>
                  <div className="field">
                    <label className="field__label" htmlFor={id('next')}>
                      Próxima dose <span className="opt">(opcional)</span>
                    </label>
                    <input
                      id={id('next')}
                      type="date"
                      className="input"
                      min={r.date || undefined}
                      value={r.nextDue}
                      onChange={(ev) => update(r.key, { nextDue: ev.target.value })}
                      aria-invalid={e.nextDue ? true : undefined}
                      aria-describedby={e.nextDue ? id('next-err') : undefined}
                    />
                    {e.nextDue && <FieldError id={id('next-err')} msg={e.nextDue} />}
                  </div>
                  <div className="field">
                    <label className="field__label" htmlFor={id('batch')}>
                      Lote <span className="opt">(opcional)</span>
                    </label>
                    <input id={id('batch')} className="input" value={r.batch} onChange={(ev) => update(r.key, { batch: ev.target.value })} />
                  </div>
                  <div className="field">
                    <label className="field__label" htmlFor={id('vet')}>
                      Aplicada por <span className="opt">(opcional)</span>
                    </label>
                    <input id={id('vet')} className="input" value={r.vet} onChange={(ev) => update(r.key, { vet: ev.target.value })} />
                  </div>
                </div>
                <Button
                  variant="danger-ghost"
                  size="sm"
                  iconOnly
                  className="vac-row__remove"
                  icon={<Trash2 aria-hidden />}
                  aria-label={`Remover ${r.name || `vacina ${i + 1}`}`}
                  onClick={() => onChange(rows.filter((x) => x.key !== r.key))}
                />
              </li>
            );
          })}
        </ol>
      )}
      <datalist id={`vac-suggest-${species}`}>
        {VACCINE_SUGGESTIONS[species].map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      <Button size="sm" icon={<Plus aria-hidden />} onClick={add}>
        Adicionar vacina
      </Button>
    </div>
  );
}

function FieldError({ id, msg }: { id: string; msg: string }) {
  return (
    <p className="field__error" id={id}>
      <AlertCircle aria-hidden />
      {msg}
    </p>
  );
}
