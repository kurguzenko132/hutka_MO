import Link from 'next/link';
import { ArrowLeft, Brain, Save, Sparkles } from 'lucide-react';
import { createInsightAction } from '@/actions/insights.actions';
import { Field, FormSection } from '@/components/forms/form-section';
import { PageHeader } from '@/components/layout/page-header';
import { LeadMultiCombobox } from '@/components/people/lead-multi-combobox';
import { Button } from '@/components/ui/button';
import { SubmitButton } from '@/components/ui/submit-button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { getCampaignOptions, getSurveyOptions, insightCategories } from '@/lib/insights';
import { requirePermission } from '@/lib/permissions';

const errorMessages: Record<string, string> = {
  'missing-title': 'Укажи название вывода.',
  'save-failed': 'Не удалось сохранить вывод. Проверь Supabase и попробуй снова.'
};

export default async function NewInsightPage({ searchParams }: { searchParams?: Promise<{ error?: string }> }) {
  await requirePermission('manageInsights', '/insights?error=forbidden');
  const params = await searchParams;
  const error = params?.error ? errorMessages[params.error] : undefined;
  const [campaigns, surveys] = await Promise.all([getCampaignOptions(), getSurveyOptions()]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Button asChild variant="secondary"><Link href="/insights"><ArrowLeft className="h-4 w-4" />Назад</Link></Button>
      <PageHeader title="Добавить вывод" subtitle="Зафиксируй вывод с доказательствами и привяжи его к контактам, кампаниям или анкетам" />

      {error && <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <form action={createInsightAction} className="space-y-6">
          <FormSection title="Основной вывод">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Название вывода">
                <Input name="title" placeholder="Мастерам важнее клиенты, чем CRM" required />
              </Field>
              <Field label="Категория">
                <Select name="category" defaultValue="Маркетинговый вывод">
                  {insightCategories.map((category) => <option key={category}>{category}</option>)}
                </Select>
              </Field>
              <Field label="Важность">
                <Select name="importance" defaultValue="Высокая">
                  <option>Низкая</option>
                  <option>Средняя</option>
                  <option>Высокая</option>
                  <option>Критично</option>
                </Select>
              </Field>
              <Field label="Статус">
                <Select name="status" defaultValue="Новый">
                  <option>Новый</option>
                  <option>На проверке</option>
                  <option>Принят</option>
                  <option>В архиве</option>
                </Select>
              </Field>
            </div>
            <div className="mt-4 space-y-4">
              <Field label="Описание">
                <Textarea name="description" placeholder="Что именно мы поняли о мастерах, салонах, клиентах или канале привлечения?" />
              </Field>
              <Field label="Доказательства">
                <Textarea name="evidence" placeholder="Например: 18 из 27 мастеров упомянули нехватку клиентов как главную проблему." />
              </Field>
              <Field label="Следующее действие">
                <Textarea name="next_action" placeholder="Что нужно сделать на основе этого вывода: поменять оффер, упростить онбординг, проверить канал..." />
              </Field>
            </div>
          </FormSection>

          <FormSection title="Связи" subtitle="Не обязательно, но полезно: так команда увидит, на чем основан вывод.">
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Контакты">
                <LeadMultiCombobox name="lead_ids" />
              </Field>
              <Field label="Кампании">
                <Select name="campaign_ids" multiple className="min-h-36 py-2">
                  {campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}
                </Select>
              </Field>
              <Field label="Анкеты">
                <Select name="survey_ids" multiple className="min-h-36 py-2">
                  {surveys.map((survey) => <option key={survey.id} value={survey.id}>{survey.name}</option>)}
                </Select>
              </Field>
            </div>
            <p className="mt-3 text-xs leading-5 text-app-muted">Кампании и анкеты поддерживают множественный выбор через Cmd/Ctrl. Если связей пока нет — просто сохрани вывод без них.</p>
          </FormSection>

          <div className="flex justify-end gap-3">
            <Button asChild variant="secondary"><Link href="/insights">Отмена</Link></Button>
            <SubmitButton><Save className="h-4 w-4" />Сохранить вывод</SubmitButton>
          </div>
        </form>

        <aside className="space-y-6">
          <div className="rounded-3xl border border-purple-100 bg-gradient-to-br from-purple-50 to-pink-50 p-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-app-purple shadow-sm"><Sparkles className="h-5 w-5" /></div>
            <h3 className="mt-4 text-lg font-black text-app-text">Вывод = решение на данных</h3>
            <p className="mt-2 text-sm leading-6 text-app-muted">Хороший вывод отвечает на вопрос: что мы поняли и что теперь нужно изменить в маркетинге или продукте.</p>
            <div className="mt-4 rounded-2xl bg-white/70 p-4 text-sm font-semibold leading-6 text-app-muted">Плохо: “мастерам нужна карта”. Хорошо: “мастерам интересна карта только если они верят, что она даст заявки”.</div>
          </div>

          <div className="rounded-3xl border border-app-line bg-white p-5 shadow-card">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-pink-50 text-pink-600"><Brain className="h-5 w-5" /></div>
            <h3 className="mt-4 text-lg font-black text-app-text">Дальше</h3>
            <p className="mt-2 text-sm leading-6 text-app-muted">После вывода следующим этапом можно назначить действие, обновить текст сообщения или изменить кампанию.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
