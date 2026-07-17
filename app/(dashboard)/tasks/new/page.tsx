import Link from 'next/link';
import { ArrowLeft, Save } from 'lucide-react';
import { createTaskAction } from '@/actions/tasks.actions';
import { getLeadOptionById } from '@/lib/leads';
import { getTaskTeamOptions, taskAssigneeRoleLabels, type TaskTeamMember } from '@/lib/tasks';
import { Field, FormSection } from '@/components/forms/form-section';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { SubmitButton } from '@/components/ui/submit-button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { LeadCombobox } from '@/components/people/lead-combobox';
import { requirePermission } from '@/lib/permissions';

const errorMessages: Record<string, string> = {
  'missing-task-title': 'Укажи название задачи.',
  'task-save-failed': 'Не удалось сохранить задачу. Проверь Supabase и попробуй еще раз.',
  'task-assignee-not-found': 'Один из участников задачи не найден среди пользователей приложения.',
  'task-assignees-failed': 'Задача создана, но участников не удалось привязать. Проверь таблицу task_assignees в Supabase.'
};

function TeamCheckboxGroup({ title, name, members }: { title: string; name: string; members: TaskTeamMember[] }) {
  return (
    <div>
      <p className="mb-2 text-sm font-bold text-app-text">{title}</p>
      <div className="max-h-44 space-y-2 overflow-auto rounded-xl border border-app-line bg-white p-3">
        {members.length === 0 ? (
          <p className="text-sm text-app-muted">Пользователей приложения пока нет.</p>
        ) : (
          members.map((member) => (
            <label key={`${name}-${member.id}`} className="flex items-start gap-3 rounded-lg px-2 py-2 transition hover:bg-purple-50">
              <input name={name} type="checkbox" value={member.id} className="mt-1 h-4 w-4 rounded border-app-line text-app-purple" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold text-app-text">{member.fullName}</span>
                <span className="block truncate text-xs text-app-muted">{member.jobTitle || member.email || 'Пользователь приложения'}</span>
              </span>
            </label>
          ))
        )}
      </div>
    </div>
  );
}

export default async function NewTaskPage({ searchParams }: { searchParams?: Promise<{ error?: string; leadId?: string }> }) {
  await requirePermission('manageTasks', '/tasks?error=forbidden');
  const params = await searchParams;
  const [teamMembers, selectedLead] = await Promise.all([
    getTaskTeamOptions(),
    params?.leadId ? getLeadOptionById(params.leadId) : Promise.resolve(null)
  ]);
  const error = params?.error ? errorMessages[params.error] : undefined;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Button asChild variant="secondary">
        <Link href="/tasks"><ArrowLeft className="h-4 w-4" />Назад</Link>
      </Button>
      <PageHeader title="Создать задачу" subtitle="Действие, созвон, отправка анкеты или проверка тестирования" />

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
            <Field label="Контакт из базы">
              <LeadCombobox
                name="lead_id"
                initialOption={selectedLead}
                placeholder="Найти контакт или оставить пустым..."
              />
            </Field>
            <Field label="Дедлайн">
              <Input name="due_date" type="date" />
            </Field>
            <Field label="Приоритет">
              <Select name="priority" defaultValue="none">
                <option value="none">Без приоритета</option>
                <option value="low">Низкий</option>
                <option value="medium">Средний</option>
                <option value="high">Высокий</option>
                <option value="urgent">Срочно</option>
              </Select>
            </Field>
          </div>
          <div className="mt-4">
            <Field label="Описание">
              <Textarea name="description" placeholder="Что именно нужно сделать и какой результат ожидаем..." />
            </Field>
          </div>
        </FormSection>
        <FormSection title="Команда задачи" subtitle="Ответственный, исполнитель и соисполнитель из пользователей приложения.">
          <div className="grid gap-4 md:grid-cols-3">
            <Field label={taskAssigneeRoleLabels.responsible}>
              <Select name="responsible_id" defaultValue="">
                <option value="">Не назначен</option>
                {teamMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.fullName}{member.jobTitle ? ` · ${member.jobTitle}` : ''}
                  </option>
                ))}
              </Select>
            </Field>
            <TeamCheckboxGroup title={taskAssigneeRoleLabels.executor} name="executor_ids" members={teamMembers} />
            <TeamCheckboxGroup title={taskAssigneeRoleLabels.co_executor} name="co_executor_ids" members={teamMembers} />
          </div>
        </FormSection>
        <div className="flex justify-end gap-3">
          <Button asChild variant="secondary"><Link href="/tasks">Отмена</Link></Button>
          <SubmitButton><Save className="h-4 w-4" />Сохранить задачу</SubmitButton>
        </div>
      </form>
    </div>
  );
}
