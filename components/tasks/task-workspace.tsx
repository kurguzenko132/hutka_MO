'use client';

import { useMemo, useState, type ElementType, type ReactNode } from 'react';
import Link from 'next/link';
import { AlertTriangle, CalendarCheck, Check, CheckCircle2, ChevronLeft, ChevronRight, Clock3, Flame, TimerOff } from 'lucide-react';
import { deleteTaskMutationAction, updateTaskStatusMutationAction } from '@/actions/tasks.actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { TaskFiltersPanel } from '@/components/tasks/task-filters';
import { TaskList } from '@/components/tasks/task-list';
import type { TaskFilterOptions, TaskFilters, TaskListItem, TaskStatus, TaskSummary } from '@/lib/tasks';
import type { UserRole } from '@/lib/roles';

const statusLabels: Record<TaskStatus, string> = {
  todo: 'К выполнению',
  in_progress: 'В работе',
  done: 'Готово',
  cancelled: 'Отменено'
};

function groupForStatus(task: TaskListItem, status: TaskStatus): TaskListItem['group'] {
  if (status === 'done') return 'Готово';
  if (status === 'cancelled') return 'Отменено';
  if (!task.dueDateRaw) return 'Без даты';

  const date = new Date(task.dueDateRaw);
  if (Number.isNaN(date.getTime())) return 'Без даты';

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  const weekEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7);

  if (date < today) return 'Просрочено';
  if (date < tomorrow) return 'Сегодня';
  if (date < weekEnd) return 'На неделе';
  return 'Позже';
}

function taskWithStatus(task: TaskListItem, status: TaskStatus): TaskListItem {
  return {
    ...task,
    statusValue: status,
    status: statusLabels[status],
    group: groupForStatus(task, status)
  };
}

function keepForStatusFilter(status: TaskStatus, filter: TaskFilters['status']) {
  if (!filter || filter === 'active') return status !== 'done' && status !== 'cancelled';
  return status === filter;
}

function adjustSummary(summary: TaskSummary, task: TaskListItem, delta: 1 | -1): TaskSummary {
  return {
    total: Math.max(0, summary.total + delta),
    overdue: Math.max(0, summary.overdue + (task.group === 'Просрочено' ? delta : 0)),
    today: Math.max(0, summary.today + (task.group === 'Сегодня' ? delta : 0)),
    urgent: Math.max(0, summary.urgent + (task.priorityValue === 'urgent' ? delta : 0)),
    done: Math.max(0, summary.done + (task.statusValue === 'done' ? delta : 0))
  };
}

function Stat({ icon: Icon, label, value, tone }: { icon: ElementType; label: string; value: number; tone: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${tone}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-2xl font-black text-app-text">{value}</p>
          <p className="text-sm text-app-muted">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function TaskNotice({ text, error }: { text: string; error: boolean }) {
  return (
    <div className={`flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold ${
      error ? 'border-red-100 bg-red-50 text-red-700' : 'border-emerald-100 bg-emerald-50 text-emerald-700'
    }`}>
      {error ? <AlertTriangle className="h-4 w-4 shrink-0" /> : <Check className="h-4 w-4 shrink-0" />}
      <span>{text}</span>
    </div>
  );
}

export function TaskWorkspace({
  initialTasks,
  initialSummary,
  initialTotal,
  filters,
  options,
  role,
  pageSize,
  currentPage,
  pageCount,
  previousHref,
  nextHref,
  serverNotice
}: {
  initialTasks: TaskListItem[];
  initialSummary: TaskSummary;
  initialTotal: number;
  filters: TaskFilters;
  options: TaskFilterOptions;
  role: UserRole;
  pageSize: number;
  currentPage: number;
  pageCount: number;
  previousHref?: string;
  nextHref?: string;
  serverNotice?: ReactNode;
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [summary, setSummary] = useState(initialSummary);
  const [total, setTotal] = useState(initialTotal);
  const [pendingIds, setPendingIds] = useState<string[]>([]);
  const [notice, setNotice] = useState('');
  const originalOrder = useMemo(() => new Map(initialTasks.map((task, index) => [task.id, index])), [initialTasks]);
  const shownFrom = tasks.length > 0 ? (currentPage - 1) * pageSize + 1 : 0;
  const shownTo = tasks.length > 0 ? shownFrom + tasks.length - 1 : 0;

  function restoreTask(task: TaskListItem) {
    setTasks((current) => {
      const next = [...current.filter((item) => item.id !== task.id), task];
      return next.sort((a, b) => (originalOrder.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (originalOrder.get(b.id) ?? Number.MAX_SAFE_INTEGER));
    });
  }

  async function changeStatus(task: TaskListItem, status: TaskStatus) {
    if (pendingIds.includes(task.id)) return;

    const staysVisible = keepForStatusFilter(status, filters.status);
    const nextTask = taskWithStatus(task, status);
    setPendingIds((current) => [...current, task.id]);
    setNotice('Сохраняю статус задачи...');
    setTasks((current) => staysVisible
      ? current.map((item) => item.id === task.id ? nextTask : item)
      : current.filter((item) => item.id !== task.id));
    setSummary((current) => staysVisible
      ? adjustSummary(adjustSummary(current, task, -1), nextTask, 1)
      : adjustSummary(current, task, -1));
    if (!staysVisible) setTotal((current) => Math.max(0, current - 1));

    try {
      const result = await updateTaskStatusMutationAction({ taskId: task.id, status });
      if (!result.ok) {
        restoreTask(task);
        setSummary((current) => staysVisible
          ? adjustSummary(adjustSummary(current, nextTask, -1), task, 1)
          : adjustSummary(current, task, 1));
        if (!staysVisible) setTotal((current) => current + 1);
        setNotice('Не удалось изменить статус. Задача возвращена в исходное состояние.');
      } else {
        setNotice(`Статус задачи изменен: ${statusLabels[status]}.`);
      }
    } catch {
      restoreTask(task);
      setSummary((current) => staysVisible
        ? adjustSummary(adjustSummary(current, nextTask, -1), task, 1)
        : adjustSummary(current, task, 1));
      if (!staysVisible) setTotal((current) => current + 1);
      setNotice('Не удалось связаться с сервером. Задача возвращена в исходное состояние.');
    } finally {
      setPendingIds((current) => current.filter((id) => id !== task.id));
    }
  }

  async function deleteTask(task: TaskListItem) {
    if (pendingIds.includes(task.id) || !window.confirm(`Удалить задачу «${task.title}»?`)) return;

    setPendingIds((current) => [...current, task.id]);
    setNotice('Удаляю задачу...');
    setTasks((current) => current.filter((item) => item.id !== task.id));
    setSummary((current) => adjustSummary(current, task, -1));
    setTotal((current) => Math.max(0, current - 1));

    try {
      const result = await deleteTaskMutationAction({ taskId: task.id });
      if (!result.ok) {
        restoreTask(task);
        setSummary((current) => adjustSummary(current, task, 1));
        setTotal((current) => current + 1);
        setNotice('Не удалось удалить задачу. Она возвращена в список.');
      } else {
        setNotice('Задача удалена.');
      }
    } catch {
      restoreTask(task);
      setSummary((current) => adjustSummary(current, task, 1));
      setTotal((current) => current + 1);
      setNotice('Не удалось связаться с сервером. Задача возвращена в список.');
    } finally {
      setPendingIds((current) => current.filter((id) => id !== task.id));
    }
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Stat icon={CalendarCheck} label="Найдено по фильтрам" value={summary.total} tone="bg-purple-50 text-app-purple" />
        <Stat icon={TimerOff} label="Просрочено" value={summary.overdue} tone="bg-red-50 text-red-600" />
        <Stat icon={Clock3} label="Сегодня" value={summary.today} tone="bg-amber-50 text-amber-600" />
        <Stat icon={Flame} label="Срочно" value={summary.urgent} tone="bg-pink-50 text-pink-600" />
        <Stat icon={CheckCircle2} label="Выполнено" value={summary.done} tone="bg-emerald-50 text-emerald-600" />
      </div>

      {serverNotice}
      {notice ? <TaskNotice text={notice} error={notice.startsWith('Не удалось')} /> : null}

      <TaskFiltersPanel filters={filters} options={options} total={total} shown={tasks.length} role={role} />
      <TaskList
        tasks={tasks}
        role={role}
        pendingIds={pendingIds}
        onStatusChange={(task, status) => void changeStatus(task, status)}
        onDelete={(task) => void deleteTask(task)}
      />

      {(pageCount > 1 || total > pageSize) && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-app-line bg-white p-4">
          <p className="text-sm text-app-muted">
            {tasks.length > 0 ? `Показано ${shownFrom}–${Math.min(shownTo, total)} из ${total}` : `Найдено задач: ${total}`}
          </p>
          <div className="flex items-center gap-2">
            {previousHref ? (
              <Button asChild size="sm" variant="secondary">
                <Link prefetch={false} href={previousHref}><ChevronLeft className="h-4 w-4" /> Предыдущая</Link>
              </Button>
            ) : (
              <Button type="button" size="sm" variant="secondary" disabled><ChevronLeft className="h-4 w-4" /> Предыдущая</Button>
            )}
            <span className="px-2 text-sm font-bold text-app-text">{currentPage} / {pageCount}</span>
            {nextHref ? (
              <Button asChild size="sm" variant="secondary">
                <Link prefetch={false} href={nextHref}>Следующая <ChevronRight className="h-4 w-4" /></Link>
              </Button>
            ) : (
              <Button type="button" size="sm" variant="secondary" disabled>Следующая <ChevronRight className="h-4 w-4" /></Button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
