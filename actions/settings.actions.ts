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

export type SettingsDirectoryItem = {
  id: string;
  name: string;
  type?: string;
  color?: string;
  orderIndex?: number;
  usageCount?: number;
};

export type SettingsDirectoryMutationResult = {
  ok: boolean;
  error?: string;
  count?: number;
  merged?: number;
  item?: SettingsDirectoryItem;
  items?: SettingsDirectoryItem[];
};

type SourceMutationInput = {
  id?: string;
  name: string;
  type?: string;
};

type StageMutationInput = {
  id?: string;
  name: string;
  type?: string;
  orderIndex?: number;
  color?: string;
};

type TagMutationInput = {
  id?: string;
  name: string;
  color?: string;
};

export type AppSettingsMutationInput = {
  productName: string;
  workspaceName: string;
  defaultCity: string;
  weeklyReportDay: string;
};

export type SettingsSimpleMutationResult = {
  ok: boolean;
  error?: string;
  role?: ReturnType<typeof normalizeRole>;
};

function revalidateSettings() {
  revalidatePath('/settings');
  revalidatePath('/people');
  revalidatePath('/people/new');
  revalidatePath('/funnels');
  revalidatePath('/dashboard');
  revalidatePath('/reports');
}

function isMissingRpc(error: { code?: string; message?: string } | null, functionName: string) {
  if (!error) return false;
  return error.code === '42883'
    || error.code === 'PGRST202'
    || String(error.message ?? '').includes(functionName);
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

async function mergeDuplicateSourcesFallback(
  supabase: Awaited<ReturnType<typeof createClient>>
) {
  const { data, error } = await supabase.from('sources').select('id,name,type,created_at').order('created_at', { ascending: true });
  if (error || !data) return { ok: false, merged: 0 };

  const groups = data.reduce((acc, source) => {
    const normalized = normalizeSourceName(String(source.name ?? ''));
    const key = sourceKey(normalized);
    if (!key) return acc;
    const items = acc.get(key) ?? [];
    items.push({ id: String(source.id), name: normalized, type: String(source.type ?? 'manual') });
    acc.set(key, items);
    return acc;
  }, new Map<string, Array<{ id: string; name: string; type: string }>>());

  let merged = 0;

  for (const items of groups.values()) {
    if (items.length < 2) continue;
    const keeper = items[0];
    const duplicateIds = items.slice(1).map((item) => item.id);

    const [renameResult, reassignResult] = await Promise.all([
      supabase.from('sources').update({ name: keeper.name, type: keeper.type }).eq('id', keeper.id),
      supabase.from('leads').update({ source_id: keeper.id }).in('source_id', duplicateIds)
    ]);
    if (renameResult.error || reassignResult.error) return { ok: false, merged };

    const { error: deleteError } = await supabase.from('sources').delete().in('id', duplicateIds);
    if (deleteError) return { ok: false, merged };
    merged += duplicateIds.length;
  }

  return { ok: true, merged };
}

function redirectMutationError(result: SettingsDirectoryMutationResult, fallback: string): never {
  const error = result.error || fallback;
  const count = typeof result.count === 'number' ? `&count=${result.count}` : '';
  redirect(`/settings?error=${encodeURIComponent(error)}${count}`);
}

export async function updateAppSettingsAction(formData: FormData) {
  const result = await updateAppSettingsMutation({
    productName: getText(formData, 'product_name'),
    workspaceName: getText(formData, 'workspace_name'),
    defaultCity: getText(formData, 'default_city'),
    weeklyReportDay: getText(formData, 'weekly_report_day')
  });
  if (!result.ok) redirect('/settings?error=settings-save-failed');
  revalidateSettings();
  redirect('/settings?saved=app');
}

export async function updateAppSettingsMutation(
  input: AppSettingsMutationInput
): Promise<SettingsSimpleMutationResult> {
  await requirePermission('manageSettings', '/dashboard?error=admin-only');
  if (!isSupabaseConfigured()) return { ok: false, error: 'demo' };

  const supabase = await createClient();
  const rows = [
    { key: 'product_name', value: input.productName.trim() || 'Hutka' },
    { key: 'workspace_name', value: input.workspaceName.trim() || 'Beauty CRM Launch' },
    { key: 'default_city', value: input.defaultCity.trim() },
    { key: 'weekly_report_day', value: input.weeklyReportDay.trim() || 'Понедельник' }
  ];

  const { error } = await supabase.from('app_settings').upsert(rows, { onConflict: 'key' });
  if (error) return { ok: false, error: 'settings-save-failed' };

  return { ok: true };
}

export async function createSourceAction(formData: FormData) {
  const result = await createSourceMutation({
    name: getText(formData, 'name'),
    type: getText(formData, 'type')
  });
  if (!result.ok) redirectMutationError(result, 'source-create-failed');
  revalidateSettings();
  redirect('/settings?saved=source');
}

export async function createSourceMutation(input: SourceMutationInput): Promise<SettingsDirectoryMutationResult> {
  const user = await requirePermission('manageSettings', '/dashboard?error=admin-only');
  const name = normalizeSourceName(input.name);
  if (!name) return { ok: false, error: 'source-name-required' };
  if (!isSupabaseConfigured()) return { ok: false, error: 'demo' };

  const supabase = await createClient();
  const duplicate = await findSourceDuplicate(supabase, name);
  if (duplicate) return { ok: false, error: 'source-duplicate' };

  const sourceType = input.type?.trim() || 'manual';
  const { data: source, error } = await supabase.from('sources').insert({
    name,
    type: sourceType
  }).select('id,name,type').single();

  if (error?.code === '23505') return { ok: false, error: 'source-duplicate' };
  if (error || !source?.id) return { ok: false, error: 'source-create-failed' };
  await recordActivityLog({
    userId: user.profileId,
    action: 'создал источник',
    entityType: 'source',
    entityId: String(source.id),
    entityTitle: name,
    details: { type: sourceType }
  });
  return {
    ok: true,
    item: {
      id: String(source.id),
      name: String(source.name ?? name),
      type: String(source.type ?? sourceType)
    }
  };
}

export async function updateSourceAction(formData: FormData) {
  const result = await updateSourceMutation({
    id: getText(formData, 'id'),
    name: getText(formData, 'name'),
    type: getText(formData, 'type')
  });
  if (!result.ok) redirectMutationError(result, 'source-update-failed');
  revalidateSettings();
  redirect('/settings?saved=source');
}

export async function updateSourceMutation(input: SourceMutationInput): Promise<SettingsDirectoryMutationResult> {
  const user = await requirePermission('manageSettings', '/dashboard?error=admin-only');
  const id = input.id?.trim() ?? '';
  const name = normalizeSourceName(input.name);
  if (!id || !name) return { ok: false, error: 'source-update-required' };
  if (!isSupabaseConfigured()) return { ok: false, error: 'demo' };

  const supabase = await createClient();
  const [exists, duplicate] = await Promise.all([
    rowExists(supabase, 'sources', id),
    findSourceDuplicate(supabase, name, id)
  ]);
  if (!exists) return { ok: false, error: 'source-not-found' };
  if (duplicate) return { ok: false, error: 'source-duplicate' };

  const sourceType = input.type?.trim() || 'manual';
  const { data: source, error } = await supabase
    .from('sources')
    .update({ name, type: sourceType })
    .eq('id', id)
    .select('id,name,type')
    .maybeSingle();

  if (error?.code === '23505') return { ok: false, error: 'source-duplicate' };
  if (error || !source?.id) return { ok: false, error: 'source-update-failed' };
  await recordActivityLog({
    userId: user.profileId,
    action: 'изменил источник',
    entityType: 'source',
    entityId: id,
    entityTitle: name,
    details: { type: sourceType }
  });
  return {
    ok: true,
    item: {
      id: String(source.id),
      name: String(source.name ?? name),
      type: String(source.type ?? sourceType)
    }
  };
}

export async function deleteSourceAction(formData: FormData) {
  const result = await deleteSourceMutation(getText(formData, 'id'));
  if (!result.ok) redirectMutationError(result, 'source-delete-failed');
  revalidateSettings();
  redirect('/settings?deleted=source');
}

export async function deleteSourceMutation(rawId: string): Promise<SettingsDirectoryMutationResult> {
  const user = await requirePermission('manageSettings', '/dashboard?error=admin-only');
  const id = rawId.trim();
  if (!id) return { ok: false, error: 'source-delete-required' };
  if (!isSupabaseConfigured()) return { ok: false, error: 'demo' };

  const supabase = await createClient();
  const [sourceResult, usageResult] = await Promise.all([
    supabase.from('sources').select('name').eq('id', id).maybeSingle(),
    supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('source_id', id)
  ]);
  const source = sourceResult.data;
  if (!source) return { ok: false, error: 'source-not-found' };
  if (usageResult.error) return { ok: false, error: 'source-delete-failed' };
  if ((usageResult.count ?? 0) > 0) {
    return { ok: false, error: 'source-in-use', count: usageResult.count ?? 0 };
  }

  const { error } = await supabase.from('sources').delete().eq('id', id);
  if (error) return { ok: false, error: 'source-in-use' };

  await recordActivityLog({
    userId: user.profileId,
    action: 'удалил источник',
    entityType: 'source',
    entityId: id,
    entityTitle: String(source.name ?? 'Источник')
  });
  return { ok: true };
}

export async function mergeDuplicateSourcesAction() {
  const result = await mergeDuplicateSourcesMutation();
  if (!result.ok) redirectMutationError(result, 'source-merge-failed');
  revalidateSettings();
  redirect(`/settings?saved=source-merge&count=${result.merged ?? 0}`);
}

export async function mergeDuplicateSourcesMutation(): Promise<SettingsDirectoryMutationResult> {
  const user = await requirePermission('manageSettings', '/dashboard?error=admin-only');
  if (!isSupabaseConfigured()) return { ok: false, error: 'demo' };

  const supabase = await createClient();
  const rpcResult = await supabase.rpc('merge_duplicate_sources', {
    p_user_id: user.profileId
  });

  let merged = 0;
  if (rpcResult.error && isMissingRpc(rpcResult.error, 'merge_duplicate_sources')) {
    const fallbackResult = await mergeDuplicateSourcesFallback(supabase);
    if (!fallbackResult.ok) return { ok: false, error: 'source-merge-failed' };
    merged = fallbackResult.merged;
    await recordActivityLog({
      userId: user.profileId,
      action: 'объединил источники',
      entityType: 'source',
      entityTitle: 'Источники',
      details: { merged, fallback: true }
    });
  } else if (rpcResult.error) {
    return { ok: false, error: 'source-merge-failed' };
  } else {
    const payload = rpcResult.data && typeof rpcResult.data === 'object'
      ? rpcResult.data as Record<string, unknown>
      : null;
    if (payload?.ok !== true) return { ok: false, error: 'source-merge-failed' };
    merged = typeof payload.merged === 'number' ? payload.merged : 0;
  }

  const { data: sources, error: sourcesError } = await supabase
    .from('sources')
    .select('id,name,type,leads(count)')
    .order('name', { ascending: true });
  if (sourcesError) return { ok: false, error: 'source-merge-failed' };

  return {
    ok: true,
    merged,
    items: (sources ?? []).map((source) => ({
      id: String(source.id),
      name: normalizeSourceName(String(source.name ?? 'Без названия')),
      type: String(source.type ?? 'manual'),
      usageCount: Array.isArray(source.leads) && typeof source.leads[0]?.count === 'number'
        ? source.leads[0].count
        : 0
    }))
  };
}

export async function createStageAction(formData: FormData) {
  const result = await createStageMutation({
    name: getText(formData, 'name'),
    type: getText(formData, 'type'),
    orderIndex: getInt(formData, 'order_index', 99),
    color: getText(formData, 'color')
  });
  if (!result.ok) redirectMutationError(result, 'stage-create-failed');
  revalidateSettings();
  redirect('/settings?saved=stage');
}

export async function createStageMutation(input: StageMutationInput): Promise<SettingsDirectoryMutationResult> {
  const user = await requirePermission('manageSettings', '/dashboard?error=admin-only');
  const name = input.name.trim();
  if (!name) return { ok: false, error: 'stage-name-required' };
  if (!isSupabaseConfigured()) return { ok: false, error: 'demo' };

  const supabase = await createClient();
  const stageType = input.type?.trim() || 'master';
  const orderIndex = Number.isFinite(input.orderIndex) ? input.orderIndex ?? 99 : 99;
  const color = input.color?.trim() || 'purple';
  const { data: stage, error } = await supabase.from('funnel_stages').insert({
    name,
    type: stageType,
    order_index: orderIndex,
    color
  }).select('id,name,type,order_index,color').single();

  if (error || !stage?.id) return { ok: false, error: 'stage-create-failed' };
  await recordActivityLog({
    userId: user.profileId,
    action: 'создал стадию',
    entityType: 'stage',
    entityId: String(stage.id),
    entityTitle: name
  });
  return {
    ok: true,
    item: {
      id: String(stage.id),
      name: String(stage.name ?? name),
      type: String(stage.type ?? stageType),
      orderIndex: typeof stage.order_index === 'number' ? stage.order_index : orderIndex,
      color: String(stage.color ?? color)
    }
  };
}

export async function updateStageAction(formData: FormData) {
  const result = await updateStageMutation({
    id: getText(formData, 'id'),
    name: getText(formData, 'name'),
    type: getText(formData, 'type'),
    orderIndex: getInt(formData, 'order_index', 99),
    color: getText(formData, 'color')
  });
  if (!result.ok) redirectMutationError(result, 'stage-update-failed');
  revalidateSettings();
  redirect('/settings?saved=stage');
}

export async function updateStageMutation(input: StageMutationInput): Promise<SettingsDirectoryMutationResult> {
  const user = await requirePermission('manageSettings', '/dashboard?error=admin-only');
  const id = input.id?.trim() ?? '';
  const name = input.name.trim();
  if (!id || !name) return { ok: false, error: 'stage-update-required' };
  if (!isSupabaseConfigured()) return { ok: false, error: 'demo' };

  const supabase = await createClient();
  const stageType = input.type?.trim() || 'master';
  const orderIndex = Number.isFinite(input.orderIndex) ? input.orderIndex ?? 99 : 99;
  const color = input.color?.trim() || 'purple';
  const { data: updatedStage, error } = await supabase
    .from('funnel_stages')
    .update({
      name,
      type: stageType,
      order_index: orderIndex,
      color
    })
    .eq('id', id)
    .select('id,name,type,order_index,color')
    .maybeSingle();

  if (error) return { ok: false, error: 'stage-update-failed' };
  if (!updatedStage?.id) return { ok: false, error: 'stage-not-found' };
  await recordActivityLog({
    userId: user.profileId,
    action: 'изменил стадию',
    entityType: 'stage',
    entityId: id,
    entityTitle: name
  });
  return {
    ok: true,
    item: {
      id: String(updatedStage.id),
      name: String(updatedStage.name ?? name),
      type: String(updatedStage.type ?? stageType),
      orderIndex: typeof updatedStage.order_index === 'number' ? updatedStage.order_index : orderIndex,
      color: String(updatedStage.color ?? color)
    }
  };
}

export async function deleteStageAction(formData: FormData) {
  const result = await deleteStageMutation(getText(formData, 'id'));
  if (!result.ok) redirectMutationError(result, 'stage-delete-failed');
  revalidateSettings();
  redirect('/settings?deleted=stage');
}

export async function deleteStageMutation(rawId: string): Promise<SettingsDirectoryMutationResult> {
  const user = await requirePermission('manageSettings', '/dashboard?error=admin-only');
  const id = rawId.trim();
  if (!id) return { ok: false, error: 'stage-delete-required' };
  if (!isSupabaseConfigured()) return { ok: false, error: 'demo' };

  const supabase = await createClient();
  const [stageResult, usageResult] = await Promise.all([
    supabase.from('funnel_stages').select('id,name').eq('id', id).maybeSingle(),
    supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('stage_id', id)
  ]);
  const stage = stageResult.data;
  if (!stage?.id) return { ok: false, error: 'stage-not-found' };
  if (usageResult.error) return { ok: false, error: 'stage-delete-failed' };
  if ((usageResult.count ?? 0) > 0) {
    return { ok: false, error: 'stage-in-use', count: usageResult.count ?? 0 };
  }

  const { error } = await supabase.from('funnel_stages').delete().eq('id', id);
  if (error) return { ok: false, error: 'stage-in-use' };

  await recordActivityLog({
    userId: user.profileId,
    action: 'удалил стадию',
    entityType: 'stage',
    entityId: id,
    entityTitle: String(stage.name ?? 'Стадия')
  });

  return { ok: true };
}

export async function createTagAction(formData: FormData) {
  const result = await createTagMutation({
    name: getText(formData, 'name'),
    color: getText(formData, 'color')
  });
  if (!result.ok) redirectMutationError(result, 'tag-create-failed');
  revalidateSettings();
  redirect('/settings?saved=tag');
}

export async function createTagMutation(input: TagMutationInput): Promise<SettingsDirectoryMutationResult> {
  const user = await requirePermission('manageSettings', '/dashboard?error=admin-only');
  const name = input.name.trim();
  if (!name) return { ok: false, error: 'tag-name-required' };
  if (!isSupabaseConfigured()) return { ok: false, error: 'demo' };

  const supabase = await createClient();
  const color = input.color?.trim() || 'purple';
  const { data: tag, error } = await supabase.from('tags').insert({
    name,
    color
  }).select('id,name,color').single();

  if (error || !tag?.id) return { ok: false, error: 'tag-create-failed' };
  await recordActivityLog({
    userId: user.profileId,
    action: 'создал тег',
    entityType: 'tag',
    entityId: String(tag.id),
    entityTitle: name
  });
  return {
    ok: true,
    item: {
      id: String(tag.id),
      name: String(tag.name ?? name),
      color: String(tag.color ?? color)
    }
  };
}

export async function updateTagAction(formData: FormData) {
  const result = await updateTagMutation({
    id: getText(formData, 'id'),
    name: getText(formData, 'name'),
    color: getText(formData, 'color')
  });
  if (!result.ok) redirectMutationError(result, 'tag-update-failed');
  revalidateSettings();
  redirect('/settings?saved=tag');
}

export async function updateTagMutation(input: TagMutationInput): Promise<SettingsDirectoryMutationResult> {
  const user = await requirePermission('manageSettings', '/dashboard?error=admin-only');
  const id = input.id?.trim() ?? '';
  const name = input.name.trim();
  if (!id || !name) return { ok: false, error: 'tag-update-required' };
  if (!isSupabaseConfigured()) return { ok: false, error: 'demo' };

  const supabase = await createClient();
  const color = input.color?.trim() || 'purple';
  const { data: updatedTag, error } = await supabase
    .from('tags')
    .update({ name, color })
    .eq('id', id)
    .select('id,name,color')
    .maybeSingle();

  if (error) return { ok: false, error: 'tag-update-failed' };
  if (!updatedTag?.id) return { ok: false, error: 'tag-not-found' };
  await recordActivityLog({
    userId: user.profileId,
    action: 'изменил тег',
    entityType: 'tag',
    entityId: id,
    entityTitle: name
  });
  return {
    ok: true,
    item: {
      id: String(updatedTag.id),
      name: String(updatedTag.name ?? name),
      color: String(updatedTag.color ?? color)
    }
  };
}

export async function deleteTagAction(formData: FormData) {
  const result = await deleteTagMutation(getText(formData, 'id'));
  if (!result.ok) redirectMutationError(result, 'tag-delete-failed');
  revalidateSettings();
  redirect('/settings?deleted=tag');
}

export async function deleteTagMutation(rawId: string): Promise<SettingsDirectoryMutationResult> {
  const user = await requirePermission('manageSettings', '/dashboard?error=admin-only');
  const id = rawId.trim();
  if (!id) return { ok: false, error: 'tag-delete-required' };
  if (!isSupabaseConfigured()) return { ok: false, error: 'demo' };

  const supabase = await createClient();
  const [tagResult, usageResult] = await Promise.all([
    supabase.from('tags').select('id,name').eq('id', id).maybeSingle(),
    supabase
      .from('lead_tags')
      .select('lead_id', { count: 'exact', head: true })
      .eq('tag_id', id)
  ]);
  const tag = tagResult.data;
  if (!tag?.id) return { ok: false, error: 'tag-not-found' };
  if (usageResult.error) return { ok: false, error: 'tag-delete-failed' };
  if ((usageResult.count ?? 0) > 0) {
    return { ok: false, error: 'tag-in-use', count: usageResult.count ?? 0 };
  }

  const { error } = await supabase.from('tags').delete().eq('id', id);
  if (error) return { ok: false, error: 'tag-in-use' };

  await recordActivityLog({
    userId: user.profileId,
    action: 'удалил тег',
    entityType: 'tag',
    entityId: id,
    entityTitle: String(tag.name ?? 'Тег')
  });

  return { ok: true };
}


export async function updateProfileRoleAction(formData: FormData) {
  const result = await updateProfileRoleMutation(
    getText(formData, 'profile_id'),
    getText(formData, 'role')
  );
  if (!result.ok) redirect(`/settings?error=${encodeURIComponent(result.error || 'role-update-failed')}`);
  revalidatePath('/settings');
  revalidatePath('/dashboard');
  redirect('/settings?saved=role');
}

export async function updateProfileRoleMutation(
  rawProfileId: string,
  rawRole: string
): Promise<SettingsSimpleMutationResult> {
  await requirePermission('manageUsers', '/settings?error=admin-only');

  const profileId = rawProfileId.trim();
  const role = normalizeRole(rawRole);
  if (!profileId) return { ok: false, error: 'profile-required' };
  if (!isSupabaseConfigured()) return { ok: false, error: 'demo' };

  const supabase = await createClient();
  const { data: updatedProfile, error } = await supabase
    .from('profiles')
    .update({ role })
    .eq('id', profileId)
    .select('id')
    .maybeSingle();

  if (error) return { ok: false, error: 'role-update-failed' };
  if (!updatedProfile?.id) return { ok: false, error: 'profile-not-found' };

  return { ok: true, role };
}
