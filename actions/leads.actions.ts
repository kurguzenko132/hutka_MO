'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { leadTypeToDb, priorityToScore } from '@/lib/leads';
import type { LeadType, Priority } from '@/lib/data';
import { requirePermission } from '@/lib/permissions';
import { getCanonicalStage, normalizeStageName } from '@/lib/stages';

function getText(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

async function ensureSourceId(supabase: Awaited<ReturnType<typeof createClient>>, name: string) {
  const sourceName = name || 'Не указан';
  const existing = await supabase.from('sources').select('id').eq('name', sourceName).maybeSingle();
  if (existing.data?.id) return existing.data.id as string;

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
  return getText(formData, 'tags')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
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

  for (const check of checks) {
    const value = normalizeDuplicateValue(check.value ?? '');
    if (!value) continue;

    let query = supabase.from('leads').select('id, name').limit(1);
    query = check.insensitive ? query.ilike(check.column, value) : query.eq(check.column, check.value ?? value);
    if (excludeId) query = query.neq('id', excludeId);

    const { data } = await query.maybeSingle();
    if (data?.id) {
      return { id: String(data.id), name: String(data.name ?? 'Контакт') };
    }
  }

  return null;
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
  const { error: deleteError } = await supabase.from('lead_tags').delete().eq('lead_id', leadId);
  if (deleteError) throw deleteError;

  for (const tag of tags) {
    const tagId = await ensureTagId(supabase, tag);
    const { error: insertError } = await supabase.from('lead_tags').insert({ lead_id: leadId, tag_id: tagId });
    if (insertError) throw insertError;
  }
}

export async function createLeadAction(formData: FormData) {
  await requirePermission('manageContacts', '/people?error=forbidden');
  if (!isSupabaseConfigured()) {
    redirect('/people?created=demo');
  }

  const name = getText(formData, 'name');
  if (!name) {
    redirect('/people/new?error=missing-name');
  }

  const type = (getText(formData, 'type') || 'Мастер') as LeadType;
  const priority = (getText(formData, 'priority') || 'Средний') as Priority;
  const source = getText(formData, 'source');
  const stage = normalizeStageName(getText(formData, 'stage'));
  const tags = getTags(formData);

  const supabase = await createClient();
  const duplicate = await findDuplicateLead(supabase, {
    email: getText(formData, 'email'),
    phone: getText(formData, 'phone'),
    instagram: getText(formData, 'instagram'),
    telegram: getText(formData, 'telegram')
  });
  if (duplicate) duplicateRedirect('/people', duplicate.id);

  const sourceId = await ensureSourceId(supabase, source);
  const stageId = await ensureStageId(supabase, stage);

  const { data: lead, error } = await supabase
    .from('leads')
    .insert({
      name,
      type: leadTypeToDb[type] ?? 'master',
      niche: getText(formData, 'niche') || null,
      city: getText(formData, 'city') || null,
      phone: getText(formData, 'phone') || null,
      telegram: getText(formData, 'telegram') || null,
      instagram: getText(formData, 'instagram') || null,
      email: getText(formData, 'email') || null,
      source_id: sourceId,
      stage_id: stageId,
      priority_score: priorityToScore(priority),
      notes: getText(formData, 'notes') || null,
      next_step: getText(formData, 'next_step') || null,
      next_contact_date: getText(formData, 'next_contact_date') || null
    })
    .select('id')
    .single();

  if (error || !lead) {
    redirect('/people/new?error=save-failed');
  }

  try {
    await syncLeadTags(supabase, lead.id, tags);
  } catch {
    redirect(`/people/${lead.id}?error=tags-save-failed`);
  }

  await supabase.from('lead_interactions').insert({
    lead_id: lead.id,
    type: 'note',
    channel: source || 'manual',
    text: 'Контакт добавлен в Hutka',
    result: 'created'
  });

  revalidatePath('/people');
  revalidatePath('/dashboard');
  redirect(`/people/${lead.id}`);
}

export async function updateLeadAction(formData: FormData) {
  await requirePermission('manageContacts', '/people?error=forbidden');
  const leadId = getText(formData, 'id');
  if (!leadId) redirect('/people');

  if (!isSupabaseConfigured()) {
    redirect(`/people/${leadId}?updated=demo`);
  }

  const name = getText(formData, 'name');
  if (!name) {
    redirect(`/people/${leadId}/edit?error=missing-name`);
  }

  const type = (getText(formData, 'type') || 'Мастер') as LeadType;
  const priority = (getText(formData, 'priority') || 'Средний') as Priority;
  const source = getText(formData, 'source');
  const stage = normalizeStageName(getText(formData, 'stage'));
  const tags = getTags(formData);

  const supabase = await createClient();
  const existingLeadId = await getExistingLeadId(supabase, leadId);
  if (!existingLeadId) redirect('/people?error=contact-not-found');

  const duplicate = await findDuplicateLead(supabase, {
    email: getText(formData, 'email'),
    phone: getText(formData, 'phone'),
    instagram: getText(formData, 'instagram'),
    telegram: getText(formData, 'telegram')
  }, leadId);
  if (duplicate) duplicateRedirect(`/people/${leadId}/edit`, duplicate.id);

  const sourceId = await ensureSourceId(supabase, source);
  const stageId = await ensureStageId(supabase, stage);

  const { error } = await supabase
    .from('leads')
    .update({
      name,
      type: leadTypeToDb[type] ?? 'master',
      niche: getText(formData, 'niche') || null,
      city: getText(formData, 'city') || null,
      phone: getText(formData, 'phone') || null,
      telegram: getText(formData, 'telegram') || null,
      instagram: getText(formData, 'instagram') || null,
      email: getText(formData, 'email') || null,
      source_id: sourceId,
      stage_id: stageId,
      priority_score: priorityToScore(priority),
      notes: getText(formData, 'notes') || null,
      next_step: getText(formData, 'next_step') || null,
      next_contact_date: getText(formData, 'next_contact_date') || null,
      updated_at: new Date().toISOString()
    })
    .eq('id', leadId);

  if (error) {
    redirect(`/people/${leadId}/edit?error=save-failed`);
  }

  try {
    await syncLeadTags(supabase, leadId, tags);
  } catch {
    redirect(`/people/${leadId}/edit?error=tags-save-failed`);
  }
  await supabase.from('lead_interactions').insert({
    lead_id: leadId,
    type: 'status_change',
    channel: 'Hutka',
    text: `Контакт обновлен. Стадия: ${stage || 'не указана'}`,
    result: 'updated'
  });

  revalidatePath('/people');
  revalidatePath(`/people/${leadId}`);
  revalidatePath('/dashboard');
  redirect(`/people/${leadId}`);
}

export async function addLeadInteractionAction(formData: FormData) {
  await requirePermission('manageContacts', '/people?error=forbidden');
  const leadId = getText(formData, 'lead_id');
  if (!leadId) redirect('/people');

  const text = getText(formData, 'text');
  if (!text) redirect(`/people/${leadId}?error=missing-interaction`);

  if (!isSupabaseConfigured()) {
    redirect(`/people/${leadId}?interaction=demo`);
  }

  const supabase = await createClient();
  const existingLeadId = await getExistingLeadId(supabase, leadId);
  if (!existingLeadId) redirect('/people?error=contact-not-found');

  const { error } = await supabase.from('lead_interactions').insert({
    lead_id: leadId,
    type: getText(formData, 'type') || 'note',
    channel: getText(formData, 'channel') || 'Hutka',
    text,
    result: getText(formData, 'result') || null
  });

  if (error) {
    redirect(`/people/${leadId}?error=interaction-failed`);
  }

  revalidatePath(`/people/${leadId}`);
  redirect(`/people/${leadId}`);
}

function getLeadIds(formData: FormData) {
  return getText(formData, 'lead_ids')
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id && looksLikeUuid(id));
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

export async function bulkChangeStageAction(formData: FormData) {
  await requirePermission('manageContacts', '/people?error=forbidden');
  const leadIds = getLeadIds(formData);
  const stage = normalizeStageName(getText(formData, 'stage'));

  if (leadIds.length === 0) redirect('/people?error=bulk-empty');
  if (!stage) redirect('/people?error=missing-stage');

  if (!isSupabaseConfigured()) {
    redirect('/people?bulk=demo-stage');
  }

  const supabase = await createClient();
  const existingLeadIds = await getExistingLeadIds(supabase, leadIds);
  if (existingLeadIds.length === 0) redirect('/people?error=bulk-empty');

  const stageId = await ensureStageId(supabase, stage);
  const { error } = await supabase
    .from('leads')
    .update({ stage_id: stageId, updated_at: new Date().toISOString() })
    .in('id', existingLeadIds);

  if (error) redirect('/people?error=bulk-stage-failed');

  await addBulkInteractions(supabase, existingLeadIds, `Массовое действие: стадия изменена на «${stage}»`, 'bulk_stage_changed');
  revalidateLeadCollection();
  redirect(`/people?bulk=stage&count=${existingLeadIds.length}`);
}

export async function bulkAssignTagAction(formData: FormData) {
  await requirePermission('manageContacts', '/people?error=forbidden');
  const leadIds = getLeadIds(formData);
  const tag = getText(formData, 'tag');

  if (leadIds.length === 0) redirect('/people?error=bulk-empty');
  if (!tag) redirect('/people?error=missing-tag');

  if (!isSupabaseConfigured()) {
    redirect('/people?bulk=demo-tag');
  }

  const supabase = await createClient();
  const existingLeadIds = await getExistingLeadIds(supabase, leadIds);
  if (existingLeadIds.length === 0) redirect('/people?error=bulk-empty');

  const tagId = await ensureTagId(supabase, tag);
  const rows = existingLeadIds.map((leadId) => ({ lead_id: leadId, tag_id: tagId }));
  const { error } = await supabase.from('lead_tags').upsert(rows, { onConflict: 'lead_id,tag_id' });

  if (error) redirect('/people?error=bulk-tag-failed');

  await addBulkInteractions(supabase, existingLeadIds, `Массовое действие: добавлен тег «${tag}»`, 'bulk_tag_added');
  revalidateLeadCollection();
  redirect(`/people?bulk=tag&count=${existingLeadIds.length}`);
}

export async function bulkCreateTaskAction(formData: FormData) {
  await requirePermission('manageTasks', '/people?error=forbidden');
  const leadIds = getLeadIds(formData);
  const title = getText(formData, 'title');

  if (leadIds.length === 0) redirect('/people?error=bulk-empty');
  if (!title) redirect('/people?error=missing-task-title');

  if (!isSupabaseConfigured()) {
    redirect('/people?bulk=demo-task');
  }

  const supabase = await createClient();
  const existingLeadIds = await getExistingLeadIds(supabase, leadIds);
  if (existingLeadIds.length === 0) redirect('/people?error=bulk-empty');

  const rows = existingLeadIds.map((leadId) => ({
    lead_id: leadId,
    title,
    description: 'Создано массовым действием из раздела «Люди».',
    priority: 'medium',
    status: 'todo'
  }));
  const { error } = await supabase.from('tasks').insert(rows);

  if (error) redirect('/people?error=bulk-task-failed');

  await addBulkInteractions(supabase, existingLeadIds, `Массовое действие: создана задача «${title}»`, 'bulk_task_created');
  revalidateLeadCollection();
  revalidatePath('/tasks');
  redirect(`/people?bulk=task&count=${existingLeadIds.length}`);
}

export async function bulkAddToCampaignAction(formData: FormData) {
  await requirePermission('manageCampaigns', '/people?error=forbidden');
  const leadIds = getLeadIds(formData);
  const campaignId = getText(formData, 'campaign_id');

  if (leadIds.length === 0) redirect('/people?error=bulk-empty');
  if (!campaignId) redirect('/people?error=missing-campaign');

  if (!isSupabaseConfigured()) {
    redirect('/people?bulk=demo-campaign');
  }

  const supabase = await createClient();
  const existingLeadIds = await getExistingLeadIds(supabase, leadIds);
  if (existingLeadIds.length === 0) redirect('/people?error=bulk-empty');

  const rows = existingLeadIds.map((leadId) => ({ campaign_id: campaignId, lead_id: leadId }));
  const { error } = await supabase.from('campaign_leads').upsert(rows, { onConflict: 'campaign_id,lead_id' });

  if (error) redirect('/people?error=bulk-campaign-failed');

  await addBulkInteractions(supabase, existingLeadIds, 'Массовое действие: контакт добавлен в кампанию', 'bulk_campaign_attached');
  revalidateLeadCollection();
  revalidatePath('/campaigns');
  revalidatePath(`/campaigns/${campaignId}`);
  redirect(`/people?bulk=campaign&count=${existingLeadIds.length}`);
}

export async function updateLeadStageFromProfileAction(formData: FormData) {
  await requirePermission('manageContacts', '/people?error=forbidden');
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

  revalidatePath(`/people/${leadId}`);
  revalidatePath('/people');
  revalidatePath('/funnels');
  revalidatePath('/dashboard');
  revalidatePath('/reports');
  revalidatePath('/geography');
  redirect(`/people/${leadId}?updated=stage`);
}

export async function updateLeadFollowUpAction(formData: FormData) {
  await requirePermission('manageContacts', '/people?error=forbidden');
  const leadId = getText(formData, 'lead_id');
  const nextStep = getText(formData, 'next_step');
  const nextContactDate = getText(formData, 'next_contact_date');

  if (!leadId) redirect('/people?error=missing-lead');

  if (!isSupabaseConfigured()) {
    redirect(`/people/${leadId}?followup=demo`);
  }

  const supabase = await createClient();
  const existingLeadId = await getExistingLeadId(supabase, leadId);
  if (!existingLeadId) redirect('/people?error=contact-not-found');

  const { error } = await supabase
    .from('leads')
    .update({
      next_step: nextStep || null,
      next_contact_date: nextContactDate || null,
      updated_at: new Date().toISOString()
    })
    .eq('id', leadId);

  if (error) redirect(`/people/${leadId}?error=followup-update-failed`);

  await supabase.from('lead_interactions').insert({
    lead_id: leadId,
    type: 'note',
    channel: 'Hutka',
    text: `Следующий шаг обновлен: ${nextStep || 'не указан'}${nextContactDate ? ` · дата ${nextContactDate}` : ''}`,
    result: 'followup_updated'
  });

  revalidatePath(`/people/${leadId}`);
  revalidatePath('/people');
  revalidatePath('/dashboard');
  revalidatePath('/tasks');
  redirect(`/people/${leadId}?updated=followup`);
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
}

export async function attachLeadToCampaignFromProfileAction(formData: FormData) {
  await requirePermission('manageCampaigns', '/people?error=forbidden');
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

  revalidateLeadRelationPages(leadId);
  revalidatePath('/campaigns');
  revalidatePath(`/campaigns/${campaignId}`);
  redirect(`/people/${leadId}?attached=campaign`);
}

export async function attachLeadToInsightFromProfileAction(formData: FormData) {
  await requirePermission('manageInsights', '/people?error=forbidden');
  const { leadId, relationId: insightId } = await requireLeadRelationInputs(formData, 'insight_id');

  if (!isSupabaseConfigured()) {
    redirect(`/people/${leadId}?attached=demo-insight`);
  }

  const supabase = await createClient();
  const existingLeadId = await getExistingLeadId(supabase, leadId);
  if (!existingLeadId) redirect('/people?error=contact-not-found');

  const { data: insight } = await supabase.from('insights').select('title').eq('id', insightId).maybeSingle();
  const insightTitle = insight?.title ? String(insight.title) : 'инсайт';

  const { error } = await supabase
    .from('insight_leads')
    .upsert({ insight_id: insightId, lead_id: leadId }, { onConflict: 'insight_id,lead_id' });

  if (error) redirect(`/people/${leadId}?error=insight-attach-failed`);

  await supabase.from('lead_interactions').insert({
    lead_id: leadId,
    type: 'note',
    channel: 'Hutka',
    text: `Контакт связан с инсайтом «${insightTitle}»`,
    result: 'insight_attached'
  });

  revalidateLeadRelationPages(leadId);
  revalidatePath('/insights');
  revalidatePath(`/insights/${insightId}`);
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
  const hypothesisTitle = hypothesis?.title ? String(hypothesis.title) : 'гипотеза';

  const { error } = await supabase
    .from('hypothesis_leads')
    .upsert({ hypothesis_id: hypothesisId, lead_id: leadId }, { onConflict: 'hypothesis_id,lead_id' });

  if (error) redirect(`/people/${leadId}?error=hypothesis-attach-failed`);

  await supabase.from('lead_interactions').insert({
    lead_id: leadId,
    type: 'note',
    channel: 'Hutka',
    text: `Контакт связан с гипотезой «${hypothesisTitle}»`,
    result: 'hypothesis_attached'
  });

  revalidateLeadRelationPages(leadId);
  revalidatePath('/hypotheses');
  revalidatePath(`/hypotheses/${hypothesisId}`);
  redirect(`/people/${leadId}?attached=hypothesis`);
}

export async function createLeadSurveyInviteAction(formData: FormData) {
  await requirePermission('manageSurveys', '/people?error=forbidden');
  const { leadId, relationId: surveyId } = await requireLeadRelationInputs(formData, 'survey_id');

  if (!isSupabaseConfigured()) {
    redirect(`/people/${leadId}?survey=demo`);
  }

  const supabase = await createClient();
  const existingLeadId = await getExistingLeadId(supabase, leadId);
  if (!existingLeadId) redirect('/people?error=contact-not-found');

  const { data: survey, error: surveyError } = await supabase
    .from('surveys')
    .select('title, slug')
    .eq('id', surveyId)
    .maybeSingle();

  if (surveyError || !survey?.slug) redirect(`/people/${leadId}?error=survey-not-found`);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '');
  const surveyUrl = `${appUrl ?? ''}/s/${survey.slug}`;
  const surveyTitle = survey.title ? String(survey.title) : 'опрос';

  await supabase.from('lead_interactions').insert({
    lead_id: leadId,
    type: 'survey_sent',
    channel: 'Hutka',
    text: `Создана ссылка на общий опрос «${surveyTitle}»: ${surveyUrl}`,
    result: 'survey_link_created'
  });

  revalidateLeadRelationPages(leadId);
  revalidatePath('/surveys');
  revalidatePath(`/surveys/${surveyId}`);
  redirect(`/people/${leadId}?survey=link-created`);
}

export async function deleteLeadAction(formData: FormData) {
  await requirePermission('manageContacts', '/people?error=forbidden');
  const leadId = getText(formData, 'lead_id');
  if (!leadId) redirect('/people?error=missing-lead');

  if (!isSupabaseConfigured()) {
    redirect('/people?deleted=demo');
  }

  const supabase = await createClient();
  const existingLeadId = await getExistingLeadId(supabase, leadId);
  if (!existingLeadId) redirect('/people?error=contact-not-found');

  const { error } = await supabase.from('leads').delete().eq('id', leadId);
  if (error) redirect(`/people/${leadId}?error=delete-failed`);

  revalidateLeadCollection();
  revalidatePath('/tasks');
  redirect('/people?deleted=lead');
}
