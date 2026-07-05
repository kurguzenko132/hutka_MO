import Link from 'next/link';
import { ArrowLeft, FilterX } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { getActivityLogs, type ActivityLogFilters } from '@/lib/activity-log';
import { getSettingsData } from '@/lib/settings';
import { requireAdmin } from '@/lib/permissions';

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

function buildFilters(params: Record<string, string | string[] | undefined> = {}): ActivityLogFilters {
  return {
    userId: firstParam(params.userId),
    entityType: firstParam(params.entityType),
    action: firstParam(params.action),
    date: firstParam(params.date)
  };
}

const entityTypes = [
  ['contact', 'Контакт'],
  ['task', 'Задача'],
  ['campaign', 'Кампания'],
  ['survey', 'Анкета'],
  ['source', 'Источник'],
  ['stage', 'Стадия'],
  ['tag', 'Тег'],
  ['settings', 'Настройки']
];

export default async function ActivityLogPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const filters = buildFilters(params);
  const [logs, settings] = await Promise.all([getActivityLogs(filters), getSettingsData()]);

  return (
    <div className="space-y-6">
      <Button asChild variant="secondary">
        <Link href="/settings">
          <ArrowLeft className="h-4 w-4" />
          Назад к настройкам
        </Link>
      </Button>

      <PageHeader
        title="Логи действий"
        subtitle="Журнал изменений по контактам, задачам, кампаниям, анкетам и справочникам"
      />

      <Card>
        <CardContent className="p-4">
          <form className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_180px_auto_auto]" action="/settings/activity-log">
            <Select name="userId" defaultValue={filters.userId ?? ''}>
              <option value="">Все пользователи</option>
              {settings.users.map((user) => (
                <option key={user.id} value={user.id}>{user.fullName}</option>
              ))}
            </Select>
            <Select name="entityType" defaultValue={filters.entityType ?? ''}>
              <option value="">Все объекты</option>
              {entityTypes.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Select>
            <Input name="action" defaultValue={filters.action ?? ''} placeholder="Действие" />
            <Input name="date" type="date" defaultValue={filters.date ?? ''} />
            <Button type="submit" variant="secondary">Показать</Button>
            <Button asChild variant="ghost">
              <Link href="/settings/activity-log">
                <FilterX className="h-4 w-4" />
                Сбросить
              </Link>
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead className="border-b border-app-line bg-slate-50 text-xs uppercase tracking-wide text-app-faint">
              <tr>
                <th className="px-4 py-3">Дата</th>
                <th className="px-4 py-3">Пользователь</th>
                <th className="px-4 py-3">Действие</th>
                <th className="px-4 py-3">Тип объекта</th>
                <th className="px-4 py-3">Название</th>
                <th className="px-4 py-3">Детали</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-line">
              {logs.map((log) => (
                <tr key={log.id} className="align-top">
                  <td className="whitespace-nowrap px-4 py-4 text-app-muted">{log.createdAt}</td>
                  <td className="px-4 py-4 font-semibold text-app-text">{log.userName}</td>
                  <td className="px-4 py-4 text-app-text">{log.action}</td>
                  <td className="px-4 py-4 text-app-muted">{log.entityType}</td>
                  <td className="px-4 py-4 font-semibold text-app-text">{log.entityTitle}</td>
                  <td className="px-4 py-4 text-app-muted">{log.details}</td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-app-muted">Записей пока нет.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
