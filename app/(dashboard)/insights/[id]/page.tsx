import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft, Brain, ClipboardList, Save, Send, Sparkles, Trash2, Users } from 'lucide-react';
import { notFound } from 'next/navigation';
import { deleteInsightAction, updateInsightAction } from '@/actions/insights.actions';
import { Field, FormSection } from '@/components/forms/form-section';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { getInsightById, insightImportanceTone, insightStatusTone } from '@/lib/insights';

export default async function InsightDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const insight = await getInsightById(id);
  if (!insight) notFound();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Button asChild variant="secondary"><Link href="/insights"><ArrowLeft className="h-4 w-4" />Назад</Link></Button>
      <PageHeader title={insight.title} subtitle={insight.description || 'Инсайт без описания'} />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <main className="space-y-6">
          <Card>
            <CardContent className="space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={insightImportanceTone(insight.importance)}>{insight.importanceLabel}</Badge>
                <Badge tone={insightStatusTone(insight.status)}>{insight.statusLabel}</Badge>
                <Badge tone="purple">{insight.category}</Badge>
                <Badge tone="gray">Связей: {insight.relationsCount}</Badge>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <InfoBlock title="Доказательства" text={insight.evidence || 'Доказательства пока не добавлены.'} />
                <InfoBlock title="Следующее действие" text={insight.nextAction || 'Следующее действие пока не указано.'} />
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-3">
            <RelationCard icon={<Users className="h-5 w-5" />} title="Контакты" empty="Контакты не привязаны" items={insight.leads} />
            <RelationCard icon={<Send className="h-5 w-5" />} title="Кампании" empty="Кампании не привязаны" items={insight.campaigns} />
            <RelationCard icon={<ClipboardList className="h-5 w-5" />} title="Опросники" empty="Опросники не привязаны" items={insight.surveys} />
          </div>

          <Card>
            <CardContent>
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-purple-50 text-app-purple"><Sparkles className="h-5 w-5" /></div>
                <div>
                  <h3 className="font-black text-app-text">Как использовать этот инсайт</h3>
                  <p className="mt-2 text-sm leading-6 text-app-muted">Обсуди его на командной встрече и преврати в действие: изменить оффер, упростить онбординг, выбрать другой канал, изменить MVP или создать новую гипотезу.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </main>

        <aside className="space-y-6">
          <form action={updateInsightAction}>
            <input type="hidden" name="insight_id" value={insight.id} />
            <FormSection title="Обновить инсайт" subtitle="Поменяй статус, важность и следующий шаг после обсуждения с командой.">
              <div className="space-y-4">
                <Field label="Статус">
                  <Select name="status" defaultValue={insight.statusLabel}>
                    <option>Новый</option>
                    <option>На проверке</option>
                    <option>Принят</option>
                    <option>В архиве</option>
                  </Select>
                </Field>
                <Field label="Важность">
                  <Select name="importance" defaultValue={insight.importanceLabel}>
                    <option>Низкая</option>
                    <option>Средняя</option>
                    <option>Высокая</option>
                    <option>Критично</option>
                  </Select>
                </Field>
                <Field label="Доказательства">
                  <Textarea name="evidence" defaultValue={insight.evidence ?? ''} />
                </Field>
                <Field label="Следующее действие">
                  <Textarea name="next_action" defaultValue={insight.nextAction ?? ''} />
                </Field>
                <Button type="submit" className="w-full"><Save className="h-4 w-4" />Сохранить изменения</Button>
              </div>
            </FormSection>
          </form>

          <Card>
            <CardContent>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-pink-50 text-pink-600"><Brain className="h-5 w-5" /></div>
              <h3 className="mt-4 text-lg font-black text-app-text">Следующий этап</h3>
              <p className="mt-2 text-sm leading-6 text-app-muted">После этого мы сделаем гипотезы реальными и сможем связывать их с такими инсайтами.</p>
            </CardContent>
          </Card>

          <form action={deleteInsightAction}>
            <input type="hidden" name="insight_id" value={insight.id} />
            <FormSection title="Удалить инсайт" subtitle="Удалится инсайт и его связи. Контакты, кампании и опросы останутся.">
              <Button type="submit" variant="danger" className="w-full"><Trash2 className="h-4 w-4" />Удалить инсайт</Button>
            </FormSection>
          </form>
        </aside>
      </div>
    </div>
  );
}

function InfoBlock({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-app-muted">{title}</p>
      <p className="mt-3 text-sm font-semibold leading-6 text-app-text">{text}</p>
    </div>
  );
}

function RelationCard({ icon, title, empty, items }: { icon: ReactNode; title: string; empty: string; items: Array<{ id: string; name: string; href: string }> }) {
  return (
    <Card className="h-full">
      <CardContent>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-purple-50 text-app-purple">{icon}</div>
          <h3 className="font-black text-app-text">{title}</h3>
        </div>
        <div className="mt-4 space-y-2">
          {items.length === 0 && <p className="rounded-2xl bg-slate-50 p-3 text-sm font-semibold text-app-muted">{empty}</p>}
          {items.map((item) => (
            <Link key={item.id} href={item.href} className="block rounded-2xl border border-app-line bg-white p-3 text-sm font-semibold text-app-text transition hover:border-purple-200 hover:bg-purple-50">
              {item.name}
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
