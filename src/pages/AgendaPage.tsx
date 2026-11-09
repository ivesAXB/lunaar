import { Link, useSearchParams } from 'react-router-dom';
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowDownRight, ArrowUpRight, ChevronLeft, ChevronRight, Stethoscope, Syringe } from 'lucide-react';
import { useData } from '@/data/store';
import { bookingViews, inCare, occupyingOn, type BookingView } from '@/data/selectors';
import { BookingStatusTag, Button, PageHeader, Photo, SectionLabel, Skeleton } from '@/components/ui';
import { isoDate, toDate, todayIso } from '@/lib/format';
import { BOOKING_STATUS } from '@/lib/labels';
import './boarding/boarding.css';
import './agenda.css';

type Mode = 'dia' | 'semana' | 'mes';
const MODES: { key: Mode; label: string }[] = [
  { key: 'dia', label: 'Dia' },
  { key: 'semana', label: 'Semana' },
  { key: 'mes', label: 'Mês' },
];
const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

export function AgendaPage() {
  const { db, ready } = useData();
  const [params, setParams] = useSearchParams();
  const mode = (MODES.find((m) => m.key === params.get('modo'))?.key ?? 'semana') as Mode;
  const date = params.get('data') ?? todayIso();
  const current = toDate(date);

  const go = (patch: { modo?: Mode; data?: string }) => {
    const next = new URLSearchParams(params);
    if (patch.modo) next.set('modo', patch.modo);
    if (patch.data) next.set('data', patch.data);
    setParams(next, { replace: true });
  };
  const shift = (dir: 1 | -1) => {
    const d = mode === 'dia' ? addDays(current, dir) : mode === 'semana' ? addWeeks(current, dir) : addMonths(current, dir);
    go({ data: isoDate(d) });
  };

  const views = bookingViews(db).filter((b) => b.status !== 'cancelada');
  const capacity = db.accommodations.reduce((s, a) => s + a.capacity, 0);

  const label =
    mode === 'dia'
      ? format(current, "EEEE, d 'de' MMMM", { locale: ptBR })
      : mode === 'semana'
        ? `${format(startOfWeek(current, { weekStartsOn: 1 }), "d 'de' MMM", { locale: ptBR })} – ${format(endOfWeek(current, { weekStartsOn: 1 }), "d 'de' MMM", { locale: ptBR })}`
        : format(current, "MMMM 'de' yyyy", { locale: ptBR });

  return (
    <div className="page">
      <PageHeader title="Agenda" sub="Entradas, saídas e ocupação do hotelzinho, com as tarefas de saúde do abrigo." />

      <div className="agenda-bar">
        <div className="agenda-bar__nav">
          <Button iconOnly variant="ghost" aria-label="Período anterior" icon={<ChevronLeft aria-hidden />} onClick={() => shift(-1)} />
          <Button iconOnly variant="ghost" aria-label="Próximo período" icon={<ChevronRight aria-hidden />} onClick={() => shift(1)} />
          <h2 className="agenda-bar__label" aria-live="polite">
            {label}
          </h2>
          {date !== todayIso() && (
            <Button size="sm" onClick={() => go({ data: todayIso() })}>
              Hoje
            </Button>
          )}
        </div>
        <div className="segmented" role="tablist" aria-label="Visualização">
          {MODES.map((m) => (
            <button key={m.key} type="button" role="tab" aria-selected={mode === m.key} onClick={() => go({ modo: m.key })}>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {!ready ? (
        <Skeleton h={420} />
      ) : mode === 'mes' ? (
        <MonthView current={current} views={views} capacity={capacity} onPick={(d) => go({ modo: 'dia', data: d })} />
      ) : mode === 'semana' ? (
        <WeekView current={current} views={views} capacity={capacity} onPick={(d) => go({ modo: 'dia', data: d })} />
      ) : (
        <DayView date={date} views={views} capacity={capacity} />
      )}

      <p className="agenda-legend" aria-label="Legenda">
        {(['reserva', 'confirmada', 'hospedado', 'finalizada'] as const).map((s) => (
          <span key={s}>
            <i className="bar-swatch" data-status={s} aria-hidden /> {BOOKING_STATUS[s].label}
          </span>
        ))}
      </p>
    </div>
  );
}

function useShelterTasks() {
  const { db } = useData();
  const care = new Set(inCare(db).map((a) => a.id));
  const name = (id: string) => db.animals.find((a) => a.id === id)?.name ?? '';
  const tasks = [
    ...db.treatments.filter((t) => t.status === 'pendente' && care.has(t.animalId)).map((t) => ({ id: t.id, date: t.startDate, animalId: t.animalId, kind: 'treat' as const, text: `${name(t.animalId)} · ${t.title}` })),
    ...db.vaccines.filter((v) => v.nextDue && care.has(v.animalId)).map((v) => ({ id: v.id, date: v.nextDue!, animalId: v.animalId, kind: 'vac' as const, text: `${name(v.animalId)} · ${v.name}` })),
  ];
  return (d: string) => tasks.filter((t) => t.date === d);
}

function MonthView({ current, views, capacity, onPick }: { current: Date; views: BookingView[]; capacity: number; onPick: (d: string) => void }) {
  const { db } = useData();
  const tasksOn = useShelterTasks();
  const days = eachDayOfInterval({ start: startOfWeek(startOfMonth(current), { weekStartsOn: 1 }), end: endOfWeek(endOfMonth(current), { weekStartsOn: 1 }) });
  const today = todayIso();
  return (
    <div className="month">
      <div className="month__head" aria-hidden>
        {WEEKDAYS.map((d) => (
          <span key={d}>
            {d}
          </span>
        ))}
      </div>
      <div className="month__grid">
        {days.map((day) => {
          const iso = isoDate(day);
          const ins = views.filter((b) => b.checkIn === iso);
          const outs = views.filter((b) => b.checkOut === iso);
          const occ = occupyingOn(db, iso).length;
          const tasks = tasksOn(iso);
          const pct = Math.min(100, (occ / capacity) * 100);
          const summary = `${format(day, "d 'de' MMMM", { locale: ptBR })}: ${ins.length} entradas, ${outs.length} saídas, ${occ} de ${capacity} vagas ocupadas${tasks.length ? `, ${tasks.length} tarefas de saúde` : ''}`;
          return (
            <button
              key={iso}
              type="button"
              className="month__cell"
              data-out={!isSameMonth(day, current) || undefined}
              data-today={iso === today || undefined}
              onClick={() => onPick(iso)}
              aria-label={summary}
            >
              <span className="month__num tnum">{format(day, 'd')}</span>
              <span className="month__events" aria-hidden>
                {ins.length > 0 && (
                  <span className="ev ev--in">
                    <ArrowDownRight /> {ins.length === 1 ? ins[0].pet.name : `${ins.length} entradas`}
                  </span>
                )}
                {outs.length > 0 && (
                  <span className="ev ev--out">
                    <ArrowUpRight /> {outs.length === 1 ? outs[0].pet.name : `${outs.length} saídas`}
                  </span>
                )}
                {tasks.length > 0 && (
                  <span className="ev ev--task">
                    <Stethoscope /> {tasks.length === 1 ? tasks[0].text.split(' · ')[0] : `${tasks.length} tarefas`}
                  </span>
                )}
              </span>
              <span className="month__occ" aria-hidden>
                <span style={{ width: `${pct}%` }} />
              </span>
              <span className="month__dots" aria-hidden>
                {ins.length > 0 && <i className="dot dot--in" />}
                {outs.length > 0 && <i className="dot dot--out" />}
                {tasks.length > 0 && <i className="dot dot--task" />}
              </span>
            </button>
          );
        })}
      </div>
      <p className="muted month__foot">A barra fina em cada dia mostra a ocupação do hotelzinho ({capacity} vagas).</p>
    </div>
  );
}

function WeekView({ current, views, capacity, onPick }: { current: Date; views: BookingView[]; capacity: number; onPick: (d: string) => void }) {
  const { db } = useData();
  const tasksOn = useShelterTasks();
  const start = startOfWeek(current, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start, end: addDays(start, 6) }).map(isoDate);
  const first = days[0];
  const endExcl = isoDate(addDays(start, 7));
  const today = todayIso();
  const rows = views.filter((b) => b.checkIn < endExcl && b.checkOut >= first).sort((a, b) => a.checkIn.localeCompare(b.checkIn));

  const col = (iso: string) => Math.round((toDate(iso).getTime() - toDate(first).getTime()) / 86_400_000);

  return (
    <div className="week">
      <div className="week__scroll">
        <div className="week__grid" style={{ gridTemplateRows: `auto auto repeat(${Math.max(rows.length, 1)}, 48px)` }}>
          <div className="week__corner" />
          {days.map((d) => (
            <button key={d} type="button" className="week__day" data-today={d === today || undefined} onClick={() => onPick(d)}>
              <span>{format(toDate(d), 'EEE', { locale: ptBR })}</span>
              <strong className="tnum">{format(toDate(d), 'd')}</strong>
            </button>
          ))}
          <div className="week__rowlabel week__rowlabel--occ">Ocupação</div>
          {days.map((d) => {
            const occ = occupyingOn(db, d).length;
            const tasks = tasksOn(d);
            return (
              <div key={d} className="week__occ" data-today={d === today || undefined}>
                <span className="tnum">
                  {occ}/{capacity}
                </span>
                <span className="week__occbar" aria-hidden>
                  <span style={{ width: `${Math.min(100, (occ / capacity) * 100)}%` }} />
                </span>
                {tasks.length > 0 && (
                  <span className="week__tasks" title={tasks.map((t) => t.text).join('\n')}>
                    <Syringe aria-hidden /> {tasks.length}
                    <span className="visually-hidden"> tarefas de saúde no abrigo</span>
                  </span>
                )}
              </div>
            );
          })}
          {rows.length === 0 && <div className="week__empty">Nenhuma hospedagem nesta semana.</div>}
          {rows.map((b, i) => {
            const s = Math.max(0, col(b.checkIn));
            const e = Math.min(7, col(b.checkOut) + 1);
            return (
              <div key={b.id} style={{ display: 'contents' }}>
                <Link to={`/hospedagem/${b.id}`} className="week__rowlabel" style={{ gridRow: i + 3 }}>
                  <Photo src={b.pet.photo} alt="" name={b.pet.name} size={28} round />
                  <span>{b.pet.name}</span>
                </Link>
                {days.map((d, di) => (
                  <div key={d} className="week__cellbg" data-today={d === today || undefined} style={{ gridRow: i + 3, gridColumn: di + 2 }} />
                ))}
                <Link
                  to={`/hospedagem/${b.id}`}
                  className="week__bar"
                  data-status={b.status}
                  data-cut-start={col(b.checkIn) < 0 || undefined}
                  data-cut-end={col(b.checkOut) > 6 || undefined}
                  style={{ gridRow: i + 3, gridColumn: `${s + 2} / ${e + 2}` }}
                  aria-label={`${b.pet.name}: ${format(toDate(b.checkIn), 'dd/MM')} a ${format(toDate(b.checkOut), 'dd/MM')}, ${BOOKING_STATUS[b.status].label}`}
                >
                  <span>{b.pet.name}</span>
                  <small>{b.client.name.split(' ')[0]}</small>
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function DayView({ date, views, capacity }: { date: string; views: BookingView[]; capacity: number }) {
  const { db } = useData();
  const tasks = useShelterTasks()(date);
  const ins = views.filter((b) => b.checkIn === date);
  const outs = views.filter((b) => b.checkOut === date);
  const staying = views.filter((b) => b.checkIn < date && b.checkOut > date && ['hospedado', 'confirmada', 'reserva'].includes(b.status));
  const occ = occupyingOn(db, date).length;

  const List = ({ items, kind }: { items: BookingView[]; kind: 'in' | 'out' | 'stay' }) =>
    items.length === 0 ? (
      <p className="muted">{kind === 'in' ? 'Nenhuma entrada.' : kind === 'out' ? 'Nenhuma saída.' : 'Nenhum pet em continuidade.'}</p>
    ) : (
      <ul className="plain-list">
        {items.map((b) => (
          <li key={b.id}>
            <Link to={`/hospedagem/${b.id}`} className="plain-list__item" style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                <Photo src={b.pet.photo} alt="" name={b.pet.name} size={40} round />
                <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <strong>{b.pet.name}</strong>
                  <span className="muted">
                    {b.client.name} · {db.accommodations.find((a) => a.id === b.accommodationId)?.name}
                  </span>
                </span>
              </span>
              <BookingStatusTag status={b.status} />
            </Link>
          </li>
        ))}
      </ul>
    );

  return (
    <div className="day">
      <div className="day__main">
        <section aria-labelledby="d-in">
          <SectionLabel id="d-in" count={ins.length}>
            Entradas
          </SectionLabel>
          <List items={ins} kind="in" />
        </section>
        <section aria-labelledby="d-out">
          <SectionLabel id="d-out" count={outs.length}>
            Saídas
          </SectionLabel>
          <List items={outs} kind="out" />
        </section>
        <section aria-labelledby="d-stay">
          <SectionLabel id="d-stay" count={staying.length}>
            Continuam hospedados
          </SectionLabel>
          <List items={staying} kind="stay" />
        </section>
      </div>
      <aside className="day__side">
        <section aria-labelledby="d-occ">
          <SectionLabel id="d-occ">Ocupação</SectionLabel>
          <p className="day__occ tnum">
            <strong>{occ}</strong> de {capacity} vagas
          </p>
          <dl className="summary-list">
            {db.accommodations.map((a) => {
              const n = occupyingOn(db, date, a.id).length;
              return (
                <div key={a.id}>
                  <dt>{a.name}</dt>
                  <dd className="tnum">
                    {n}/{a.capacity}
                  </dd>
                </div>
              );
            })}
          </dl>
        </section>
        <section aria-labelledby="d-tasks">
          <SectionLabel id="d-tasks" count={tasks.length}>
            Saúde no abrigo
          </SectionLabel>
          {tasks.length === 0 ? (
            <p className="muted">Nenhuma tarefa de saúde agendada.</p>
          ) : (
            <ul className="plain-list">
              {tasks.map((t) => (
                <li key={t.id}>
                  <Link to={`/animais/${t.animalId}?aba=saude`} className="plain-list__item">
                    {t.kind === 'vac' ? <Syringe size={18} aria-hidden /> : <Stethoscope size={18} aria-hidden />}
                    <span>{t.text}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </aside>
    </div>
  );
}
