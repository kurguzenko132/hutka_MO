'use server';

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
  const stageName = name || 'Найдено';
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
  const tags = getText(formData, 'tags')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);

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

  for (const tag of tags) {
    const tagId = await ensureTagId(supabase, tag);
    await supabase.from('lead_tags').insert({ lead_id: lead.id, tag_id: tagId });
  }

  await supabase.from('lead_interactions').insert({
    lead_id: lead.id,
    type: 'note',
    channel: source || 'manual',
    text: 'Контакт добавлен в Hutka',
    result: 'created'
  });

  redirect(`/people/${lead.id}`);
}
