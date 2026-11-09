import { useSearchParams } from 'react-router-dom';
import { eachDayOfInterval, endOfMonth, format, startOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useData } from '@/data/store';
import { inCare } from '@/data/selectors';
import { BarChart } from '@/components/BarChart';
import { AnimalStatusTag, PageHeader, SectionLabel, Skeleton } from '@/components/ui';
import { fmtMoney, fmtNumber, isoDate, nightsBetween, toDate } from '@/lib/format';
import { ANIMAL_STATUS_ORDER } from '@/lib/labels';
import './dashboard.css';
import './reports.css';

const PERIODS = [3, 6, 12];
// Paleta categórica validada (contraste ≥ 3:1 no fundo, separação para daltonismo).
const C_INTAKE = '#3b6fb0';
const C_ADOPT = '#a86b00';
const C_SINGLE = '#474338';

export function ReportsPage() {
  const { db, ready } = useData();
  const [params, setParams] = useSearchParams();
  const months = PERIODS.includes(Number(params.get('meses'))) ? Number(params.get('meses')) : 6;

  const now = new Date();
  const buckets = Array.from({ length: months }, (_, i) => {
    const d = subMonths(now, months - 1 - i);
    return { key: format(d, 'yyyy-MM'), label: format(d, months > 6 ? 'MMM' : 'MMM/yy', { locale: ptBR }).replace('.', ''), start: startOfMonth(d), end: endOfMonth(d) };
  });
  const from = isoDate(buckets[0].start);
  const inMonth = (iso: string | undefined, key: string) => !!iso && iso.slice(0, 7) === key;

  // Abrigo
  const intakes = buckets.map((b) => db.animals.filter((a) => inMonth(a.intakeDate, b.key)).length);
  const adoptions = buckets.map((b) => db.animals.filter((a) => inMonth(a.adoption?.date, b.key)).length);
  const adoptedInPeriod = db.animals.filter((a) => a.adoption && a.adoption.date >= from);
  const avgDaysToAdopt = adoptedInPeriod.length
    ? Math.round(adoptedInPeriod.reduce((s, a) => s + nightsBetween(a.intakeDate, a.adoption!.date), 0) / adoptedInPeriod.length)
    : 0;
  const care = inCare(db);
  const byStatus = ANIMAL_STATUS_ORDER.filter((s) => s !== 'adotado').map((s) => ({ status: s, n: care.filter((a) => a.status === s).length }));
  const maxStatus = Math.max(1, ...byStatus.map((s) => s.n));
  const longest = [...care].sort((a, b) => a.intakeDate.localeCompare(b.intakeDate)).slice(0, 5);

  // Hotelzinho
  const checkoutsIn = (key: string) => db.checkouts.filter((c) => c.at.slice(0, 7) === key);
  const revenue = buckets.map((b) => checkoutsIn(b.key).reduce((s, c) => s + c.finalValue, 0));
  const finished = db.bookings.filter((b) => b.status === 'finalizada' && b.checkOut >= from);
  const nightsSold = finished.reduce((s, b) => s + Math.max(1, nightsBetween(b.checkIn, b.checkOut)), 0);
  const totalRevenue = revenue.reduce((a, b) => a + b, 0);
  const capacity = db.accommodations.reduce((s, a) => s + a.capacity, 0);
  const occupancy = buckets.map((b) => {
    const days = eachDayOfInterval({ start: b.start, end: b.end > now ? now : b.end });
    // Histórico: conta hospedagens reais (em andamento ou finalizadas), não reservas.
    const real = db.bookings.filter((x) => x.status === 'hospedado' || x.status === 'finalizada' || x.status === 'confirmada');
    const used = days.reduce((s, d) => {
      const iso = isoDate(d);
      return s + real.filter((x) => x.checkIn <= iso && x.checkOut > iso).length;
    }, 0);
    return Math.round((used / (days.length * capacity)) * 100);
  });

  const setMonths = (m: number) => setParams(m === 6 ? {} : { meses: String(m) }, { replace: true });

  return (
    <div className="page">
      <PageHeader
        title="Relatórios"
        sub={`${format(buckets[0].start, "MMMM 'de' yyyy", { locale: ptBR })} até hoje`}
        actions={
          <div className="segmented" role="group" aria-label="Período">
            {PERIODS.map((p) => (
              <button key={p} type="button" aria-pressed={months === p} onClick={() => setMonths(p)}>
                {p} meses
              </button>
            ))}
          </div>
        }
      />

      {!ready ? (
        <Skeleton h={400} />
      ) : (
        <div className="reports">
          <section aria-labelledby="r-shelter">
            <SectionLabel id="r-shelter">Abrigo</SectionLabel>
            <div className="stat-strip stat-strip--4">
              <Stat value={fmtNumber(intakes.reduce((a, b) => a + b, 0))} label="Entradas no período" />
              <Stat value={fmtNumber(adoptedInPeriod.length)} label="Adoções no período" />
              <Stat value={adoptedInPeriod.length ? `${avgDaysToAdopt} dias` : '—'} label="Tempo médio até a adoção" />
              <Stat value={fmtNumber(care.length)} label="Sob cuidado hoje" />
            </div>

            <div className="reports__row">
              <BarChart
                title="Entradas e adoções por mês"
                categories={buckets.map((b) => b.label)}
                series={[
                  { key: 'in', label: 'Entradas', color: C_INTAKE },
                  { key: 'out', label: 'Adoções', color: C_ADOPT },
                ]}
                values={{ in: intakes, out: adoptions }}
              />
              <div>
                <p className="chart__title" style={{ marginBottom: 12 }}>
                  Situação dos animais hoje
                </p>
                <ul className="hbars">
                  {byStatus.map((s) => (
                    <li key={s.status}>
                      <AnimalStatusTag status={s.status} short bare />
                      <span className="hbars__track" aria-hidden>
                        <span style={{ width: `${(s.n / maxStatus) * 100}%` }} />
                      </span>
                      <span className="hbars__n tnum">{s.n}</span>
                    </li>
                  ))}
                </ul>
                <p className="chart__title" style={{ margin: '28px 0 8px' }}>
                  Há mais tempo esperando adoção
                </p>
                <ol className="ranked">
                  {longest.map((a) => (
                    <li key={a.id}>
                      <span>{a.name}</span>
                      <span className="muted tnum">{nightsBetween(a.intakeDate, isoDate(now))} dias</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </section>

          <section aria-labelledby="r-hotel">
            <SectionLabel id="r-hotel">Hotelzinho</SectionLabel>
            <div className="stat-strip stat-strip--4">
              <Stat value={fmtMoney(totalRevenue)} label="Faturamento no período" />
              <Stat value={fmtNumber(nightsSold)} label="Diárias vendidas" />
              <Stat value={finished.length ? fmtMoney(totalRevenue / finished.length) : '—'} label="Ticket médio por hospedagem" />
              <Stat value={`${occupancy[occupancy.length - 1]}%`} label={`Ocupação em ${buckets[buckets.length - 1].label}`} />
            </div>
            <div className="reports__row reports__row--even">
              <BarChart title="Faturamento por mês (check-outs)" categories={buckets.map((b) => b.label)} series={[{ key: 'r', label: 'Faturamento', color: C_SINGLE }]} values={{ r: revenue }} format={(n) => (n >= 1000 ? `R$ ${fmtNumber(n / 1000, 1)} mil` : fmtMoney(n))} />
              <BarChart title="Ocupação média do hotelzinho" categories={buckets.map((b) => b.label)} series={[{ key: 'o', label: 'Ocupação', color: C_SINGLE }]} values={{ o: occupancy }} format={(n) => `${n}%`} />
            </div>
          </section>

          <p className="muted reports__note">
            Faturamento considera o valor final registrado no check-out. Ocupação considera hospedagens confirmadas e em andamento sobre {capacity} vagas. Os dados de {format(toDate(isoDate(now)), 'MMMM', { locale: ptBR })} vão até hoje.
          </p>
        </div>
      )}
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="stat">
      <span className="stat__value tnum">{value}</span>
      <span className="stat__label">{label}</span>
    </div>
  );
}
