import { PeopleFilters } from '@/components/people/people-filters';
import { PeopleTable } from '@/components/people/people-table';
import { getCampaignOptions } from '@/lib/campaigns';
import { getLeadDirectoryMeta, getLeadDirectoryPage, type LeadFilters } from '@/lib/leads';
import { buildSmartLeadViews } from '@/lib/lead-views';
import { PageHeader } from '@/components/layout/page-header';
import { getCurrentUserContext } from '@/lib/permissions';
import { ActionNotice } from '@/components/ui/action-notice';

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

function buildFilters(params: Record<string, string | string[] | undefined> = {}): LeadFilters {
  return {
    q: firstParam(params.q),
    type: firstParam(params.type),
    city: firstParam(params.city),
    niche: firstParam(params.niche),
    stage: firstParam(params.stage),
    source: firstParam(params.source),
    priority: firstParam(params.priority),
    tag: firstParam(params.tag),
    view: firstParam(params.view)
  };
}

const PAGE_SIZE = 50;

function pageHref(filters: LeadFilters, page: number) {
  const query = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) query.set(key, String(value));
  });
  if (page > 1) query.set('page', String(page));
  const value = query.toString();
  return value ? `/people?${value}` : '/people';
}

type PeoplePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PeoplePage({ searchParams }: PeoplePageProps) {
  const [user, params] = await Promise.all([
    getCurrentUserContext(),
    searchParams
  ]);
  const role = user?.role ?? 'viewer';
  const filters = buildFilters(params);
  const requestedPage = Number(firstParam(params?.page) || 1);
  const normalizedPage = Math.max(Number.isFinite(requestedPage) ? Math.floor(requestedPage) : 1, 1);
  const [directory, meta, campaigns] = await Promise.all([
    getLeadDirectoryPage(filters, normalizedPage, PAGE_SIZE),
    getLeadDirectoryMeta(),
    getCampaignOptions()
  ]);
  const smartViews = buildSmartLeadViews(meta.smartViewCounts);
  const currentPage = directory.currentPage;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Контакты"
        subtitle="База мастеров, салонов, клиентов и партнеров с рабочими фильтрами и быстрыми действиями"
      />

      <ActionNotice searchParams={params} />
      <PeopleFilters filters={filters} options={meta.options} shown={directory.total} total={meta.total} role={role} smartViews={smartViews} />
      <PeopleTable
        key={`${currentPage}:${JSON.stringify(filters)}`}
        items={directory.items}
        totalItems={directory.total}
        pageSize={directory.pageSize}
        currentPage={currentPage}
        pageCount={directory.pageCount}
        previousHref={currentPage > 1 ? pageHref(filters, currentPage - 1) : undefined}
        nextHref={currentPage < directory.pageCount ? pageHref(filters, currentPage + 1) : undefined}
        role={role}
        stages={meta.options.stages}
        tags={meta.options.tags}
        campaigns={campaigns}
      />
    </div>
  );
}
