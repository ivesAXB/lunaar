import { NavLink } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { useData } from '@/data/store';
import { buildAlerts } from '@/data/selectors';
import { useSeenAlerts } from '@/lib/seenAlerts';

/** Sino da barra superior: leva à central de alertas e mostra quantos itens ainda não foram vistos. */
export function AlertBell() {
  const { db, ready } = useData();
  const { unseen } = useSeenAlerts(ready ? buildAlerts(db) : []);
  const label = unseen ? `Alertas: ${unseen} ${unseen === 1 ? 'novo' : 'novos'}` : 'Alertas';
  return (
    <NavLink to="/alertas" className="btn btn--ghost btn--icon alert-bell" aria-label={label} title={label}>
      <Bell aria-hidden />
      {unseen > 0 && (
        <span className="alert-bell__count tnum" aria-hidden>
          {unseen > 99 ? '99+' : unseen}
        </span>
      )}
    </NavLink>
  );
}
