'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { requireUser } from '@/lib/permissions';

function getText(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

function cleanTelegram(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  return trimmed.startsWith('@') ? trimmed : `@${trimmed.replace(/^https?:\/\/t\.me\//, '')}`;
}

export async function updateOwnProfileAction(formData: FormData) {
  const user = await requireUser('/profile');

  if (!isSupabaseConfigured()) {
    redirect('/profile?demo=1');
  }

  const fullName = getText(formData, 'full_name');
  const jobTitle = getText(formData, 'job_title');
  const avatarUrl = getText(formData, 'avatar_url');
  const phone = getText(formData, 'phone');
  const telegram = cleanTelegram(getText(formData, 'telegram'));
  const telegramChatId = getText(formData, 'telegram_chat_id');
  const telegramNotificationsEnabled = getText(formData, 'telegram_notifications_enabled') === 'on';
  const bio = getText(formData, 'bio');

  if (!fullName) {
    redirect('/profile?error=name-required');
  }

  const supabase = await createClient();
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (profileError || !profile?.id) {
    redirect('/profile?error=profile-not-found');
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: fullName,
      job_title: jobTitle || 'Маркетолог',
      avatar_url: avatarUrl || null,
      phone: phone || null,
      telegram: telegram || null,
      telegram_chat_id: telegramChatId || null,
      telegram_notifications_enabled: telegramChatId ? telegramNotificationsEnabled : false,
      bio: bio || null,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', user.id);

  if (error) {
    redirect('/profile?error=save-failed');
  }

  revalidatePath('/profile');
  revalidatePath('/dashboard');
  revalidatePath('/settings');
  revalidatePath('/notifications');
  redirect('/profile?saved=1');
}
