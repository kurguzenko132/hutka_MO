import { FollowUpWorkspace } from '@/components/followups/followup-workspace';
import { PageHeader } from '@/components/layout/page-header';
import { getFollowUpDirectoryPage, type FollowUpReason } from '@/lib/followups';
import { getCurrentUserContext } from '@/lib/permissions';
import { can } from '@/lib/roles';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const PAGE_SIZE = 40;

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function followUpReason(value: string | undefined): FollowUpReason | undefined {
  const values: FollowUpReason[] = [
    'overdue_followup',
    'today_followup',
    'missing_next_action',
    'hot_without_task',
    'unanswered_questionnaire',
    'stale_stage'
  ];
  return values.includes(value as FollowUpReason) ? value as FollowUpReason : undefined;
}

export default async function FollowUpsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const reason = followUpReason(firstParam(params.reason));
  const requestedPage = Number(firstParam(params.page) || 1);
  const normalizedPage = Math.max(Number.isFinite(requestedPage) ? Math.floor(requestedPage) : 1, 1);
  const [data, user] = await Promise.all([
    getFollowUpDirectoryPage(reason, normalizedPage, PAGE_SIZE),
    getCurrentUserContext()
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Что сделать"
        subtitle="Hutka находит контакты, которым нужен следующий шаг, и предлагает задачи."
        actionLabel="Открыть задачи"
        actionHref="/tasks"
      />
      <FollowUpWorkspace
        initialRecommendations={data.recommendations}
        initialBulkCandidates={data.bulkCandidates}
        initialSummary={data.summary}
        initialFilteredTotal={data.total}
        reason={reason}
        currentPage={data.currentPage}
        demoMode={data.demoMode}
        canManageTasks={can(user?.role ?? 'viewer', 'manageTasks')}
        initialCreated={firstParam(params.created)}
        initialError={firstParam(params.error)}
      />
    </div>
  );
}
