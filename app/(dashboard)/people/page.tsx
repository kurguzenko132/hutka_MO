import { PeopleFilters } from '@/components/people/people-filters';
import { PeopleTable } from '@/components/people/people-table';
import { getCampaignOptions } from '@/lib/campaigns';
import { getLeadFilterOptions, getLeads, type LeadFilters } from '@/lib/leads';
import { getSavedLeadViews, getSmartLeadViews } from '@/lib/lead-views';
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

type PeoplePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PeoplePage({ searchParams }: PeoplePageProps) {
  const user = await getCurrentUserContext();
  const role = user?.role ?? 'viewer';
  const params = await searchParams;
  const filters = buildFilters(params);
  const [leads, allLeads, filterOptions, campaigns, savedViews] = await Promise.all([
    getLeads(filters),
    getLeads(),
    getLeadFilterOptions(),
    getCampaignOptions(),
    getSavedLeadViews(user?.profileId)
  ]);
  const smartViews = getSmartLeadViews(allLeads);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Люди"
        subtitle="База мастеров, салонов, клиентов и партнеров с рабочими фильтрами и быстрыми действиями"
      />

      <ActionNotice searchParams={params} />
      <PeopleFilters filters={filters} options={filterOptions} shown={leads.length} total={allLeads.length} role={role} smartViews={smartViews} savedViews={savedViews} />
      <PeopleTable items={leads} role={role} stages={filterOptions.stages} tags={filterOptions.tags} campaigns={campaigns} />
    </div>
  );
}
