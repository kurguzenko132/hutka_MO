'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { requirePermission } from '@/lib/permissions';
import { normalizeRole } from '@/lib/roles';

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
  await requirePermission('manageSettings', '/dashboard?error=admin-only');
  const name = getText(formData, 'name');
  if (!name) redirect('/settings?error=source-name-required');
  if (!isSupabaseConfigured()) demoRedirect();

  const supabase = await createClient();
  const { error } = await supabase.from('sources').insert({
    name,
    type: getText(formData, 'type') || 'manual'
  });

  if (error) redirect('/settings?error=source-create-failed');
  revalidateSettings();
  redirect('/settings?saved=source');
}

export async function updateSourceAction(formData: FormData) {
  await requirePermission('manageSettings', '/dashboard?error=admin-only');
  const id = getText(formData, 'id');
  const name = getText(formData, 'name');
  if (!id || !name) redirect('/settings?error=source-update-required');
  if (!isSupabaseConfigured()) demoRedirect();

  const supabase = await createClient();
  const { error } = await supabase
    .from('sources')
    .update({ name, type: getText(formData, 'type') || 'manual' })
    .eq('id', id);

  if (error) redirect('/settings?error=source-update-failed');
  revalidateSettings();
  redirect('/settings?saved=source');
}

export async function deleteSourceAction(formData: FormData) {
  await requirePermission('manageSettings', '/dashboard?error=admin-only');
  const id = getText(formData, 'id');
  if (!id) redirect('/settings?error=source-delete-required');
  if (!isSupabaseConfigured()) demoRedirect();

  const supabase = await createClient();
  const { error } = await supabase.from('sources').delete().eq('id', id);
  if (error) redirect('/settings?error=source-in-use');

  revalidateSettings();
  redirect('/settings?deleted=source');
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
  await requirePermission('manageSettings', '/dashboard?error=admin-only');
  const id = getText(formData, 'id');
  if (!id) redirect('/settings?error=stage-delete-required');
  if (!isSupabaseConfigured()) demoRedirect();

  const supabase = await createClient();
  const { error } = await supabase.from('funnel_stages').delete().eq('id', id);
  if (error) redirect('/settings?error=stage-in-use');

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
  const { error } = await supabase
    .from('tags')
    .update({ name, color: getText(formData, 'color') || 'purple' })
    .eq('id', id);

  if (error) redirect('/settings?error=tag-update-failed');
  revalidateSettings();
  redirect('/settings?saved=tag');
}

export async function deleteTagAction(formData: FormData) {
  await requirePermission('manageSettings', '/dashboard?error=admin-only');
  const id = getText(formData, 'id');
  if (!id) redirect('/settings?error=tag-delete-required');
  if (!isSupabaseConfigured()) demoRedirect();

  const supabase = await createClient();
  const { error } = await supabase.from('tags').delete().eq('id', id);
  if (error) redirect('/settings?error=tag-in-use');

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
  const { error } = await supabase.from('profiles').update({ role }).eq('id', profileId);

  if (error) redirect('/settings?error=role-update-failed');

  revalidatePath('/settings');
  revalidatePath('/dashboard');
  redirect('/settings?saved=role');
}
