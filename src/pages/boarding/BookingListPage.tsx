import { useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { useData } from '@/data/store';
import { accommodationById, bookingViews, occupyingOn, type BookingView } from '@/data/selectors';
import { BookingStatusTag, ButtonLink, EmptyState, PageHeader, Photo, Skeleton, Tag } from '@/components/ui';
import { fmtDate, fmtMoney, normalize, todayIso } from '@/lib/format';
import type { BookingStatus } from '@/data/types';
import '../dashboard.css';

const TABS: { key: string; label: string; statuses: BookingStatus[] }[] = [
  { key: 'ativas', label: 'Hospedados agora', statuses: ['hospedado'] },
  { key: 'proximas', label: 'Reservas', statuses: ['reserva', 'confirmada'] },
  { key: 'encerradas', label: 'Encerradas', statuses: ['finalizada', 'cancelada'] },
  { key: 'todas', label: 'Todas', statuses: ['reserva', 'confirmada', 'hospedado', 'finalizada', 'cancelada'] },
];

export function BookingListPage() {
  const { db, ready } = useData();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const today = todayIso();
  const tab = TABS.find((t) => t.key === params.get('aba')) ?? TABS[0];
  const q = params.get('q') ?? '';

  const all = useMemo(() => bookingViews(db), [db]);
  const list = useMemo(() => {
    const term = normalize(q.trim());
    return all
      .filter((b) => tab.statuses.includes(b.status))
      .filter((b) => !term || normalize(`${b.code} ${b.pet.name} ${b.client.name}`).includes(term))
      .sort((a, b) => (tab.key === 'encerradas' || tab.key === 'todas' ? b.checkIn.localeCompare(a.checkIn) : tab.key === 'ativas' ? a.checkOut.localeCompare(b.checkOut) : a.checkIn.localeCompare(b.checkIn)));
  }, [all, tab, q]);

  const hosted = all.filter((b) => b.status === 'hospedado');
  const capacity = db.accommodations.reduce((s, a) => s + a.capacity, 0);
  const stats = [
    { label: 'Hospedados agora', value: hosted.length },
    { label: 'Entradas hoje', value: all.filter((b) => ['reserva', 'confirmada'].includes(b.status) && b.checkIn === today).length },
    { label: 'Saídas hoje', value: hosted.filter((b) => b.checkOut <= today).length },
    { label: 'Vagas livres hoje', value: Math.max(0, capacity - occupyingOn(db, today).length) },
  ];

  const setQuery = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    setParams(next, { replace: true });
  };

  return (
    <div className="page">
      <PageHeader
        title="Hospedagens"
        sub="Hotelzinho: pets de clientes hospedados na LUNAAR."
        actions={
          <ButtonLink to="/hospedagem/nova" variant="primary" icon={<Plus aria-hidden />}>
            Nova hospedagem
          </ButtonLink>
        }
      />

      <div className="stat-strip stat-strip--4">
        {stats.map((s) => (
          <div key={s.label} className="stat">
            <span className="stat__value tnum">{ready ? s.value : <Skeleton w={28} h={28} />}</span>
            <span className="stat__label">{s.label}</span>
          </div>
        ))}
      </div>

      <nav className="tabs" aria-label="Filtrar hospedagens">
        {TABS.map((t) => (
          <Link key={t.key} to={`?aba=${t.key}${q ? `&q=${encodeURIComponent(q)}` : ''}`} replace aria-current={t.key === tab.key ? 'page' : undefined}>
            {t.label}
            {ready && <span className="count">{all.filter((b) => t.statuses.includes(b.status)).length}</span>}
          </Link>
        ))}
      </nav>

      <div className="toolbar">
        <div className="input-group toolbar__search">
          <Search aria-hidden />
          <input className="input" type="search" placeholder="Buscar pet, tutor ou código" aria-label="Buscar hospedagens" value={q} onChange={(e) => setQuery({ q: e.target.value })} />
        </div>
      </div>

      {!ready ? (
        <Skeleton h={280} />
      ) : list.length === 0 ? (
        <EmptyState
          title={q ? 'Nada encontrado' : tab.key === 'ativas' ? 'Nenhum pet hospedado agora' : 'Nenhuma hospedagem aqui'}
          action={
            !q && (
              <ButtonLink to="/hospedagem/nova" variant="primary" icon={<Plus aria-hidden />}>
                Nova hospedagem
              </ButtonLink>
            )
          }
        >
          {q ? 'Confira o nome do pet, do tutor ou o código da hospedagem.' : undefined}
        </EmptyState>
      ) : (
        <div className="table-wrap">
          <table className="table table--stack">
            <thead>
              <tr>
                <th scope="col">Pet</th>
                <th scope="col">Período</th>
                <th scope="col">Acomodação</th>
                <th scope="col">Situação</th>
                <th scope="col" className="num">
                  Valor
                </th>
                <th scope="col">Código</th>
              </tr>
            </thead>
            <tbody>
              {list.map((b) => (
                <Row key={b.id} b={b} today={today} onOpen={() => navigate(`/hospedagem/${b.id}`)} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Row({ b, today, onOpen }: { b: BookingView; today: string; onOpen: () => void }) {
  const { db } = useData();
  const checkout = db.checkouts.find((c) => c.bookingId === b.id);
  const acc = accommodationById(db, b.accommodationId);
  const late = b.status === 'hospedado' && b.checkOut < today;
  const leavingToday = b.status === 'hospedado' && b.checkOut === today;
  const arrivingToday = ['reserva', 'confirmada'].includes(b.status) && b.checkIn === today;
  return (
    <tr data-href onClick={(e) => !(e.target as HTMLElement).closest('a') && onOpen()}>
      <td data-primary>
        <div className="cell-primary">
          <Photo src={b.pet.photo} alt="" name={b.pet.name} size={40} round />
          <div style={{ minWidth: 0 }}>
            <Link to={`/hospedagem/${b.id}`} className="cell-primary__name">
              {b.pet.name}
            </Link>
            <div className="cell-primary__sub">{b.client.name}</div>
          </div>
        </div>
      </td>
      <td data-label="Período" className="tnum">
        <span className="nowrap">
          {fmtDate(b.checkIn, 'dd/MM')} → {fmtDate(b.checkOut, 'dd/MM')}
        </span>{' '}
        <span className="muted">· {b.nights}n</span>
        {late && (
          <>
            {' '}
            <Tag tone="red">Atrasada</Tag>
          </>
        )}
        {leavingToday && (
          <>
            {' '}
            <Tag tone="amber">Sai hoje</Tag>
          </>
        )}
        {arrivingToday && (
          <>
            {' '}
            <Tag tone="green">Chega hoje</Tag>
          </>
        )}
      </td>
      <td data-label="Acomodação">{acc?.name}</td>
      <td data-end>
        <BookingStatusTag status={b.status} />
      </td>
      <td data-label="Valor" className="num">
        {b.status === 'cancelada' ? '—' : fmtMoney(checkout?.finalValue ?? b.estimated)}
        {!checkout && b.status !== 'cancelada' && <span className="visually-hidden"> (estimado)</span>}
      </td>
      <td data-label="Código" className="muted tnum" data-hide-mobile>
        {b.code}
      </td>
    </tr>
  );
}
