import type { ReactNode } from 'react';
import Link from 'next/link';
import { Check, Clock, ExternalLink, RotateCcw, Trash2, X } from 'lucide-react';
import { deleteTaskAction, updateTaskStatusAction } from '@/actions/tasks.actions';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { TaskListItem } from '@/lib/tasks';
import { can, type UserRole } from '@/lib/roles';

const groupTone: Record<TaskListItem['group'], BadgeTone> = {
  'Просрочено': 'red',
  'Сегодня': 'yellow',
  'На неделе': 'blue',
  'Позже': 'green',
  'Без даты': 'gray',
  'Готово': 'green',
  'Отменено': 'gray'
};

const priorityTone: Record<TaskListItem['priorityValue'], BadgeTone> = {
  low: 'gray',
  medium: 'blue',
  high: 'yellow',
  urgent: 'red'
};

const statusTone: Record<TaskListItem['statusValue'], BadgeTone> = {
  todo: 'gray',
  in_progress: 'purple',
  done: 'green',
  cancelled: 'red'
};

const groupOrder: TaskListItem['group'][] = ['Просрочено', 'Сегодня', 'На неделе', 'Позже', 'Без даты', 'Готово', 'Отменено'];

function StatusForm({ task, status, returnTo, label, icon }: { task: TaskListItem; status: string; returnTo: string; label: string; icon: ReactNode }) {
  return (
    <form action={updateTaskStatusAction}>
      <input type="hidden" name="task_id" value={task.id} />
      <input type="hidden" name="status" value={status} />
      <input type="hidden" name="lead_id" value={task.leadId ?? ''} />
      <input type="hidden" name="title" value={task.title} />
      <input type="hidden" name="return_to" value={returnTo} />
      <Button type="submit" variant="secondary" size="sm">
        {icon}
        {label}
      </Button>
    </form>
  );
}

export function TaskList({ tasks, returnTo, role = 'viewer' }: { tasks: TaskListItem[]; returnTo: string; role?: UserRole }) {
  if (!tasks.length) {
    return (
      <Card>
        <CardContent className="p-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-50 text-app-purple">
            <Clock className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-lg font-bold text-app-text">Задач не найдено</h3>
          <p className="mt-2 text-sm text-app-muted">Попробуй изменить фильтры или создай новую задачу для контакта.</p>
          {can(role, 'manageTasks') && (
            <Button asChild className="mt-5">
              <Link href="/tasks/new">Создать задачу</Link>
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {groupOrder.map((group) => {
        const groupTasks = tasks.filter((task) => task.group === group);
        if (!groupTasks.length) return null;

        return (
          <Card key={group}>
            <CardHeader className="flex-row items-center justify-between gap-3">
              <CardTitle>{group}</CardTitle>
              <Badge tone={groupTone[group]}>{groupTasks.length}</Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              {groupTasks.map((task) => (
                <div key={task.id} className="rounded-2xl border border-app-line bg-white p-4 transition hover:border-purple-200 hover:bg-purple-50/30">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-bold text-app-text">{task.title}</h3>
                        <Badge tone={statusTone[task.statusValue]}>{task.status}</Badge>
                        <Badge tone={priorityTone[task.priorityValue]}>{task.priority}</Badge>
                      </div>
                      {task.description && <p className="mt-2 text-sm leading-6 text-app-muted">{task.description}</p>}
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-app-faint">
                        <Badge tone={groupTone[task.group]}>{task.dueDate}</Badge>
                        {task.leadId && task.leadName ? (
                          <Link href={`/people/${task.leadId}`} className="inline-flex items-center gap-1 font-semibold text-app-purple hover:text-purple-700">
                            {task.leadName}
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Link>
                        ) : (
                          <span>Без контакта</span>
                        )}
                      </div>
                    </div>

                    {can(role, 'manageTasks') && (
                    <div className="flex flex-wrap gap-2 xl:justify-end">
                      {task.statusValue === 'todo' && (
                        <StatusForm task={task} status="in_progress" returnTo={returnTo} label="В работу" icon={<Clock className="h-4 w-4" />} />
                      )}
                      {task.statusValue !== 'done' && task.statusValue !== 'cancelled' && (
                        <StatusForm task={task} status="done" returnTo={returnTo} label="Готово" icon={<Check className="h-4 w-4" />} />
                      )}
                      {task.statusValue === 'done' && (
                        <StatusForm task={task} status="todo" returnTo={returnTo} label="Вернуть" icon={<RotateCcw className="h-4 w-4" />} />
                      )}
                      {task.statusValue !== 'cancelled' && task.statusValue !== 'done' && (
                        <StatusForm task={task} status="cancelled" returnTo={returnTo} label="Отменить" icon={<X className="h-4 w-4" />} />
                      )}
                      <form action={deleteTaskAction}>
                        <input type="hidden" name="task_id" value={task.id} />
                        <input type="hidden" name="return_to" value={returnTo} />
                        <Button type="submit" variant="ghost" size="sm" className="text-red-600 hover:bg-red-50 hover:text-red-700" aria-label="Удалить задачу">
                          <Trash2 className="h-4 w-4" />
                          Удалить
                        </Button>
                      </form>
                    </div>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
