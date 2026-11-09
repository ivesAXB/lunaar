import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertOctagon, AlertTriangle, ArrowRight, BellOff, Check, Info } from 'lucide-react';
import { useData } from '@/data/store';
import { buildAlerts, type AlertSeverity } from '@/data/selectors';
import { Button, EmptyState, PageHeader, Photo, Skeleton } from '@/components/ui';
import { itemKey, useSeenAlerts } from '@/lib/seenAlerts';
import './dashboard.css';

const SEVERITY_ICON: Record<AlertSeverity, typeof AlertOctagon> = { critical: AlertOctagon, warning: AlertTriangle, info: Info };
const SEVERITY_LABEL: Record<AlertSeverity, string> = { critical: 'Urgente', warning: 'Hoje', info: 'Pendente' };

/**
 * Central de alertas: tudo o que o sistema detectou nos dados (doses atrasadas,
 * vacinas vencendo, perda de peso, tarefas atrasadas…). Os itens somem sozinhos
 * quando o problema é resolvido; "visto" só tira o destaque de novidade.
 */
export function AlertsPage() {
  const { db, ready } = useData();
  const alerts = ready ? buildAlerts(db) : [];
  const { seen, unseen, markSeen, markAll } = useSeenAlerts(alerts);
  const [onlyNew, setOnlyNew] = useState(false);
  const total = alerts.reduce((n, a) => n + a.items.length, 0);

  const visible = alerts
    .map((a) => ({ ...a, items: onlyNew ? a.items.filter((i) => !seen.has(itemKey(a.id, i.id))) : a.items }))
    .filter((a) => a.items.length);

  return (
    <div className="page">
      <PageHeader
        title="Alertas"
        sub="Pendências detectadas automaticamente. Cada item some quando o problema é resolvido."
        actions={
          unseen > 0 && (
            <Button icon={<Check aria-hidden />} onClick={markAll}>
              Marcar todos como vistos
            </Button>
          )
        }
      />

      <div className="toolbar" style={{ marginBottom: 'var(--sp-6)' }}>
        <div className="segmented" role="group" aria-label="Filtrar alertas">
          <button type="button" aria-pressed={!onlyNew} onClick={() => setOnlyNew(false)}>
            Todos <span className="tnum">({total})</span>
          </button>
          <button type="button" aria-pressed={onlyNew} onClick={() => setOnlyNew(true)}>
            Novos <span className="tnum">({unseen})</span>
          </button>
        </div>
      </div>

      {!ready ? (
        <Skeleton h={320} />
      ) : visible.length === 0 ? (
        <EmptyState icon={<BellOff aria-hidden />} title={onlyNew ? 'Nenhum alerta novo' : 'Nenhum alerta'}>
          {onlyNew ? 'Você já viu todos os alertas.' : 'Tudo em dia. Nenhuma pendência para mostrar.'}
        </EmptyState>
      ) : (
        <ol className="alerts" style={{ maxWidth: 860 }}>
          {visible.map((alert) => {
            const Icon = SEVERITY_ICON[alert.severity];
            return (
              <li key={alert.id} className="alert" data-severity={alert.severity}>
                <div className="alert__head">
                  <Icon aria-hidden className="alert__icon" />
                  <span className="visually-hidden">{SEVERITY_LABEL[alert.severity]}:</span>
                  <h2 className="alert__title">{alert.title}</h2>
                  {alert.action && (
                    <Link to={alert.action.href} className="link alerts-page__action">
                      {alert.action.label}
                    </Link>
                  )}
                </div>
                <ul className="alert__items">
                  {alert.items.map((item) => {
                    const key = itemKey(alert.id, item.id);
                    const isNew = !seen.has(key);
                    return (
                      <li key={item.id}>
                        <Link to={item.href} className="alert__item" onClick={() => markSeen([key])}>
                          <Photo src={item.photo} alt="" name={item.label} size={32} round />
                          <span className="alert__item-text">
                            <strong>
                              {item.label}
                              {isNew && (
                                <span className="alerts-page__new" title="Novo">
                                  <span className="visually-hidden"> (novo)</span>
                                </span>
                              )}
                            </strong>
                            {item.detail && <span>{item.detail}</span>}
                          </span>
                          <ArrowRight aria-hidden className="alert__go" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
