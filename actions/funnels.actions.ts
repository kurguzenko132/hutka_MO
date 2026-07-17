'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { requirePermission } from '@/lib/permissions';
import { getCanonicalStage, normalizeStageName } from '@/lib/stages';
import { recordActivityLog, writeActivityLog } from '@/lib/activity-log';
import { deferSideEffects } from '@/lib/deferred-side-effects';

function getText(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

function looksLikeUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isMissingAtomicFunnelMove(error: { code?: string; message?: string; details?: string } | null) {
  if (!error) return false;
  if (error.code === 'PGRST202' || error.code === '42883') return true;
  const message = `${error.message ?? ''} ${error.details ?? ''}`.toLowerCase();
  return message.includes('move_lead_to_stage') && (
    message.includes('could not find')
    || message.includes('does not exist')
    || message.includes('schema cache')
  );
}

async function ensureStageId(supabase: Awaited<ReturnType<typeof createClient>>, stageId: string, stageName: string) {
  if (stageId && !stageId.startsWith('stage-') && !stageId.startsWith('missing-')) {
    if (looksLikeUuid(stageId)) {
      const existing = await supabase.from('funnel_stages').select('id').eq('id', stageId).maybeSingle();
      if (existing.data?.id) return stageId;
    }

    if (!stageName) throw new Error('Stage not found');
  }

  const stage = getCanonicalStage(stageName || stageId);
  const name = stage.name;
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
    .insert({ name, type: 'master', order_index: stage.orderIndex, color: stage.color })
    .select('id')
    .single();

  if (created.error || !created.data?.id) {
    throw created.error ?? new Error('Не удалось создать стадию');
  }

  return String(created.data.id);
}

export async function moveLeadToStageAction(formData: FormData) {
  const user = await requirePermission('manageFunnels', '/funnels?error=forbidden');
  const leadId = getText(formData, 'lead_id');
  const stageId = getText(formData, 'stage_id');
  const rawStageName = getText(formData, 'stage_name');
  const campaignId = getText(formData, 'campaign_id');
  const baseRedirect = campaignId ? `/funnels?campaignId=${encodeURIComponent(campaignId)}` : '/funnels';

  if (!leadId) redirect(`${baseRedirect}${campaignId ? '&' : '?'}error=missing-lead`);

  if (!isSupabaseConfigured()) {
    redirect(`${baseRedirect}${campaignId ? '&' : '?'}updated=demo`);
  }

  const supabase = await createClient();
  const { data: lead, error: leadError } = await supabase.from('leads').select('id').eq('id', leadId).maybeSingle();
  if (leadError || !lead?.id) redirect(`${baseRedirect}${campaignId ? '&' : '?'}error=lead-not-found`);

  let stageName = rawStageName;
  if (!stageName && stageId && !looksLikeUuid(stageId)) {
    stageName = stageId;
  } else if (!stageName && stageId) {
    const selectedStage = await supabase.from('funnel_stages').select('name').eq('id', stageId).maybeSingle();
    stageName = selectedStage.data?.name ? String(selectedStage.data.name) : '';
  }
  stageName = normalizeStageName(stageName);

  let nextStageId: string;

  try {
    nextStageId = await ensureStageId(supabase, stageName ? '' : stageId, stageName);
  } catch {
    redirect(`${baseRedirect}${campaignId ? '&' : '?'}error=stage-not-found`);
  }

  let nextStageName = stageName;

  const { error } = await supabase
    .from('leads')
    .update({ stage_id: nextStageId, updated_at: new Date().toISOString() })
    .eq('id', leadId);

  if (error) {
    redirect(`${baseRedirect}${campaignId ? '&' : '?'}error=move-failed`);
  }

  await supabase.from('lead_interactions').insert({
    lead_id: leadId,
    type: 'status_change',
    channel: 'Hutka',
    text: `Контакт перемещен в стадию: ${nextStageName || 'не указана'}`,
    result: 'stage_updated'
  });
  await recordActivityLog({
    userId: user.profileId,
    action: 'перетащил контакт в воронке',
    entityType: 'contact',
    entityId: leadId,
    entityTitle: 'Контакт',
    details: { stage: nextStageName, campaign_id: campaignId || null }
  });

  revalidatePath('/funnels');
  revalidatePath('/people');
  revalidatePath(`/people/${leadId}`);
  revalidatePath('/dashboard');
  revalidatePath('/reports');
  revalidatePath('/geography');
  redirect(`${baseRedirect}${campaignId ? '&' : '?'}updated=stage`);
}

export async function moveLeadToStageMutationAction(input: {
  leadId: string;
  stageId?: string;
  stageName: string;
  campaignId?: string;
  refusalReason?: string;
}) {
  const user = await requirePermission('manageFunnels', '/funnels?error=forbidden');
  const leadId = input.leadId.trim();
  const nextStageName = normalizeStageName(input.stageName);
  const refusalReason = input.refusalReason?.trim() ?? '';

  if (!leadId || !nextStageName) return { ok: false, error: 'missing-data' };
  if (nextStageName === 'Отказ' && !refusalReason) return { ok: false, error: 'refusal-required' };
  if (!isSupabaseConfigured()) return { ok: true, stageName: nextStageName };

  const supabase = await createClient();
  const requestedStageId = input.stageId?.trim() ?? '';
  const atomicResult = await supabase.rpc('move_lead_to_stage', {
    p_lead_id: leadId,
    p_stage_id: looksLikeUuid(requestedStageId) ? requestedStageId : null,
    p_stage_name: nextStageName,
    p_refusal_reason: refusalReason || null,
    p_campaign_id: input.campaignId?.trim() || null,
    p_actor_profile_id: user.profileId
  });

  if (!atomicResult.error && atomicResult.data && typeof atomicResult.data === 'object' && !Array.isArray(atomicResult.data)) {
    const result = atomicResult.data as Record<string, unknown>;
    if (result.ok === true) {
      return {
        ok: true,
        stageName: typeof result.stage_name === 'string' ? result.stage_name : nextStageName
      };
    }
    if (result.ok === false && typeof result.error === 'string') {
      return { ok: false, error: result.error };
    }
    return { ok: false, error: 'move-failed' };
  }
  if (atomicResult.error && !isMissingAtomicFunnelMove(atomicResult.error)) {
    return { ok: false, error: 'move-failed' };
  }
  if (!atomicResult.error) {
    return { ok: false, error: 'move-failed' };
  }

  let nextStageId = input.stageId?.trim() ?? '';
  try {
    if (!looksLikeUuid(nextStageId)) {
      nextStageId = await ensureStageId(supabase, '', nextStageName);
    }
  } catch {
    return { ok: false, error: 'stage-not-found' };
  }

  const updatePayload: Record<string, string | null> = {
    stage_id: nextStageId,
    updated_at: new Date().toISOString()
  };

  if (nextStageName === 'Отказ') {
    updatePayload.refusal_reason_id = null;
    updatePayload.refusal_reason = refusalReason;
    updatePayload.refusal_comment = refusalReason;
    updatePayload.refused_at = new Date().toISOString();
  } else {
    updatePayload.refusal_reason_id = null;
    updatePayload.refusal_reason = null;
    updatePayload.refusal_comment = null;
    updatePayload.refused_at = null;
  }

  const { data: lead, error } = await supabase
    .from('leads')
    .update(updatePayload)
    .eq('id', leadId)
    .select('id,name')
    .maybeSingle();
  if (error) return { ok: false, error: 'move-failed' };
  if (!lead?.id) return { ok: false, error: 'lead-not-found' };

  const testingText = nextStageName === 'Тестирует'
    ? 'Важное событие: контакт начал тестирование.'
    : `Контакт перемещен в стадию: ${nextStageName}`;

  deferSideEffects(
    async () => {
      await supabase.from('lead_interactions').insert({
        lead_id: leadId,
        type: 'status_change',
        channel: 'Hutka',
        text: nextStageName === 'Отказ' ? `Контакт перемещен в отказ. Причина: ${refusalReason}` : testingText,
        result: 'stage_updated',
        created_by: user.profileId
      });
    },
    async () => writeActivityLog({
      userId: user.profileId,
      action: 'перетащил контакт в воронке',
      entityType: 'contact',
      entityId: leadId,
      entityTitle: String(lead.name ?? 'Контакт'),
      details: { stage: nextStageName, campaign_id: input.campaignId || null, refusal_reason: refusalReason || null }
    })
  );

  return { ok: true, stageName: nextStageName };
}
