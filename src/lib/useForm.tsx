import { useCallback, useRef, useState, type ChangeEvent } from 'react';
import { AlertCircle } from 'lucide-react';

type Errors<T> = Partial<Record<keyof T, string>>;

/**
 * Estado de formulário com validação:
 * - valida no blur de cada campo (depois que ele foi tocado);
 * - no envio, valida tudo, mostra o resumo de erros e foca o primeiro campo inválido.
 * Cada campo usa o id `f-<nome>` para ser alcançável pelo resumo.
 */
export function useForm<T extends Record<string, unknown>>(initial: T, validate: (v: T) => Errors<T>) {
  const [values, setValues] = useState<T>(initial);
  const [errors, setErrors] = useState<Errors<T>>({});
  const [showSummary, setShowSummary] = useState(false);
  const touched = useRef(new Set<keyof T>());
  const valuesRef = useRef(values);
  valuesRef.current = values;

  const revalidate = useCallback(
    (next: T, only?: keyof T) => {
      const all = validate(next);
      setErrors((prev) => {
        if (!only) return all;
        const copy = { ...prev };
        if (all[only]) copy[only] = all[only];
        else delete copy[only];
        // Remove erros já corrigidos em outros campos tocados
        (Object.keys(copy) as (keyof T)[]).forEach((k) => !all[k] && delete copy[k]);
        return copy;
      });
    },
    [validate],
  );

  const set = useCallback(
    <K extends keyof T>(key: K, value: T[K]) => {
      const next = { ...valuesRef.current, [key]: value };
      valuesRef.current = next;
      setValues(next);
      if (touched.current.has(key)) revalidate(next, key);
    },
    [revalidate],
  );

  const bind = <K extends keyof T>(key: K, transform?: (v: string) => T[K]) => ({
    id: `f-${String(key)}`,
    value: (values[key] ?? '') as string,
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      set(key, (transform ? transform(e.target.value) : e.target.value) as T[K]),
    onBlur: () => {
      touched.current.add(key);
      revalidate(valuesRef.current, key);
    },
  });

  const check = () => {
    (Object.keys(values) as (keyof T)[]).forEach((k) => touched.current.add(k));
    const all = validate(values);
    setErrors(all);
    const keys = Object.keys(all);
    setShowSummary(keys.length > 1);
    if (keys.length) {
      const el = document.getElementById(`f-${keys[0]}`);
      el?.focus();
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return false;
    }
    return true;
  };

  return { values, set, bind, errors, check, showSummary, setValues };
}

export function ErrorSummary<T>({ errors, labels }: { errors: Partial<Record<keyof T, string>>; labels: Partial<Record<keyof T, string>> }) {
  const entries = Object.entries(errors).filter(([, v]) => v) as [string, string][];
  if (entries.length < 2) return null;
  return (
    <div className="error-summary" role="alert" tabIndex={-1}>
      <AlertCircle size={20} aria-hidden style={{ flex: 'none', marginTop: 2 }} />
      <div>
        <strong>Corrija {entries.length} campos para continuar:</strong>
        <ul>
          {entries.map(([k, msg]) => (
            <li key={k}>
              <a
                href={`#f-${k}`}
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById(`f-${k}`)?.focus();
                }}
              >
                {labels[k as keyof T] ?? k}: {msg}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
