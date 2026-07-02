import Link from 'next/link';
import { ArrowRight, Megaphone } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getCampaigns, statusTone } from '@/lib/campaigns';
import { getCurrentUserContext } from '@/lib/permissions';
import { can } from '@/lib/roles';

export default async function CampaignsPage() {
  const user = await getCurrentUserContext();
  const role = user?.role ?? 'viewer';
  const campaigns = await getCampaigns();

  return (
    <div className="space-y-6">
      <PageHeader title="Кампании" subtitle="Маркетинговые активности, каналы, офферы и результативность" actionLabel={can(role, 'manageCampaigns') ? 'Создать кампанию' : undefined} actionHref={can(role, 'manageCampaigns') ? '/campaigns/new' : undefined} />

      <div className="grid gap-4">
        {campaigns.map((campaign) => (
          <Card key={campaign.id} className="card-hover">
            <CardContent>
              <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-purple-50 text-app-purple">
                      <Megaphone className="h-5 w-5" />
                    </div>
                    <h3 className="text-lg font-black text-app-text">{campaign.name}</h3>
                    <Badge tone={statusTone(campaign.status)}>{campaign.statusLabel}</Badge>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-app-muted">Цель: {campaign.goal || 'Цель не указана'}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge tone="purple">{campaign.channel}</Badge>
                    {campaign.city && <Badge tone="gray">{campaign.city}</Badge>}
                    {campaign.niche && <Badge tone="pink">{campaign.niche}</Badge>}
                    <Badge tone="green">Конверсия: {campaign.metrics.conversion}</Badge>
                  </div>
                </div>
                <Button asChild variant="secondary">
                  <Link href={`/campaigns/${campaign.id}`}>Открыть <ArrowRight className="h-4 w-4" /></Link>
                </Button>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-4">
                <Metric label="Контакты" value={campaign.metrics.contacts} />
                <Metric label="Ответы" value={campaign.metrics.responses} />
                <Metric label="Опрос / интерес" value={campaign.metrics.surveys} />
                <Metric label="Участники" value={campaign.metrics.participants} />
              </div>

              {campaign.resultNotes && (
                <div className="mt-4 rounded-2xl border border-purple-100 bg-purple-50 p-4 text-sm font-semibold leading-6 text-purple-800">
                  Вывод: {campaign.resultNotes}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-app-faint">{label}</p>
      <p className="mt-1 text-2xl font-black text-app-text">{value}</p>
    </div>
  );
}
