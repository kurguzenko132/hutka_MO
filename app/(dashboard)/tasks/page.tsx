import type { ElementType } from 'react';
import { CalendarCheck, CheckCircle2, Clock3, Flame, TimerOff } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { TaskFiltersPanel } from '@/components/tasks/task-filters';
import { TaskList } from '@/components/tasks/task-list';
import { getTaskFilterOptions, getTaskSummary, getTasks, type TaskFilters } from '@/lib/tasks';
import { getCurrentUserContext } from '@/lib/permissions';
import { can } from '@/lib/roles';
import { ActionNotice } from '@/components/ui/action-notice';

function normalizeTaskFilters(params?: Record<string, string | undefined>): TaskFilters {
  return {
    q: params?.q || undefined,
    status: (params?.status as TaskFilters['status']) || 'active',
    priority: (params?.priority as TaskFilters['priority']) || undefined,
    due: (params?.due as TaskFilters['due']) || undefined,
    leadId: params?.leadId || undefined,
    profileId: params?.profileId || undefined
  };
}

function buildReturnTo(params?: Record<string, string | undefined>) {
  const query = new URLSearchParams();
  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value) query.set(key, value);
  });
  const search = query.toString();
  return search ? `/tasks?${search}` : '/tasks';
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

export default async function TasksPage({ searchParams }: { searchParams?: Promise<Record<string, string | undefined>> }) {
  const user = await getCurrentUserContext();
  const role = user?.role ?? 'viewer';
  const params = await searchParams;
  const filters = normalizeTaskFilters(params);
  const returnTo = buildReturnTo(params);

  const [tasks, baseTasks, options] = await Promise.all([
    getTasks(filters),
    getTasks({ status: filters.status || 'active' }),
    getTaskFilterOptions()
  ]);

  const summary = getTaskSummary(tasks);

  return (
    <div className="space-y-6">
      <PageHeader title="Задачи" subtitle="Follow-up, созвоны, опросы и действия по контактам" actionLabel={can(role, 'manageTasks') ? 'Создать задачу' : undefined} actionHref={can(role, 'manageTasks') ? '/tasks/new' : undefined} />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Stat icon={CalendarCheck} label="Найдено по фильтрам" value={summary.total} tone="bg-purple-50 text-app-purple" />
        <Stat icon={TimerOff} label="Просрочено" value={summary.overdue} tone="bg-red-50 text-red-600" />
        <Stat icon={Clock3} label="Сегодня" value={summary.today} tone="bg-amber-50 text-amber-600" />
        <Stat icon={Flame} label="Срочно" value={summary.urgent} tone="bg-pink-50 text-pink-600" />
        <Stat icon={CheckCircle2} label="Выполнено" value={summary.done} tone="bg-emerald-50 text-emerald-600" />
      </div>

      <ActionNotice searchParams={params} />
      <TaskFiltersPanel filters={filters} options={options} total={baseTasks.length} shown={tasks.length} role={role} />
      <TaskList tasks={tasks} returnTo={returnTo} role={role} />
    </div>
  );
}
