import { useEffect, useId, useRef, useState } from 'react';
import './chart.css';

export interface Series {
  key: string;
  label: string;
  color: string;
}

interface Props {
  title: string;
  categories: string[];
  series: Series[];
  values: Record<string, number[]>;
  format?: (n: number) => string;
  height?: number;
}

/**
 * Barras verticais (simples ou agrupadas) em SVG.
 * Marcas finas com topo arredondado, grade discreta, dica ao passar o mouse
 * ou focar pelo teclado, legenda para 2+ séries e alternativa em tabela.
 */
export function BarChart({ title, categories, series, values, format = (n) => String(n), height = 220 }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);
  const id = useId();

  const plotRef = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(640);
  useEffect(() => {
    const el = plotRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [asTable]);
  const H = height;
  const pad = { top: 16, right: 8, bottom: 28, left: 44 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;
  const max = Math.max(1, ...series.flatMap((s) => values[s.key]));
  const nice = niceMax(max);
  const ticks = [0, nice / 2, nice];
  const band = innerW / categories.length;
  const groupW = Math.min(band * 0.62, series.length * 26);
  const barW = (groupW - (series.length - 1) * 2) / series.length;
  const y = (v: number) => pad.top + innerH - (v / nice) * innerH;

  return (
    <figure className="chart" aria-labelledby={`${id}-t`}>
      <figcaption className="chart__head">
        <span id={`${id}-t`} className="chart__title">
          {title}
        </span>
        {series.length > 1 && (
          <span className="chart__legend">
            {series.map((s) => (
              <span key={s.key}>
                <i style={{ background: s.color }} aria-hidden />
                {s.label}
              </span>
            ))}
          </span>
        )}
        <button type="button" className="chart__toggle" onClick={() => setAsTable((t) => !t)} aria-pressed={asTable}>
          {asTable ? 'Ver gráfico' : 'Ver tabela'}
        </button>
      </figcaption>

      {asTable ? (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Mês</th>
                {series.map((s) => (
                  <th key={s.key} scope="col" className="num">
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {categories.map((c, i) => (
                <tr key={c}>
                  <td>{c}</td>
                  {series.map((s) => (
                    <td key={s.key} className="num">
                      {format(values[s.key][i])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="chart__plot" ref={plotRef}>
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}. ${summary(categories, series, values, format)}`}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={pad.left} x2={W - pad.right} y1={y(t)} y2={y(t)} className={t === 0 ? 'chart__base' : 'chart__grid'} />
                <text x={pad.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="chart__tick">
                  {format(t)}
                </text>
              </g>
            ))}
            {categories.map((c, i) => {
              const x0 = pad.left + band * i + (band - groupW) / 2;
              return (
                <g key={c}>
                  <rect
                    x={pad.left + band * i}
                    y={pad.top}
                    width={band}
                    height={innerH}
                    className="chart__hit"
                    data-active={hover === i || undefined}
                    onMouseEnter={() => setHover(i)}
                    onMouseLeave={() => setHover(null)}
                  />
                  {series.map((s, si) => {
                    const v = values[s.key][i];
                    const h = Math.max(v > 0 ? 2 : 0, (v / nice) * innerH);
                    const x = x0 + si * (barW + 2);
                    return <path key={s.key} d={roundedTop(x, pad.top + innerH - h, barW, h, Math.min(4, barW / 2))} fill={s.color} pointerEvents="none" />;
                  })}
                  <text x={pad.left + band * i + band / 2} y={H - 8} textAnchor="middle" className="chart__tick">
                    {c}
                  </text>
                </g>
              );
            })}
          </svg>
          {hover !== null && (
            <div className="chart__tip" style={{ left: `${((pad.left + band * hover + band / 2) / W) * 100}%` }} role="status">
              <strong>{categories[hover]}</strong>
              {series.map((s) => (
                <span key={s.key}>
                  <i style={{ background: s.color }} aria-hidden />
                  {s.label}: <b className="tnum">{format(values[s.key][hover])}</b>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </figure>
  );
}

function niceMax(v: number) {
  const pow = 10 ** Math.floor(Math.log10(v));
  const n = v / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

function roundedTop(x: number, y: number, w: number, h: number, r: number) {
  if (h <= 0) return '';
  const rr = Math.min(r, h);
  return `M${x},${y + h} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h} Z`;
}

function summary(categories: string[], series: Series[], values: Record<string, number[]>, format: (n: number) => string) {
  return series
    .map((s) => {
      const vals = values[s.key];
      const total = vals.reduce((a, b) => a + b, 0);
      const maxI = vals.indexOf(Math.max(...vals));
      return `${s.label}: total ${format(total)}, maior em ${categories[maxI]} (${format(vals[maxI])})`;
    })
    .join('. ');
}
