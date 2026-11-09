import { Link } from 'react-router-dom';
import { AlertOctagon, AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight, Info } from 'lucide-react';
import { useData, useMe } from '@/data/store';
import { bookingViews, buildAlerts, inCare, type AlertSeverity } from '@/data/selectors';
import { daysFromToday, fmtDateShort, fmtRelativeDay, fmtTime, plural, todayIso, toDate } from '@/lib/format';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ANIMAL_STATUS } from '@/lib/labels';
import { compareKennels, kennelShort } from '@/lib/kennel';
import { BookingStatusTag, Photo, SectionLabel, Skeleton } from '@/components/ui';
import './dashboard.css';

const SEVERITY_ICON: Record<AlertSeverity, typeof AlertOctagon> = {
  critical: AlertOctagon,
  warning: AlertTriangle,
  info: Info,
};
const SEVERITY_LABEL: Record<AlertSeverity, string> = { critical: 'Urgente', warning: 'Hoje', info: 'Pendente' };

export function DashboardPage() {
  const { db, ready } = useData();
  const user = useMe();
  const today = todayIso();

  const care = inCare(db);
  const count = (s: string) => care.filter((a) => a.status === s).length;
  const adoptedRecent = db.animals
    .filter((a) => a.status === 'adotado' && a.adoption && daysFromToday(a.adoption.date) >= -30)
    .sort((a, b) => b.adoption!.date.localeCompare(a.adoption!.date));
  const views = bookingViews(db);
  const hosted = views.filter((b) => b.status === 'hospedado');
  const checkinsToday = views.filter((b) => ['reserva', 'confirmada'].includes(b.status) && b.checkIn === today);
  const checkoutsToday = hosted.filter((b) => b.checkOut <= today);
  const upcoming = views
    .filter((b) => ['reserva', 'confirmada'].includes(b.status) && b.checkIn > today)
    .sort((a, b) => a.checkIn.localeCompare(b.checkIn));
  const alerts = buildAlerts(db);

  const firstName = user?.name.replace(/^Dra?\.\s*/, '').split(' ')[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';

  const stats = [
    { label: 'Sob cuidado', value: care.length, to: '/animais' },
    { label: 'Para adoção', value: count('disponivel'), to: '/animais?status=disponivel' },
    { label: 'Em tratamento', value: count('tratamento'), to: '/animais?status=tratamento' },
    { label: 'Adotados em 30 dias', value: adoptedRecent.length, to: '/animais?status=adotado' },
    { label: 'Hospedados', value: hosted.length, to: '/hospedagem?aba=ativas' },
    { label: 'Reservas futuras', value: upcoming.length, to: '/hospedagem?aba=proximas' },
  ];

  return (
    <div className="page dash">
      <header className="dash__head">
        <p className="dash__date">
          {format(toDate(today), "EEEE, d 'de' MMMM", { locale: ptBR })} · {greeting}, {firstName}
        </p>
        <h1 className="dash__headline" id="page-title" tabIndex={-1}>
          {ready ? (
            <>
              A LUNAAR cuida hoje de <span className="marker tnum">{plural(care.length, 'animal', 'animais')}</span>
              {hosted.length > 0 && (
                <>
                  {' '}
                  e <span className="marker tnum">{plural(hosted.length, 'hóspede', 'hóspedes')}</span>
                </>
              )}
              .
            </>
          ) : (
            <Skeleton w="70%" h={40} />
          )}
        </h1>
      </header>

      <nav className="stat-strip" aria-label="Resumo">
        {stats.map((s) => (
          <Link key={s.label} to={s.to} className="stat">
            <span className="stat__value tnum">{ready ? s.value : <Skeleton w={32} h={28} />}</span>
            <span className="stat__label">{s.label}</span>
          </Link>
        ))}
      </nav>

      <div className="dash__grid">
        <section className="dash__alerts" aria-labelledby="alerts-title">
          <SectionLabel id="alerts-title" count={ready ? alerts.length : undefined}>
            Precisa de atenção
          </SectionLabel>
          {!ready ? (
            <AlertSkeleton />
          ) : alerts.length === 0 ? (
            <p className="dash__clear">Nada pendente. Bom trabalho, equipe!</p>
          ) : (
            <ol className="alerts">
              {alerts.map((alert) => {
                const Icon = SEVERITY_ICON[alert.severity];
                return (
                  <li key={alert.id} className="alert" data-severity={alert.severity}>
                    <div className="alert__head">
                      <Icon aria-hidden className="alert__icon" />
                      <span className="visually-hidden">{SEVERITY_LABEL[alert.severity]}:</span>
                      <h3 className="alert__title">{alert.title}</h3>
                    </div>
                    <ul className="alert__items">
                      {alert.items.slice(0, 4).map((item) => (
                        <li key={item.id}>
                          <Link to={item.href} className="alert__item">
                            <Photo src={item.photo} alt="" name={item.label} size={32} round />
                            <span className="alert__item-text">
                              <strong>{item.label}</strong>
                              {item.detail && <span>{item.detail}</span>}
                            </span>
                            <ArrowRight aria-hidden className="alert__go" />
                          </Link>
                        </li>
                      ))}
                      {alert.items.length > 4 && <li className="alert__more">e mais {alert.items.length - 4}</li>}
                    </ul>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <div className="dash__side">
          <section aria-labelledby="moves-title">
            <SectionLabel id="moves-title" action={<Link to="/agenda?modo=dia">Agenda do dia</Link>}>
              Movimento de hoje
            </SectionLabel>
            {!ready ? (
              <Skeleton h={120} />
            ) : checkinsToday.length + checkoutsToday.length === 0 ? (
              <p className="muted">Sem entradas ou saídas no hotelzinho hoje.</p>
            ) : (
              <ul className="moves">
                {checkinsToday.map((b) => (
                  <li key={b.id}>
                    <Link to={`/hospedagem/${b.id}`} className="move">
                      <span className="move__kind" data-kind="in">
                        <ArrowDownRight aria-hidden />
                        Entrada
                      </span>
                      <Photo src={b.pet.photo} alt="" name={b.pet.name} size={36} round />
                      <span className="move__text">
                        <strong>{b.pet.name}</strong>
                        <span>{b.client.name}</span>
                      </span>
                      <BookingStatusTag status={b.status} />
                    </Link>
                  </li>
                ))}
                {checkoutsToday.map((b) => {
                  const checkin = db.checkins.find((c) => c.bookingId === b.id);
                  return (
                    <li key={b.id}>
                      <Link to={`/hospedagem/${b.id}`} className="move">
                        <span className="move__kind" data-kind="out">
                          <ArrowUpRight aria-hidden />
                          Saída
                        </span>
                        <Photo src={b.pet.photo} alt="" name={b.pet.name} size={36} round />
                        <span className="move__text">
                          <strong>{b.pet.name}</strong>
                          <span>
                            {b.client.name}
                            {checkin && ` · entrou ${fmtDateShort(checkin.at.slice(0, 10))} ${fmtTime(checkin.at)}`}
                          </span>
                        </span>
                        {b.checkOut < today ? <span className="tag tag--plain" data-tone="red">Atrasada</span> : <span className="tag tag--plain" data-tone="amber">Sai hoje</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section aria-labelledby="occ-title">
            <SectionLabel id="occ-title">Ocupação agora</SectionLabel>
            {!ready ? <Skeleton h={220} /> : <Occupancy />}
          </section>
        </div>
      </div>

      <div className="dash__bottom">
        <section aria-labelledby="adopted-title">
          <SectionLabel id="adopted-title" action={<Link to="/animais?status=adotado">Ver todos</Link>}>
            Adotados recentemente
          </SectionLabel>
          {ready && adoptedRecent.length === 0 && <p className="muted">Nenhuma adoção nos últimos 30 dias.</p>}
          <ul className="adopted">
            {adoptedRecent.slice(0, 4).map((a) => (
              <li key={a.id}>
                <Link to={`/animais/${a.id}`} className="adopted__item">
                  <Photo src={a.photo} alt={`Foto de ${a.name}`} name={a.name} ratio="1" />
                  <span>
                    <strong>{a.name}</strong>
                    <small>
                      {fmtRelativeDay(a.adoption!.date)} · {a.adoption!.adopterName.split(' ')[0]}
                    </small>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="upcoming-title">
          <SectionLabel id="upcoming-title" action={<Link to="/hospedagem?aba=proximas">Todas as reservas</Link>}>
            Próximas chegadas
          </SectionLabel>
          {ready && upcoming.length === 0 && <p className="muted">Nenhuma reserva futura.</p>}
          <ul className="upcoming">
            {upcoming.slice(0, 5).map((b) => (
              <li key={b.id}>
                <Link to={`/hospedagem/${b.id}`} className="upcoming__item">
                  <span className="upcoming__date">
                    <span className="tnum">{format(toDate(b.checkIn), 'dd')}</span>
                    <small>{format(toDate(b.checkIn), 'MMM', { locale: ptBR })}</small>
                  </span>
                  <span className="upcoming__text">
                    <strong>{b.pet.name}</strong>
                    <span>
                      {b.nights} {b.nights === 1 ? 'noite' : 'noites'} · {b.client.name}
                    </span>
                  </span>
                  <BookingStatusTag status={b.status} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

function AlertSkeleton() {
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ display: 'grid', gap: 10 }}>
          <Skeleton w="60%" h={18} />
          <Skeleton w="90%" h={32} />
        </div>
      ))}
    </div>
  );
}

/** Vagas de cada canil e acomodação, com quem está ocupando. */
function Occupancy() {
  const { db } = useData();
  const today = todayIso();
  const care = inCare(db);
  const rows = [
    ...[...db.kennels].sort(compareKennels).map((k) => ({
      id: k.id,
      name: kennelShort(k),
      capacity: k.capacity,
      href: `/animais?canil=${k.id}`,
      occupants: care.filter((a) => a.kennelId === k.id).map((a) => ({ id: a.id, name: a.name, photo: a.photo, note: ANIMAL_STATUS[a.status].short })),
      group: `${k.location} · Setor ${k.sector}`,
    })),
    ...db.accommodations.map((ac) => ({
      id: ac.id,
      name: ac.name,
      capacity: ac.capacity,
      href: '/hospedagem?aba=ativas',
      occupants: bookingViews(db)
        .filter((b) => b.accommodationId === ac.id && b.status === 'hospedado' && b.checkIn <= today)
        .map((b) => ({ id: b.id, name: b.pet.name, photo: b.pet.photo, note: b.client.name })),
      group: 'Hotelzinho',
    })),
  ];
  let lastGroup = '';
  return (
    <div className="occ">
      {rows.map((r) => {
        const header = r.group !== lastGroup;
        lastGroup = r.group;
        const free = Math.max(0, r.capacity - r.occupants.length);
        const over = r.occupants.length > r.capacity;
        return (
          <div key={r.id}>
            {header && <p className="occ__group">{r.group}</p>}
            <Link to={r.href} className="occ__row" aria-label={`${r.name}: ${r.occupants.length} de ${r.capacity} vagas ocupadas`}>
              <span className="occ__name">{r.name}</span>
              <span className="occ__slots" aria-hidden>
                {r.occupants.map((o) => (
                  <span key={o.id} className="occ__slot occ__slot--full" title={`${o.name} · ${o.note}`}>
                    {o.photo ? <img src={o.photo} alt="" loading="lazy" /> : <span>{o.name[0]}</span>}
                  </span>
                ))}
                {Array.from({ length: free }).map((_, i) => (
                  <span key={i} className="occ__slot" />
                ))}
              </span>
              <span className={`occ__count tnum ${over ? 'occ__count--over' : ''}`}>
                {r.occupants.length}/{r.capacity}
              </span>
            </Link>
          </div>
        );
      })}
    </div>
  );
}
