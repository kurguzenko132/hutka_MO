'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { requireUser } from '@/lib/permissions';
import type { LeadFilters } from '@/lib/leads';

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
  const { error } = await supabase.from('saved_lead_views').insert({
    profile_id: user.profileId,
    name,
    filters
  });

  if (error) redirect('/people?error=view-save-failed');

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
  const { error } = await supabase
    .from('saved_lead_views')
    .delete()
    .eq('id', id)
    .eq('profile_id', user.profileId);

  if (error) redirect('/people?error=view-delete-failed');

  revalidatePath('/people');
  redirect('/people?deleted=view');
}
