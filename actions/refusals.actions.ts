'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { requirePermission } from '@/lib/permissions';

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

async function leadExists(supabase: Awaited<ReturnType<typeof createClient>>, leadId: string) {
  const { data, error } = await supabase.from('leads').select('id').eq('id', leadId).maybeSingle();
  return !error && Boolean(data?.id);
}

async function refusalReasonExists(supabase: Awaited<ReturnType<typeof createClient>>, id: string) {
  const { data, error } = await supabase.from('refusal_reasons').select('id').eq('id', id).maybeSingle();
  return !error && Boolean(data?.id);
}

export async function markLeadRefusedAction(formData: FormData) {
  await requirePermission('manageContacts', '/people?error=forbidden');

  const leadId = getText(formData, 'lead_id');
  const reasonId = getText(formData, 'reason_id');
  const manualReason = getText(formData, 'reason');
  const comment = getText(formData, 'refusal_comment');

  if (!leadId) redirect('/people?error=missing-lead');
  if (!reasonId && !manualReason) redirect(`/people/${leadId}?error=missing-refusal-reason`);

  if (!isSupabaseConfigured()) {
    redirect(`/people/${leadId}?refusal=demo`);
  }

  const supabase = await createClient();
  if (!(await leadExists(supabase, leadId))) redirect('/people?error=contact-not-found');

  let reasonName = manualReason;
  let resolvedReasonId: string | null = reasonId || null;

  if (reasonId) {
    const reason = await supabase.from('refusal_reasons').select('name').eq('id', reasonId).maybeSingle();
    if (reason.data?.name) {
      reasonName = String(reason.data.name);
    } else {
      resolvedReasonId = null;
      if (!manualReason) redirect(`/people/${leadId}?error=missing-refusal-reason`);
    }
  }

  const refusalStageId = await ensureRefusalStageId(supabase);
  if (!refusalStageId) redirect(`/people/${leadId}?error=refusal-stage-failed`);

  const now = new Date().toISOString();

  const { error } = await supabase
    .from('leads')
    .update({
      stage_id: refusalStageId,
      refusal_reason_id: resolvedReasonId,
      refusal_reason: reasonName || 'Причина не указана',
      refusal_comment: comment || null,
      refused_at: now,
      updated_at: now
    })
    .eq('id', leadId);

  if (error) redirect(`/people/${leadId}?error=refusal-save-failed`);

  await supabase.from('lead_interactions').insert({
    lead_id: leadId,
    type: 'status_change',
    channel: 'Hutka',
    text: `Контакт переведен в отказ. Причина: ${reasonName || 'не указана'}${comment ? `. Комментарий: ${comment}` : ''}`,
    result: 'refused'
  });

  revalidateRefusals(leadId);
  redirect(`/people/${leadId}?updated=refusal`);
}

export async function clearLeadRefusalAction(formData: FormData) {
  await requirePermission('manageContacts', '/people?error=forbidden');
  const leadId = getText(formData, 'lead_id');
  if (!leadId) redirect('/people?error=missing-lead');
  if (!isSupabaseConfigured()) redirect(`/people/${leadId}?refusal=demo`);

  const supabase = await createClient();
  if (!(await leadExists(supabase, leadId))) redirect('/people?error=contact-not-found');

  const { error } = await supabase
    .from('leads')
    .update({
      refusal_reason_id: null,
      refusal_reason: null,
      refusal_comment: null,
      refused_at: null,
      updated_at: new Date().toISOString()
    })
    .eq('id', leadId);

  if (error) redirect(`/people/${leadId}?error=refusal-clear-failed`);

  await supabase.from('lead_interactions').insert({
    lead_id: leadId,
    type: 'note',
    channel: 'Hutka',
    text: 'Причина отказа очищена из карточки контакта.',
    result: 'refusal_cleared'
  });

  revalidateRefusals(leadId);
  redirect(`/people/${leadId}?updated=refusal-cleared`);
}

export async function createRefusalReasonAction(formData: FormData) {
  await requirePermission('manageSettings', '/dashboard?error=admin-only');
  const name = getText(formData, 'name');
  if (!name) redirect('/settings/refusal-reasons?error=name-required');
  if (!isSupabaseConfigured()) redirect('/settings/refusal-reasons?demo=1');

  const supabase = await createClient();
  const { error } = await supabase.from('refusal_reasons').insert({
    name,
    description: getText(formData, 'description') || null,
    color: getText(formData, 'color') || 'gray',
    order_index: getInt(formData, 'order_index', 99),
    is_active: getText(formData, 'is_active') !== 'false'
  });

  if (error) redirect('/settings/refusal-reasons?error=create-failed');
  revalidateRefusals();
  redirect('/settings/refusal-reasons?saved=created');
}

export async function updateRefusalReasonAction(formData: FormData) {
  await requirePermission('manageSettings', '/dashboard?error=admin-only');
  const id = getText(formData, 'id');
  const name = getText(formData, 'name');
  if (!id || !name) redirect('/settings/refusal-reasons?error=update-required');
  if (!isSupabaseConfigured()) redirect('/settings/refusal-reasons?demo=1');

  const supabase = await createClient();
  if (!(await refusalReasonExists(supabase, id))) redirect('/settings/refusal-reasons?error=reason-not-found');

  const { error } = await supabase
    .from('refusal_reasons')
    .update({
      name,
      description: getText(formData, 'description') || null,
      color: getText(formData, 'color') || 'gray',
      order_index: getInt(formData, 'order_index', 99),
      is_active: getText(formData, 'is_active') !== 'false',
      updated_at: new Date().toISOString()
    })
    .eq('id', id);

  if (error) redirect('/settings/refusal-reasons?error=update-failed');
  revalidateRefusals();
  redirect('/settings/refusal-reasons?saved=updated');
}

export async function deleteRefusalReasonAction(formData: FormData) {
  await requirePermission('manageSettings', '/dashboard?error=admin-only');
  const id = getText(formData, 'id');
  if (!id) redirect('/settings/refusal-reasons?error=delete-required');
  if (!isSupabaseConfigured()) redirect('/settings/refusal-reasons?demo=1');

  const supabase = await createClient();
  if (!(await refusalReasonExists(supabase, id))) redirect('/settings/refusal-reasons?error=reason-not-found');

  const { error } = await supabase.from('refusal_reasons').delete().eq('id', id);
  if (error) redirect('/settings/refusal-reasons?error=in-use');

  revalidateRefusals();
  redirect('/settings/refusal-reasons?deleted=1');
}
