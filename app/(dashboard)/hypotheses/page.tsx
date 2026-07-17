import Link from 'next/link';
import { FlaskConical, Plus, Target } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getHypotheses, hypothesisConfidenceTone, hypothesisStatusTone } from '@/lib/hypotheses';
import { getCurrentUserContext } from '@/lib/permissions';
import { can } from '@/lib/roles';

export default async function HypothesesPage() {
  const user = await getCurrentUserContext();
  const role = user?.role ?? 'viewer';
  const hypotheses = await getHypotheses();

  return (
    <div className="space-y-6">
      <PageHeader title="Проверки" subtitle="Проверка предположений через данные, анкеты, кампании и выводы" actionLabel={can(role, 'manageHypotheses') ? 'Добавить проверку' : undefined} actionHref={can(role, 'manageHypotheses') ? '/hypotheses/new' : undefined} />

      <div className="grid gap-4">
        {hypotheses.map((item) => (
          <Link prefetch={false} key={item.id} href={`/hypotheses/${item.id}`}>
            <Card className="card-hover">
              <CardContent>
                <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={hypothesisStatusTone(item.status)}>{item.statusLabel}</Badge>
                      <Badge tone={hypothesisConfidenceTone(item.confidence)}>Уверенность: {item.confidenceLabel}</Badge>
                      <Badge tone="gray">{item.category}</Badge>
                    </div>
                    <h3 className="mt-4 text-xl font-black leading-7 text-app-text">{item.title}</h3>
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-app-muted">{item.description || item.testMethod || 'Описание проверки пока не добавлено.'}</p>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <MiniBlock label="Как проверяем" text={item.testMethod || 'Способ проверки пока не указан.'} />
                      <MiniBlock label="Следующее действие" text={item.nextAction || 'Следующее действие пока не указано.'} />
                    </div>
                  </div>
                  <div className="shrink-0 rounded-2xl bg-purple-50 px-4 py-3 text-center">
                    <p className="text-2xl font-black text-app-purple">{item.relationsCount}</p>
                    <p className="text-xs font-bold text-app-muted">связей</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {hypotheses.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-purple-50 text-app-purple"><FlaskConical className="h-6 w-6" /></div>
            <h3 className="mt-4 text-xl font-black text-app-text">Проверок пока нет</h3>
            <p className="mt-2 max-w-xl text-sm leading-6 text-app-muted">Создай первую проверку через кампании, анкеты и реальные контакты.</p>
            {can(role, 'manageHypotheses') && <Button asChild className="mt-5"><Link href="/hypotheses/new"><Plus className="h-4 w-4" />Добавить проверку</Link></Button>}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-pink-50 text-pink-600"><Target className="h-5 w-5" /></div>
            <div>
              <h3 className="font-black text-app-text">Правильная логика проверки</h3>
              <p className="mt-1 text-sm leading-6 text-app-muted">Предположение проверяется кампанией или анкетой. Вывод — решение. Дальше меняем продукт, оффер или канал.</p>
            </div>
          </div>
          {can(role, 'manageHypotheses') && <Button asChild variant="secondary"><Link href="/hypotheses/new">Создать проверку</Link></Button>}
        </CardContent>
      </Card>
    </div>
  );
}

function MiniBlock({ label, text }: { label: string; text: string }) {
  return (
    <div className="rounded-2xl border border-app-line bg-slate-50/60 p-3">
      <p className="text-xs font-black uppercase tracking-wide text-app-muted">{label}</p>
      <p className="mt-1 line-clamp-2 text-sm font-semibold leading-6 text-app-text">{text}</p>
    </div>
  );
}
