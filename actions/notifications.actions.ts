'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { requireUser } from '@/lib/permissions';
import { getSafeRedirectPath, withRedirectQuery } from '@/lib/auth';

function getText(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

export async function markNotificationReadAction(formData: FormData) {
  const eventKey = getText(formData, 'event_key');
  const returnTo = getSafeRedirectPath(getText(formData, 'return_to'), '/notifications');

  if (!eventKey || !isSupabaseConfigured()) {
    redirect(returnTo);
  }

  const user = await requireUser('/notifications');
  if (!user.profileId) redirect(returnTo);

  const supabase = await createClient();
  const { error } = await supabase.from('notification_reads').upsert(
    {
      profile_id: user.profileId,
      event_key: eventKey,
      read_at: new Date().toISOString()
    },
    { onConflict: 'profile_id,event_key' }
  );

  if (error) redirect(withRedirectQuery(returnTo, { error: 'notification-read-failed' }, '/notifications'));

  revalidatePath('/notifications');
  revalidatePath('/dashboard');
  redirect(returnTo);
}

export async function markAllNotificationsReadAction(formData: FormData) {
  const returnTo = getSafeRedirectPath(getText(formData, 'return_to'), '/notifications');
  const eventKeys = formData.getAll('event_key').map((value) => String(value).trim()).filter(Boolean);

  if (eventKeys.length === 0 || !isSupabaseConfigured()) {
    redirect(returnTo);
  }

  const user = await requireUser('/notifications');
  if (!user.profileId) redirect(returnTo);

  const now = new Date().toISOString();
  const rows = eventKeys.map((eventKey) => ({ profile_id: user.profileId, event_key: eventKey, read_at: now }));

  const supabase = await createClient();
  const { error } = await supabase.from('notification_reads').upsert(rows, { onConflict: 'profile_id,event_key' });

  if (error) redirect(withRedirectQuery(returnTo, { error: 'notification-read-failed' }, '/notifications'));

  revalidatePath('/notifications');
  revalidatePath('/dashboard');
  redirect(returnTo);
}
