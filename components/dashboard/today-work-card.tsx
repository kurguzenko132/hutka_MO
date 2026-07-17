import Link from 'next/link';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { TaskListItem } from '@/lib/tasks';

function priorityTone(priority: string) {
  if (priority === 'Срочно') return 'red' as const;
  if (priority === 'Высокий') return 'yellow' as const;
  return 'gray' as const;
}

export function TodayWorkCard({ tasks }: { tasks: TaskListItem[] }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Сегодня нужно сделать</CardTitle>
        <Link prefetch={false} href="/tasks" className="text-xs font-bold text-app-purple">Все задачи →</Link>
      </CardHeader>
      <CardContent className="space-y-3">
        {tasks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-app-line p-4 text-sm text-app-muted">
            Нет активных задач. Запланируй действие для контакта или создай новую анкету.
          </div>
        ) : (
          tasks.map((task) => (
            <Link key={task.id} prefetch={false} href={task.leadId ? `/people/${task.leadId}` : '/tasks'} className="group block rounded-2xl border border-app-line p-4 transition hover:border-purple-200 hover:bg-purple-50/60">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-emerald-50 p-2 text-app-green">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-black text-app-text">{task.title}</p>
                    <ArrowRight className="mt-1 h-4 w-4 text-app-faint transition group-hover:translate-x-0.5 group-hover:text-app-purple" />
                  </div>
                  <p className="mt-1 text-xs text-app-muted">{task.leadName || 'Без контакта'} · {task.dueDate}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge tone={priorityTone(task.priority)}>{task.priority}</Badge>
                    <Badge tone="blue">{task.status}</Badge>
                  </div>
                </div>
              </div>
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  );
}
