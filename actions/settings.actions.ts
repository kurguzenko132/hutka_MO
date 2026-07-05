'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { requirePermission } from '@/lib/permissions';
import { normalizeRole } from '@/lib/roles';
import { recordActivityLog } from '@/lib/activity-log';
import { normalizeSourceName, sourceKey } from '@/lib/source-normalization';

function getText(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

function getInt(formData: FormData, key: string, fallback = 0) {
  const value = Number.parseInt(getText(formData, key), 10);
  return Number.isFinite(value) ? value : fallback;
}

function revalidateSettings() {
  revalidatePath('/settings');
  revalidatePath('/people');
  revalidatePath('/people/new');
  revalidatePath('/funnels');
  revalidatePath('/dashboard');
  revalidatePath('/reports');
}

function demoRedirect() {
  redirect('/settings?demo=1');
}

async function rowExists(supabase: Awaited<ReturnType<typeof createClient>>, table: string, id: string) {
  const { data, error } = await supabase.from(table).select('id').eq('id', id).maybeSingle();
  return !error && Boolean(data?.id);
}

async function findSourceDuplicate(supabase: Awaited<ReturnType<typeof createClient>>, name: string, excludeId?: string) {
  const key = sourceKey(name);
  if (!key) return null;

  const { data, error } = await supabase.from('sources').select('id,name');
  if (error || !data) return null;

  return data.find((source) => {
    const id = String(source.id);
    if (excludeId && id === excludeId) return false;
    return sourceKey(normalizeSourceName(String(source.name ?? ''))) === key;
  }) ?? null;
}

export async function updateAppSettingsAction(formData: FormData) {
  await requirePermission('manageSettings', '/dashboard?error=admin-only');
  if (!isSupabaseConfigured()) demoRedirect();

  const supabase = await createClient();
  const rows = [
    { key: 'product_name', value: getText(formData, 'product_name') || 'Hutka' },
    { key: 'workspace_name', value: getText(formData, 'workspace_name') || 'Beauty CRM Launch' },
    { key: 'default_city', value: getText(formData, 'default_city') || '' },
    { key: 'weekly_report_day', value: getText(formData, 'weekly_report_day') || 'Понедельник' }
  ];

  const { error } = await supabase.from('app_settings').upsert(rows, { onConflict: 'key' });
  if (error) redirect('/settings?error=settings-save-failed');

  revalidateSettings();
  redirect('/settings?saved=app');
}

export async function createSourceAction(formData: FormData) {
  const user = await requirePermission('manageSettings', '/dashboard?error=admin-only');
  const name = normalizeSourceName(getText(formData, 'name'));
  if (!name) redirect('/settings?error=source-name-required');
  if (!isSupabaseConfigured()) demoRedirect();

  const supabase = await createClient();
  const duplicate = await findSourceDuplicate(supabase, name);
  if (duplicate) redirect('/settings?error=source-duplicate');

  const { error } = await supabase.from('sources').insert({
    name,
    type: getText(formData, 'type') || 'manual'
  });

  if (error) redirect('/settings?error=source-create-failed');
  await recordActivityLog({
    userId: user.profileId,
    action: 'создал источник',
    entityType: 'source',
    entityTitle: name,
    details: { type: getText(formData, 'type') || 'manual' }
  });
  revalidateSettings();
  redirect('/settings?saved=source');
}

export async function updateSourceAction(formData: FormData) {
  const user = await requirePermission('manageSettings', '/dashboard?error=admin-only');
  const id = getText(formData, 'id');
  const name = normalizeSourceName(getText(formData, 'name'));
  if (!id || !name) redirect('/settings?error=source-update-required');
  if (!isSupabaseConfigured()) demoRedirect();

  const supabase = await createClient();
  if (!(await rowExists(supabase, 'sources', id))) redirect('/settings?error=source-not-found');
  const duplicate = await findSourceDuplicate(supabase, name, id);
  if (duplicate) redirect('/settings?error=source-duplicate');

  const { error } = await supabase
    .from('sources')
    .update({ name, type: getText(formData, 'type') || 'manual' })
    .eq('id', id);

  if (error) redirect('/settings?error=source-update-failed');
  await recordActivityLog({
    userId: user.profileId,
    action: 'изменил источник',
    entityType: 'source',
    entityId: id,
    entityTitle: name,
    details: { type: getText(formData, 'type') || 'manual' }
  });
  revalidateSettings();
  redirect('/settings?saved=source');
}

export async function deleteSourceAction(formData: FormData) {
  const user = await requirePermission('manageSettings', '/dashboard?error=admin-only');
  const id = getText(formData, 'id');
  if (!id) redirect('/settings?error=source-delete-required');
  if (!isSupabaseConfigured()) demoRedirect();

  const supabase = await createClient();
  const { data: source } = await supabase.from('sources').select('name').eq('id', id).maybeSingle();
  if (!source) redirect('/settings?error=source-not-found');

  const { count, error: countError } = await supabase
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .eq('source_id', id);
  if (countError) redirect('/settings?error=source-delete-failed');
  if ((count ?? 0) > 0) redirect(`/settings?error=source-in-use&count=${count}`);

  const { error } = await supabase.from('sources').delete().eq('id', id);
  if (error) redirect('/settings?error=source-in-use');

  await recordActivityLog({
    userId: user.profileId,
    action: 'удалил источник',
    entityType: 'source',
    entityId: id,
    entityTitle: String(source.name ?? 'Источник')
  });
  revalidateSettings();
  redirect('/settings?deleted=source');
}

export async function mergeDuplicateSourcesAction() {
  const user = await requirePermission('manageSettings', '/dashboard?error=admin-only');
  if (!isSupabaseConfigured()) demoRedirect();

  const supabase = await createClient();
  const { data, error } = await supabase.from('sources').select('id,name,type,created_at').order('created_at', { ascending: true });
  if (error || !data) redirect('/settings?error=source-merge-failed');

  const groups = data.reduce((acc, source) => {
    const normalized = normalizeSourceName(String(source.name ?? ''));
    const key = sourceKey(normalized);
    if (!key) return acc;
    const items = acc.get(key) ?? [];
    items.push({ id: String(source.id), name: normalized, type: String(source.type ?? 'manual'), createdAt: String(source.created_at ?? '') });
    acc.set(key, items);
    return acc;
  }, new Map<string, Array<{ id: string; name: string; type: string; createdAt: string }>>());

  let merged = 0;

  for (const items of groups.values()) {
    if (items.length < 2) continue;
    const keeper = items[0];
    const duplicateIds = items.slice(1).map((item) => item.id);

    await supabase.from('sources').update({ name: keeper.name, type: keeper.type }).eq('id', keeper.id);
    await supabase.from('leads').update({ source_id: keeper.id }).in('source_id', duplicateIds);
    const { error: deleteError } = await supabase.from('sources').delete().in('id', duplicateIds);
    if (deleteError) redirect('/settings?error=source-merge-failed');
    merged += duplicateIds.length;
  }

  await recordActivityLog({
    userId: user.profileId,
    action: 'объединил источники',
    entityType: 'source',
    entityTitle: 'Источники',
    details: { merged }
  });
  revalidateSettings();
  redirect(`/settings?saved=source-merge&count=${merged}`);
}

export async function createStageAction(formData: FormData) {
  await requirePermission('manageSettings', '/dashboard?error=admin-only');
  const name = getText(formData, 'name');
  if (!name) redirect('/settings?error=stage-name-required');
  if (!isSupabaseConfigured()) demoRedirect();

  const supabase = await createClient();
  const { error } = await supabase.from('funnel_stages').insert({
    name,
    type: getText(formData, 'type') || 'master',
    order_index: getInt(formData, 'order_index', 99),
    color: getText(formData, 'color') || 'purple'
  });

  if (error) redirect('/settings?error=stage-create-failed');
  revalidateSettings();
  redirect('/settings?saved=stage');
}

export async function updateStageAction(formData: FormData) {
  await requirePermission('manageSettings', '/dashboard?error=admin-only');
  const id = getText(formData, 'id');
  const name = getText(formData, 'name');
  if (!id || !name) redirect('/settings?error=stage-update-required');
  if (!isSupabaseConfigured()) demoRedirect();

  const supabase = await createClient();
  if (!(await rowExists(supabase, 'funnel_stages', id))) redirect('/settings?error=stage-not-found');

  const { error } = await supabase
    .from('funnel_stages')
    .update({
      name,
      type: getText(formData, 'type') || 'master',
      order_index: getInt(formData, 'order_index', 99),
      color: getText(formData, 'color') || 'purple'
    })
    .eq('id', id);

  if (error) redirect('/settings?error=stage-update-failed');
  revalidateSettings();
  redirect('/settings?saved=stage');
}

export async function deleteStageAction(formData: FormData) {
  const user = await requirePermission('manageSettings', '/dashboard?error=admin-only');
  const id = getText(formData, 'id');
  if (!id) redirect('/settings?error=stage-delete-required');
  if (!isSupabaseConfigured()) demoRedirect();

  const supabase = await createClient();
  const { data: stage } = await supabase.from('funnel_stages').select('id,name').eq('id', id).maybeSingle();
  if (!stage?.id) redirect('/settings?error=stage-not-found');
  const { count: leadsCount } = await supabase
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .eq('stage_id', id);
  if ((leadsCount ?? 0) > 0) redirect(`/settings?error=stage-in-use&count=${leadsCount}`);

  const { error } = await supabase.from('funnel_stages').delete().eq('id', id);
  if (error) redirect('/settings?error=stage-in-use');

  await recordActivityLog({
    userId: user.profileId,
    action: 'удалил стадию',
    entityType: 'stage',
    entityId: id,
    entityTitle: String(stage.name ?? 'Стадия')
  });

  revalidateSettings();
  redirect('/settings?deleted=stage');
}

export async function createTagAction(formData: FormData) {
  await requirePermission('manageSettings', '/dashboard?error=admin-only');
  const name = getText(formData, 'name');
  if (!name) redirect('/settings?error=tag-name-required');
  if (!isSupabaseConfigured()) demoRedirect();

  const supabase = await createClient();
  const { error } = await supabase.from('tags').insert({
    name,
    color: getText(formData, 'color') || 'purple'
  });

  if (error) redirect('/settings?error=tag-create-failed');
  revalidateSettings();
  redirect('/settings?saved=tag');
}

export async function updateTagAction(formData: FormData) {
  await requirePermission('manageSettings', '/dashboard?error=admin-only');
  const id = getText(formData, 'id');
  const name = getText(formData, 'name');
  if (!id || !name) redirect('/settings?error=tag-update-required');
  if (!isSupabaseConfigured()) demoRedirect();

  const supabase = await createClient();
  if (!(await rowExists(supabase, 'tags', id))) redirect('/settings?error=tag-not-found');

  const { error } = await supabase
    .from('tags')
    .update({ name, color: getText(formData, 'color') || 'purple' })
    .eq('id', id);

  if (error) redirect('/settings?error=tag-update-failed');
  revalidateSettings();
  redirect('/settings?saved=tag');
}

export async function deleteTagAction(formData: FormData) {
  const user = await requirePermission('manageSettings', '/dashboard?error=admin-only');
  const id = getText(formData, 'id');
  if (!id) redirect('/settings?error=tag-delete-required');
  if (!isSupabaseConfigured()) demoRedirect();

  const supabase = await createClient();
  const { data: tag } = await supabase.from('tags').select('id,name').eq('id', id).maybeSingle();
  if (!tag?.id) redirect('/settings?error=tag-not-found');
  const { count: leadsCount } = await supabase
    .from('lead_tags')
    .select('lead_id', { count: 'exact', head: true })
    .eq('tag_id', id);
  if ((leadsCount ?? 0) > 0) redirect(`/settings?error=tag-in-use&count=${leadsCount}`);

  const { error } = await supabase.from('tags').delete().eq('id', id);
  if (error) redirect('/settings?error=tag-in-use');

  await recordActivityLog({
    userId: user.profileId,
    action: 'удалил тег',
    entityType: 'tag',
    entityId: id,
    entityTitle: String(tag.name ?? 'Тег')
  });

  revalidateSettings();
  redirect('/settings?deleted=tag');
}


export async function updateProfileRoleAction(formData: FormData) {
  await requirePermission('manageUsers', '/settings?error=admin-only');

  const profileId = getText(formData, 'profile_id');
  const role = normalizeRole(getText(formData, 'role'));
  if (!profileId) redirect('/settings?error=profile-required');
  if (!isSupabaseConfigured()) demoRedirect();

  const supabase = await createClient();
  if (!(await rowExists(supabase, 'profiles', profileId))) redirect('/settings?error=profile-not-found');

  const { error } = await supabase.from('profiles').update({ role }).eq('id', profileId);

  if (error) redirect('/settings?error=role-update-failed');

  revalidatePath('/settings');
  revalidatePath('/dashboard');
  redirect('/settings?saved=role');
}
