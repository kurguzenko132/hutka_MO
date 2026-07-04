'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { sendWorkspaceTelegramNotification } from '@/lib/telegram';
import { statusLabel } from '@/lib/tasks';
import type { TaskAssigneeRole, TaskStatus } from '@/lib/tasks';
import { requirePermission } from '@/lib/permissions';
import { getSafeRedirectPath, withRedirectQuery } from '@/lib/auth';

function getText(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

const priorityToDb: Record<string, string> = {
  'Без приоритета': 'none',
  Низкий: 'low',
  Средний: 'medium',
  Высокий: 'high',
  Срочно: 'urgent',
  none: 'none',
  low: 'low',
  medium: 'medium',
  high: 'high',
  urgent: 'urgent'
};

const allowedStatuses: TaskStatus[] = ['todo', 'in_progress', 'done', 'cancelled'];
const allowedAssigneeRoles: TaskAssigneeRole[] = ['responsible', 'executor', 'co_executor'];

type TaskAssigneeDraft = {
  profile_id: string;
  role: TaskAssigneeRole;
};

function getReturnTo(formData: FormData, fallback = '/tasks') {
  return getSafeRedirectPath(getText(formData, 'return_to'), fallback);
}

function getIds(formData: FormData, key: string) {
  return Array.from(new Set(
    formData
      .getAll(key)
      .map((value) => String(value).trim())
      .filter(Boolean)
  ));
}

function getTaskAssignees(formData: FormData): TaskAssigneeDraft[] {
  const byProfile = new Map<string, TaskAssigneeRole>();

  getIds(formData, 'co_executor_ids').forEach((profileId) => byProfile.set(profileId, 'co_executor'));
  getIds(formData, 'executor_ids').forEach((profileId) => byProfile.set(profileId, 'executor'));

  const responsibleId = getText(formData, 'responsible_id');
  if (responsibleId) byProfile.set(responsibleId, 'responsible');

  return Array.from(byProfile.entries())
    .map(([profile_id, role]) => ({ profile_id, role }))
    .filter((item) => allowedAssigneeRoles.includes(item.role));
}

async function getExistingProfileIds(supabase: Awaited<ReturnType<typeof createClient>>, profileIds: string[]) {
  if (profileIds.length === 0) return new Set<string>();

  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .in('id', profileIds);

  if (error || !data) return new Set<string>();
  return new Set(data.map((profile) => String(profile.id)));
}

export async function createTaskAction(formData: FormData) {
  const user = await requirePermission('manageTasks', '/tasks?error=forbidden');
  const title = getText(formData, 'title');
  const leadId = getText(formData, 'lead_id') || null;
  const returnTo = getReturnTo(formData);
  const dueDate = getText(formData, 'due_date');
  const priority = priorityToDb[getText(formData, 'priority')] ?? 'none';
  const assignees = getTaskAssignees(formData);

  if (!title) {
    redirect(withRedirectQuery(returnTo, { error: 'missing-task-title' }, '/tasks'));
  }

  if (!isSupabaseConfigured()) {
    redirect(withRedirectQuery(returnTo, { task: 'demo' }, '/tasks'));
  }

  const supabase = await createClient();

  if (leadId) {
    const { data: lead, error: leadError } = await supabase.from('leads').select('id').eq('id', leadId).maybeSingle();
    if (leadError || !lead?.id) {
      redirect(withRedirectQuery(returnTo, { error: 'lead-not-found' }, '/tasks'));
    }
  }

  const profileIds = assignees.map((assignee) => assignee.profile_id);
  if (profileIds.length > 0) {
    const existingProfileIds = await getExistingProfileIds(supabase, profileIds);
    const hasUnknownProfile = profileIds.some((profileId) => !existingProfileIds.has(profileId));
    if (hasUnknownProfile) {
      redirect(withRedirectQuery(returnTo, { error: 'task-assignee-not-found' }, '/tasks'));
    }
  }

  const { data: task, error } = await supabase
    .from('tasks')
    .insert({
      title,
      lead_id: leadId,
      description: getText(formData, 'description') || null,
      due_date: dueDate || null,
      priority,
      status: 'todo',
      created_by: user.profileId
    })
    .select('id')
    .single();

  if (error || !task?.id) {
    redirect(withRedirectQuery(returnTo, { error: 'task-save-failed' }, '/tasks'));
  }

  if (assignees.length > 0) {
    const rows = assignees.map((assignee) => ({
      task_id: String(task.id),
      profile_id: assignee.profile_id,
      role: assignee.role
    }));
    const { error: assigneeError } = await supabase.from('task_assignees').insert(rows);
    if (assigneeError) {
      revalidatePath('/tasks');
      revalidatePath('/dashboard');
      if (leadId) revalidatePath(`/people/${leadId}`);
      redirect(withRedirectQuery(returnTo, { error: 'task-assignees-failed' }, '/tasks'));
    }
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

  await sendWorkspaceTelegramNotification({
    eventType: 'task_created',
    title: 'создана задача',
    text: `Создана задача: ${title}`,
    href: leadId ? `/people/${leadId}` : '/tasks',
    extraLines: [
      dueDate ? `Дедлайн: ${dueDate}` : 'Дедлайн: не указан',
      assignees.length > 0 ? `Участников: ${assignees.length}` : 'Участники не назначены'
    ]
  });

  revalidatePath('/tasks');
  revalidatePath('/dashboard');
  revalidatePath('/notifications');
  redirect(returnTo);
}

export async function updateTaskStatusAction(formData: FormData) {
  await requirePermission('manageTasks', '/tasks?error=forbidden');
  const taskId = getText(formData, 'task_id');
  const status = getText(formData, 'status') as TaskStatus;
  const returnTo = getReturnTo(formData);

  if (!taskId || !allowedStatuses.includes(status)) {
    redirect(withRedirectQuery(returnTo, { error: 'task-status-failed' }, '/tasks'));
  }

  if (!isSupabaseConfigured()) {
    redirect(withRedirectQuery(returnTo, { task: 'demo-status' }, '/tasks'));
  }

  const supabase = await createClient();
  const { data: task, error: taskError } = await supabase
    .from('tasks')
    .select('id,lead_id,title')
    .eq('id', taskId)
    .maybeSingle();

  if (taskError || !task?.id) {
    redirect(withRedirectQuery(returnTo, { error: 'task-not-found' }, '/tasks'));
  }

  const { error } = await supabase
    .from('tasks')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', taskId);

  if (error) {
    redirect(withRedirectQuery(returnTo, { error: 'task-status-failed' }, '/tasks'));
  }

  const leadId = task.lead_id ? String(task.lead_id) : '';
  const title = task.title ? String(task.title) : 'Задача';

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

  if (status === 'done' || status === 'in_progress') {
    await sendWorkspaceTelegramNotification({
      eventType: 'task_status_changed',
      title: 'обновлена задача',
      text: `Статус задачи «${title}» изменен на ${statusLabel(status)}.`,
      href: leadId ? `/people/${leadId}` : '/tasks'
    });
  }

  revalidatePath('/tasks');
  revalidatePath('/dashboard');
  revalidatePath('/notifications');
  revalidatePath('/reports');
  redirect(returnTo);
}

export async function deleteTaskAction(formData: FormData) {
  await requirePermission('manageTasks', '/tasks?error=forbidden');
  const taskId = getText(formData, 'task_id');
  const returnTo = getReturnTo(formData);
  if (!taskId) redirect(withRedirectQuery(returnTo, { error: 'missing-task' }, '/tasks'));

  if (!isSupabaseConfigured()) {
    redirect(withRedirectQuery(returnTo, { task: 'demo-delete' }, '/tasks'));
  }

  const supabase = await createClient();
  const { data: task, error: taskError } = await supabase
    .from('tasks')
    .select('id,lead_id')
    .eq('id', taskId)
    .maybeSingle();

  if (taskError || !task?.id) {
    redirect(withRedirectQuery(returnTo, { error: 'task-not-found' }, '/tasks'));
  }

  const { error } = await supabase.from('tasks').delete().eq('id', taskId);
  if (error) redirect(withRedirectQuery(returnTo, { error: 'task-delete-failed' }, '/tasks'));

  const leadId = task.lead_id ? String(task.lead_id) : '';

  revalidatePath('/tasks');
  revalidatePath('/dashboard');
  revalidatePath('/reports');
  if (leadId) revalidatePath(`/people/${leadId}`);
  redirect(withRedirectQuery(returnTo, { deleted: 'task' }, '/tasks'));
}
