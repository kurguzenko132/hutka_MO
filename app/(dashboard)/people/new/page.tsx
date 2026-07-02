import Link from 'next/link';
import { ArrowLeft, Save, Sparkles } from 'lucide-react';
import { createLeadAction } from '@/actions/leads.actions';
import { Field, FormSection } from '@/components/forms/form-section';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

const errorMessages: Record<string, string> = {
  'missing-name': 'Укажи имя или название контакта.',
  'save-failed': 'Не удалось сохранить контакт. Проверь Supabase и попробуй еще раз.'
};

export default async function NewLeadPage({ searchParams }: { searchParams?: Promise<{ error?: string }> }) {
  const params = await searchParams;
  const error = params?.error ? errorMessages[params.error] : undefined;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="secondary">
          <Link href="/people">
            <ArrowLeft className="h-4 w-4" />
            Назад
          </Link>
        </Button>
      </div>

      <PageHeader title="Добавить контакт" subtitle="Новый мастер, салон, клиент или партнер для маркетинговой воронки" />

      {error && (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <form action={createLeadAction} className="space-y-6">
          <FormSection title="Основная информация" subtitle="Минимально нужно имя, тип контакта, город и источник.">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Имя / название">
                <Input name="name" placeholder="Например: Анна Смирнова или Beauty Line" required />
              </Field>
              <Field label="Тип контакта">
                <Select name="type" defaultValue="Мастер">
                  <option>Мастер</option>
                  <option>Салон</option>
                  <option>Клиент</option>
                  <option>Партнер</option>
                </Select>
              </Field>
              <Field label="Ниша">
                <Input name="niche" placeholder="Маникюр, брови, косметология..." />
              </Field>
              <Field label="Город">
                <Input name="city" placeholder="Минск, Брест, Москва..." />
              </Field>
              <Field label="Источник">
                <Select name="source" defaultValue="Instagram">
                  <option>Instagram</option>
                  <option>Telegram</option>
                  <option>TikTok</option>
                  <option>Рекомендация</option>
                  <option>Офлайн</option>
                  <option>Beauty-школа</option>
                  <option>Реклама</option>
                </Select>
              </Field>
              <Field label="Стадия">
                <Select name="stage" defaultValue="Найдено">
                  <option>Найдено</option>
                  <option>Написал</option>
                  <option>Ответил</option>
                  <option>Опрос</option>
                  <option>Заинтересован</option>
                  <option>Тест</option>
                  <option>Активен</option>
                  <option>Отказ</option>
                </Select>
              </Field>
            </div>
          </FormSection>

          <FormSection title="Контакты и follow-up" subtitle="Эти поля помогут не потерять человека после первого касания.">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Instagram">
                <Input name="instagram" placeholder="@username" />
              </Field>
              <Field label="Telegram">
                <Input name="telegram" placeholder="@username" />
              </Field>
              <Field label="Телефон">
                <Input name="phone" placeholder="+375 ..." />
              </Field>
              <Field label="Email">
                <Input name="email" type="email" placeholder="name@email.com" />
              </Field>
              <Field label="Приоритет">
                <Select name="priority" defaultValue="Средний">
                  <option>Высокий</option>
                  <option>Средний</option>
                  <option>Низкий</option>
                </Select>
              </Field>
              <Field label="Следующий контакт">
                <Input name="next_contact_date" type="date" />
              </Field>
            </div>
          </FormSection>

          <FormSection title="Боли, теги и заметки">
            <div className="space-y-4">
              <Field label="Теги" hint="Пока теги вводятся текстом. Позже подключим выбор из базы тегов.">
                <Input name="tags" placeholder="Нужны клиенты, Нет CRM, Пустые окна" />
              </Field>
              <Field label="Следующий шаг">
                <Input name="next_step" placeholder="Написать повторно, отправить опрос, назначить пилот..." />
              </Field>
              <Field label="Заметка">
                <Textarea name="notes" placeholder="Что известно о контакте, какую боль озвучил, что обещали сделать дальше..." />
              </Field>
            </div>
          </FormSection>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button asChild variant="secondary">
              <Link href="/people">Отмена</Link>
            </Button>
            <Button type="submit">
              <Save className="h-4 w-4" />
              Сохранить контакт
            </Button>
          </div>
        </form>

        <aside className="space-y-4">
          <div className="rounded-3xl border border-purple-100 bg-gradient-to-br from-purple-50 to-pink-50 p-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-app-purple shadow-sm">
              <Sparkles className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-lg font-black text-app-text">Как заполнять быстрее</h3>
            <p className="mt-2 text-sm leading-6 text-app-muted">
              На первом касании достаточно имени, ссылки, города и стадии. Остальное можно заполнить после ответа или опроса.
            </p>
          </div>
          <div className="rounded-3xl border border-app-line bg-white p-5 shadow-card">
            <p className="text-sm font-black text-app-text">Рекомендуемые теги</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {['Нужны клиенты', 'Нет CRM', 'Пустые окна', 'Готов к пилоту', 'Вернуться позже'].map((tag) => (
                <Badge key={tag} tone="purple">{tag}</Badge>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
