'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';

function getText(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

const priorityToDb: Record<string, string> = {
  Низкий: 'low',
  Средний: 'medium',
  Высокий: 'high',
  Срочно: 'urgent'
};

export async function createTaskAction(formData: FormData) {
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
