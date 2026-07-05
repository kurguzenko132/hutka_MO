'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { requirePermission } from '@/lib/permissions';
import { getFollowUpRecommendations } from '@/lib/followups';
import type { FollowUpRecommendation } from '@/lib/followups';
import { sendWorkspaceTelegramNotification } from '@/lib/telegram';
import { getSafeRedirectPath, withRedirectQuery } from '@/lib/auth';

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

async function createTaskFromRecommendation(
  supabase: Awaited<ReturnType<typeof createClient>>,
  recommendation: Pick<FollowUpRecommendation, 'leadId' | 'suggestedTaskTitle' | 'suggestedTaskDescription' | 'suggestedDueDate' | 'priority' | 'title'>
) {
  const exists = await hasDuplicateOpenTask(supabase, recommendation.leadId, recommendation.suggestedTaskTitle);
  if (exists) return false;

  const { error } = await supabase.from('tasks').insert({
    lead_id: recommendation.leadId,
    title: recommendation.suggestedTaskTitle,
    description: recommendation.suggestedTaskDescription,
    due_date: recommendation.suggestedDueDate || null,
    priority: recommendation.priority,
    status: 'todo'
  });

  if (error) throw error;

  await supabase.from('lead_interactions').insert({
    lead_id: recommendation.leadId,
    type: 'note',
    channel: 'Hutka',
    text: `Автоматически создана задача по рекомендации: ${recommendation.suggestedTaskTitle}`,
    result: 'auto_followup_task_created'
  });

  return true;
}

export async function createFollowUpTaskAction(formData: FormData) {
  await requirePermission('manageTasks', '/followups?error=forbidden');

  const leadId = getText(formData, 'lead_id');
  const title = getText(formData, 'title');
  const description = getText(formData, 'description');
  const dueDate = getText(formData, 'due_date');
  const priority = normalizePriority(getText(formData, 'priority'));
  const returnTo = getReturnTo(formData);

  if (!leadId || !title) redirect(withRedirectQuery(returnTo, { error: 'missing-followup-data' }, '/followups'));
  if (!isSupabaseConfigured()) redirect(withRedirectQuery(returnTo, { created: 'demo' }, '/followups'));

  const supabase = await createClient();
  const { data: lead, error: leadError } = await supabase.from('leads').select('id').eq('id', leadId).maybeSingle();

  if (leadError || !lead?.id) {
    redirect(withRedirectQuery(returnTo, { error: 'lead-not-found' }, '/followups'));
  }

  let created = false;

  try {
    created = await createTaskFromRecommendation(supabase, {
      leadId,
      suggestedTaskTitle: title,
      suggestedTaskDescription: description,
      suggestedDueDate: dueDate,
      priority: priority || 'medium',
      title
    });
  } catch {
    redirect(withRedirectQuery(returnTo, { error: 'followup-task-failed' }, '/followups'));
  }

  if (created) {
    await sendWorkspaceTelegramNotification({
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
  redirect(withRedirectQuery(returnTo, { created: created ? '1' : 'duplicate' }, '/followups'));
}

export async function createAllFollowUpTasksAction(formData: FormData) {
  await requirePermission('manageTasks', '/followups?error=forbidden');
  const limit = Number(getText(formData, 'limit') || 10);
  const returnTo = getReturnTo(formData);

  if (!isSupabaseConfigured()) redirect(withRedirectQuery(returnTo, { created: 'demo-bulk' }, '/followups'));

  const data = await getFollowUpRecommendations();
  const candidates = data.recommendations
    .filter((item) => !item.hasOpenTask)
    .slice(0, Number.isFinite(limit) && limit > 0 ? limit : 10);

  if (candidates.length === 0) redirect(withRedirectQuery(returnTo, { created: 'none' }, '/followups'));

  const supabase = await createClient();
  let created = 0;

  for (const item of candidates) {
    try {
      const didCreate = await createTaskFromRecommendation(supabase, item);
      if (didCreate) created += 1;
    } catch {
      // Continue with the rest; the page will show how many were created.
    }
  }

  if (created > 0) {
    await sendWorkspaceTelegramNotification({
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
