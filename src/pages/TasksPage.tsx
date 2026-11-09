import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Circle, CircleDot, ListChecks, MoreHorizontal, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { useData, useMe } from '@/data/store';
import { inCare, isTaskOverdue, localDay, userById } from '@/data/selectors';
import type { Base, Task, TaskCategory, TaskPriority, TaskStatus } from '@/data/types';
import { useToast } from '@/components/toast';
import { Button, ConfirmDialog, Dialog, EmptyState, Field, MenuButton, PageHeader, Photo, Skeleton, Tag } from '@/components/ui';
import { fmtRelativeDay, fmtTime, todayIso } from '@/lib/format';
import { BASE, TASK_CATEGORY, TASK_PRIORITY, TASK_STATUS, TASK_STATUS_ORDER } from '@/lib/labels';
import './tasks.css';

const COLUMN_ICON: Record<TaskStatus, typeof Circle> = { pendente: Circle, em_andamento: CircleDot, concluida: CheckCircle2 };
const NEXT: Record<TaskStatus, { status: TaskStatus; label: string }> = {
  pendente: { status: 'em_andamento', label: 'Iniciar' },
  em_andamento: { status: 'concluida', label: 'Concluir' },
  concluida: { status: 'pendente', label: 'Reabrir' },
};
const DONE_VISIBLE = 12;

/** Tarefas da equipe, em três colunas por situação. */
export function TasksPage() {
  const { db, ready, actions } = useData();
  const me = useMe();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [mine, setMine] = useState(false);
  const [editing, setEditing] = useState<Partial<Task> | null>(null);
  const [removing, setRemoving] = useState<Task | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // "Novo → Tarefa" abre direto o formulário.
  useEffect(() => {
    if (params.get('nova')) {
      setEditing({});
      setParams({}, { replace: true });
    }
  }, [params, setParams]);

  const list = db.tasks.filter((t) => !mine || t.assigneeId === me?.id);
  const column = (status: TaskStatus) => {
    const items = list.filter((t) => t.status === status);
    if (status === 'concluida') return items.sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? ''));
    return items.sort((a, b) => TASK_PRIORITY[a.priority].rank - TASK_PRIORITY[b.priority].rank || a.dueAt.localeCompare(b.dueAt));
  };

  const advance = async (t: Task) => {
    setBusy(t.id);
    try {
      await actions.setTaskStatus(t.id, NEXT[t.status].status);
      toast(`Tarefa ${NEXT[t.status].status === 'concluida' ? 'concluída' : NEXT[t.status].status === 'pendente' ? 'reaberta' : 'iniciada'}.`);
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="page tasks-page">
      <PageHeader
        title="Tarefas"
        sub="O que a equipe precisa fazer, quem faz e até quando."
        actions={
          <Button variant="dark" icon={<Plus aria-hidden />} onClick={() => setEditing({})}>
            Nova tarefa
          </Button>
        }
      />

      <div className="toolbar" style={{ marginBottom: 'var(--sp-6)' }}>
        <div className="segmented" role="group" aria-label="Filtrar tarefas">
          <button type="button" aria-pressed={!mine} onClick={() => setMine(false)}>
            Toda a equipe
          </button>
          <button type="button" aria-pressed={mine} onClick={() => setMine(true)}>
            Minhas tarefas
          </button>
        </div>
      </div>

      {!ready ? (
        <Skeleton h={360} />
      ) : list.length === 0 ? (
        <EmptyState
          icon={<ListChecks aria-hidden />}
          title={mine ? 'Nenhuma tarefa atribuída a você' : 'Nenhuma tarefa ainda'}
          action={
            <Button variant="dark" icon={<Plus aria-hidden />} onClick={() => setEditing({})}>
              Nova tarefa
            </Button>
          }
        >
          Crie tarefas para a equipe: pesar um animal, levar ao veterinário, limpar a enfermaria…
        </EmptyState>
      ) : (
        <div className="task-board">
          {TASK_STATUS_ORDER.map((status) => {
            const items = column(status);
            const Icon = COLUMN_ICON[status];
            const shown = status === 'concluida' ? items.slice(0, DONE_VISIBLE) : items;
            return (
              <section key={status} className="task-col" data-status={status} aria-labelledby={`col-${status}`}>
                <h2 className="task-col__head" id={`col-${status}`}>
                  <Icon aria-hidden />
                  {TASK_STATUS[status].label}
                  <span className="section-label__count tnum">{items.length}</span>
                </h2>
                {items.length === 0 ? (
                  <p className="task-col__empty">Nada aqui.</p>
                ) : (
                  <ul className="task-list">
                    {shown.map((t) => (
                      <TaskItem
                        key={t.id}
                        task={t}
                        busy={busy === t.id}
                        onAdvance={() => advance(t)}
                        onEdit={() => setEditing(t)}
                        onDelete={() => setRemoving(t)}
                      />
                    ))}
                  </ul>
                )}
                {items.length > shown.length && <p className="task-col__empty">e mais {items.length - shown.length} concluídas antes</p>}
              </section>
            );
          })}
        </div>
      )}

      {editing && <TaskDialog initial={editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        title="Excluir tarefa?"
        description={removing?.title}
        confirmLabel="Excluir"
        onConfirm={async () => {
          await actions.deleteTask(removing!.id);
          toast('Tarefa excluída.');
        }}
      />
    </div>
  );
}

function TaskItem({ task: t, busy, onAdvance, onEdit, onDelete }: { task: Task; busy: boolean; onAdvance: () => void; onEdit: () => void; onDelete: () => void }) {
  const { db, base } = useData();
  const animal = db.animals.find((a) => a.id === t.animalId);
  const assignee = userById(db, t.assigneeId);
  const overdue = isTaskOverdue(t);
  const prio = TASK_PRIORITY[t.priority];
  const next = NEXT[t.status];
  return (
    <li className="task" data-overdue={overdue || undefined} data-done={t.status === 'concluida' || undefined}>
      <div className="task__top">
        <p className="task__title">{t.title}</p>
        <MenuButton label={`Mais ações: ${t.title}`} icon={<MoreHorizontal aria-hidden />} variant="ghost">
          {(close) => (
            <>
              <button type="button" role="menuitem" onClick={() => (close(), onEdit())}>
                <Pencil aria-hidden /> Editar
              </button>
              <button type="button" role="menuitem" className="menu__danger" onClick={() => (close(), onDelete())}>
                <Trash2 aria-hidden /> Excluir
              </button>
            </>
          )}
        </MenuButton>
      </div>
      <div className="task__tags">
        {t.priority !== 'normal' && t.priority !== 'baixa' && (
          <Tag tone={prio.tone} dot>
            {prio.label}
          </Tag>
        )}
        <span className="task__cat">{TASK_CATEGORY[t.category]}</span>
        {base === 'todas' && <span className="task__cat">· {BASE[animal?.base ?? t.base]}</span>}
      </div>
      {animal && (
        <Link to={`/animais/${animal.id}`} className="task__animal">
          <Photo src={animal.photo} alt="" name={animal.name} size={24} round />
          {animal.name}
        </Link>
      )}
      {t.notes && <p className="task__notes">{t.notes}</p>}
      <div className="task__foot">
        <span className={overdue ? 'task__due task__due--late' : 'task__due'}>
          {t.status === 'concluida' && t.doneAt ? `Concluída ${fmtRelativeDay(localDay(t.doneAt))}` : `${overdue ? 'Atrasada · ' : ''}${fmtRelativeDay(localDay(t.dueAt))} às ${fmtTime(t.dueAt)}`}
        </span>
        <span className="task__who">{assignee?.name ?? 'Sem responsável'}</span>
      </div>
      <Button size="sm" block variant={t.status === 'em_andamento' ? 'dark' : 'default'} loading={busy} onClick={onAdvance} icon={t.status === 'concluida' ? <RotateCcw aria-hidden /> : t.status === 'em_andamento' ? <CheckCircle2 aria-hidden /> : <ArrowRight aria-hidden />}>
        {next.label}
      </Button>
    </li>
  );
}

function TaskDialog({ initial, onClose }: { initial: Partial<Task>; onClose: () => void }) {
  const { db, actions, base: filter } = useData();
  const me = useMe();
  const toast = useToast();
  const animals = inCare(db).sort((a, b) => a.name.localeCompare(b.name));
  const due = initial.dueAt ? new Date(initial.dueAt) : new Date(Date.now() + 2 * 3_600_000);
  const pad = (n: number) => String(n).padStart(2, '0');
  const [form, setForm] = useState({
    title: initial.title ?? '',
    animalId: initial.animalId ?? '',
    base: (initial.base ?? (filter === 'todas' ? 'ong' : filter)) as Base,
    assigneeId: initial.assigneeId ?? me?.id ?? '',
    priority: (initial.priority ?? 'normal') as TaskPriority,
    category: (initial.category ?? 'geral') as TaskCategory,
    date: `${due.getFullYear()}-${pad(due.getMonth() + 1)}-${pad(due.getDate())}`,
    time: `${pad(due.getHours())}:${pad(due.getMinutes())}`,
    notes: initial.notes ?? '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      setError('Descreva a tarefa. Ex.: “Pesar o Thor”.');
      return;
    }
    setBusy(true);
    try {
      const animal = animals.find((a) => a.id === form.animalId);
      await actions.saveTask({
        id: initial.id,
        title: form.title.trim(),
        animalId: form.animalId || undefined,
        base: animal?.base ?? form.base,
        assigneeId: form.assigneeId || undefined,
        priority: form.priority,
        category: form.category,
        dueAt: new Date(`${form.date}T${form.time || '12:00'}:00`).toISOString(),
        status: initial.status ?? 'pendente',
        doneAt: initial.doneAt,
        notes: form.notes.trim() || undefined,
      });
      toast(initial.id ? 'Tarefa atualizada.' : 'Tarefa criada.');
      onClose();
    } catch (err) {
      toast((err as Error).message, 'error');
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      wide
      onClose={onClose}
      busy={busy}
      title={initial.id ? 'Editar tarefa' : 'Nova tarefa'}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button variant="dark" type="submit" form="task-form" loading={busy}>
            {initial.id ? 'Salvar' : 'Criar tarefa'}
          </Button>
        </>
      }
    >
      <form id="task-form" className="form-grid" onSubmit={submit} noValidate>
        <Field label="Tarefa" required error={error}>
          {(p) => <input {...p} data-autofocus className="input" value={form.title} onChange={set('title')} placeholder="Ex.: Levar o Duque para retirar os pontos" />}
        </Field>
        <Field label="Animal" optional className="col-3">
          {(p) => (
            <select {...p} className="select" value={form.animalId} onChange={set('animalId')}>
              <option value="">Nenhum (tarefa geral)</option>
              {animals.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                  {filter === 'todas' ? ` · ${BASE[a.base]}` : ''}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Responsável" optional className="col-3">
          {(p) => <AssigneeSelect {...p} value={form.assigneeId} onChange={set('assigneeId')} />}
        </Field>
        {!form.animalId && filter === 'todas' && (
          <Field label="Unidade" className="col-2">
            {(p) => (
              <select {...p} className="select" value={form.base} onChange={set('base')}>
                {(Object.keys(BASE) as Base[]).map((b) => (
                  <option key={b} value={b}>
                    {BASE[b]}
                  </option>
                ))}
              </select>
            )}
          </Field>
        )}
        <Field label="Prioridade" className="col-2">
          {(p) => (
            <select {...p} className="select" value={form.priority} onChange={set('priority')}>
              {(['baixa', 'normal', 'alta', 'critica'] as TaskPriority[]).map((k) => (
                <option key={k} value={k}>
                  {TASK_PRIORITY[k].label}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Categoria" className="col-2">
          {(p) => (
            <select {...p} className="select" value={form.category} onChange={set('category')}>
              {Object.entries(TASK_CATEGORY).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Prazo" required className="col-2 keep">
          {(p) => <input {...p} type="date" className="input" value={form.date} min={initial.id ? undefined : todayIso()} onChange={set('date')} />}
        </Field>
        <Field label="Horário" className="col-2 keep">
          {(p) => <input {...p} type="time" className="input" value={form.time} onChange={set('time')} />}
        </Field>
        <Field label="Observações" optional>
          {(p) => <textarea {...p} className="textarea" rows={2} value={form.notes} onChange={set('notes')} />}
        </Field>
      </form>
    </Dialog>
  );
}

function AssigneeSelect(props: { id: string; value: string; onChange: React.ChangeEventHandler<HTMLSelectElement> }) {
  const { db } = useData();
  return (
    <select {...props} className="select">
      <option value="">Sem responsável</option>
      {db.users
        .filter((u) => u.active)
        .map((u) => (
          <option key={u.id} value={u.id}>
            {u.name}
          </option>
        ))}
    </select>
  );
}
