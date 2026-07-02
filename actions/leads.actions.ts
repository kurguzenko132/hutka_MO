'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { leadTypeToDb, priorityToScore } from '@/lib/leads';
import type { LeadType, Priority } from '@/lib/data';

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
  const stageName = name || 'Найден';
  const existing = await supabase.from('funnel_stages').select('id').eq('name', stageName).maybeSingle();
  if (existing.data?.id) return existing.data.id as string;

  const created = await supabase
    .from('funnel_stages')
    .insert({ name: stageName, type: 'master', order_index: 99, color: 'purple' })
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

async function syncLeadTags(supabase: Awaited<ReturnType<typeof createClient>>, leadId: string, tags: string[]) {
  await supabase.from('lead_tags').delete().eq('lead_id', leadId);

  for (const tag of tags) {
    const tagId = await ensureTagId(supabase, tag);
    await supabase.from('lead_tags').insert({ lead_id: leadId, tag_id: tagId });
  }
}

export async function createLeadAction(formData: FormData) {
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
  const stage = getText(formData, 'stage');
  const tags = getTags(formData);

  const supabase = await createClient();
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

  await syncLeadTags(supabase, lead.id, tags);

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
  const stage = getText(formData, 'stage');
  const tags = getTags(formData);

  const supabase = await createClient();
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

  await syncLeadTags(supabase, leadId, tags);
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
  const leadId = getText(formData, 'lead_id');
  if (!leadId) redirect('/people');

  const text = getText(formData, 'text');
  if (!text) redirect(`/people/${leadId}?error=missing-interaction`);

  if (!isSupabaseConfigured()) {
    redirect(`/people/${leadId}?interaction=demo`);
  }

  const supabase = await createClient();
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
