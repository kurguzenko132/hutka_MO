'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { Check, Clock, ExternalLink, LoaderCircle, RotateCcw, Trash2, Users, X } from 'lucide-react';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { TaskListItem, TaskStatus } from '@/lib/tasks';
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
  none: 'gray',
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

function StatusButton({
  status,
  label,
  icon,
  pending,
  onClick
}: {
  status: TaskStatus;
  label: string;
  icon: ReactNode;
  pending: boolean;
  onClick: (status: TaskStatus) => void;
}) {
  return (
    <Button type="button" variant="secondary" size="sm" disabled={pending} onClick={() => onClick(status)}>
      {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : icon}
      {label}
    </Button>
  );
}

export function TaskList({
  tasks,
  role = 'viewer',
  pendingIds = [],
  onStatusChange,
  onDelete
}: {
  tasks: TaskListItem[];
  role?: UserRole;
  pendingIds?: string[];
  onStatusChange: (task: TaskListItem, status: TaskStatus) => void;
  onDelete: (task: TaskListItem) => void;
}) {
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
              <Link prefetch={false} href="/tasks/new">Создать задачу</Link>
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
              {groupTasks.map((task) => {
                const pending = pendingIds.includes(task.id);

                return (
                  <div key={task.id} className="performance-contain rounded-2xl border border-app-line bg-white p-4 transition hover:border-purple-200 hover:bg-purple-50/30">
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
                            <Link prefetch={false} href={`/people/${task.leadId}`} className="inline-flex items-center gap-1 font-semibold text-app-purple hover:text-purple-700">
                              {task.leadName}
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Link>
                          ) : (
                            <span>Без контакта</span>
                          )}
                        </div>
                        {task.assignees.length > 0 && (
                          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                            <span className="inline-flex items-center gap-1 font-semibold text-app-faint">
                              <Users className="h-3.5 w-3.5" />
                              Команда:
                            </span>
                            {task.assignees.map((assignee) => (
                              <span key={`${task.id}-${assignee.role}-${assignee.id}`} className="inline-flex items-center gap-1 rounded-full bg-app-soft px-2.5 py-1 text-app-muted">
                                <span className="font-bold text-app-text">{assignee.fullName}</span>
                                <span>· {assignee.roleLabel}</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {can(role, 'manageTasks') && (
                        <div className="flex flex-wrap gap-2 xl:justify-end">
                          {task.statusValue === 'todo' && (
                            <StatusButton status="in_progress" label="В работу" icon={<Clock className="h-4 w-4" />} pending={pending} onClick={(status) => onStatusChange(task, status)} />
                          )}
                          {task.statusValue !== 'done' && task.statusValue !== 'cancelled' && (
                            <StatusButton status="done" label="Готово" icon={<Check className="h-4 w-4" />} pending={pending} onClick={(status) => onStatusChange(task, status)} />
                          )}
                          {task.statusValue === 'done' && (
                            <StatusButton status="todo" label="Вернуть" icon={<RotateCcw className="h-4 w-4" />} pending={pending} onClick={(status) => onStatusChange(task, status)} />
                          )}
                          {task.statusValue !== 'cancelled' && task.statusValue !== 'done' && (
                            <StatusButton status="cancelled" label="Отменить" icon={<X className="h-4 w-4" />} pending={pending} onClick={(status) => onStatusChange(task, status)} />
                          )}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={pending}
                            className="text-red-600 hover:bg-red-50 hover:text-red-700"
                            aria-label="Удалить задачу"
                            onClick={() => onDelete(task)}
                          >
                            {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                            Удалить
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
