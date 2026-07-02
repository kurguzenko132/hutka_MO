import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

const campaigns = [
  { name: 'Мастера маникюра Минск — Instagram', goal: '20 интервью, 5 тестеров', leads: 60, replies: 22, surveys: 10, testers: 4, conversion: '6,6%' },
  { name: 'Бровисты Брест — Telegram', goal: '15 интервью, 4 тестера', leads: 38, replies: 19, surveys: 12, testers: 6, conversion: '15,8%' },
  { name: 'Опрос клиентов — карта мастеров', goal: '100 ответов клиентов', leads: 130, replies: 82, surveys: 56, testers: 0, conversion: '43%' }
];

export default function CampaignsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Кампании" subtitle="Маркетинговые активности и их результативность" actionLabel="Создать кампанию" />
      <div className="grid gap-4">
        {campaigns.map((campaign) => (
          <Card key={campaign.name} className="card-hover">
            <CardContent>
              <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                <div>
                  <h3 className="text-lg font-black text-app-text">{campaign.name}</h3>
                  <p className="mt-2 text-sm text-app-muted">Цель: {campaign.goal}</p>
                </div>
                <Badge tone="purple">Конверсия: {campaign.conversion}</Badge>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-4">
                <Metric label="Лиды" value={campaign.leads} />
                <Metric label="Ответы" value={campaign.replies} />
                <Metric label="Опросы" value={campaign.surveys} />
                <Metric label="Тестеры" value={campaign.testers} />
              </div>
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
