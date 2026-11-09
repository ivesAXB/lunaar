import { useData, type BaseFilter } from '@/data/store';
import { useToast } from './toast';

const OPTIONS: { value: BaseFilter; label: string; short: string }[] = [
  { value: 'ong', label: 'ONG Lunaar', short: 'ONG' },
  { value: 'recanto', label: 'Recanto', short: 'Recanto' },
  { value: 'todas', label: 'Todas', short: 'Todas' },
];

/** Alterna a unidade exibida: cada uma tem seus animais, canis e tarefas. */
export function BaseSwitcher() {
  const { base, setBase } = useData();
  const toast = useToast();
  return (
    <div className="segmented base-switcher" role="group" aria-label="Unidade exibida">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={base === o.value}
          onClick={() => {
            if (o.value === base) return;
            setBase(o.value);
            toast(o.value === 'todas' ? 'Exibindo as duas unidades.' : `Exibindo ${o.label}.`, 'info');
          }}
        >
          <span className="base-switcher__long">{o.label}</span>
          <span className="base-switcher__short">
            {o.short}
          </span>
        </button>
      ))}
    </div>
  );
}
