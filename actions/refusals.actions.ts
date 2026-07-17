'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { requirePermission } from '@/lib/permissions';
import { recordActivityLog, writeActivityLog } from '@/lib/activity-log';
import { deferSideEffects } from '@/lib/deferred-side-effects';
import type { RefusalReason } from '@/lib/refusals';

function getText(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

function getInt(formData: FormData, key: string, fallback = 99) {
  const value = Number.parseInt(getText(formData, key), 10);
  return Number.isFinite(value) ? value : fallback;
}

function revalidateRefusals(leadId?: string) {
  revalidatePath('/settings/refusal-reasons');
  revalidatePath('/settings');
  revalidatePath('/people');
  revalidatePath('/dashboard');
  revalidatePath('/reports');
  revalidatePath('/funnels');
  revalidatePath('/geography');
  if (leadId) revalidatePath(`/people/${leadId}`);
}

async function ensureRefusalStageId(supabase: Awaited<ReturnType<typeof createClient>>) {
  const existing = await supabase.from('funnel_stages').select('id').eq('name', 'Отказ').maybeSingle();
  if (existing.data?.id) return String(existing.data.id);

  const created = await supabase
    .from('funnel_stages')
    .insert({ name: 'Отказ', type: 'master', order_index: 999, color: 'red' })
    .select('id')
    .single();

  return created.data?.id ? String(created.data.id) : null;
}

export type LeadRefusalMutationInput = {
  leadId: string;
  reasonId?: string;
  reason?: string;
  comment?: string;
};

export type LeadRefusalMutationResult = {
  ok: boolean;
  error?: string;
  refusal?: {
    reason: string;
    comment?: string;
    refusedAt: string;
  } | null;
};

export type RefusalReasonMutationInput = {
  id?: string;
  name: string;
  description?: string;
  color?: string;
  orderIndex?: number;
  isActive?: boolean;
};

export type RefusalReasonMutationResult = {
  ok: boolean;
  error?: string;
  count?: number;
  item?: RefusalReason;
};

function mapRefusalReason(
  row: Record<string, unknown>,
  usageCount = 0
): RefusalReason {
  return {
    id: String(row.id),
    name: String(row.name ?? 'Причина отказа'),
    description: row.description ? String(row.description) : undefined,
    color: String(row.color ?? 'gray'),
    orderIndex: Number(row.order_index ?? 99),
    isActive: row.is_active !== false,
    usageCount
  };
}

async function markLeadRefusedCore(
  input: LeadRefusalMutationInput,
  userId?: string | null,
  shouldRevalidate = false
): Promise<LeadRefusalMutationResult> {
  const leadId = input.leadId.trim();
  const reasonId = input.reasonId?.trim() ?? '';
  const manualReason = input.reason?.trim() ?? '';
  const comment = input.comment?.trim() ?? '';

  if (!leadId) return { ok: false, error: 'missing-lead' };
  if (!reasonId && !manualReason) return { ok: false, error: 'missing-refusal-reason' };
  if (!isSupabaseConfigured()) {
    return {
      ok: true,
      refusal: {
        reason: manualReason || 'Причина отказа',
        comment: comment || undefined,
        refusedAt: new Date().toISOString()
      }
    };
  }

  const supabase = await createClient();
  const [reasonResult, refusalStageId] = await Promise.all([
    reasonId
      ? supabase.from('refusal_reasons').select('name').eq('id', reasonId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    ensureRefusalStageId(supabase)
  ]);

  let reasonName = manualReason;
  let resolvedReasonId: string | null = reasonId || null;
  if (reasonId) {
    if (reasonResult.data?.name) {
      reasonName = String(reasonResult.data.name);
    } else {
      resolvedReasonId = null;
      if (!manualReason) return { ok: false, error: 'missing-refusal-reason' };
    }
  }
  if (!refusalStageId) return { ok: false, error: 'refusal-stage-failed' };

  const now = new Date().toISOString();
  const { data: lead, error } = await supabase
    .from('leads')
    .update({
      stage_id: refusalStageId,
      refusal_reason_id: resolvedReasonId,
      refusal_reason: reasonName || 'Причина не указана',
      refusal_comment: comment || null,
      refused_at: now,
      updated_at: now
    })
    .eq('id', leadId)
    .select('id,name')
    .maybeSingle();

  if (error) return { ok: false, error: 'refusal-save-failed' };
  if (!lead?.id) return { ok: false, error: 'contact-not-found' };

  deferSideEffects(
    async () => {
      await supabase.from('lead_interactions').insert({
        lead_id: leadId,
        type: 'status_change',
        channel: 'Hutka',
        text: `Контакт переведен в отказ. Причина: ${reasonName || 'не указана'}${comment ? `. Комментарий: ${comment}` : ''}`,
        result: 'refused',
        created_by: userId || null
      });
    },
    async () => writeActivityLog({
      userId,
      action: 'зафиксировал отказ',
      entityType: 'contact',
      entityId: leadId,
      entityTitle: String(lead.name ?? 'Контакт'),
      details: { reason: reasonName || 'Причина не указана', comment: comment || null }
    })
  );

  if (shouldRevalidate) revalidateRefusals(leadId);
  return {
    ok: true,
    refusal: {
      reason: reasonName || 'Причина не указана',
      comment: comment || undefined,
      refusedAt: now
    }
  };
}

async function clearLeadRefusalCore(
  leadIdValue: string,
  userId?: string | null,
  shouldRevalidate = false
): Promise<LeadRefusalMutationResult> {
  const leadId = leadIdValue.trim();
  if (!leadId) return { ok: false, error: 'missing-lead' };
  if (!isSupabaseConfigured()) return { ok: true, refusal: null };

  const supabase = await createClient();
  const { data: lead, error } = await supabase
    .from('leads')
    .update({
      refusal_reason_id: null,
      refusal_reason: null,
      refusal_comment: null,
      refused_at: null,
      updated_at: new Date().toISOString()
    })
    .eq('id', leadId)
    .select('id,name')
    .maybeSingle();

  if (error) return { ok: false, error: 'refusal-clear-failed' };
  if (!lead?.id) return { ok: false, error: 'contact-not-found' };

  deferSideEffects(
    async () => {
      await supabase.from('lead_interactions').insert({
        lead_id: leadId,
        type: 'note',
        channel: 'Hutka',
        text: 'Причина отказа очищена из карточки контакта.',
        result: 'refusal_cleared',
        created_by: userId || null
      });
    },
    async () => writeActivityLog({
      userId,
      action: 'очистил причину отказа',
      entityType: 'contact',
      entityId: leadId,
      entityTitle: String(lead.name ?? 'Контакт')
    })
  );

  if (shouldRevalidate) revalidateRefusals(leadId);
  return { ok: true, refusal: null };
}

export async function markLeadRefusedMutationAction(
  input: LeadRefusalMutationInput
): Promise<LeadRefusalMutationResult> {
  const user = await requirePermission('manageContacts', '/people?error=forbidden');
  return markLeadRefusedCore(input, user.profileId);
}

export async function clearLeadRefusalMutationAction(
  input: { leadId: string }
): Promise<LeadRefusalMutationResult> {
  const user = await requirePermission('manageContacts', '/people?error=forbidden');
  return clearLeadRefusalCore(input.leadId, user.profileId);
}

export async function markLeadRefusedAction(formData: FormData) {
  const user = await requirePermission('manageContacts', '/people?error=forbidden');
  const leadId = getText(formData, 'lead_id');
  const result = await markLeadRefusedCore({
    leadId,
    reasonId: getText(formData, 'reason_id'),
    reason: getText(formData, 'reason'),
    comment: getText(formData, 'refusal_comment')
  }, user.profileId, true);

  if (!result.ok) {
    if (result.error === 'missing-lead') redirect('/people?error=missing-lead');
    if (result.error === 'contact-not-found') redirect('/people?error=contact-not-found');
    redirect(`/people/${leadId}?error=${result.error ?? 'refusal-save-failed'}`);
  }
  redirect(`/people/${leadId}?updated=refusal`);
}

export async function clearLeadRefusalAction(formData: FormData) {
  const user = await requirePermission('manageContacts', '/people?error=forbidden');
  const leadId = getText(formData, 'lead_id');
  const result = await clearLeadRefusalCore(leadId, user.profileId, true);

  if (!result.ok) {
    if (result.error === 'missing-lead') redirect('/people?error=missing-lead');
    if (result.error === 'contact-not-found') redirect('/people?error=contact-not-found');
    redirect(`/people/${leadId}?error=${result.error ?? 'refusal-clear-failed'}`);
  }
  redirect(`/people/${leadId}?updated=refusal-cleared`);
}

export async function createRefusalReasonAction(formData: FormData) {
  const result = await createRefusalReasonMutation({
    name: getText(formData, 'name'),
    description: getText(formData, 'description'),
    color: getText(formData, 'color'),
    orderIndex: getInt(formData, 'order_index', 99),
    isActive: getText(formData, 'is_active') !== 'false'
  });
  if (!result.ok) redirect(`/settings/refusal-reasons?error=${encodeURIComponent(result.error || 'create-failed')}`);
  revalidateRefusals();
  redirect('/settings/refusal-reasons?saved=created');
}

export async function createRefusalReasonMutation(
  input: RefusalReasonMutationInput
): Promise<RefusalReasonMutationResult> {
  const user = await requirePermission('manageSettings', '/dashboard?error=admin-only');
  const name = input.name.trim();
  if (!name) return { ok: false, error: 'name-required' };
  if (!isSupabaseConfigured()) return { ok: false, error: 'demo' };

  const supabase = await createClient();
  const { data: reason, error } = await supabase.from('refusal_reasons').insert({
    name,
    description: input.description?.trim() || null,
    color: input.color?.trim() || 'gray',
    order_index: Number.isFinite(input.orderIndex) ? input.orderIndex ?? 99 : 99,
    is_active: input.isActive !== false
  }).select('id,name,description,color,order_index,is_active').single();

  if (error || !reason?.id) return { ok: false, error: 'create-failed' };
  await recordActivityLog({
    userId: user.profileId,
    action: 'создал причину отказа',
    entityType: 'refusal_reason',
    entityId: String(reason.id),
    entityTitle: name
  });
  return { ok: true, item: mapRefusalReason(reason as Record<string, unknown>) };
}

export async function updateRefusalReasonAction(formData: FormData) {
  const result = await updateRefusalReasonMutation({
    id: getText(formData, 'id'),
    name: getText(formData, 'name'),
    description: getText(formData, 'description'),
    color: getText(formData, 'color'),
    orderIndex: getInt(formData, 'order_index', 99),
    isActive: getText(formData, 'is_active') !== 'false'
  });
  if (!result.ok) redirect(`/settings/refusal-reasons?error=${encodeURIComponent(result.error || 'update-failed')}`);
  revalidateRefusals();
  redirect('/settings/refusal-reasons?saved=updated');
}

export async function updateRefusalReasonMutation(
  input: RefusalReasonMutationInput
): Promise<RefusalReasonMutationResult> {
  const user = await requirePermission('manageSettings', '/dashboard?error=admin-only');
  const id = input.id?.trim() ?? '';
  const name = input.name.trim();
  if (!id || !name) return { ok: false, error: 'update-required' };
  if (!isSupabaseConfigured()) return { ok: false, error: 'demo' };

  const supabase = await createClient();
  const { data: reason, error } = await supabase
    .from('refusal_reasons')
    .update({
      name,
      description: input.description?.trim() || null,
      color: input.color?.trim() || 'gray',
      order_index: Number.isFinite(input.orderIndex) ? input.orderIndex ?? 99 : 99,
      is_active: input.isActive !== false,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select('id,name,description,color,order_index,is_active')
    .maybeSingle();

  if (error) return { ok: false, error: 'update-failed' };
  if (!reason?.id) return { ok: false, error: 'reason-not-found' };
  await recordActivityLog({
    userId: user.profileId,
    action: 'изменил причину отказа',
    entityType: 'refusal_reason',
    entityId: id,
    entityTitle: name
  });
  return { ok: true, item: mapRefusalReason(reason as Record<string, unknown>) };
}

export async function deleteRefusalReasonAction(formData: FormData) {
  const result = await deleteRefusalReasonMutation(getText(formData, 'id'));
  if (!result.ok) {
    const count = typeof result.count === 'number' ? `&count=${result.count}` : '';
    redirect(`/settings/refusal-reasons?error=${encodeURIComponent(result.error || 'delete-failed')}${count}`);
  }
  revalidateRefusals();
  redirect('/settings/refusal-reasons?deleted=1');
}

export async function deleteRefusalReasonMutation(
  rawId: string
): Promise<RefusalReasonMutationResult> {
  const user = await requirePermission('manageSettings', '/dashboard?error=admin-only');
  const id = rawId.trim();
  if (!id) return { ok: false, error: 'delete-required' };
  if (!isSupabaseConfigured()) return { ok: false, error: 'demo' };

  const supabase = await createClient();
  const [reasonResult, usageResult] = await Promise.all([
    supabase.from('refusal_reasons').select('id,name').eq('id', id).maybeSingle(),
    supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('refusal_reason_id', id)
  ]);
  const reason = reasonResult.data;
  if (!reason?.id) return { ok: false, error: 'reason-not-found' };
  if (usageResult.error) return { ok: false, error: 'delete-failed' };
  if ((usageResult.count ?? 0) > 0) {
    return { ok: false, error: 'in-use', count: usageResult.count ?? 0 };
  }

  const { error } = await supabase.from('refusal_reasons').delete().eq('id', id);
  if (error) return { ok: false, error: 'in-use' };

  await recordActivityLog({
    userId: user.profileId,
    action: 'удалил причину отказа',
    entityType: 'refusal_reason',
    entityId: id,
    entityTitle: String(reason.name ?? 'Причина отказа')
  });
  return { ok: true };
}
