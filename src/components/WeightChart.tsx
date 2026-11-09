import { useEffect, useId, useRef, useState } from 'react';
import type { AnimalWeight } from '@/data/types';
import { fmtDate, fmtKg, toDate } from '@/lib/format';
import './chart.css';

/**
 * Evolução de peso em SVG: linha fina, pontos nas medições, eixo de tempo real
 * (medições espaçadas de forma irregular ficam no lugar certo) e dica ao
 * passar o mouse ou focar pelo teclado. A tabela da aba Peso é a alternativa textual.
 */
export function WeightChart({ data, height = 200 }: { data: AnimalWeight[]; height?: number }) {
  const id = useId();
  const plotRef = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(640);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = plotRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (data.length === 0) return null;

  const H = height;
  const pad = { top: 18, right: 16, bottom: 26, left: 44 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;
  const times = data.map((w) => toDate(w.measuredOn).getTime());
  const t0 = Math.min(...times);
  const t1 = Math.max(...times);
  const kgs = data.map((w) => w.weightKg);
  const lo = Math.min(...kgs);
  const hi = Math.max(...kgs);
  const spread = Math.max(hi - lo, hi * 0.1, 0.5);
  const yMin = Math.max(0, lo - spread * 0.25);
  const yMax = hi + spread * 0.25;
  const x = (t: number) => pad.left + (t1 === t0 ? innerW / 2 : ((t - t0) / (t1 - t0)) * innerW);
  const y = (kg: number) => pad.top + innerH - ((kg - yMin) / (yMax - yMin)) * innerH;
  const ticks = [yMin, (yMin + yMax) / 2, yMax];
  const points = data.map((w, i) => ({ w, cx: x(times[i]), cy: y(w.weightKg) }));
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${p.cx.toFixed(1)},${p.cy.toFixed(1)}`).join(' ');
  const active = hover != null ? points[hover] : null;

  return (
    <figure className="chart" aria-labelledby={`${id}-t`}>
      <figcaption className="chart__head">
        <span id={`${id}-t`} className="chart__title">
          Evolução do peso
        </span>
      </figcaption>
      <div ref={plotRef} className="chart__plot" style={{ position: 'relative' }}>
        <svg width={W} height={H} role="img" aria-label={`Peso de ${fmtKg(data[0].weightKg)} em ${fmtDate(data[0].measuredOn)} a ${fmtKg(data[data.length - 1].weightKg)} em ${fmtDate(data[data.length - 1].measuredOn)}`}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.left} x2={W - pad.right} y1={y(t)} y2={y(t)} className="chart__grid" />
              <text x={pad.left - 8} y={y(t) + 4} textAnchor="end" className="chart__tick">
                {t.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}
              </text>
            </g>
          ))}
          <text x={pad.left} y={H - 6} className="chart__tick">
            {fmtDate(data[0].measuredOn, 'dd/MM/yy')}
          </text>
          {data.length > 1 && (
            <text x={W - pad.right} y={H - 6} className="chart__tick" textAnchor="end">
              {fmtDate(data[data.length - 1].measuredOn, 'dd/MM/yy')}
            </text>
          )}
          <path d={path} fill="none" stroke="var(--ink)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          {points.map((p, i) => (
            <circle
              key={p.w.id}
              cx={p.cx}
              cy={p.cy}
              r={hover === i ? 6 : 4}
              fill={i === points.length - 1 ? 'var(--yellow)' : 'var(--surface)'}
              stroke="var(--ink)"
              strokeWidth="2"
              tabIndex={0}
              aria-label={`${fmtDate(p.w.measuredOn)}: ${fmtKg(p.w.weightKg)}`}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              style={{ cursor: 'default', outline: 'none' }}
            />
          ))}
        </svg>
        {active && (
          <div
            className="chart__tip"
            role="presentation"
            style={{ position: 'absolute', left: Math.min(Math.max(active.cx, 60), W - 60), top: active.cy - 12, transform: 'translate(-50%, -100%)' }}
          >
            <strong className="tnum">{fmtKg(active.w.weightKg)}</strong>
            <span>{fmtDate(active.w.measuredOn)}</span>
          </div>
        )}
      </div>
    </figure>
  );
}
