import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { leads } from '@/lib/data';

const stages = ['Найдено', 'Написал', 'Ответил', 'Опрос', 'Тест', 'Активен'];

export default function FunnelsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Воронки" subtitle="Kanban-доска по стадиям привлечения" actionLabel="Добавить контакт" />
      <div className="grid gap-4 overflow-x-auto xl:grid-cols-6">
        {stages.map((stage) => (
          <Card key={stage} className="min-h-[520px] min-w-64">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{stage}</CardTitle>
                <Badge tone="gray">{leads.filter((lead) => lead.stage === stage).length || Math.floor(Math.random() * 12) + 3}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {leads.filter((lead) => lead.stage === stage).map((lead) => (
                <div key={lead.id} className="rounded-2xl border border-app-line bg-white p-4 shadow-sm">
                  <p className="font-bold text-app-text">{lead.name}</p>
                  <p className="mt-1 text-sm text-app-muted">{lead.niche} · {lead.city}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge tone="purple">{lead.source}</Badge>
                    <Badge tone={lead.priority === 'Высокий' ? 'red' : lead.priority === 'Средний' ? 'yellow' : 'green'}>{lead.score}/100</Badge>
                  </div>
                </div>
              ))}
              {leads.filter((lead) => lead.stage === stage).length === 0 && (
                <div className="rounded-2xl border border-dashed border-app-line p-4 text-sm text-app-muted">Пока нет контактов на этой стадии</div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
