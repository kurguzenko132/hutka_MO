import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const groups = [
  { title: 'Просрочено', tone: 'red', tasks: ['Написать Анне повторно', 'Отправить опрос салону Beauty Line'] },
  { title: 'Сегодня', tone: 'yellow', tasks: ['Созвон с Екатериной в 16:00', 'Проверить, заполнила ли Ольга профиль', 'Собрать фидбек по тесту'] },
  { title: 'Завтра', tone: 'green', tasks: ['Вернуться к мастеру после отказа', 'Подготовить отчет по Instagram'] }
] as const;

export default function TasksPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Задачи" subtitle="Ежедневные follow-up и действия по контактам" actionLabel="Создать задачу" actionHref="/tasks/new" />
      <div className="grid gap-6 lg:grid-cols-3">
        {groups.map((group) => (
          <Card key={group.title}>
            <CardHeader><CardTitle>{group.title}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {group.tasks.map((task) => (
                <label key={task} className="flex items-start gap-3 rounded-2xl border border-app-line p-4 transition hover:bg-slate-50">
                  <input type="checkbox" className="mt-1" />
                  <div>
                    <p className="font-semibold text-app-text">{task}</p>
                    <Badge tone={group.tone} className="mt-2">{group.title}</Badge>
                  </div>
                </label>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
