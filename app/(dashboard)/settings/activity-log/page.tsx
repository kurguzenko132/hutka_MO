import Link from 'next/link';
import Form from 'next/form';
import { ArrowLeft, ChevronLeft, ChevronRight, FilterX } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { SubmitButton } from '@/components/ui/submit-button';
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

function pageHref(filters: ActivityLogFilters, page: number) {
  const params = new URLSearchParams();
  if (filters.userId) params.set('userId', filters.userId);
  if (filters.entityType) params.set('entityType', filters.entityType);
  if (filters.action) params.set('action', filters.action);
  if (filters.date) params.set('date', filters.date);
  if (page > 1) params.set('page', String(page));
  const query = params.toString();
  return query ? `/settings/activity-log?${query}` : '/settings/activity-log';
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
  const requestedPage = Math.max(Number.parseInt(firstParam(params?.page), 10) || 1, 1);
  const [directory, settings] = await Promise.all([getActivityLogs(filters, requestedPage), getSettingsData()]);
  const logs = directory.items;

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
          <Form className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_180px_auto_auto]" action="/settings/activity-log" prefetch={false}>
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
            <SubmitButton variant="secondary">Показать</SubmitButton>
            <Button asChild variant="ghost">
              <Link href="/settings/activity-log">
                <FilterX className="h-4 w-4" />
                Сбросить
              </Link>
            </Button>
          </Form>
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
        <div className="flex flex-col gap-3 border-t border-app-line px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold text-app-muted">
            {directory.total > 0
              ? `Показано ${(directory.currentPage - 1) * directory.pageSize + 1}–${Math.min(directory.currentPage * directory.pageSize, directory.total)} из ${directory.total}`
              : 'Записей нет'}
          </p>
          <div className="flex items-center gap-2">
            {directory.currentPage > 1 ? (
              <Button asChild size="sm" variant="secondary">
                <Link prefetch={false} href={pageHref(filters, directory.currentPage - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                  Предыдущая
                </Link>
              </Button>
            ) : (
              <Button type="button" size="sm" variant="secondary" disabled>
                <ChevronLeft className="h-4 w-4" />
                Предыдущая
              </Button>
            )}
            <span className="px-2 text-sm font-bold text-app-text">
              {directory.currentPage} / {directory.pageCount}
            </span>
            {directory.currentPage < directory.pageCount ? (
              <Button asChild size="sm" variant="secondary">
                <Link prefetch={false} href={pageHref(filters, directory.currentPage + 1)}>
                  Следующая
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </Button>
            ) : (
              <Button type="button" size="sm" variant="secondary" disabled>
                Следующая
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
