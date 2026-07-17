'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { queueWorkspaceTelegramNotification } from '@/lib/telegram';
import { statusLabel } from '@/lib/tasks';
import type { TaskAssigneeRole, TaskStatus } from '@/lib/tasks';
import { requirePermission } from '@/lib/permissions';
import { getSafeRedirectPath, withRedirectQuery } from '@/lib/auth';
import { writeActivityLog } from '@/lib/activity-log';
import { deferSideEffects } from '@/lib/deferred-side-effects';

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

export type TaskMutationResult = {
  ok: boolean;
  error?: string;
};

type AtomicTaskCreateResult =
  | { status: 'success'; taskId: string }
  | { status: 'business-error'; error: string }
  | { status: 'unavailable' }
  | { status: 'failed' };

function isMissingAtomicTaskCreate(error: { code?: string; message?: string; details?: string } | null) {
  if (!error) return false;
  if (error.code === 'PGRST202' || error.code === '42883') return true;
  const message = `${error.message ?? ''} ${error.details ?? ''}`.toLowerCase();
  return message.includes('create_task_with_assignees') && (
    message.includes('could not find')
    || message.includes('does not exist')
    || message.includes('schema cache')
  );
}

async function createTaskWithAssigneesRpc(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: {
    title: string;
    leadId: string | null;
    description: string;
    dueDate: string;
    priority: string;
    assignees: TaskAssigneeDraft[];
    actorProfileId: string | null;
  }
): Promise<AtomicTaskCreateResult> {
  const { data, error } = await supabase.rpc('create_task_with_assignees', {
    p_title: input.title,
    p_lead_id: input.leadId,
    p_description: input.description || null,
    p_due_date: input.dueDate || null,
    p_priority: input.priority,
    p_assignee_profile_ids: input.assignees.map((assignee) => assignee.profile_id),
    p_assignee_roles: input.assignees.map((assignee) => assignee.role),
    p_actor_profile_id: input.actorProfileId
  });

  if (error) {
    return isMissingAtomicTaskCreate(error) ? { status: 'unavailable' } : { status: 'failed' };
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { status: 'failed' };
  }

  const result = data as Record<string, unknown>;
  if (result.ok === true && typeof result.task_id === 'string') {
    return { status: 'success', taskId: result.task_id };
  }
  if (result.ok === false && typeof result.error === 'string') {
    return { status: 'business-error', error: result.error };
  }
  return { status: 'failed' };
}

function queueTaskCreatedTelegram(input: {
  title: string;
  leadId: string | null;
  dueDate: string;
  assigneeCount: number;
}) {
  queueWorkspaceTelegramNotification({
    eventType: 'task_created',
    title: 'создана задача',
    text: `Создана задача: ${input.title}`,
    href: input.leadId ? `/people/${input.leadId}` : '/tasks',
    extraLines: [
      input.dueDate ? `Дедлайн: ${input.dueDate}` : 'Дедлайн: не указан',
      input.assigneeCount > 0 ? `Участников: ${input.assigneeCount}` : 'Участники не назначены'
    ]
  });
}

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
  const atomicResult = await createTaskWithAssigneesRpc(supabase, {
    title,
    leadId,
    description: getText(formData, 'description'),
    dueDate,
    priority,
    assignees,
    actorProfileId: user.profileId
  });

  if (atomicResult.status === 'success') {
    if (leadId) revalidatePath(`/people/${leadId}`);
    queueTaskCreatedTelegram({
      title,
      leadId,
      dueDate,
      assigneeCount: assignees.length
    });
    revalidatePath('/tasks');
    revalidatePath('/dashboard');
    revalidatePath('/notifications');
    redirect(returnTo);
  }
  if (atomicResult.status === 'business-error') {
    const error = atomicResult.error === 'invalid-assignees'
      ? 'task-assignee-not-found'
      : atomicResult.error === 'invalid-priority'
        ? 'task-save-failed'
        : atomicResult.error;
    redirect(withRedirectQuery(returnTo, { error }, '/tasks'));
  }
  if (atomicResult.status === 'failed') {
    redirect(withRedirectQuery(returnTo, { error: 'task-save-failed' }, '/tasks'));
  }

  const profileIds = assignees.map((assignee) => assignee.profile_id);
  const [leadResult, existingProfileIds] = await Promise.all([
    leadId ? supabase.from('leads').select('id').eq('id', leadId).maybeSingle() : Promise.resolve({ data: { id: null }, error: null }),
    getExistingProfileIds(supabase, profileIds)
  ]);

  if (leadId && (leadResult.error || !leadResult.data?.id)) {
    redirect(withRedirectQuery(returnTo, { error: 'lead-not-found' }, '/tasks'));
  }

  const hasUnknownProfile = profileIds.some((profileId) => !existingProfileIds.has(profileId));
  if (hasUnknownProfile) {
    redirect(withRedirectQuery(returnTo, { error: 'task-assignee-not-found' }, '/tasks'));
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

  deferSideEffects(
    async () => {
      if (!leadId) return;
      await supabase.from('lead_interactions').insert({
        lead_id: leadId,
        type: 'note',
        channel: 'Hutka',
        text: `Создана задача: ${title}`,
        result: 'task_created'
      });
    },
    async () => writeActivityLog({
      userId: user.profileId,
      action: 'создал задачу',
      entityType: 'task',
      entityId: String(task.id),
      entityTitle: title,
      details: { lead_id: leadId, due_date: dueDate || null, assignees: assignees.length }
    })
  );

  if (leadId) revalidatePath(`/people/${leadId}`);

  queueTaskCreatedTelegram({
    title,
    leadId,
    dueDate,
    assigneeCount: assignees.length
  });

  revalidatePath('/tasks');
  revalidatePath('/dashboard');
  revalidatePath('/notifications');
  redirect(returnTo);
}

async function updateTaskStatusCore(
  taskId: string,
  status: TaskStatus,
  userId?: string | null,
  shouldRevalidate = false
): Promise<TaskMutationResult> {
  if (!taskId || !allowedStatuses.includes(status)) return { ok: false, error: 'task-status-failed' };
  if (!isSupabaseConfigured()) return { ok: true };

  const supabase = await createClient();
  const { data: task, error } = await supabase
    .from('tasks')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', taskId)
    .select('id,lead_id,title')
    .maybeSingle();

  if (error || !task?.id) {
    return { ok: false, error: 'task-status-failed' };
  }

  const leadId = task.lead_id ? String(task.lead_id) : '';
  const title = task.title ? String(task.title) : 'Задача';

  deferSideEffects(
    async () => {
      if (!leadId) return;
      await supabase.from('lead_interactions').insert({
        lead_id: leadId,
        type: 'note',
        channel: 'Hutka',
        text: `Статус задачи изменен: ${title} → ${status}`,
        result: 'task_status_changed'
      });
    },
    async () => writeActivityLog({
      userId,
      action: status === 'done' ? 'закрыл задачу' : 'изменил задачу',
      entityType: 'task',
      entityId: taskId,
      entityTitle: title,
      details: { status, lead_id: leadId || null }
    })
  );

  if (status === 'done' || status === 'in_progress') {
    queueWorkspaceTelegramNotification({
      eventType: 'task_status_changed',
      title: 'обновлена задача',
      text: `Статус задачи «${title}» изменен на ${statusLabel(status)}.`,
      href: leadId ? `/people/${leadId}` : '/tasks'
    });
  }

  if (shouldRevalidate) {
    revalidatePath('/tasks');
    revalidatePath('/dashboard');
    revalidatePath('/notifications');
    revalidatePath('/reports');
    if (leadId) revalidatePath(`/people/${leadId}`);
  }
  return { ok: true };
}

export async function updateTaskStatusMutationAction(input: {
  taskId: string;
  status: TaskStatus;
}): Promise<TaskMutationResult> {
  const user = await requirePermission('manageTasks', '/tasks?error=forbidden');
  return updateTaskStatusCore(input.taskId.trim(), input.status, user.profileId);
}

export async function updateTaskStatusAction(formData: FormData) {
  const user = await requirePermission('manageTasks', '/tasks?error=forbidden');
  const taskId = getText(formData, 'task_id');
  const status = getText(formData, 'status') as TaskStatus;
  const returnTo = getReturnTo(formData);
  if (!isSupabaseConfigured()) {
    redirect(withRedirectQuery(returnTo, { task: 'demo-status' }, '/tasks'));
  }
  const result = await updateTaskStatusCore(taskId, status, user.profileId, true);

  if (!result.ok) {
    redirect(withRedirectQuery(returnTo, { error: result.error ?? 'task-status-failed' }, '/tasks'));
  }

  redirect(returnTo);
}

async function deleteTaskCore(
  taskId: string,
  userId?: string | null,
  shouldRevalidate = false
): Promise<TaskMutationResult> {
  if (!taskId) return { ok: false, error: 'missing-task' };
  if (!isSupabaseConfigured()) return { ok: true };

  const supabase = await createClient();
  const { data: task, error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', taskId)
    .select('id,lead_id,title')
    .maybeSingle();
  if (error || !task?.id) return { ok: false, error: 'task-delete-failed' };

  const leadId = task.lead_id ? String(task.lead_id) : '';
  deferSideEffects(async () => writeActivityLog({
    userId,
    action: 'удалил задачу',
    entityType: 'task',
    entityId: taskId,
    entityTitle: String(task.title ?? 'Задача'),
    details: { lead_id: leadId || null }
  }));

  if (shouldRevalidate) {
    revalidatePath('/tasks');
    revalidatePath('/dashboard');
    revalidatePath('/reports');
    if (leadId) revalidatePath(`/people/${leadId}`);
  }
  return { ok: true };
}

export async function deleteTaskMutationAction(input: { taskId: string }): Promise<TaskMutationResult> {
  const user = await requirePermission('manageTasks', '/tasks?error=forbidden');
  return deleteTaskCore(input.taskId.trim(), user.profileId);
}

export async function deleteTaskAction(formData: FormData) {
  const user = await requirePermission('manageTasks', '/tasks?error=forbidden');
  const taskId = getText(formData, 'task_id');
  const returnTo = getReturnTo(formData);
  if (!isSupabaseConfigured()) {
    redirect(withRedirectQuery(returnTo, { task: 'demo-delete' }, '/tasks'));
  }
  const result = await deleteTaskCore(taskId, user.profileId, true);

  if (!result.ok) {
    redirect(withRedirectQuery(returnTo, { error: result.error ?? 'task-delete-failed' }, '/tasks'));
  }

  redirect(withRedirectQuery(returnTo, { deleted: 'task' }, '/tasks'));
}
