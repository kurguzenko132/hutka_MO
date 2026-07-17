import { PageHeader } from '@/components/layout/page-header';
import { TaskWorkspace } from '@/components/tasks/task-workspace';
import { getTaskDirectoryPage, getTaskFilterOptions, type TaskFilters } from '@/lib/tasks';
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

const PAGE_SIZE = 40;

function pageHref(params: Record<string, string | undefined> | undefined, page: number) {
  const query = new URLSearchParams();
  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value && key !== 'page') query.set(key, value);
  });
  if (page > 1) query.set('page', String(page));
  const search = query.toString();
  return search ? `/tasks?${search}` : '/tasks';
}

export default async function TasksPage({ searchParams }: { searchParams?: Promise<Record<string, string | undefined>> }) {
  const [user, params] = await Promise.all([
    getCurrentUserContext(),
    searchParams
  ]);
  const role = user?.role ?? 'viewer';
  const filters = normalizeTaskFilters(params);
  const returnTo = buildReturnTo(params);
  const requestedPage = Number(params?.page || 1);
  const normalizedPage = Math.max(Number.isFinite(requestedPage) ? Math.floor(requestedPage) : 1, 1);

  const [directory, options] = await Promise.all([
    getTaskDirectoryPage(filters, normalizedPage, PAGE_SIZE),
    getTaskFilterOptions()
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Задачи" subtitle="Действия, созвоны, анкеты и рабочие шаги по контактам" actionLabel={can(role, 'manageTasks') ? 'Создать задачу' : undefined} actionHref={can(role, 'manageTasks') ? '/tasks/new' : undefined} />

      <TaskWorkspace
        key={`${returnTo}:${directory.currentPage}`}
        initialTasks={directory.items}
        initialSummary={directory.summary}
        initialTotal={directory.total}
        filters={filters}
        options={options}
        role={role}
        pageSize={directory.pageSize}
        currentPage={directory.currentPage}
        pageCount={directory.pageCount}
        previousHref={directory.currentPage > 1 ? pageHref(params, directory.currentPage - 1) : undefined}
        nextHref={directory.currentPage < directory.pageCount ? pageHref(params, directory.currentPage + 1) : undefined}
        serverNotice={<ActionNotice searchParams={params} />}
      />
    </div>
  );
}
