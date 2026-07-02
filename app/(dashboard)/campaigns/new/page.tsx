import Link from 'next/link';
import { ArrowLeft, Save, Target } from 'lucide-react';
import { createCampaignAction } from '@/actions/campaigns.actions';
import { Field, FormSection } from '@/components/forms/form-section';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { requirePermission } from '@/lib/permissions';

const errorMessages: Record<string, string> = {
  'missing-name': 'Укажи название кампании.',
  'save-failed': 'Не удалось сохранить кампанию. Проверь Supabase и попробуй снова.'
};

export default async function NewCampaignPage({ searchParams }: { searchParams?: Promise<{ error?: string }> }) {
  await requirePermission('manageCampaigns', '/campaigns?error=forbidden');
  const params = await searchParams;
  const error = params?.error ? errorMessages[params.error] : undefined;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Button asChild variant="secondary"><Link href="/campaigns"><ArrowLeft className="h-4 w-4" />Назад</Link></Button>
      <PageHeader title="Создать кампанию" subtitle="Маркетинговый эксперимент: кому пишем, где ищем и какой оффер проверяем" />

      {error && <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <form action={createCampaignAction} className="space-y-6">
          <FormSection title="Кампания">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Название">
                <Input name="name" placeholder="Мастера маникюра Минск — Instagram" required />
              </Field>
              <Field label="Канал">
                <Select name="channel" defaultValue="Instagram">
                  <option>Instagram</option>
                  <option>Telegram</option>
                  <option>TikTok</option>
                  <option>Рекомендации</option>
                  <option>Офлайн</option>
                  <option>Beauty-школа</option>
                  <option>Реклама</option>
                </Select>
              </Field>
              <Field label="Город">
                <Input name="city" placeholder="Минск" />
              </Field>
              <Field label="Ниша">
                <Input name="niche" placeholder="Маникюр" />
              </Field>
              <Field label="Статус">
                <Select name="status" defaultValue="Активна">
                  <option>Планируется</option>
                  <option>Активна</option>
                  <option>На паузе</option>
                  <option>Завершена</option>
                </Select>
              </Field>
              <Field label="Бюджет">
                <Input name="budget" type="number" min="0" step="0.01" placeholder="0" />
              </Field>
              <Field label="Дата старта">
                <Input name="start_date" type="date" />
              </Field>
              <Field label="Дата завершения">
                <Input name="end_date" type="date" />
              </Field>
            </div>
          </FormSection>

          <FormSection title="Цель, оффер и ожидаемый вывод">
            <div className="space-y-4">
              <Field label="Цель">
                <Textarea name="goal" placeholder="Например: найти 30 мастеров, получить 15 ответов и 5 участников пилота." />
              </Field>
              <Field label="Оффер / сообщение">
                <Textarea name="offer_text" placeholder="Клиенты смогут находить вас на карте и записываться онлайн..." />
              </Field>
              <Field label="Вывод / заметка">
                <Textarea name="result_notes" placeholder="Что хотим проверить или какой промежуточный вывод уже есть..." />
              </Field>
            </div>
          </FormSection>

          <div className="flex justify-end gap-3">
            <Button asChild variant="secondary"><Link href="/campaigns">Отмена</Link></Button>
            <Button type="submit"><Save className="h-4 w-4" />Сохранить кампанию</Button>
          </div>
        </form>
        <aside className="rounded-3xl border border-purple-100 bg-gradient-to-br from-purple-50 to-pink-50 p-5 h-fit">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-app-purple shadow-sm"><Target className="h-5 w-5" /></div>
          <h3 className="mt-4 text-lg font-black text-app-text">Кампания = эксперимент</h3>
          <p className="mt-2 text-sm leading-6 text-app-muted">Фиксируй аудиторию, канал, оффер и ожидаемую метрику. Так будет понятно, что реально работает.</p>
          <div className="mt-4 rounded-2xl bg-white/70 p-4 text-sm font-semibold leading-6 text-app-muted">После создания открой кампанию и привяжи к ней контакты из базы.</div>
        </aside>
      </div>
    </div>
  );
}
