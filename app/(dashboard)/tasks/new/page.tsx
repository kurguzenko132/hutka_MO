import Link from 'next/link';
import { ArrowLeft, Save } from 'lucide-react';
import { createTaskAction } from '@/actions/tasks.actions';
import { getLeadOptions } from '@/lib/leads';
import { Field, FormSection } from '@/components/forms/form-section';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { requirePermission } from '@/lib/permissions';

const errorMessages: Record<string, string> = {
  'missing-task-title': 'Укажи название задачи.',
  'task-save-failed': 'Не удалось сохранить задачу. Проверь Supabase и попробуй еще раз.'
};

export default async function NewTaskPage({ searchParams }: { searchParams?: Promise<{ error?: string; leadId?: string }> }) {
  await requirePermission('manageTasks', '/tasks?error=forbidden');
  const [leads, params] = await Promise.all([getLeadOptions(), searchParams]);
  const error = params?.error ? errorMessages[params.error] : undefined;
  const selectedLeadId = params?.leadId ?? '';

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Button asChild variant="secondary">
        <Link href="/tasks"><ArrowLeft className="h-4 w-4" />Назад</Link>
      </Button>
      <PageHeader title="Создать задачу" subtitle="Follow-up, созвон, отправка опроса или проверка пилота" />

      {error && (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      <form action={createTaskAction} className="space-y-6">
        <input type="hidden" name="return_to" value="/tasks" />
        <FormSection title="Задача">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Название">
              <Input name="title" placeholder="Написать Анне повторно" required />
            </Field>
            <Field label="Связанный контакт">
              <Select name="lead_id" defaultValue={selectedLeadId}>
                <option value="">Без контакта</option>
                {leads.map((lead) => (
                  <option key={lead.id} value={lead.id}>{lead.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Дата">
              <Input name="due_date" type="date" />
            </Field>
            <Field label="Приоритет">
              <Select name="priority" defaultValue="Средний">
                <option>Низкий</option>
                <option>Средний</option>
                <option>Высокий</option>
                <option>Срочно</option>
              </Select>
            </Field>
          </div>
          <div className="mt-4">
            <Field label="Описание">
              <Textarea name="description" placeholder="Что именно нужно сделать и какой результат ожидаем..." />
            </Field>
          </div>
        </FormSection>
        <div className="flex justify-end gap-3">
          <Button asChild variant="secondary"><Link href="/tasks">Отмена</Link></Button>
          <Button type="submit"><Save className="h-4 w-4" />Сохранить задачу</Button>
        </div>
      </form>
    </div>
  );
}
