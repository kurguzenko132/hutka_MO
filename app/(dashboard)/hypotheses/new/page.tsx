import Link from 'next/link';
import { ArrowLeft, FlaskConical, Save, Target } from 'lucide-react';
import { createHypothesisAction } from '@/actions/hypotheses.actions';
import { Field, FormSection } from '@/components/forms/form-section';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { getLeadOptions } from '@/lib/leads';
import { getCampaignOptions, getSurveyOptions } from '@/lib/insights';
import { getInsightOptions, hypothesisCategories } from '@/lib/hypotheses';
import { requirePermission } from '@/lib/permissions';

const errorMessages: Record<string, string> = {
  'missing-title': 'Укажи название проверки.',
  'save-failed': 'Не удалось сохранить проверку. Проверь Supabase и попробуй снова.'
};

export default async function NewHypothesisPage({ searchParams }: { searchParams?: Promise<{ error?: string }> }) {
  await requirePermission('manageHypotheses', '/hypotheses?error=forbidden');
  const params = await searchParams;
  const error = params?.error ? errorMessages[params.error] : undefined;
  const [leads, insights, campaigns, surveys] = await Promise.all([getLeadOptions(), getInsightOptions(), getCampaignOptions(), getSurveyOptions()]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Button asChild variant="secondary"><Link href="/hypotheses"><ArrowLeft className="h-4 w-4" />Назад</Link></Button>
      <PageHeader title="Добавить проверку" subtitle="Опиши предположение, способ проверки, метрику успеха и связи с данными" />

      {error && <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <form action={createHypothesisAction} className="space-y-6">
          <FormSection title="Проверка">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Название">
                <Input name="title" placeholder="Мастерам важнее новые клиенты, чем CRM" required />
              </Field>
              <Field label="Категория">
                <Select name="category" defaultValue="Оффер">
                  {hypothesisCategories.map((category) => <option key={category}>{category}</option>)}
                </Select>
              </Field>
              <Field label="Статус">
                <Select name="status" defaultValue="Новая">
                  <option>Новая</option>
                  <option>В проверке</option>
                  <option>Подтверждается</option>
                  <option>Не подтверждается</option>
                  <option>Нужно больше данных</option>
                  <option>Закрыта</option>
                </Select>
              </Field>
              <Field label="Уверенность">
                <Select name="confidence" defaultValue="Средняя">
                  <option>Низкая</option>
                  <option>Средняя</option>
                  <option>Высокая</option>
                </Select>
              </Field>
            </div>
            <div className="mt-4 space-y-4">
              <Field label="Описание">
                <Textarea name="description" placeholder="Что именно мы предполагаем и почему это важно проверить?" />
              </Field>
              <Field label="Как проверяем">
                <Textarea name="test_method" placeholder="Например: сравнить два оффера в Instagram на 50 мастерах." />
              </Field>
              <Field label="Метрика успеха">
                <Textarea name="success_metric" placeholder="Например: оффер Б должен дать в 2 раза больше ответов и 5 участников тестирования." />
              </Field>
            </div>
          </FormSection>

          <FormSection title="Данные и результат" subtitle="Можно заполнить сразу или позже после проверки.">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Данные за">
                <Textarea name="evidence_for" placeholder="Что подтверждает предположение?" />
              </Field>
              <Field label="Данные против">
                <Textarea name="evidence_against" placeholder="Что противоречит предположению?" />
              </Field>
            </div>
            <div className="mt-4 space-y-4">
              <Field label="Результат проверки">
                <Textarea name="result" placeholder="Какой вывод сделали после проверки?" />
              </Field>
              <Field label="Следующее действие">
                <Textarea name="next_action" placeholder="Что делаем дальше: меняем оффер, закрываем проверку, запускаем новый тест..." />
              </Field>
            </div>
          </FormSection>

          <FormSection title="Связи" subtitle="Свяжи проверку с реальными контактами, выводами, кампаниями и анкетами.">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Field label="Контакты">
                <Select name="lead_ids" multiple className="min-h-36 py-2">
                  {leads.map((lead) => <option key={lead.id} value={lead.id}>{lead.name}</option>)}
                </Select>
              </Field>
              <Field label="Выводы">
                <Select name="insight_ids" multiple className="min-h-36 py-2">
                  {insights.map((insight) => <option key={insight.id} value={insight.id}>{insight.name}</option>)}
                </Select>
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
            <p className="mt-3 text-xs leading-5 text-app-muted">Чтобы выбрать несколько пунктов, удерживай Cmd/Ctrl. Связи можно не добавлять на старте.</p>
          </FormSection>

          <div className="flex justify-end gap-3">
            <Button asChild variant="secondary"><Link href="/hypotheses">Отмена</Link></Button>
            <Button type="submit"><Save className="h-4 w-4" />Сохранить проверку</Button>
          </div>
        </form>

        <aside className="space-y-6">
          <div className="rounded-3xl border border-purple-100 bg-gradient-to-br from-purple-50 to-pink-50 p-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-app-purple shadow-sm"><FlaskConical className="h-5 w-5" /></div>
            <h3 className="mt-4 text-lg font-black text-app-text">Проверка = измеримое предположение</h3>
            <p className="mt-2 text-sm leading-6 text-app-muted">Не пиши просто “мастерам нужна карта”. Пиши так, чтобы было понятно, как это проверить и какая метрика покажет успех.</p>
            <div className="mt-4 rounded-2xl bg-white/70 p-4 text-sm font-semibold leading-6 text-app-muted">Формула: предполагаем → проверяем → считаем → делаем вывод → меняем действие.</div>
          </div>

          <div className="rounded-3xl border border-app-line bg-white p-5 shadow-card">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-pink-50 text-pink-600"><Target className="h-5 w-5" /></div>
            <h3 className="mt-4 text-lg font-black text-app-text">Пример</h3>
            <p className="mt-2 text-sm leading-6 text-app-muted">“Оффер про клиентов с карты даст минимум в 2 раза больше ответов, чем оффер про CRM”. Это можно проверить кампанией и потом превратить в вывод.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
