import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Save } from 'lucide-react';
import { updateLeadAction } from '@/actions/leads.actions';
import { getLeadById } from '@/lib/leads';
import { getSettingsData } from '@/lib/settings';
import { Field, FormSection } from '@/components/forms/form-section';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { requirePermission } from '@/lib/permissions';

const errorMessages: Record<string, string> = {
  'missing-name': 'Укажи имя или название контакта.',
  'save-failed': 'Не удалось сохранить изменения. Проверь Supabase и попробуй еще раз.'
};

const types = ['Мастер', 'Салон', 'Клиент', 'Партнер'];
const priorities = ['Высокий', 'Средний', 'Низкий'];

export default async function EditLeadPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ error?: string }>;
}) {
  await requirePermission('manageContacts', '/people?error=forbidden');
  const { id } = await params;
  const query = await searchParams;
  const lead = await getLeadById(id);
  if (!lead) notFound();

  const error = query?.error ? errorMessages[query.error] : undefined;
  const settings = await getSettingsData();
  const sources = Array.from(new Set([lead.source, ...settings.sources.map((source) => source.name)].filter(Boolean)));
  const stages = Array.from(new Set([lead.stage, ...settings.stages.map((stage) => stage.name)].filter(Boolean)));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Button asChild variant="secondary">
        <Link href={`/people/${lead.id}`}>
          <ArrowLeft className="h-4 w-4" />
          Назад к карточке
        </Link>
      </Button>

      <PageHeader title="Редактировать контакт" subtitle="Обнови данные, стадию, приоритет, теги и следующий шаг" />

      {error && (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      <form action={updateLeadAction} className="space-y-6">
        <input type="hidden" name="id" value={lead.id} />

        <FormSection title="Основная информация">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Имя / название">
              <Input name="name" defaultValue={lead.name} required />
            </Field>
            <Field label="Тип контакта">
              <Select name="type" defaultValue={lead.type}>
                {types.map((type) => <option key={type}>{type}</option>)}
              </Select>
            </Field>
            <Field label="Ниша">
              <Input name="niche" defaultValue={lead.niche === 'Не указана' ? '' : lead.niche} />
            </Field>
            <Field label="Город">
              <Input name="city" defaultValue={lead.city === 'Не указан' ? '' : lead.city} />
            </Field>
            <Field label="Источник">
              <Select name="source" defaultValue={lead.source}>
                {sources.map((source) => <option key={source}>{source}</option>)}
              </Select>
            </Field>
            <Field label="Стадия">
              <Select name="stage" defaultValue={lead.stage}>
                {stages.map((stage) => <option key={stage}>{stage}</option>)}
              </Select>
            </Field>
          </div>
        </FormSection>

      <FormSection title="Контакты и действие">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Instagram">
              <Input name="instagram" defaultValue={lead.instagram ?? ''} placeholder="@username" />
            </Field>
            <Field label="Telegram">
              <Input name="telegram" defaultValue={lead.telegram ?? ''} placeholder="@username" />
            </Field>
            <Field label="Телефон">
              <Input name="phone" defaultValue={lead.phone ?? ''} placeholder="+375 ..." />
            </Field>
            <Field label="Email">
              <Input name="email" type="email" defaultValue={lead.email ?? ''} placeholder="name@email.com" />
            </Field>
            <Field label="Приоритет">
              <Select name="priority" defaultValue={lead.priority}>
                {priorities.map((priority) => <option key={priority}>{priority}</option>)}
              </Select>
            </Field>
            <Field label="Следующий контакт">
              <Input name="next_contact_date" type="date" defaultValue={lead.nextDateRaw ?? ''} />
            </Field>
          </div>
        </FormSection>

        <FormSection title="Боли, теги и заметки">
          <div className="space-y-4">
            <Field label="Теги" hint="Через запятую">
              <Input name="tags" defaultValue={lead.tags.join(', ')} />
            </Field>
            <Field label="Следующий шаг">
              <Input name="next_step" defaultValue={lead.nextStep === 'Связаться' ? '' : lead.nextStep} />
            </Field>
            <Field label="Заметка">
              <Textarea name="notes" defaultValue={lead.notes ?? ''} />
            </Field>
          </div>
        </FormSection>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button asChild variant="secondary">
            <Link href={`/people/${lead.id}`}>Отмена</Link>
          </Button>
          <Button type="submit">
            <Save className="h-4 w-4" />
            Сохранить изменения
          </Button>
        </div>
      </form>
    </div>
  );
}
