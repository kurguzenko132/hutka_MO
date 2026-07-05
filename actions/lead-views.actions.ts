'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { requireUser } from '@/lib/permissions';
import type { LeadFilters } from '@/lib/leads';
import { recordActivityLog } from '@/lib/activity-log';

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

function collectFilters(formData: FormData): LeadFilters {
  const result: LeadFilters = {};
  const keys: Array<keyof LeadFilters> = ['q', 'type', 'city', 'niche', 'stage', 'source', 'priority', 'tag', 'view'];

  for (const key of keys) {
    const value = text(formData, key);
    if (value) result[key] = value;
  }

  return result;
}

export async function createSavedLeadViewAction(formData: FormData) {
  const user = await requireUser('/people');
  const name = text(formData, 'name');
  const filters = collectFilters(formData);

  if (!name) redirect('/people?error=missing-view-name');
  if (!user.profileId) redirect('/people?error=profile-not-found');

  if (!isSupabaseConfigured()) {
    redirect('/people?saved=demo');
  }

  const supabase = await createClient();
  const { data: view, error } = await supabase
    .from('saved_lead_views')
    .insert({
      profile_id: user.profileId,
      name,
      filters
    })
    .select('id')
    .single();

  if (error || !view) redirect('/people?error=view-save-failed');

  await recordActivityLog({
    userId: user.profileId,
    action: 'создал сохраненный фильтр',
    entityType: 'saved_lead_view',
    entityId: String(view.id),
    entityTitle: name,
    details: { filters }
  });

  revalidatePath('/people');
  redirect('/people?saved=view');
}

export async function deleteSavedLeadViewAction(formData: FormData) {
  const user = await requireUser('/people');
  const id = text(formData, 'id');

  if (!id) redirect('/people?error=missing-view');
  if (!user.profileId) redirect('/people?error=profile-not-found');

  if (!isSupabaseConfigured()) {
    redirect('/people?deleted=demo-view');
  }

  const supabase = await createClient();
  const { data: view, error: viewError } = await supabase
    .from('saved_lead_views')
    .select('id,name')
    .eq('id', id)
    .eq('profile_id', user.profileId)
    .maybeSingle();

  if (viewError || !view?.id) redirect('/people?error=view-not-found');

  const { error } = await supabase
    .from('saved_lead_views')
    .delete()
    .eq('id', id)
    .eq('profile_id', user.profileId);

  if (error) redirect('/people?error=view-delete-failed');

  await recordActivityLog({
    userId: user.profileId,
    action: 'удалил сохраненный фильтр',
    entityType: 'saved_lead_view',
    entityId: id,
    entityTitle: String(view.name ?? 'Сохраненный фильтр')
  });

  revalidatePath('/people');
  redirect('/people?deleted=view');
}
