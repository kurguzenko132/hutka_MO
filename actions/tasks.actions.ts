'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import type { TaskStatus } from '@/lib/tasks';
import { requirePermission } from '@/lib/permissions';

function getText(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

const priorityToDb: Record<string, string> = {
  Низкий: 'low',
  Средний: 'medium',
  Высокий: 'high',
  Срочно: 'urgent',
  low: 'low',
  medium: 'medium',
  high: 'high',
  urgent: 'urgent'
};

const allowedStatuses: TaskStatus[] = ['todo', 'in_progress', 'done', 'cancelled'];

export async function createTaskAction(formData: FormData) {
  await requirePermission('manageTasks', '/tasks?error=forbidden');
  const title = getText(formData, 'title');
  const leadId = getText(formData, 'lead_id');
  const returnTo = getText(formData, 'return_to') || '/tasks';

  if (!title) {
    redirect(`${returnTo}?error=missing-task-title`);
  }

  if (!isSupabaseConfigured()) {
    redirect(`${returnTo}?task=demo`);
  }

  const supabase = await createClient();
  const { error } = await supabase.from('tasks').insert({
    title,
    lead_id: leadId || null,
    description: getText(formData, 'description') || null,
    due_date: getText(formData, 'due_date') || null,
    priority: priorityToDb[getText(formData, 'priority')] ?? 'medium',
    status: 'todo'
  });

  if (error) {
    redirect(`${returnTo}?error=task-save-failed`);
  }

  if (leadId) {
    await supabase.from('lead_interactions').insert({
      lead_id: leadId,
      type: 'note',
      channel: 'Hutka',
      text: `Создана задача: ${title}`,
      result: 'task_created'
    });
    revalidatePath(`/people/${leadId}`);
  }

  revalidatePath('/tasks');
  revalidatePath('/dashboard');
  redirect(returnTo);
}

export async function updateTaskStatusAction(formData: FormData) {
  await requirePermission('manageTasks', '/tasks?error=forbidden');
  const taskId = getText(formData, 'task_id');
  const status = getText(formData, 'status') as TaskStatus;
  const leadId = getText(formData, 'lead_id');
  const title = getText(formData, 'title') || 'Задача';
  const returnTo = getText(formData, 'return_to') || '/tasks';

  if (!taskId || !allowedStatuses.includes(status)) {
    redirect(`${returnTo}?error=task-status-failed`);
  }

  if (!isSupabaseConfigured()) {
    redirect(`${returnTo}?task=demo-status`);
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('tasks')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', taskId);

  if (error) {
    redirect(`${returnTo}?error=task-status-failed`);
  }

  if (leadId) {
    await supabase.from('lead_interactions').insert({
      lead_id: leadId,
      type: 'note',
      channel: 'Hutka',
      text: `Статус задачи изменен: ${title} → ${status}`,
      result: 'task_status_changed'
    });
    revalidatePath(`/people/${leadId}`);
  }

  revalidatePath('/tasks');
  revalidatePath('/dashboard');
  revalidatePath('/reports');
  redirect(returnTo);
}

export async function deleteTaskAction(formData: FormData) {
  await requirePermission('manageTasks', '/tasks?error=forbidden');
  const taskId = getText(formData, 'task_id');
  const returnTo = getText(formData, 'return_to') || '/tasks';
  if (!taskId) redirect(`${returnTo}?error=missing-task`);

  if (!isSupabaseConfigured()) {
    redirect(`${returnTo}?task=demo-delete`);
  }

  const supabase = await createClient();
  const { error } = await supabase.from('tasks').delete().eq('id', taskId);
  if (error) redirect(`${returnTo}?error=task-delete-failed`);

  revalidatePath('/tasks');
  revalidatePath('/dashboard');
  revalidatePath('/reports');
  redirect(`${returnTo}?deleted=task`);
}
