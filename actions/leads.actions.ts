'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { leadTypeToDb, priorityToScore } from '@/lib/leads';
import type { LeadType, Priority } from '@/lib/data';
import { requirePermission } from '@/lib/permissions';
import { getCanonicalStage, normalizeStageName } from '@/lib/stages';
import { recordActivityLog, writeActivityLog } from '@/lib/activity-log';
import { normalizeSourceName, sourceKey } from '@/lib/source-normalization';
import { getSafeRedirectPath, withRedirectQuery } from '@/lib/auth';
import { buildAppUrl } from '@/lib/app-url';
import { deferSideEffects } from '@/lib/deferred-side-effects';

function getText(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

async function ensureSourceId(supabase: Awaited<ReturnType<typeof createClient>>, name: string) {
  const sourceName = normalizeSourceName(name) || 'Не указан';
  const existing = await supabase.from('sources').select('id').eq('name', sourceName).maybeSingle();
  if (existing.data?.id) return existing.data.id as string;

  const { data: sources } = await supabase.from('sources').select('id,name');
  const duplicate = (sources ?? []).find((source) => sourceKey(normalizeSourceName(String(source.name ?? ''))) === sourceKey(sourceName));
  if (duplicate?.id) return String(duplicate.id);

  const created = await supabase.from('sources').insert({ name: sourceName, type: 'manual' }).select('id').single();
  if (created.error) throw created.error;
  return created.data.id as string;
}

async function ensureStageId(supabase: Awaited<ReturnType<typeof createClient>>, name: string) {
  const stage = getCanonicalStage(name);
  const stageName = stage.name;
  const existing = await supabase.from('funnel_stages').select('id').eq('name', stageName).maybeSingle();
  if (existing.data?.id) return existing.data.id as string;

  const created = await supabase
    .from('funnel_stages')
    .insert({ name: stageName, type: 'master', order_index: stage.orderIndex, color: stage.color })
    .select('id')
    .single();
  if (created.error) throw created.error;
  return created.data.id as string;
}

async function ensureTagId(supabase: Awaited<ReturnType<typeof createClient>>, name: string) {
  const tagName = name.trim();
  const existing = await supabase.from('tags').select('id').eq('name', tagName).maybeSingle();
  if (existing.data?.id) return existing.data.id as string;

  const created = await supabase.from('tags').insert({ name: tagName, color: 'purple' }).select('id').single();
  if (created.error) throw created.error;
  return created.data.id as string;
}

function getTags(formData: FormData) {
  return Array.from(new Set(
    getText(formData, 'tags')
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean)
  ));
}

type LeadSaveInput = {
  leadId: string | null;
  name: string;
  type: string;
  niche: string;
  city: string;
  phone: string;
  telegram: string;
  instagram: string;
  email: string;
  source: string;
  stage: string;
  stageOrder: number;
  stageColor: string;
  priorityScore: number;
  notes: string;
  nextStep: string;
  nextContactDate: string;
  tags: string[];
};

type AtomicLeadSaveResult =
  | { status: 'success'; leadId: string }
  | { status: 'business-error'; error: string; duplicateId?: string }
  | { status: 'unavailable' }
  | { status: 'failed' };

function buildLeadSaveInput(formData: FormData, leadId: string | null): LeadSaveInput {
  const type = (getText(formData, 'type') || 'Мастер') as LeadType;
  const priority = (getText(formData, 'priority') || 'Средний') as Priority;
  const stage = normalizeStageName(getText(formData, 'stage'));
  const canonicalStage = getCanonicalStage(stage);

  return {
    leadId,
    name: getText(formData, 'name'),
    type: leadTypeToDb[type] ?? 'master',
    niche: getText(formData, 'niche'),
    city: getText(formData, 'city'),
    phone: getText(formData, 'phone'),
    telegram: getText(formData, 'telegram'),
    instagram: getText(formData, 'instagram'),
    email: getText(formData, 'email'),
    source: getText(formData, 'source'),
    stage,
    stageOrder: canonicalStage.orderIndex,
    stageColor: canonicalStage.color,
    priorityScore: priorityToScore(priority),
    notes: getText(formData, 'notes'),
    nextStep: getText(formData, 'next_step'),
    nextContactDate: getText(formData, 'next_contact_date'),
    tags: getTags(formData)
  };
}

function isMissingAtomicLeadSave(error: { code?: string; message?: string; details?: string } | null) {
  if (!error) return false;
  if (error.code === 'PGRST202' || error.code === '42883') return true;
  const message = `${error.message ?? ''} ${error.details ?? ''}`.toLowerCase();
  return message.includes('save_lead_with_tags') && (
    message.includes('could not find')
    || message.includes('does not exist')
    || message.includes('schema cache')
  );
}

async function saveLeadWithTagsRpc(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: LeadSaveInput,
  actorProfileId: string | null
): Promise<AtomicLeadSaveResult> {
  const { data, error } = await supabase.rpc('save_lead_with_tags', {
    p_lead_id: input.leadId,
    p_name: input.name,
    p_type: input.type,
    p_niche: input.niche || null,
    p_city: input.city || null,
    p_phone: input.phone || null,
    p_telegram: input.telegram || null,
    p_instagram: input.instagram || null,
    p_email: input.email || null,
    p_source_name: input.source,
    p_stage_name: input.stage,
    p_stage_order: input.stageOrder,
    p_stage_color: input.stageColor,
    p_priority_score: input.priorityScore,
    p_notes: input.notes || null,
    p_next_step: input.nextStep || null,
    p_next_contact_date: input.nextContactDate || null,
    p_tags: input.tags,
    p_actor_profile_id: actorProfileId
  });

  if (error) {
    return isMissingAtomicLeadSave(error) ? { status: 'unavailable' } : { status: 'failed' };
  }

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { status: 'failed' };
  }

  const result = data as Record<string, unknown>;
  if (result.ok === true && typeof result.lead_id === 'string') {
    return { status: 'success', leadId: result.lead_id };
  }

  if (result.ok === false && typeof result.error === 'string') {
    return {
      status: 'business-error',
      error: result.error,
      duplicateId: typeof result.duplicate_id === 'string' ? result.duplicate_id : undefined
    };
  }

  return { status: 'failed' };
}

function looksLikeUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}


function normalizeDuplicateValue(value: string) {
  return value.trim().toLowerCase();
}

async function findDuplicateLead(
  supabase: Awaited<ReturnType<typeof createClient>>,
  fields: { email?: string; phone?: string; instagram?: string; telegram?: string },
  excludeId?: string
) {
  const checks: Array<{ column: 'email' | 'phone' | 'instagram' | 'telegram'; value?: string; insensitive?: boolean }> = [
    { column: 'email', value: fields.email, insensitive: true },
    { column: 'phone', value: fields.phone },
    { column: 'instagram', value: fields.instagram, insensitive: true },
    { column: 'telegram', value: fields.telegram, insensitive: true }
  ];

  const results = await Promise.all(checks.map(async (check) => {
    const value = normalizeDuplicateValue(check.value ?? '');
    if (!value) return null;

    let query = supabase.from('leads').select('id, name').limit(1);
    query = check.insensitive ? query.ilike(check.column, value) : query.eq(check.column, check.value ?? value);
    if (excludeId) query = query.neq('id', excludeId);

    const { data } = await query.maybeSingle();
    return data?.id ? { id: String(data.id), name: String(data.name ?? 'Контакт') } : null;
  }));

  return results.find((result) => result !== null) ?? null;
}

async function getExistingLeadId(supabase: Awaited<ReturnType<typeof createClient>>, leadId: string) {
  const { data, error } = await supabase.from('leads').select('id').eq('id', leadId).maybeSingle();
  return !error && data?.id ? String(data.id) : null;
}

async function getExistingLeadIds(supabase: Awaited<ReturnType<typeof createClient>>, leadIds: string[]) {
  if (leadIds.length === 0) return [];

  const { data, error } = await supabase.from('leads').select('id').in('id', leadIds);
  if (error || !data) return [];

  const existing = new Set(data.map((lead) => String(lead.id)));
  return leadIds.filter((leadId) => existing.has(leadId));
}

function duplicateRedirect(basePath: string, duplicateId?: string) {
  const suffix = duplicateId ? `&duplicateId=${encodeURIComponent(duplicateId)}` : '';
  redirect(`${basePath}?error=duplicate-contact${suffix}`);
}

async function syncLeadTags(supabase: Awaited<ReturnType<typeof createClient>>, leadId: string, tags: string[]) {
  const [deleteResult, tagIds] = await Promise.all([
    supabase.from('lead_tags').delete().eq('lead_id', leadId),
    Promise.all(tags.map((tag) => ensureTagId(supabase, tag)))
  ]);
  const deleteError = deleteResult.error;
  if (deleteError) throw deleteError;
  if (tagIds.length === 0) return;

  const { error: insertError } = await supabase.from('lead_tags').insert(
    tagIds.map((tagId) => ({ lead_id: leadId, tag_id: tagId }))
  );
  if (insertError) throw insertError;
}

export async function createLeadAction(formData: FormData) {
  const user = await requirePermission('manageContacts', '/people?error=forbidden');
  if (!isSupabaseConfigured()) {
    redirect('/people?created=demo');
  }

  const input = buildLeadSaveInput(formData, null);
  if (!input.name) {
    redirect('/people/new?error=missing-name');
  }

  const supabase = await createClient();
  const atomicResult = await saveLeadWithTagsRpc(supabase, input, user.profileId);
  if (atomicResult.status === 'success') {
    revalidatePath('/people');
    revalidatePath('/funnels');
    redirect(`/people/${atomicResult.leadId}?created=contact`);
  }
  if (atomicResult.status === 'business-error') {
    if (atomicResult.error === 'duplicate-contact') {
      duplicateRedirect('/people', atomicResult.duplicateId);
    }
    redirect(`/people/new?error=${encodeURIComponent(atomicResult.error)}`);
  }
  if (atomicResult.status === 'failed') {
    redirect('/people/new?error=save-failed');
  }

  const duplicate = await findDuplicateLead(supabase, {
    email: input.email,
    phone: input.phone,
    instagram: input.instagram,
    telegram: input.telegram
  });
  if (duplicate) duplicateRedirect('/people', duplicate.id);

  const [sourceId, stageId] = await Promise.all([
    ensureSourceId(supabase, input.source),
    ensureStageId(supabase, input.stage)
  ]);

  const { data: lead, error } = await supabase
    .from('leads')
    .insert({
      name: input.name,
      type: input.type,
      niche: input.niche || null,
      city: input.city || null,
      phone: input.phone || null,
      telegram: input.telegram || null,
      instagram: input.instagram || null,
      email: input.email || null,
      source_id: sourceId,
      stage_id: stageId,
      priority_score: input.priorityScore,
      notes: input.notes || null,
      next_step: input.nextStep || null,
      next_contact_date: input.nextContactDate || null
    })
    .select('id')
    .single();

  if (error || !lead) {
    redirect('/people/new?error=save-failed');
  }

  try {
    await syncLeadTags(supabase, lead.id, input.tags);
  } catch {
    redirect(`/people/${lead.id}?error=tags-save-failed`);
  }

  await Promise.all([
    supabase.from('lead_interactions').insert({
      lead_id: lead.id,
      type: 'note',
      channel: input.source || 'manual',
      text: 'Контакт добавлен в Hutka',
      result: 'created'
    }),
    recordActivityLog({
      userId: user.profileId,
      action: 'создал контакт',
      entityType: 'contact',
      entityId: lead.id,
      entityTitle: input.name,
      details: { source: normalizeSourceName(input.source), stage: input.stage }
    })
  ]);

  // Keep cache invalidation narrow: dashboard/report pages will refresh on next navigation.
  // Revalidating every analytics page after a contact create made the UI feel heavy.
  revalidatePath('/people');
  revalidatePath('/funnels');
  redirect(`/people/${lead.id}?created=contact`);
}

export async function updateLeadAction(formData: FormData) {
  const user = await requirePermission('manageContacts', '/people?error=forbidden');
  const leadId = getText(formData, 'id');
  if (!leadId) redirect('/people');

  if (!isSupabaseConfigured()) {
    redirect(`/people/${leadId}?updated=demo`);
  }

  const input = buildLeadSaveInput(formData, leadId);
  if (!input.name) {
    redirect(`/people/${leadId}/edit?error=missing-name`);
  }

  const supabase = await createClient();
  const atomicResult = await saveLeadWithTagsRpc(supabase, input, user.profileId);
  if (atomicResult.status === 'success') {
    revalidatePath('/people');
    revalidatePath(`/people/${leadId}`);
    revalidatePath('/funnels');
    redirect(`/people/${leadId}?updated=contact`);
  }
  if (atomicResult.status === 'business-error') {
    if (atomicResult.error === 'duplicate-contact') {
      duplicateRedirect(`/people/${leadId}/edit`, atomicResult.duplicateId);
    }
    if (atomicResult.error === 'contact-not-found') {
      redirect('/people?error=contact-not-found');
    }
    redirect(`/people/${leadId}/edit?error=${encodeURIComponent(atomicResult.error)}`);
  }
  if (atomicResult.status === 'failed') {
    redirect(`/people/${leadId}/edit?error=save-failed`);
  }

  const [existingLeadId, duplicate] = await Promise.all([
    getExistingLeadId(supabase, leadId),
    findDuplicateLead(supabase, {
      email: input.email,
      phone: input.phone,
      instagram: input.instagram,
      telegram: input.telegram
    }, leadId)
  ]);
  if (!existingLeadId) redirect('/people?error=contact-not-found');
  if (duplicate) duplicateRedirect(`/people/${leadId}/edit`, duplicate.id);

  const [sourceId, stageId] = await Promise.all([
    ensureSourceId(supabase, input.source),
    ensureStageId(supabase, input.stage)
  ]);

  const { error } = await supabase
    .from('leads')
    .update({
      name: input.name,
      type: input.type,
      niche: input.niche || null,
      city: input.city || null,
      phone: input.phone || null,
      telegram: input.telegram || null,
      instagram: input.instagram || null,
      email: input.email || null,
      source_id: sourceId,
      stage_id: stageId,
      priority_score: input.priorityScore,
      notes: input.notes || null,
      next_step: input.nextStep || null,
      next_contact_date: input.nextContactDate || null,
      updated_at: new Date().toISOString()
    })
    .eq('id', leadId);

  if (error) {
    redirect(`/people/${leadId}/edit?error=save-failed`);
  }

  try {
    await syncLeadTags(supabase, leadId, input.tags);
  } catch {
    redirect(`/people/${leadId}/edit?error=tags-save-failed`);
  }
  await Promise.all([
    supabase.from('lead_interactions').insert({
      lead_id: leadId,
      type: 'status_change',
      channel: 'Hutka',
      text: `Контакт обновлен. Стадия: ${input.stage || 'не указана'}`,
      result: 'updated'
    }),
    recordActivityLog({
      userId: user.profileId,
      action: 'изменил контакт',
      entityType: 'contact',
      entityId: leadId,
      entityTitle: input.name,
      details: {
        stage: input.stage,
        source: normalizeSourceName(input.source),
        next_step: input.nextStep || null,
        next_contact_date: input.nextContactDate || null
      }
    })
  ]);

  revalidatePath('/people');
  revalidatePath(`/people/${leadId}`);
  revalidatePath('/dashboard');
  revalidatePath('/funnels');
  revalidatePath('/followups');
  revalidatePath('/reports');
  revalidatePath('/geography');
  redirect(`/people/${leadId}?updated=contact`);
}

export type LeadInteractionMutationInput = {
  leadId: string;
  type?: string;
  channel?: string;
  text: string;
  result?: string;
};

export type LeadInteractionMutationResult = {
  ok: boolean;
  error?: string;
  interaction?: {
    id: string;
    type: string;
    channel?: string;
    text: string;
    result?: string;
    createdAt: string;
  };
};

async function addLeadInteractionCore(
  input: LeadInteractionMutationInput,
  userId?: string | null,
  shouldRevalidate = false
): Promise<LeadInteractionMutationResult> {
  const leadId = input.leadId.trim();
  const text = input.text.trim();
  if (!leadId) return { ok: false, error: 'missing-lead' };
  if (!text) return { ok: false, error: 'missing-interaction' };

  const type = input.type?.trim() || 'note';
  const channel = input.channel?.trim() || 'Hutka';
  const result = input.result?.trim() || '';
  if (!isSupabaseConfigured()) {
    return {
      ok: true,
      interaction: {
        id: `demo-interaction-${Date.now()}`,
        type,
        channel,
        text,
        result: result || undefined,
        createdAt: new Date().toISOString()
      }
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.from('lead_interactions').insert({
    lead_id: leadId,
    type,
    channel,
    text,
    result: result || null,
    created_by: userId ?? null
  }).select('id,type,channel,text,result,created_at').single();

  if (error || !data?.id) {
    return { ok: false, error: error?.code === '23503' ? 'contact-not-found' : 'interaction-failed' };
  }

  await recordActivityLog({
    userId,
    action: 'добавил активность контакта',
    entityType: 'contact',
    entityId: leadId,
    entityTitle: text.slice(0, 120),
    details: { type, channel, result: result || null }
  });

  if (shouldRevalidate) revalidatePath(`/people/${leadId}`);
  return {
    ok: true,
    interaction: {
      id: String(data.id),
      type: String(data.type ?? type),
      channel: data.channel ? String(data.channel) : undefined,
      text: String(data.text ?? text),
      result: data.result ? String(data.result) : undefined,
      createdAt: String(data.created_at ?? new Date().toISOString())
    }
  };
}

export async function addLeadInteractionMutationAction(
  input: LeadInteractionMutationInput
): Promise<LeadInteractionMutationResult> {
  const user = await requirePermission('manageContacts', '/people?error=forbidden');
  return addLeadInteractionCore(input, user.profileId);
}

export async function addLeadInteractionAction(formData: FormData) {
  const user = await requirePermission('manageContacts', '/people?error=forbidden');
  const leadId = getText(formData, 'lead_id');
  const result = await addLeadInteractionCore({
    leadId,
    type: getText(formData, 'type'),
    channel: getText(formData, 'channel'),
    text: getText(formData, 'text'),
    result: getText(formData, 'result')
  }, user.profileId, true);

  if (!result.ok) {
    if (result.error === 'missing-lead' || result.error === 'contact-not-found') redirect('/people?error=contact-not-found');
    redirect(`/people/${leadId}?error=${result.error ?? 'interaction-failed'}`);
  }
  redirect(`/people/${leadId}`);
}

function getLeadIds(formData: FormData) {
  return getText(formData, 'lead_ids')
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id && looksLikeUuid(id));
}

function getBulkReturnTo(formData: FormData) {
  return getSafeRedirectPath(getText(formData, 'return_to'), '/people');
}

async function addBulkInteractions(
  supabase: Awaited<ReturnType<typeof createClient>>,
  leadIds: string[],
  text: string,
  result: string
) {
  if (leadIds.length === 0) return;

  await supabase.from('lead_interactions').insert(
    leadIds.map((leadId) => ({
      lead_id: leadId,
      type: 'note',
      channel: 'Hutka',
      text,
      result
    }))
  );
}

function revalidateLeadCollection() {
  revalidatePath('/people');
  revalidatePath('/funnels');
  revalidatePath('/dashboard');
  revalidatePath('/reports');
  revalidatePath('/geography');
}

export type BulkLeadMutationResult = {
  ok: boolean;
  count: number;
  error?: string;
};

function normalizeLeadMutationIds(leadIds: string[]) {
  const uniqueIds = Array.from(new Set(leadIds.map((id) => id.trim()).filter(Boolean)));
  return isSupabaseConfigured() ? uniqueIds.filter(looksLikeUuid) : uniqueIds;
}

async function bulkChangeStageCore(
  input: { leadIds: string[]; stage: string },
  userId?: string | null,
  shouldRevalidate = false
): Promise<BulkLeadMutationResult> {
  const leadIds = normalizeLeadMutationIds(input.leadIds);
  const stage = normalizeStageName(input.stage);
  if (leadIds.length === 0) return { ok: false, count: 0, error: 'bulk-empty' };
  if (!stage) return { ok: false, count: 0, error: 'missing-stage' };
  if (!isSupabaseConfigured()) return { ok: true, count: leadIds.length };

  const supabase = await createClient();
  const [existingLeadIds, stageId] = await Promise.all([
    getExistingLeadIds(supabase, leadIds),
    ensureStageId(supabase, stage)
  ]);
  if (existingLeadIds.length === 0) return { ok: false, count: 0, error: 'bulk-empty' };
  const { error } = await supabase
    .from('leads')
    .update({ stage_id: stageId, updated_at: new Date().toISOString() })
    .in('id', existingLeadIds);

  if (error) return { ok: false, count: 0, error: 'bulk-stage-failed' };

  await Promise.all([
    addBulkInteractions(supabase, existingLeadIds, `Массовое действие: стадия изменена на «${stage}»`, 'bulk_stage_changed'),
    recordActivityLog({
      userId,
      action: 'изменил стадию контакта',
      entityType: 'contact',
      entityTitle: 'Массовое изменение стадии',
      details: { contacts: existingLeadIds.length, stage, bulk: true }
    })
  ]);
  if (shouldRevalidate) revalidateLeadCollection();
  return { ok: true, count: existingLeadIds.length };
}

export async function bulkChangeStageMutationAction(input: {
  leadIds: string[];
  stage: string;
}): Promise<BulkLeadMutationResult> {
  const user = await requirePermission('manageContacts', '/people?error=forbidden');
  return bulkChangeStageCore(input, user.profileId);
}

async function bulkAssignTagCore(
  input: { leadIds: string[]; tag: string },
  userId?: string | null,
  shouldRevalidate = false
): Promise<BulkLeadMutationResult> {
  const leadIds = normalizeLeadMutationIds(input.leadIds);
  const tag = input.tag.trim();
  if (leadIds.length === 0) return { ok: false, count: 0, error: 'bulk-empty' };
  if (!tag) return { ok: false, count: 0, error: 'missing-tag' };
  if (!isSupabaseConfigured()) return { ok: true, count: leadIds.length };

  const supabase = await createClient();
  const existingLeadIds = await getExistingLeadIds(supabase, leadIds);
  if (existingLeadIds.length === 0) return { ok: false, count: 0, error: 'bulk-empty' };

  const tagId = await ensureTagId(supabase, tag);
  const rows = existingLeadIds.map((leadId) => ({ lead_id: leadId, tag_id: tagId }));
  const { error } = await supabase.from('lead_tags').upsert(rows, { onConflict: 'lead_id,tag_id' });

  if (error) return { ok: false, count: 0, error: 'bulk-tag-failed' };

  await Promise.all([
    addBulkInteractions(supabase, existingLeadIds, `Массовое действие: добавлен тег «${tag}»`, 'bulk_tag_added'),
    recordActivityLog({
      userId,
      action: 'изменил контакт',
      entityType: 'contact',
      entityTitle: 'Массовое добавление тега',
      details: { contacts: existingLeadIds.length, tag, bulk: true }
    })
  ]);
  if (shouldRevalidate) revalidateLeadCollection();
  return { ok: true, count: existingLeadIds.length };
}

export async function bulkAssignTagMutationAction(input: {
  leadIds: string[];
  tag: string;
}): Promise<BulkLeadMutationResult> {
  const user = await requirePermission('manageContacts', '/people?error=forbidden');
  return bulkAssignTagCore(input, user.profileId);
}

async function bulkCreateTaskCore(
  input: { leadIds: string[]; title: string },
  userId?: string | null,
  shouldRevalidate = false
): Promise<BulkLeadMutationResult> {
  const leadIds = normalizeLeadMutationIds(input.leadIds);
  const title = input.title.trim();
  if (leadIds.length === 0) return { ok: false, count: 0, error: 'bulk-empty' };
  if (!title) return { ok: false, count: 0, error: 'missing-task-title' };
  if (!isSupabaseConfigured()) return { ok: true, count: leadIds.length };

  const supabase = await createClient();
  const existingLeadIds = await getExistingLeadIds(supabase, leadIds);
  if (existingLeadIds.length === 0) return { ok: false, count: 0, error: 'bulk-empty' };

  const rows = existingLeadIds.map((leadId) => ({
    lead_id: leadId,
    title,
    description: 'Создано массовым действием из раздела «Люди».',
    priority: 'medium',
    status: 'todo',
    created_by: userId ?? null
  }));
  const { error } = await supabase.from('tasks').insert(rows);

  if (error) return { ok: false, count: 0, error: 'bulk-task-failed' };

  await Promise.all([
    addBulkInteractions(supabase, existingLeadIds, `Массовое действие: создана задача «${title}»`, 'bulk_task_created'),
    recordActivityLog({
      userId,
      action: 'создал задачу',
      entityType: 'task',
      entityTitle: title,
      details: { contacts: existingLeadIds.length, bulk: true }
    })
  ]);
  if (shouldRevalidate) {
    revalidateLeadCollection();
    revalidatePath('/tasks');
    revalidatePath('/followups');
  }
  return { ok: true, count: existingLeadIds.length };
}

export async function bulkCreateTaskMutationAction(input: {
  leadIds: string[];
  title: string;
}): Promise<BulkLeadMutationResult> {
  const user = await requirePermission('manageTasks', '/people?error=forbidden');
  return bulkCreateTaskCore(input, user.profileId);
}

async function bulkAddToCampaignCore(
  input: { leadIds: string[]; campaignId: string },
  userId?: string | null,
  shouldRevalidate = false
): Promise<BulkLeadMutationResult> {
  const leadIds = normalizeLeadMutationIds(input.leadIds);
  const campaignId = input.campaignId.trim();
  if (leadIds.length === 0) return { ok: false, count: 0, error: 'bulk-empty' };
  if (!campaignId) return { ok: false, count: 0, error: 'missing-campaign' };
  if (!isSupabaseConfigured()) return { ok: true, count: leadIds.length };

  const supabase = await createClient();
  const existingLeadIds = await getExistingLeadIds(supabase, leadIds);
  if (existingLeadIds.length === 0) return { ok: false, count: 0, error: 'bulk-empty' };

  const rows = existingLeadIds.map((leadId) => ({ campaign_id: campaignId, lead_id: leadId }));
  const { error } = await supabase.from('campaign_leads').upsert(rows, { onConflict: 'campaign_id,lead_id' });

  if (error) return { ok: false, count: 0, error: 'bulk-campaign-failed' };

  await Promise.all([
    addBulkInteractions(supabase, existingLeadIds, 'Массовое действие: контакт добавлен в кампанию', 'bulk_campaign_attached'),
    recordActivityLog({
      userId,
      action: 'добавил контакт в кампанию',
      entityType: 'campaign',
      entityId: campaignId,
      entityTitle: 'Кампания',
      details: { contacts: existingLeadIds.length, bulk: true }
    })
  ]);
  if (shouldRevalidate) {
    revalidateLeadCollection();
    revalidatePath('/campaigns');
    revalidatePath(`/campaigns/${campaignId}`);
    revalidatePath('/funnels');
  }
  return { ok: true, count: existingLeadIds.length };
}

export async function bulkAddToCampaignMutationAction(input: {
  leadIds: string[];
  campaignId: string;
}): Promise<BulkLeadMutationResult> {
  const user = await requirePermission('manageCampaigns', '/people?error=forbidden');
  return bulkAddToCampaignCore(input, user.profileId);
}

export async function bulkChangeStageAction(formData: FormData) {
  const user = await requirePermission('manageContacts', '/people?error=forbidden');
  const returnTo = getBulkReturnTo(formData);
  const stage = normalizeStageName(getText(formData, 'stage'));
  const result = await bulkChangeStageCore({ leadIds: getLeadIds(formData), stage }, user.profileId, true);
  if (!result.ok) redirect(withRedirectQuery(returnTo, { error: result.error ?? 'bulk-stage-failed' }, '/people'));
  redirect(withRedirectQuery(returnTo, { bulk: 'stage', count: result.count }, '/people'));
}

export async function bulkAssignTagAction(formData: FormData) {
  const user = await requirePermission('manageContacts', '/people?error=forbidden');
  const returnTo = getBulkReturnTo(formData);
  const result = await bulkAssignTagCore({
    leadIds: getLeadIds(formData),
    tag: getText(formData, 'tag')
  }, user.profileId, true);
  if (!result.ok) redirect(withRedirectQuery(returnTo, { error: result.error ?? 'bulk-tag-failed' }, '/people'));
  redirect(withRedirectQuery(returnTo, { bulk: 'tag', count: result.count }, '/people'));
}

export async function bulkCreateTaskAction(formData: FormData) {
  const user = await requirePermission('manageTasks', '/people?error=forbidden');
  const returnTo = getBulkReturnTo(formData);
  const result = await bulkCreateTaskCore({
    leadIds: getLeadIds(formData),
    title: getText(formData, 'title')
  }, user.profileId, true);
  if (!result.ok) redirect(withRedirectQuery(returnTo, { error: result.error ?? 'bulk-task-failed' }, '/people'));
  redirect(withRedirectQuery(returnTo, { bulk: 'task', count: result.count }, '/people'));
}

export async function bulkAddToCampaignAction(formData: FormData) {
  const user = await requirePermission('manageCampaigns', '/people?error=forbidden');
  const returnTo = getBulkReturnTo(formData);
  const result = await bulkAddToCampaignCore({
    leadIds: getLeadIds(formData),
    campaignId: getText(formData, 'campaign_id')
  }, user.profileId, true);
  if (!result.ok) redirect(withRedirectQuery(returnTo, { error: result.error ?? 'bulk-campaign-failed' }, '/people'));
  redirect(withRedirectQuery(returnTo, { bulk: 'campaign', count: result.count }, '/people'));
}

export async function updateLeadStageFromProfileAction(formData: FormData) {
  const user = await requirePermission('manageContacts', '/people?error=forbidden');
  const leadId = getText(formData, 'lead_id');
  const stageId = getText(formData, 'stage_id');
  const stageName = getText(formData, 'stage_name');

  if (!leadId) redirect('/people?error=missing-lead');
  if (!stageId && !stageName) redirect(`/people/${leadId}?error=missing-stage`);

  if (!isSupabaseConfigured()) {
    redirect(`/people/${leadId}?stage=demo`);
  }

  const supabase = await createClient();
  const existingLeadId = await getExistingLeadId(supabase, leadId);
  if (!existingLeadId) redirect('/people?error=contact-not-found');

  let nextStageName = normalizeStageName(stageName);

  if (stageId && !looksLikeUuid(stageId)) {
    nextStageName = normalizeStageName(stageId);
  } else if (stageId) {
    const stage = await supabase.from('funnel_stages').select('id,name').eq('id', stageId).maybeSingle();
    if (stage.data?.id) {
      nextStageName = normalizeStageName(stageName || String(stage.data.name ?? ''));
    } else if (!stageName) {
      redirect(`/people/${leadId}?error=stage-not-found`);
    }
  }

  const nextStageId = await ensureStageId(supabase, nextStageName);
  const shouldClearRefusal = nextStageName !== 'Отказ';
  const updatePayload: Record<string, string | null> = {
    stage_id: nextStageId,
    updated_at: new Date().toISOString()
  };

  if (shouldClearRefusal) {
    updatePayload.refusal_reason_id = null;
    updatePayload.refusal_reason = null;
    updatePayload.refusal_comment = null;
    updatePayload.refused_at = null;
  }

  const { error } = await supabase
    .from('leads')
    .update(updatePayload)
    .eq('id', leadId);

  if (error) redirect(`/people/${leadId}?error=stage-update-failed`);

  await supabase.from('lead_interactions').insert({
    lead_id: leadId,
    type: 'status_change',
    channel: 'Hutka',
    text: `Стадия изменена из карточки контакта: ${nextStageName}`,
    result: 'stage_updated'
  });
  await recordActivityLog({
    userId: user.profileId,
    action: 'изменил стадию контакта',
    entityType: 'contact',
    entityId: leadId,
    entityTitle: 'Контакт',
    details: { stage: nextStageName }
  });

  revalidatePath(`/people/${leadId}`);
  revalidatePath('/people');
  revalidatePath('/funnels');
  revalidatePath('/dashboard');
  revalidatePath('/reports');
  revalidatePath('/geography');
  redirect(`/people/${leadId}?updated=stage`);
}

export type LeadFollowUpMutationInput = {
  leadId: string;
  nextStep: string;
  nextContactDate?: string;
  comment?: string;
};

export type LeadFollowUpMutationResult = {
  ok: boolean;
  error?: string;
  taskId?: string;
  created?: boolean;
};

type AtomicLeadFollowUpResult =
  | { status: 'success'; taskId: string; created: boolean }
  | { status: 'business-error'; error: string }
  | { status: 'unavailable' }
  | { status: 'failed' };

function isMissingAtomicLeadFollowUp(error: { code?: string; message?: string; details?: string } | null) {
  if (!error) return false;
  if (error.code === 'PGRST202' || error.code === '42883') return true;
  const message = `${error.message ?? ''} ${error.details ?? ''}`.toLowerCase();
  return message.includes('schedule_lead_action') && (
    message.includes('could not find')
    || message.includes('does not exist')
    || message.includes('schema cache')
  );
}

async function scheduleLeadActionRpc(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: {
    leadId: string;
    nextStep: string;
    nextContactDate: string;
    comment: string;
    actorProfileId: string | null;
  }
): Promise<AtomicLeadFollowUpResult> {
  const { data, error } = await supabase.rpc('schedule_lead_action', {
    p_lead_id: input.leadId,
    p_next_step: input.nextStep,
    p_next_contact_date: input.nextContactDate || null,
    p_comment: input.comment || null,
    p_actor_profile_id: input.actorProfileId
  });

  if (error) {
    return isMissingAtomicLeadFollowUp(error) ? { status: 'unavailable' } : { status: 'failed' };
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { status: 'failed' };
  }

  const result = data as Record<string, unknown>;
  if (result.ok === true && typeof result.task_id === 'string') {
    return {
      status: 'success',
      taskId: result.task_id,
      created: result.created === true
    };
  }
  if (result.ok === false && typeof result.error === 'string') {
    return { status: 'business-error', error: result.error };
  }
  return { status: 'failed' };
}

async function updateLeadFollowUpCore(
  input: LeadFollowUpMutationInput,
  userId?: string | null,
  shouldRevalidate = false
): Promise<LeadFollowUpMutationResult> {
  const leadId = input.leadId.trim();
  const nextStep = input.nextStep.trim();
  const nextContactDate = input.nextContactDate?.trim() ?? '';
  const comment = input.comment?.trim() ?? '';

  if (!leadId) return { ok: false, error: 'missing-lead' };
  if (!nextStep) return { ok: false, error: 'missing-next-action' };
  if (!isSupabaseConfigured()) {
    return { ok: true, taskId: 'demo-next-action', created: true };
  }

  const supabase = await createClient();
  const atomicResult = await scheduleLeadActionRpc(supabase, {
    leadId,
    nextStep,
    nextContactDate,
    comment,
    actorProfileId: userId ?? null
  });
  if (atomicResult.status === 'success') {
    if (shouldRevalidate) {
      revalidatePath(`/people/${leadId}`);
      revalidatePath('/people');
      revalidatePath('/dashboard');
      revalidatePath('/tasks');
      revalidatePath('/followups');
      revalidatePath('/notifications');
    }
    return {
      ok: true,
      taskId: atomicResult.taskId,
      created: atomicResult.created
    };
  }
  if (atomicResult.status === 'business-error') {
    return { ok: false, error: atomicResult.error };
  }
  if (atomicResult.status === 'failed') {
    return { ok: false, error: 'followup-update-failed' };
  }

  const [leadResult, existingTaskResult] = await Promise.all([
    supabase.from('leads').select('id,name').eq('id', leadId).maybeSingle(),
    supabase
      .from('tasks')
      .select('id')
      .eq('lead_id', leadId)
      .in('status', ['todo', 'in_progress'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
  ]);
  const { data: lead, error: leadError } = leadResult;
  if (leadError || !lead?.id) return { ok: false, error: 'contact-not-found' };
  if (existingTaskResult.error) return { ok: false, error: 'task-save-failed' };

  const existingTask = existingTaskResult.data;
  const hadExistingTask = Boolean(existingTask?.id);
  let taskId = existingTask?.id ? String(existingTask.id) : '';
  if (taskId) {
    const [leadUpdateResult, taskUpdateResult] = await Promise.all([
      supabase
        .from('leads')
        .update({
          next_step: nextStep || null,
          next_contact_date: nextContactDate || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', leadId),
      supabase
        .from('tasks')
        .update({
          title: nextStep,
          description: comment || null,
          due_date: nextContactDate || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', taskId)
    ]);
    if (leadUpdateResult.error) return { ok: false, error: 'followup-update-failed' };
    if (taskUpdateResult.error) return { ok: false, error: 'task-save-failed' };
  } else {
    const [leadUpdateResult, taskCreateResult] = await Promise.all([
      supabase
        .from('leads')
        .update({
          next_step: nextStep || null,
          next_contact_date: nextContactDate || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', leadId),
      supabase
        .from('tasks')
        .insert({
          lead_id: leadId,
          title: nextStep,
          description: comment || null,
          due_date: nextContactDate || null,
          priority: 'none',
          status: 'todo',
          created_by: userId ?? null
        })
        .select('id')
        .single()
    ]);
    if (leadUpdateResult.error) return { ok: false, error: 'followup-update-failed' };
    const { data: task, error: taskCreateError } = taskCreateResult;
    if (taskCreateError || !task?.id) return { ok: false, error: 'task-save-failed' };
    taskId = String(task.id);
  }

  deferSideEffects(
    async () => {
      await supabase.from('lead_interactions').insert({
        lead_id: leadId,
        type: 'note',
        channel: 'Hutka',
        text: `Запланировано действие: ${nextStep}${nextContactDate ? ` · дата ${nextContactDate}` : ''}${comment ? ` · ${comment}` : ''}`,
        result: 'next_action_planned'
      });
    },
    async () => writeActivityLog({
      userId,
      action: hadExistingTask ? 'изменил задачу' : 'создал задачу',
      entityType: 'task',
      entityId: taskId,
      entityTitle: nextStep,
      details: {
        contact_id: leadId,
        contact: String(lead.name ?? 'Контакт'),
        due_date: nextContactDate || null,
        from_next_action: true
      }
    })
  );

  if (shouldRevalidate) {
    revalidatePath(`/people/${leadId}`);
    revalidatePath('/people');
    revalidatePath('/dashboard');
    revalidatePath('/tasks');
    revalidatePath('/followups');
    revalidatePath('/notifications');
  }

  return { ok: true, taskId, created: !hadExistingTask };
}

export async function updateLeadFollowUpMutationAction(
  input: LeadFollowUpMutationInput
): Promise<LeadFollowUpMutationResult> {
  const user = await requirePermission('manageContacts', '/people?error=forbidden');
  return updateLeadFollowUpCore(input, user.profileId);
}

export async function updateLeadFollowUpAction(formData: FormData) {
  const user = await requirePermission('manageContacts', '/people?error=forbidden');
  const leadId = getText(formData, 'lead_id');
  const result = await updateLeadFollowUpCore({
    leadId,
    nextStep: getText(formData, 'next_step'),
    nextContactDate: getText(formData, 'next_contact_date'),
    comment: getText(formData, 'comment') || getText(formData, 'description')
  }, user.profileId, true);

  if (!result.ok) {
    if (result.error === 'missing-lead') redirect('/people?error=missing-lead');
    if (result.error === 'contact-not-found') redirect('/people?error=contact-not-found');
    redirect(`/people/${leadId}?error=${result.error ?? 'followup-update-failed'}`);
  }

  redirect(`/people/${leadId}?updated=next-action`);
}

async function requireLeadRelationInputs(formData: FormData, relationKey: string) {
  const leadId = getText(formData, 'lead_id');
  const relationId = getText(formData, relationKey);

  if (!leadId) redirect('/people?error=missing-lead');
  if (!relationId) redirect(`/people/${leadId}?error=missing-relation`);

  return { leadId, relationId };
}

function revalidateLeadRelationPages(leadId: string) {
  revalidatePath(`/people/${leadId}`);
  revalidatePath('/people');
  revalidatePath('/dashboard');
  revalidatePath('/reports');
  revalidatePath('/funnels');
}

export async function attachLeadToCampaignFromProfileAction(formData: FormData) {
  const user = await requirePermission('manageCampaigns', '/people?error=forbidden');
  const { leadId, relationId: campaignId } = await requireLeadRelationInputs(formData, 'campaign_id');

  if (!isSupabaseConfigured()) {
    redirect(`/people/${leadId}?attached=demo-campaign`);
  }

  const supabase = await createClient();
  const existingLeadId = await getExistingLeadId(supabase, leadId);
  if (!existingLeadId) redirect('/people?error=contact-not-found');

  const { data: campaign } = await supabase.from('campaigns').select('name').eq('id', campaignId).maybeSingle();
  const campaignName = campaign?.name ? String(campaign.name) : 'кампания';

  const { error } = await supabase
    .from('campaign_leads')
    .upsert({ campaign_id: campaignId, lead_id: leadId }, { onConflict: 'campaign_id,lead_id' });

  if (error) redirect(`/people/${leadId}?error=campaign-attach-failed`);

  await supabase.from('lead_interactions').insert({
    lead_id: leadId,
    type: 'note',
    channel: 'Hutka',
    text: `Контакт привязан к кампании «${campaignName}» из карточки контакта`,
    result: 'campaign_attached'
  });
  await recordActivityLog({
    userId: user.profileId,
    action: 'добавил контакт в кампанию',
    entityType: 'campaign',
    entityId: campaignId,
    entityTitle: campaignName,
    details: { contact_id: leadId }
  });

  revalidateLeadRelationPages(leadId);
  revalidatePath('/campaigns');
  revalidatePath(`/campaigns/${campaignId}`);
  redirect(`/people/${leadId}?attached=campaign`);
}

export type LeadRelationMutationResult = {
  ok: boolean;
  error?: string;
  title?: string;
  url?: string;
};

async function attachLeadToInsightCore(
  leadIdValue: string,
  insightIdValue: string,
  userId?: string | null,
  shouldRevalidate = false
): Promise<LeadRelationMutationResult> {
  const leadId = leadIdValue.trim();
  const insightId = insightIdValue.trim();
  if (!leadId) return { ok: false, error: 'missing-lead' };
  if (!insightId) return { ok: false, error: 'missing-relation' };
  if (!isSupabaseConfigured()) return { ok: true, title: 'Демо-вывод' };

  const supabase = await createClient();
  const [insightResult, relationResult] = await Promise.all([
    supabase.from('insights').select('id,title').eq('id', insightId).maybeSingle(),
    supabase
      .from('insight_leads')
      .upsert({ insight_id: insightId, lead_id: leadId }, { onConflict: 'insight_id,lead_id' })
  ]);

  const insight = insightResult.data;
  if (insightResult.error || !insight?.id) return { ok: false, error: 'insight-not-found' };
  if (relationResult.error) return { ok: false, error: 'insight-attach-failed' };
  const insightTitle = insight?.title ? String(insight.title) : 'вывод';

  await Promise.all([
    supabase.from('lead_interactions').insert({
      lead_id: leadId,
      type: 'note',
      channel: 'Hutka',
      text: `Контакт связан с выводом «${insightTitle}»`,
      result: 'insight_attached',
      created_by: userId || null
    }),
    recordActivityLog({
      userId,
      action: 'связал контакт с выводом',
      entityType: 'insight',
      entityId: insightId,
      entityTitle: insightTitle,
      details: { contact_id: leadId }
    })
  ]);

  if (shouldRevalidate) {
    revalidateLeadRelationPages(leadId);
    revalidatePath('/insights');
    revalidatePath(`/insights/${insightId}`);
  }
  return { ok: true, title: insightTitle };
}

export async function attachLeadToInsightMutationAction(input: {
  leadId: string;
  insightId: string;
}): Promise<LeadRelationMutationResult> {
  const user = await requirePermission('manageInsights', '/people?error=forbidden');
  return attachLeadToInsightCore(input.leadId, input.insightId, user.profileId);
}

export async function attachLeadToInsightFromProfileAction(formData: FormData) {
  const user = await requirePermission('manageInsights', '/people?error=forbidden');
  const { leadId, relationId: insightId } = await requireLeadRelationInputs(formData, 'insight_id');
  const result = await attachLeadToInsightCore(leadId, insightId, user.profileId, true);

  if (!result.ok) {
    if (result.error === 'contact-not-found') redirect('/people?error=contact-not-found');
    redirect(`/people/${leadId}?error=${result.error ?? 'insight-attach-failed'}`);
  }
  redirect(`/people/${leadId}?attached=insight`);
}

export async function attachLeadToHypothesisFromProfileAction(formData: FormData) {
  await requirePermission('manageHypotheses', '/people?error=forbidden');
  const { leadId, relationId: hypothesisId } = await requireLeadRelationInputs(formData, 'hypothesis_id');

  if (!isSupabaseConfigured()) {
    redirect(`/people/${leadId}?attached=demo-hypothesis`);
  }

  const supabase = await createClient();
  const existingLeadId = await getExistingLeadId(supabase, leadId);
  if (!existingLeadId) redirect('/people?error=contact-not-found');

  const { data: hypothesis } = await supabase.from('hypotheses').select('title').eq('id', hypothesisId).maybeSingle();
  const hypothesisTitle = hypothesis?.title ? String(hypothesis.title) : 'проверка';

  const { error } = await supabase
    .from('hypothesis_leads')
    .upsert({ hypothesis_id: hypothesisId, lead_id: leadId }, { onConflict: 'hypothesis_id,lead_id' });

  if (error) redirect(`/people/${leadId}?error=hypothesis-attach-failed`);

  await supabase.from('lead_interactions').insert({
    lead_id: leadId,
    type: 'note',
    channel: 'Hutka',
    text: `Контакт связан с проверкой «${hypothesisTitle}»`,
    result: 'hypothesis_attached'
  });

  revalidateLeadRelationPages(leadId);
  revalidatePath('/hypotheses');
  revalidatePath(`/hypotheses/${hypothesisId}`);
  redirect(`/people/${leadId}?attached=hypothesis`);
}

async function createLeadSurveyInviteCore(
  leadIdValue: string,
  surveyIdValue: string,
  userId?: string | null,
  shouldRevalidate = false
): Promise<LeadRelationMutationResult> {
  const leadId = leadIdValue.trim();
  const surveyId = surveyIdValue.trim();
  if (!leadId) return { ok: false, error: 'missing-lead' };
  if (!surveyId) return { ok: false, error: 'missing-relation' };
  if (!isSupabaseConfigured()) {
    return { ok: true, title: 'Демо-анкета', url: '/s/demo-masters' };
  }

  const supabase = await createClient();
  const { data: survey, error: surveyError } = await supabase
    .from('surveys')
    .select('id,title,slug')
    .eq('id', surveyId)
    .maybeSingle();

  if (surveyError || !survey?.id || !survey.slug) return { ok: false, error: 'survey-not-found' };

  const surveyUrl = buildAppUrl(`/s/${survey.slug}`);
  const surveyTitle = survey.title ? String(survey.title) : 'анкета';

  const { error: interactionError } = await supabase.from('lead_interactions').insert({
    lead_id: leadId,
    type: 'survey_sent',
    channel: 'Hutka',
    text: `Создана ссылка на анкету «${surveyTitle}»: ${surveyUrl}`,
    result: 'survey_link_created',
    created_by: userId || null
  });
  if (interactionError) return { ok: false, error: 'survey-link-create-failed' };

  await recordActivityLog({
    userId,
    action: 'создал ссылку на анкету',
    entityType: 'survey',
    entityId: surveyId,
    entityTitle: surveyTitle,
    details: { contact_id: leadId, url: surveyUrl }
  });

  if (shouldRevalidate) {
    revalidateLeadRelationPages(leadId);
    revalidatePath('/surveys');
    revalidatePath(`/surveys/${surveyId}`);
  }
  return { ok: true, title: surveyTitle, url: surveyUrl };
}

export async function createLeadSurveyInviteMutationAction(input: {
  leadId: string;
  surveyId: string;
}): Promise<LeadRelationMutationResult> {
  const user = await requirePermission('manageSurveys', '/people?error=forbidden');
  return createLeadSurveyInviteCore(input.leadId, input.surveyId, user.profileId);
}

export async function createLeadSurveyInviteAction(formData: FormData) {
  const user = await requirePermission('manageSurveys', '/people?error=forbidden');
  const { leadId, relationId: surveyId } = await requireLeadRelationInputs(formData, 'survey_id');
  const result = await createLeadSurveyInviteCore(leadId, surveyId, user.profileId, true);

  if (!result.ok) {
    if (result.error === 'contact-not-found') redirect('/people?error=contact-not-found');
    redirect(`/people/${leadId}?error=${result.error ?? 'survey-link-create-failed'}`);
  }
  redirect(`/people/${leadId}?survey=link-created`);
}

export async function deleteLeadAction(formData: FormData) {
  const user = await requirePermission('manageContacts', '/people?error=forbidden');
  const leadId = getText(formData, 'lead_id');
  const confirmation = getText(formData, 'confirmation');
  if (!leadId) redirect('/people?error=missing-lead');
  if (confirmation !== 'УДАЛИТЬ') redirect(`/people/${leadId}?error=confirmation-required`);

  if (!isSupabaseConfigured()) {
    redirect('/people?deleted=demo');
  }

  const supabase = await createClient();
  const { data: lead, error } = await supabase
    .from('leads')
    .delete()
    .eq('id', leadId)
    .select('id,name')
    .maybeSingle();
  if (error) redirect(`/people/${leadId}?error=delete-failed`);
  if (!lead?.id) redirect('/people?error=contact-not-found');
  await recordActivityLog({
    userId: user.profileId,
    action: 'удалил контакт',
    entityType: 'contact',
    entityId: leadId,
    entityTitle: String(lead.name ?? 'Контакт')
  });

  revalidateLeadCollection();
  revalidatePath('/tasks');
  redirect('/people?deleted=lead');
}
