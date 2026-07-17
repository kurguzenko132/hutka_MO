'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { requirePermission } from '@/lib/permissions';
import { getFollowUpRecommendations } from '@/lib/followups';
import type { FollowUpRecommendation } from '@/lib/followups';
import { queueWorkspaceTelegramNotification } from '@/lib/telegram';
import { getSafeRedirectPath, withRedirectQuery } from '@/lib/auth';
import { writeActivityLog } from '@/lib/activity-log';
import { deferSideEffects } from '@/lib/deferred-side-effects';

function getText(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

function getReturnTo(formData: FormData, fallback = '/followups') {
  return getSafeRedirectPath(getText(formData, 'return_to'), fallback);
}

function normalizePriority(value: string): FollowUpRecommendation['priority'] {
  return value === 'low' || value === 'medium' || value === 'high' || value === 'urgent' ? value : 'medium';
}

async function hasDuplicateOpenTask(
  supabase: Awaited<ReturnType<typeof createClient>>,
  leadId: string,
  title: string
) {
  const { data } = await supabase
    .from('tasks')
    .select('id')
    .eq('lead_id', leadId)
    .eq('title', title)
    .in('status', ['todo', 'in_progress'])
    .limit(1)
    .maybeSingle();

  return Boolean(data?.id);
}

export type FollowUpTaskMutationInput = {
  id?: string;
  leadId: string;
  title: string;
  description?: string;
  dueDate?: string;
  priority: FollowUpRecommendation['priority'];
  reasonTitle?: string;
};

export type FollowUpTaskMutationResult = {
  ok: boolean;
  created: boolean;
  duplicate?: boolean;
  taskId?: string;
  error?: string;
};

export type FollowUpBulkMutationResult = {
  ok: boolean;
  createdCount: number;
  addressedIds: string[];
  failedIds: string[];
};

function isMissingFollowUpRpc(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  return error.code === '42883'
    || error.code === 'PGRST202'
    || String(error.message ?? '').includes('create_followup_task');
}

function parseRpcResult(value: unknown): FollowUpTaskMutationResult | null {
  if (!value || typeof value !== 'object') return null;
  const payload = value as Record<string, unknown>;
  const ok = payload.ok === true;
  return {
    ok,
    created: payload.created === true,
    duplicate: ok && payload.created !== true,
    taskId: typeof payload.task_id === 'string' ? payload.task_id : undefined,
    error: typeof payload.error === 'string' ? payload.error : ok ? undefined : 'followup-task-failed'
  };
}

async function createTaskFromRecommendationFallback(
  supabase: Awaited<ReturnType<typeof createClient>>,
  recommendation: FollowUpTaskMutationInput,
  userId?: string | null
): Promise<FollowUpTaskMutationResult> {
  const exists = await hasDuplicateOpenTask(supabase, recommendation.leadId, recommendation.title);
  if (exists) return { ok: true, created: false, duplicate: true };

  const { data: task, error } = await supabase.from('tasks').insert({
    lead_id: recommendation.leadId,
    title: recommendation.title,
    description: recommendation.description || null,
    due_date: recommendation.dueDate || null,
    priority: recommendation.priority,
    status: 'todo',
    created_by: userId ?? null
  }).select('id').single();

  if (error || !task?.id) return { ok: false, created: false, error: 'followup-task-failed' };

  const { error: interactionError } = await supabase.from('lead_interactions').insert({
    lead_id: recommendation.leadId,
    type: 'note',
    channel: 'Hutka',
    text: `Автоматически создана задача по рекомендации: ${recommendation.title}`,
    result: 'auto_followup_task_created',
    created_by: userId ?? null
  });

  if (interactionError) {
    await supabase.from('tasks').delete().eq('id', task.id);
    return { ok: false, created: false, error: 'followup-task-failed' };
  }

  return { ok: true, created: true, taskId: String(task.id) };
}

async function createTaskFromRecommendation(
  supabase: Awaited<ReturnType<typeof createClient>>,
  recommendation: FollowUpTaskMutationInput,
  userId?: string | null
): Promise<FollowUpTaskMutationResult> {
  const rpcResult = await supabase.rpc('create_followup_task', {
    p_lead_id: recommendation.leadId,
    p_title: recommendation.title,
    p_description: recommendation.description || null,
    p_due_date: recommendation.dueDate || null,
    p_priority: recommendation.priority,
    p_created_by: userId ?? null
  });

  let result = parseRpcResult(rpcResult.data);
  if (rpcResult.error && isMissingFollowUpRpc(rpcResult.error)) {
    result = await createTaskFromRecommendationFallback(supabase, recommendation, userId);
  } else if (rpcResult.error) {
    result = { ok: false, created: false, error: 'followup-task-failed' };
  } else if (!result) {
    result = { ok: false, created: false, error: 'followup-task-failed' };
  }

  if (result.created && result.taskId) {
    deferSideEffects(async () => writeActivityLog({
      userId,
      action: 'создал задачу',
      entityType: 'task',
      entityId: result.taskId,
      entityTitle: recommendation.title,
      details: {
        lead_id: recommendation.leadId,
        due_date: recommendation.dueDate || null,
        source: 'followups',
        reason: recommendation.reasonTitle || null
      }
    }));
  }

  return result;
}

function recommendationInput(
  recommendation: Pick<FollowUpRecommendation, 'id' | 'leadId' | 'suggestedTaskTitle' | 'suggestedTaskDescription' | 'suggestedDueDate' | 'priority' | 'title'>
): FollowUpTaskMutationInput {
  return {
    id: recommendation.id,
    leadId: recommendation.leadId,
    title: recommendation.suggestedTaskTitle,
    description: recommendation.suggestedTaskDescription,
    dueDate: recommendation.suggestedDueDate,
    priority: recommendation.priority,
    reasonTitle: recommendation.title
  };
}

async function createFollowUpTaskCore(
  input: FollowUpTaskMutationInput,
  userId?: string | null
): Promise<FollowUpTaskMutationResult> {
  if (!input.leadId.trim() || !input.title.trim()) {
    return { ok: false, created: false, error: 'missing-followup-data' };
  }
  if (!isSupabaseConfigured()) return { ok: true, created: true, taskId: `demo:${input.id ?? input.leadId}` };

  const supabase = await createClient();
  return createTaskFromRecommendation(supabase, {
    ...input,
    leadId: input.leadId.trim(),
    title: input.title.trim(),
    description: input.description?.trim(),
    dueDate: input.dueDate?.trim(),
    priority: normalizePriority(input.priority)
  }, userId);
}

export async function createFollowUpTaskMutationAction(
  input: FollowUpTaskMutationInput
): Promise<FollowUpTaskMutationResult> {
  const user = await requirePermission('manageTasks', '/followups?error=forbidden');
  const result = await createFollowUpTaskCore(input, user.profileId);

  if (result.created) {
    queueWorkspaceTelegramNotification({
      eventType: 'followup_task_created',
      title: 'создана задача',
      text: `Создана задача по рекомендации: ${input.title}`,
      href: `/people/${input.leadId}`,
      extraLines: [
        input.description ? `Описание: ${input.description}` : '',
        input.dueDate ? `Срок: ${input.dueDate}` : ''
      ].filter((line): line is string => Boolean(line))
    });
  }

  return result;
}

export async function createAllFollowUpTasksMutationAction(input: {
  items: FollowUpTaskMutationInput[];
}): Promise<FollowUpBulkMutationResult> {
  const user = await requirePermission('manageTasks', '/followups?error=forbidden');
  const items = input.items.slice(0, 10);
  if (items.length === 0) return { ok: true, createdCount: 0, addressedIds: [], failedIds: [] };

  const results = await Promise.all(items.map(async (item) => ({
    id: item.id ?? `${item.leadId}:${item.title}`,
    result: await createFollowUpTaskCore(item, user.profileId)
  })));
  const addressedIds = results.filter((item) => item.result.ok).map((item) => item.id);
  const failedIds = results.filter((item) => !item.result.ok).map((item) => item.id);
  const createdCount = results.filter((item) => item.result.created).length;

  if (createdCount > 0) {
    queueWorkspaceTelegramNotification({
      eventType: 'followup_tasks_created',
      title: 'созданы задачи',
      text: `Hutka автоматически создала ${createdCount} задач по рекомендациям.`,
      href: '/followups'
    });
  }

  return {
    ok: failedIds.length === 0,
    createdCount,
    addressedIds,
    failedIds
  };
}

export async function createFollowUpTaskAction(formData: FormData) {
  const user = await requirePermission('manageTasks', '/followups?error=forbidden');

  const leadId = getText(formData, 'lead_id');
  const title = getText(formData, 'title');
  const description = getText(formData, 'description');
  const dueDate = getText(formData, 'due_date');
  const priority = normalizePriority(getText(formData, 'priority'));
  const returnTo = getReturnTo(formData);

  if (!leadId || !title) redirect(withRedirectQuery(returnTo, { error: 'missing-followup-data' }, '/followups'));
  const result = await createFollowUpTaskCore({
      id: getText(formData, 'recommendation_id'),
      leadId,
      title,
      description,
      dueDate,
      priority,
      reasonTitle: getText(formData, 'reason_title')
    }, user.profileId);

  if (!result.ok) redirect(withRedirectQuery(returnTo, { error: result.error ?? 'followup-task-failed' }, '/followups'));

  if (result.created) {
    queueWorkspaceTelegramNotification({
      eventType: 'followup_task_created',
      title: 'создана задача',
      text: `Создана задача по рекомендации: ${title}`,
      href: `/people/${leadId}`,
      extraLines: [description ? `Описание: ${description}` : '', dueDate ? `Срок: ${dueDate}` : ''].filter((line): line is string => Boolean(line))
    });
  }


  revalidatePath('/followups');
  revalidatePath('/tasks');
  revalidatePath('/dashboard');
  revalidatePath(`/people/${leadId}`);
  redirect(withRedirectQuery(returnTo, { created: result.created ? '1' : 'duplicate' }, '/followups'));
}

export async function createAllFollowUpTasksAction(formData: FormData) {
  const user = await requirePermission('manageTasks', '/followups?error=forbidden');
  const limit = Number(getText(formData, 'limit') || 10);
  const returnTo = getReturnTo(formData);

  if (!isSupabaseConfigured()) redirect(withRedirectQuery(returnTo, { created: 'demo-bulk' }, '/followups'));

  const data = await getFollowUpRecommendations();
  const candidates = data.recommendations
    .filter((item) => !item.hasOpenTask)
    .slice(0, Number.isFinite(limit) && limit > 0 ? limit : 10);

  if (candidates.length === 0) redirect(withRedirectQuery(returnTo, { created: 'none' }, '/followups'));

  const results = await Promise.all(candidates.map(async (item) => {
    return createFollowUpTaskCore(recommendationInput(item), user.profileId);
  }));
  const created = results.filter((result) => result.created).length;

  if (created > 0) {
    queueWorkspaceTelegramNotification({
      eventType: 'followup_tasks_created',
      title: 'созданы задачи',
      text: `Hutka автоматически создала ${created} задач по рекомендациям.`,
      href: '/followups'
    });
  }

  revalidatePath('/followups');
  revalidatePath('/tasks');
  revalidatePath('/dashboard');
  revalidatePath('/people');
  redirect(withRedirectQuery(returnTo, { created }, '/followups'));
}
