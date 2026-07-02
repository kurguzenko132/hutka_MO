import Link from 'next/link';
import { ArrowLeft, Save, Target } from 'lucide-react';
import { Field, FormSection } from '@/components/forms/form-section';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

export default function NewCampaignPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Button asChild variant="secondary"><Link href="/campaigns"><ArrowLeft className="h-4 w-4" />Назад</Link></Button>
      <PageHeader title="Создать кампанию" subtitle="Маркетинговый эксперимент: кому пишем, где ищем и какой оффер проверяем" />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <form className="space-y-6">
          <FormSection title="Кампания">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Название">
                <Input placeholder="Мастера маникюра Минск — Instagram" />
              </Field>
              <Field label="Канал">
                <Select defaultValue="Instagram">
                  <option>Instagram</option>
                  <option>Telegram</option>
                  <option>TikTok</option>
                  <option>Рекомендации</option>
                  <option>Офлайн</option>
                  <option>Beauty-школа</option>
                </Select>
              </Field>
              <Field label="Город">
                <Input placeholder="Минск" />
              </Field>
              <Field label="Ниша">
                <Input placeholder="Маникюр" />
              </Field>
              <Field label="Статус">
                <Select defaultValue="Планируется">
                  <option>Планируется</option>
                  <option>Активна</option>
                  <option>На паузе</option>
                  <option>Завершена</option>
                </Select>
              </Field>
              <Field label="Бюджет">
                <Input type="number" placeholder="0" />
              </Field>
            </div>
          </FormSection>

          <FormSection title="Цель и оффер">
            <div className="space-y-4">
              <Field label="Цель">
                <Textarea placeholder="Например: найти 30 мастеров, получить 15 ответов и 5 участников пилота." />
              </Field>
              <Field label="Оффер / сообщение">
                <Textarea placeholder="Клиенты смогут находить вас на карте и записываться онлайн..." />
              </Field>
              <Field label="Какой вывод хотим получить">
                <Input placeholder="Проверить, работает ли оффер про новых клиентов лучше, чем оффер про CRM" />
              </Field>
            </div>
          </FormSection>

          <div className="flex justify-end gap-3">
            <Button asChild variant="secondary"><Link href="/campaigns">Отмена</Link></Button>
            <Button type="button"><Save className="h-4 w-4" />Сохранить кампанию</Button>
          </div>
        </form>
        <aside className="rounded-3xl border border-purple-100 bg-gradient-to-br from-purple-50 to-pink-50 p-5 h-fit">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-app-purple shadow-sm"><Target className="h-5 w-5" /></div>
          <h3 className="mt-4 text-lg font-black text-app-text">Кампания = эксперимент</h3>
          <p className="mt-2 text-sm leading-6 text-app-muted">Фиксируй аудиторию, канал, оффер и ожидаемую метрику. Так будет понятно, что реально работает.</p>
        </aside>
      </div>
    </div>
  );
}
