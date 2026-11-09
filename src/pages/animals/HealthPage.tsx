import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import { useData } from '@/data/store';
import { inCare, latestDoses } from '@/data/selectors';
import { useToast } from '@/components/toast';
import { Button, PageHeader, Photo, SectionLabel, Skeleton, Tag } from '@/components/ui';
import { daysFromToday, fmtDate, fmtRelativeDay } from '@/lib/format';
import { TREATMENT_STATUS } from '@/lib/labels';

/** Visão da equipe veterinária: o que precisa ser feito, em todos os animais. */
export function HealthPage() {
  const { db, ready, actions } = useData();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const care = inCare(db);
  const byId = new Map(care.map((a) => [a.id, a]));

  const treatments = db.treatments
    .filter((t) => t.status !== 'concluido' && byId.has(t.animalId))
    .sort((a, b) => (a.status === 'pendente' ? -1 : 1) - (b.status === 'pendente' ? -1 : 1) || a.startDate.localeCompare(b.startDate));

  // Só a dose mais recente de cada vacina conta: doses antigas já reforçadas não aparecem.
  const vaccines = care
    .flatMap((a) => latestDoses(db, a.id))
    .filter((v) => v.nextDue && daysFromToday(v.nextDue) <= 30)
    .sort((a, b) => a.nextDue!.localeCompare(b.nextDue!));

  const noVisit = care
    .filter((a) => !a.lastVetVisit || daysFromToday(a.lastVetVisit) < -180)
    .sort((a, b) => (a.lastVetVisit ?? '').localeCompare(b.lastVetVisit ?? ''));

  const advance = async (id: string, status: 'ativo' | 'concluido') => {
    setBusy(id);
    await actions.setTreatmentStatus(id, status);
    setBusy(null);
    toast(status === 'concluido' ? 'Tratamento concluído.' : 'Tratamento iniciado.');
  };

  return (
    <div className="page">
      <PageHeader title="Saúde" sub="Tratamentos, vacinas e consultas de todos os animais sob cuidado." />

      {!ready ? (
        <Skeleton h={300} />
      ) : (
        <div style={{ display: 'grid', gap: 48 }}>
          <section aria-labelledby="h-treat">
            <SectionLabel id="h-treat" count={treatments.length}>
              Tratamentos em aberto
            </SectionLabel>
            {treatments.length === 0 ? (
              <p className="muted">Nenhum tratamento em aberto.</p>
            ) : (
              <div className="table-wrap">
                <table className="table table--stack">
                  <thead>
                    <tr>
                      <th scope="col">Animal</th>
                      <th scope="col">Tratamento</th>
                      <th scope="col">Medicação</th>
                      <th scope="col">Período</th>
                      <th scope="col">Situação</th>
                      <th scope="col">
                        <span className="visually-hidden">Ações</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {treatments.map((t) => {
                      const a = byId.get(t.animalId)!;
                      return (
                        <tr key={t.id}>
                          <td data-primary>
                            <div className="cell-primary">
                              <Photo src={a.photo} alt="" name={a.name} size={36} round />
                              <Link to={`/animais/${a.id}?aba=saude`} className="cell-primary__name">
                                {a.name}
                              </Link>
                            </div>
                          </td>
                          <td data-label="Tratamento">
                            <strong style={{ fontWeight: 600 }}>{t.title}</strong>
                          </td>
                          <td data-label="Medicação">{[t.medication, t.dosage].filter(Boolean).join(' · ') || '—'}</td>
                          <td data-label="Período" className="tnum">
                            {t.status === 'pendente' ? `Previsto ${fmtRelativeDay(t.startDate)}` : `${fmtDate(t.startDate, 'dd/MM')}${t.endDate ? ` → ${fmtDate(t.endDate, 'dd/MM')}` : ''}`}
                          </td>
                          <td data-end>
                            <Tag tone={TREATMENT_STATUS[t.status].tone} dot>
                              {TREATMENT_STATUS[t.status].label}
                            </Tag>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            {t.status === 'pendente' ? (
                              <Button size="sm" loading={busy === t.id} onClick={() => advance(t.id, 'ativo')}>
                                Iniciar
                              </Button>
                            ) : (
                              <Button size="sm" icon={<Check aria-hidden />} loading={busy === t.id} onClick={() => advance(t.id, 'concluido')}>
                                Concluir
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section aria-labelledby="h-vac">
            <SectionLabel id="h-vac" count={vaccines.length}>
              Vacinas nos próximos 30 dias
            </SectionLabel>
            {vaccines.length === 0 ? (
              <p className="muted">Nenhuma vacina vencendo.</p>
            ) : (
              <div className="table-wrap">
                <table className="table table--stack">
                  <thead>
                    <tr>
                      <th scope="col">Animal</th>
                      <th scope="col">Vacina</th>
                      <th scope="col">Última dose</th>
                      <th scope="col">Vencimento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vaccines.map((v) => {
                      const a = byId.get(v.animalId)!;
                      const due = daysFromToday(v.nextDue!);
                      return (
                        <tr key={v.id}>
                          <td data-primary>
                            <div className="cell-primary">
                              <Photo src={a.photo} alt="" name={a.name} size={36} round />
                              <Link to={`/animais/${a.id}?aba=saude`} className="cell-primary__name">
                                {a.name}
                              </Link>
                            </div>
                          </td>
                          <td data-label="Vacina">{v.name}</td>
                          <td data-label="Última dose" className="tnum">
                            {fmtDate(v.date)}
                          </td>
                          <td data-end>
                            <Tag tone={due < 0 ? 'red' : due <= 7 ? 'amber' : 'neutral'} dot>
                              {due < 0 ? `Vencida há ${-due}d` : due === 0 ? 'Vence hoje' : `${fmtDate(v.nextDue!, 'dd/MM')} · em ${due}d`}
                            </Tag>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section aria-labelledby="h-visit">
            <SectionLabel id="h-visit" count={noVisit.length}>
              Sem consulta há mais de 6 meses
            </SectionLabel>
            {noVisit.length === 0 ? (
              <p className="muted">Todos os animais foram avaliados nos últimos 6 meses.</p>
            ) : (
              <ul className="plain-list">
                {noVisit.map((a) => (
                  <li key={a.id}>
                    <Link to={`/animais/${a.id}?aba=saude`} className="plain-list__item">
                      <Photo src={a.photo} alt="" name={a.name} size={36} round />
                      <strong>{a.name}</strong>
                      <span className="muted">{a.lastVetVisit ? `Última consulta em ${fmtDate(a.lastVetVisit)}` : 'Nenhuma consulta registrada'}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
