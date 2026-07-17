'use client';

import { useState } from 'react';
import { AlertTriangle, Check, LoaderCircle, Trash2 } from 'lucide-react';
import { deleteTaskMutationAction } from '@/actions/tasks.actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { LeadTask } from '@/lib/leads';

export function LeadTasksCard({
  initialTasks,
  canManage
}: {
  initialTasks: LeadTask[];
  canManage: boolean;
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [pendingId, setPendingId] = useState('');
  const [notice, setNotice] = useState('');
  const [noticeError, setNoticeError] = useState(false);

  async function removeTask(task: LeadTask) {
    if (pendingId || !window.confirm(`Удалить задачу «${task.title}»?`)) return;
    const previousTasks = tasks;
    setPendingId(task.id);
    setNotice('Удаляю задачу...');
    setNoticeError(false);
    setTasks((current) => current.filter((item) => item.id !== task.id));

    try {
      const result = await deleteTaskMutationAction({ taskId: task.id });
      if (!result.ok) {
        setTasks(previousTasks);
        setNotice('Не удалось удалить задачу. Она возвращена в список.');
        setNoticeError(true);
      } else {
        setNotice('Задача удалена.');
      }
    } catch {
      setTasks(previousTasks);
      setNotice('Не удалось связаться с сервером. Задача возвращена в список.');
      setNoticeError(true);
    } finally {
      setPendingId('');
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle>Задачи по контакту</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {notice && (
          <p aria-live="polite" className={`flex items-start gap-2 text-sm font-semibold ${noticeError ? 'text-red-700' : 'text-emerald-700'}`}>
            {noticeError ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> : <Check className="mt-0.5 h-4 w-4 shrink-0" />}
            <span>{notice}</span>
          </p>
        )}
        {tasks.length ? tasks.map((task) => (
          <div key={task.id} className="rounded-2xl border border-app-line p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-bold text-app-text">{task.title}</p>
                {task.description && <p className="mt-1 text-sm text-app-muted">{task.description}</p>}
              </div>
              <Badge tone={task.priority === 'Срочно' || task.priority === 'Высокий' ? 'red' : task.priority === 'Средний' ? 'yellow' : 'green'}>{task.priority}</Badge>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold text-app-faint">{task.status} · {task.dueDate}</p>
              {canManage && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={Boolean(pendingId)}
                  className="text-red-600 hover:bg-red-50 hover:text-red-700"
                  onClick={() => void removeTask(task)}
                >
                  {pendingId === task.id ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  Удалить
                </Button>
              )}
            </div>
          </div>
        )) : <p className="text-sm text-app-muted">Задач по контакту пока нет.</p>}
      </CardContent>
    </Card>
  );
}
