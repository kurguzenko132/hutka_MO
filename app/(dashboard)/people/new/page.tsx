import Link from 'next/link';
import { ArrowLeft, Save, Sparkles } from 'lucide-react';
import { createLeadAction } from '@/actions/leads.actions';
import { Field, FormSection } from '@/components/forms/form-section';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { getLeadFormOptions } from '@/lib/lead-form-options';
import { Button } from '@/components/ui/button';
import { SubmitButton } from '@/components/ui/submit-button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { requirePermission } from '@/lib/permissions';

const errorMessages: Record<string, string> = {
  'missing-name': 'Укажи имя или название контакта.',
  'save-failed': 'Не удалось сохранить контакт. Проверь Supabase и попробуй еще раз.'
};

export default async function NewLeadPage({ searchParams }: { searchParams?: Promise<{ error?: string }> }) {
  await requirePermission('manageContacts', '/people?error=forbidden');
  const params = await searchParams;
  const error = params?.error ? errorMessages[params.error] : undefined;
  const options = await getLeadFormOptions();
  const sources = options.sources;
  const stages = options.stages;
  const tags = options.tags;

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

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
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
                <Select name="source" defaultValue={sources[0] ?? 'Instagram'}>
                  {(sources.length ? sources : ['Instagram']).map((source) => <option key={source}>{source}</option>)}
                </Select>
              </Field>
              <Field label="Стадия">
                <Select name="stage" defaultValue={stages[0] ?? 'Новый'}>
                  {(stages.length ? stages : ['Новый']).map((stage) => <option key={stage}>{stage}</option>)}
                </Select>
              </Field>
            </div>
          </FormSection>

          <FormSection title="Контакты и действие" subtitle="Эти поля помогут не потерять человека после первого касания.">
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
              <Field label="Теги" hint="Через запятую. Справочник тегов можно менять в настройках.">
                <Input name="tags" placeholder={(tags.length ? tags.slice(0, 3).join(', ') : 'Нужны клиенты, Нет CRM, Пустые окна')} />
              </Field>
              <Field label="Следующий шаг">
                <Input name="next_step" placeholder="Написать повторно, отправить анкету, назначить тестирование..." />
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
            <SubmitButton>
              <Save className="h-4 w-4" />
              Сохранить контакт
            </SubmitButton>
          </div>
        </form>

        <aside className="space-y-4">
          <div className="rounded-3xl border border-app-line bg-white p-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-purple-50 text-app-purple">
              <Sparkles className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-lg font-black text-app-text">Как заполнять быстрее</h3>
            <p className="mt-2 text-sm leading-6 text-app-muted">
              На первом касании достаточно имени, ссылки, города и стадии. Остальное можно заполнить после ответа или анкеты.
            </p>
          </div>
          <div className="rounded-3xl border border-app-line bg-white p-5">
            <p className="text-sm font-black text-app-text">Рекомендуемые теги</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {(tags.length ? tags.slice(0, 5) : ['Нужны клиенты', 'Нет CRM', 'Пустые окна', 'Заинтересован', 'Вернуться позже']).map((tag) => (
                <Badge key={tag} tone="purple">{tag}</Badge>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
