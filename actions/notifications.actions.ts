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

export type NotificationMutationResult = {
  ok: boolean;
  error?: string;
};

async function markNotificationsReadCore(profileId: string, eventKeys: string[]): Promise<NotificationMutationResult> {
  const uniqueKeys = Array.from(new Set(eventKeys.map((key) => key.trim()).filter(Boolean)));
  if (uniqueKeys.length === 0) return { ok: true };
  if (!isSupabaseConfigured()) return { ok: true };

  const now = new Date().toISOString();
  const rows = uniqueKeys.map((eventKey) => ({ profile_id: profileId, event_key: eventKey, read_at: now }));

  const supabase = await createClient();
  const { error } = await supabase.from('notification_reads').upsert(rows, { onConflict: 'profile_id,event_key' });

  if (error) return { ok: false, error: 'notification-read-failed' };
  return { ok: true };
}

function revalidateNotificationPages() {
  revalidatePath('/notifications');
  revalidatePath('/dashboard');
}

export async function markNotificationReadMutationAction(input: { eventKey: string }): Promise<NotificationMutationResult> {
  const user = await requireUser('/notifications');
  if (!user.profileId) return { ok: false, error: 'profile-not-found' };
  return markNotificationsReadCore(user.profileId, [input.eventKey]);
}

export async function markAllNotificationsReadMutationAction(input: { eventKeys: string[] }): Promise<NotificationMutationResult> {
  const user = await requireUser('/notifications');
  if (!user.profileId) return { ok: false, error: 'profile-not-found' };
  return markNotificationsReadCore(user.profileId, input.eventKeys);
}

export async function markNotificationReadAction(formData: FormData) {
  const eventKey = getText(formData, 'event_key');
  const returnTo = getSafeRedirectPath(getText(formData, 'return_to'), '/notifications');
  if (!eventKey || !isSupabaseConfigured()) redirect(returnTo);

  const user = await requireUser('/notifications');
  if (!user.profileId) redirect(returnTo);
  const result = await markNotificationsReadCore(user.profileId, [eventKey]);
  if (!result.ok) redirect(withRedirectQuery(returnTo, { error: result.error ?? 'notification-read-failed' }, '/notifications'));
  revalidateNotificationPages();
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

  const result = await markNotificationsReadCore(user.profileId, eventKeys);
  if (!result.ok) redirect(withRedirectQuery(returnTo, { error: result.error ?? 'notification-read-failed' }, '/notifications'));
  revalidateNotificationPages();
  redirect(returnTo);
}
