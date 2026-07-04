import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft, BarChart3, ClipboardList, Lightbulb, Save, Send, Target, Trash2, Users } from 'lucide-react';
import { notFound } from 'next/navigation';
import { deleteHypothesisAction, updateHypothesisAction } from '@/actions/hypotheses.actions';
import { Field, FormSection } from '@/components/forms/form-section';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { getHypothesisById, hypothesisConfidenceTone, hypothesisStatusTone } from '@/lib/hypotheses';
import { getCurrentUserContext } from '@/lib/permissions';
import { can } from '@/lib/roles';

export default async function HypothesisDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, currentUser] = await Promise.all([params, getCurrentUserContext()]);
  const currentRole = currentUser?.role ?? 'viewer';
  const canManageHypotheses = can(currentRole, 'manageHypotheses');
  const hypothesis = await getHypothesisById(id);
  if (!hypothesis) notFound();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Button asChild variant="secondary"><Link href="/hypotheses"><ArrowLeft className="h-4 w-4" />Назад</Link></Button>
      <PageHeader title={hypothesis.title} subtitle={hypothesis.description || 'Идея без описания'} />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <main className="space-y-6">
          <Card>
            <CardContent className="space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={hypothesisStatusTone(hypothesis.status)}>{hypothesis.statusLabel}</Badge>
                <Badge tone={hypothesisConfidenceTone(hypothesis.confidence)}>Уверенность: {hypothesis.confidenceLabel}</Badge>
                <Badge tone="purple">{hypothesis.category}</Badge>
                <Badge tone="gray">Связей: {hypothesis.relationsCount}</Badge>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <InfoBlock title="Как проверяем" text={hypothesis.testMethod || 'Способ проверки пока не указан.'} />
                <InfoBlock title="Метрика успеха" text={hypothesis.successMetric || 'Метрика успеха пока не указана.'} />
                <InfoBlock title="Данные за" text={hypothesis.evidenceFor || 'Подтверждающие данные пока не добавлены.'} />
                <InfoBlock title="Данные против" text={hypothesis.evidenceAgainst || 'Противоречащие данные пока не добавлены.'} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <InfoBlock title="Результат проверки" text={hypothesis.result || 'Результат пока не зафиксирован.'} />
              <InfoBlock title="Следующее действие" text={hypothesis.nextAction || 'Следующее действие пока не указано.'} />
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-4">
            <RelationCard icon={<Users className="h-5 w-5" />} title="Контакты" empty="Контакты не привязаны" items={hypothesis.leads} />
            <RelationCard icon={<Lightbulb className="h-5 w-5" />} title="Выводы" empty="Выводы не привязаны" items={hypothesis.insights} />
            <RelationCard icon={<Send className="h-5 w-5" />} title="Кампании" empty="Кампании не привязаны" items={hypothesis.campaigns} />
            <RelationCard icon={<ClipboardList className="h-5 w-5" />} title="Опросники" empty="Опросники не привязаны" items={hypothesis.surveys} />
          </div>

          <Card>
            <CardContent>
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-purple-50 text-app-purple"><Target className="h-5 w-5" /></div>
                <div>
                  <h3 className="font-black text-app-text">Как принимать решение</h3>
                  <p className="mt-2 text-sm leading-6 text-app-muted">Когда данных достаточно, переведи идею в статус “Подтверждается” или “Не подтверждается”, зафиксируй результат и создай вывод для команды.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </main>

        <aside className="space-y-6">
          {canManageHypotheses && (
            <form action={updateHypothesisAction}>
              <input type="hidden" name="hypothesis_id" value={hypothesis.id} />
              <FormSection title="Обновить проверку" subtitle="Зафиксируй текущий статус, данные и результат.">
                <div className="space-y-4">
                  <Field label="Статус">
                    <Select name="status" defaultValue={hypothesis.statusLabel}>
                      <option>Новая</option>
                      <option>В проверке</option>
                      <option>Подтверждается</option>
                      <option>Не подтверждается</option>
                      <option>Нужно больше данных</option>
                      <option>Закрыта</option>
                    </Select>
                  </Field>
                  <Field label="Уверенность">
                    <Select name="confidence" defaultValue={hypothesis.confidenceLabel}>
                      <option>Низкая</option>
                      <option>Средняя</option>
                      <option>Высокая</option>
                    </Select>
                  </Field>
                  <Field label="Данные за">
                    <Textarea name="evidence_for" defaultValue={hypothesis.evidenceFor || ''} />
                  </Field>
                  <Field label="Данные против">
                    <Textarea name="evidence_against" defaultValue={hypothesis.evidenceAgainst || ''} />
                  </Field>
                  <Field label="Результат">
                    <Textarea name="result" defaultValue={hypothesis.result || ''} />
                  </Field>
                  <Field label="Следующее действие">
                    <Textarea name="next_action" defaultValue={hypothesis.nextAction || ''} />
                  </Field>
                  <Button type="submit" className="w-full"><Save className="h-4 w-4" />Сохранить</Button>
                </div>
              </FormSection>
            </form>
          )}

          <Card>
            <CardContent>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-pink-50 text-pink-600"><BarChart3 className="h-5 w-5" /></div>
              <h3 className="mt-4 font-black text-app-text">Цикл проверки</h3>
              <ol className="mt-3 space-y-2 text-sm leading-6 text-app-muted">
                <li>1. Формулируем предположение.</li>
                <li>2. Запускаем кампанию или опрос.</li>
                <li>3. Фиксируем данные за/против.</li>
                <li>4. Переводим результат в вывод.</li>
              </ol>
            </CardContent>
          </Card>

          {canManageHypotheses && (
            <form action={deleteHypothesisAction}>
              <input type="hidden" name="hypothesis_id" value={hypothesis.id} />
              <FormSection title="Удалить идею" subtitle="Удалится идея и ее связи. Контакты, кампании, выводы и опросы останутся.">
                <Button type="submit" variant="danger" className="w-full"><Trash2 className="h-4 w-4" />Удалить идею</Button>
              </FormSection>
            </form>
          )}
        </aside>
      </div>
    </div>
  );
}

function InfoBlock({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-app-line bg-slate-50/60 p-4">
      <p className="text-xs font-black uppercase tracking-wide text-app-muted">{title}</p>
      <p className="mt-2 whitespace-pre-line text-sm font-medium leading-6 text-app-text">{text}</p>
    </div>
  );
}

function RelationCard({ icon, title, empty, items }: { icon: ReactNode; title: string; empty: string; items: Array<{ id: string; name: string; href: string }> }) {
  return (
    <Card>
      <CardContent>
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-purple-50 text-app-purple">{icon}</div>
          <h3 className="font-black text-app-text">{title}</h3>
        </div>
        <div className="space-y-2">
          {items.length === 0 && <p className="text-sm text-app-muted">{empty}</p>}
          {items.map((item) => (
            <Link key={item.id} href={item.href} className="block rounded-xl border border-app-line p-3 text-sm font-semibold text-app-text transition hover:border-purple-200 hover:bg-purple-50">
              {item.name}
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
