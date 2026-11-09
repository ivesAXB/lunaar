import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ChevronLeft, ChevronRight, Clock, Pencil, Pill, Undo2 } from 'lucide-react';
import { addDays, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useData } from '@/data/store';
import { doseSlots, inCare, userById, type DoseSlot } from '@/data/selectors';
import type { AnimalTreatment } from '@/data/types';
import { useToast } from '@/components/toast';
import { Button, EmptyState, PageHeader, Photo, SectionLabel, Skeleton, Tag } from '@/components/ui';
import { fmtDate, fmtRelativeDay, fmtTime, todayIso, toDate } from '@/lib/format';
import { DOSE_STATUS } from '@/lib/labels';
import { TreatmentDialog } from './animals/AnimalDialogs';
import './dashboard.css';
import './medications.css';

/** Agenda de doses: o que cada animal precisa tomar em cada horário do dia. */
export function MedicationsPage() {
  const { db, ready, actions } = useData();
  const toast = useToast();
  const [date, setDate] = useState(todayIso());
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<AnimalTreatment | null>(null);

  const slots = useMemo(() => doseSlots(db, date), [db, date]);
  const groups = useMemo(() => {
    const map = new Map<string, DoseSlot[]>();
    slots.forEach((s) => map.set(s.time, [...(map.get(s.time) ?? []), s]));
    return [...map.entries()];
  }, [slots]);
  const count = (st: DoseSlot['status']) => slots.filter((s) => s.status === st).length;

  const care = new Map(inCare(db).map((a) => [a.id, a]));
  const inUse = db.treatments
    .filter((t) => t.status === 'ativo' && care.has(t.animalId) && (t.medication || t.times.length))
    .sort((a, b) => b.times.length - a.times.length || care.get(a.animalId)!.name.localeCompare(care.get(b.animalId)!.name));

  const shift = (days: number) => setDate(format(addDays(toDate(date), days), 'yyyy-MM-dd'));
  const isToday = date === todayIso();
  const future = date > todayIso();

  const toggle = async (s: DoseSlot) => {
    setBusy(s.key);
    try {
      const given = await actions.toggleDose(s.treatment.id, s.date, s.time);
      toast(given ? `Dose registrada: ${s.animal.name} · ${s.treatment.medication ?? s.treatment.title}.` : 'Registro da dose desfeito.');
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="page meds">
      <PageHeader title="Medicamentos" sub="Agenda de doses das medicações em andamento. Marque cada dose assim que for dada." />

      <div className="meds__day" role="group" aria-label="Dia da agenda">
        <Button iconOnly variant="ghost" icon={<ChevronLeft aria-hidden />} aria-label="Dia anterior" onClick={() => shift(-1)} />
        <label className="meds__date">
          <span className="visually-hidden">Data</span>
          <input type="date" className="input" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </label>
        <Button iconOnly variant="ghost" icon={<ChevronRight aria-hidden />} aria-label="Próximo dia" onClick={() => shift(1)} />
        <span className="meds__day-label">{format(toDate(date), "EEEE, d 'de' MMMM", { locale: ptBR })}</span>
        {!isToday && (
          <Button size="sm" onClick={() => setDate(todayIso())}>
            Voltar para hoje
          </Button>
        )}
      </div>

      <nav className="stat-strip stat-strip--4" aria-label="Resumo do dia">
        {[
          { label: 'Doses previstas', value: slots.length },
          { label: 'Administradas', value: count('administrada') },
          { label: 'Pendentes', value: count('pendente') },
          { label: 'Atrasadas', value: count('atrasada') },
        ].map((s) => (
          <div key={s.label} className="stat">
            <span className="stat__value tnum" data-alert={s.label === 'Atrasadas' && s.value > 0 ? true : undefined}>
              {ready ? s.value : <Skeleton w={32} h={28} />}
            </span>
            <span className="stat__label">{s.label}</span>
          </div>
        ))}
      </nav>

      {!ready ? (
        <Skeleton h={320} />
      ) : slots.length === 0 ? (
        <EmptyState icon={<Pill aria-hidden />} title={isToday ? 'Nenhuma dose prevista para hoje' : `Nenhuma dose prevista em ${fmtDate(date)}`}>
          As doses aparecem aqui quando um tratamento em andamento tem horários. Abra o prontuário do animal, aba Saúde, e informe os horários no tratamento.
        </EmptyState>
      ) : (
        <ol className="dose-groups">
          {groups.map(([time, list]) => (
            <li key={time} className="dose-group">
              <h2 className="dose-group__time tnum">
                <Clock aria-hidden />
                {time}
              </h2>
              <ul className="doses">
                {list.map((s) => {
                  const meta = DOSE_STATUS[s.status];
                  const who = s.given && userById(db, s.given.userId)?.name;
                  return (
                    <li key={s.key} className="dose" data-status={s.status}>
                      <Photo src={s.animal.photo} alt="" name={s.animal.name} size={40} round />
                      <div className="dose__main">
                        <p className="dose__title">
                          <Link to={`/animais/${s.animal.id}?aba=saude`} className="cell-primary__name">
                            {s.animal.name}
                          </Link>
                          <span className="dose__med">{s.treatment.medication ?? s.treatment.title}</span>
                        </p>
                        <p className="dose__meta">
                          {[s.treatment.dosage, s.treatment.title !== s.treatment.medication && s.treatment.title].filter(Boolean).join(' · ')}
                          {s.given && (
                            <>
                              {' · '}
                              <span className="dose__given">
                                dada às {fmtTime(s.given.givenAt)}
                                {who && ` por ${who}`}
                              </span>
                            </>
                          )}
                        </p>
                      </div>
                      <Tag tone={meta.tone} dot>
                        {meta.label}
                      </Tag>
                      <Button
                        size="sm"
                        variant={s.given ? 'ghost' : 'dark'}
                        icon={s.given ? <Undo2 aria-hidden /> : <Check aria-hidden />}
                        loading={busy === s.key}
                        disabled={future && !s.given}
                        onClick={() => toggle(s)}
                        aria-label={s.given ? `Desfazer dose de ${s.animal.name} às ${time}` : `Registrar dose de ${s.animal.name} às ${time}`}
                      >
                        {s.given ? 'Desfazer' : 'Dar dose'}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ol>
      )}

      <section aria-labelledby="h-inuse" style={{ marginTop: 'var(--sp-12)' }}>
        <SectionLabel id="h-inuse" count={ready ? inUse.length : undefined}>
          Medicações em uso
        </SectionLabel>
        {ready && inUse.length === 0 ? (
          <p className="muted">Nenhuma medicação em uso.</p>
        ) : (
          <div className="table-wrap">
            <table className="table table--stack">
              <thead>
                <tr>
                  <th scope="col">Animal</th>
                  <th scope="col">Medicamento</th>
                  <th scope="col">Horários</th>
                  <th scope="col">Período</th>
                  <th scope="col">
                    <span className="visually-hidden">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {inUse.map((t) => {
                  const a = care.get(t.animalId)!;
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
                      <td data-label="Medicamento">
                        <strong style={{ fontWeight: 600 }}>{t.medication ?? t.title}</strong>
                        {t.dosage && <div className="cell-primary__sub">{t.dosage}</div>}
                      </td>
                      <td data-label="Horários" className="tnum">
                        {t.times.length ? t.times.join(' · ') : <Tag tone="amber">Sem horários</Tag>}
                      </td>
                      <td data-label="Período" className="tnum">
                        {fmtDate(t.startDate, 'dd/MM')}
                        {t.endDate ? ` → ${fmtDate(t.endDate, 'dd/MM')} (${fmtRelativeDay(t.endDate)})` : ' · uso contínuo'}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <Button size="sm" variant="ghost" icon={<Pencil aria-hidden />} onClick={() => setEditing(t)}>
                          {t.times.length ? 'Editar' : 'Definir horários'}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editing && care.get(editing.animalId) && (
        <TreatmentDialog open onClose={() => setEditing(null)} animal={care.get(editing.animalId)!} treatment={editing} />
      )}
    </div>
  );
}
