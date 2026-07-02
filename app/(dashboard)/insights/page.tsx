import Link from 'next/link';
import { Lightbulb, Plus, Sparkles } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getInsights, insightImportanceTone, insightStatusTone } from '@/lib/insights';
import { getCurrentUserContext } from '@/lib/permissions';
import { can } from '@/lib/roles';

export default async function InsightsPage() {
  const user = await getCurrentUserContext();
  const role = user?.role ?? 'viewer';
  const items = await getInsights();

  return (
    <div className="space-y-6">
      <PageHeader title="Инсайты" subtitle="Боли рынка, возражения, цитаты и выводы" actionLabel={can(role, 'manageInsights') ? 'Добавить инсайт' : undefined} actionHref={can(role, 'manageInsights') ? '/insights/new' : undefined} />

      <div className="grid gap-4 lg:grid-cols-3">
        {items.map((item) => (
          <Link key={item.id} href={`/insights/${item.id}`}>
            <Card className="card-hover h-full">
              <CardContent className="flex h-full flex-col">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={insightImportanceTone(item.importance)}>{item.importanceLabel}</Badge>
                  <Badge tone={insightStatusTone(item.status)}>{item.statusLabel}</Badge>
                </div>
                <h3 className="mt-4 text-lg font-black leading-7 text-app-text">{item.title}</h3>
                <p className="mt-3 line-clamp-4 text-sm leading-6 text-app-muted">{item.description || item.evidence || 'Описание пока не добавлено.'}</p>
                <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-5">
                  <Badge tone="gray">{item.category}</Badge>
                  <span className="text-xs font-bold text-app-muted">Связей: {item.relationsCount}</span>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {items.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-purple-50 text-app-purple"><Sparkles className="h-6 w-6" /></div>
            <h3 className="mt-4 text-xl font-black text-app-text">Инсайтов пока нет</h3>
            <p className="mt-2 max-w-xl text-sm leading-6 text-app-muted">Создай первый инсайт из опросов, кампаний или общения с мастерами. Он поможет команде принимать решения по продукту и маркетингу.</p>
            {can(role, 'manageInsights') && <Button asChild className="mt-5"><Link href="/insights/new"><Plus className="h-4 w-4" />Добавить инсайт</Link></Button>}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-pink-50 text-pink-600"><Lightbulb className="h-5 w-5" /></div>
            <div>
              <h3 className="font-black text-app-text">Как правильно фиксировать инсайт</h3>
              <p className="mt-1 text-sm leading-6 text-app-muted">Инсайт должен быть не просто мнением, а выводом с доказательством: ответы опроса, повторяющееся возражение, результат кампании или цитата из общения.</p>
            </div>
          </div>
          {can(role, 'manageInsights') && <Button asChild variant="secondary"><Link href="/insights/new">Создать вывод</Link></Button>}
        </CardContent>
      </Card>
    </div>
  );
}
