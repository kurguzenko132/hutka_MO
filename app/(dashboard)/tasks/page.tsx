import { getTasks } from '@/lib/tasks';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const groups = [
  { title: 'Просрочено', tone: 'red' },
  { title: 'Сегодня', tone: 'yellow' },
  { title: 'Позже', tone: 'green' }
] as const;

export default async function TasksPage() {
  const tasks = await getTasks();

  return (
    <div className="space-y-6">
      <PageHeader title="Задачи" subtitle="Ежедневные follow-up и действия по контактам" actionLabel="Создать задачу" actionHref="/tasks/new" />
      <div className="grid gap-6 lg:grid-cols-3">
        {groups.map((group) => {
          const groupTasks = tasks.filter((task) => task.group === group.title);
          return (
            <Card key={group.title}>
              <CardHeader><CardTitle>{group.title}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {groupTasks.length ? groupTasks.map((task) => (
                  <label key={task.id} className="flex items-start gap-3 rounded-2xl border border-app-line p-4 transition hover:bg-slate-50">
                    <input type="checkbox" className="mt-1" />
                    <div>
                      <p className="font-semibold text-app-text">{task.title}</p>
                      {task.description && <p className="mt-1 text-sm text-app-muted">{task.description}</p>}
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge tone={group.tone}>{group.title}</Badge>
                        <Badge tone={task.priority === 'Срочно' || task.priority === 'Высокий' ? 'red' : 'gray'}>{task.priority}</Badge>
                      </div>
                      <p className="mt-2 text-xs text-app-faint">{task.leadName ? `${task.leadName} · ` : ''}{task.dueDate}</p>
                    </div>
                  </label>
                )) : <p className="text-sm text-app-muted">Нет задач в этой группе.</p>}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
