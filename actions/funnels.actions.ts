'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { requirePermission } from '@/lib/permissions';

function getText(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

function looksLikeUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function ensureStageId(supabase: Awaited<ReturnType<typeof createClient>>, stageId: string, stageName: string) {
  if (stageId && !stageId.startsWith('stage-') && !stageId.startsWith('missing-')) {
    if (looksLikeUuid(stageId)) {
      const existing = await supabase.from('funnel_stages').select('id').eq('id', stageId).maybeSingle();
      if (existing.data?.id) return stageId;
    }

    if (!stageName) throw new Error('Stage not found');
  }

  const name = stageName || 'Найден';
  const existing = await supabase
    .from('funnel_stages')
    .select('id')
    .eq('name', name)
    .order('order_index', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existing.data?.id) return String(existing.data.id);

  const created = await supabase
    .from('funnel_stages')
    .insert({ name, type: 'master', order_index: 99, color: 'purple' })
    .select('id')
    .single();

  if (created.error || !created.data?.id) {
    throw created.error ?? new Error('Не удалось создать стадию');
  }

  return String(created.data.id);
}

export async function moveLeadToStageAction(formData: FormData) {
  await requirePermission('manageFunnels', '/funnels?error=forbidden');
  const leadId = getText(formData, 'lead_id');
  const stageId = getText(formData, 'stage_id');
  const stageName = getText(formData, 'stage_name');

  if (!leadId) redirect('/funnels?error=missing-lead');

  if (!isSupabaseConfigured()) {
    redirect('/funnels?updated=demo');
  }

  const supabase = await createClient();
  const { data: lead, error: leadError } = await supabase.from('leads').select('id').eq('id', leadId).maybeSingle();
  if (leadError || !lead?.id) redirect('/funnels?error=lead-not-found');

  let nextStageId: string;

  try {
    nextStageId = await ensureStageId(supabase, stageId, stageName);
  } catch {
    redirect('/funnels?error=stage-not-found');
  }

  let nextStageName = stageName;

  if (!nextStageName) {
    const selectedStage = await supabase.from('funnel_stages').select('name').eq('id', nextStageId).maybeSingle();
    nextStageName = selectedStage.data?.name ? String(selectedStage.data.name) : 'не указана';
  }

  const { error } = await supabase
    .from('leads')
    .update({ stage_id: nextStageId, updated_at: new Date().toISOString() })
    .eq('id', leadId);

  if (error) {
    redirect('/funnels?error=move-failed');
  }

  await supabase.from('lead_interactions').insert({
    lead_id: leadId,
    type: 'status_change',
    channel: 'Hutka',
    text: `Контакт перемещен в стадию: ${nextStageName || 'не указана'}`,
    result: 'stage_updated'
  });

  revalidatePath('/funnels');
  revalidatePath('/people');
  revalidatePath(`/people/${leadId}`);
  revalidatePath('/dashboard');
  revalidatePath('/reports');
  revalidatePath('/geography');
  redirect('/funnels?updated=stage');
}
