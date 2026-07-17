import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { notFound } from 'next/navigation';
import { InsightDetailWorkspace } from '@/components/insights/insight-detail-workspace';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { getInsightById } from '@/lib/insights';
import { getCurrentUserContext } from '@/lib/permissions';
import { can } from '@/lib/roles';

export default async function InsightDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, currentUser] = await Promise.all([params, getCurrentUserContext()]);
  const currentRole = currentUser?.role ?? 'viewer';
  const canManageInsights = can(currentRole, 'manageInsights');
  const insight = await getInsightById(id);
  if (!insight) notFound();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Button asChild variant="secondary"><Link href="/insights"><ArrowLeft className="h-4 w-4" />Назад</Link></Button>
      <PageHeader title={insight.title} subtitle={insight.description || 'Вывод без описания'} />
      <InsightDetailWorkspace initialInsight={insight} canManage={canManageInsights} />
    </div>
  );
}
