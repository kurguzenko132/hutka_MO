'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { requireUser } from '@/lib/permissions';
import { normalizeRole } from '@/lib/roles';
import type { MarketingProfile } from '@/lib/profile-shared';

function getText(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

function cleanTelegram(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  return trimmed.startsWith('@') ? trimmed : `@${trimmed.replace(/^https?:\/\/t\.me\//, '')}`;
}

export type ProfileMutationInput = {
  fullName: string;
  jobTitle?: string;
  avatarUrl?: string;
  phone?: string;
  telegram?: string;
  telegramChatId?: string;
  telegramNotificationsEnabled?: boolean;
  bio?: string;
};

export type ProfileMutationResult = {
  ok: boolean;
  error?: 'demo' | 'name-required' | 'save-failed' | 'profile-not-found';
  item?: MarketingProfile;
};

function mapProfile(row: Record<string, unknown>, user: Awaited<ReturnType<typeof requireUser>>): MarketingProfile {
  const text = (value: unknown, fallback = '') => typeof value === 'string' && value.trim() ? value : fallback;
  return {
    id: String(row.id),
    userId: text(row.user_id, user.id),
    email: text(row.email, user.email),
    fullName: text(row.full_name, user.fullName),
    jobTitle: text(row.job_title, 'Маркетолог'),
    role: normalizeRole(typeof row.role === 'string' ? row.role : user.role),
    avatarUrl: text(row.avatar_url),
    phone: text(row.phone),
    telegram: text(row.telegram),
    telegramChatId: text(row.telegram_chat_id),
    telegramNotificationsEnabled: Boolean(row.telegram_notifications_enabled),
    telegramLastTestAt: text(row.telegram_last_test_at),
    bio: text(row.bio),
    createdAt: text(row.created_at),
    updatedAt: text(row.updated_at),
    isDemo: false
  };
}

export async function updateOwnProfileAction(formData: FormData) {
  const result = await updateOwnProfileMutation({
    fullName: getText(formData, 'full_name'),
    jobTitle: getText(formData, 'job_title'),
    avatarUrl: getText(formData, 'avatar_url'),
    phone: getText(formData, 'phone'),
    telegram: getText(formData, 'telegram'),
    telegramChatId: getText(formData, 'telegram_chat_id'),
    telegramNotificationsEnabled: getText(formData, 'telegram_notifications_enabled') === 'on',
    bio: getText(formData, 'bio')
  });
  if (!result.ok) {
    if (result.error === 'demo') redirect('/profile?demo=1');
    redirect(`/profile?error=${result.error ?? 'save-failed'}`);
  }
  revalidatePath('/profile');
  revalidatePath('/dashboard');
  revalidatePath('/settings');
  revalidatePath('/notifications');
  redirect('/profile?saved=1');
}

export async function updateOwnProfileMutation(input: ProfileMutationInput): Promise<ProfileMutationResult> {
  const user = await requireUser('/profile');
  if (!isSupabaseConfigured()) return { ok: false, error: 'demo' };

  const fullName = input.fullName.trim();
  if (!fullName) return { ok: false, error: 'name-required' };

  const jobTitle = input.jobTitle?.trim() || 'Маркетолог';
  const avatarUrl = input.avatarUrl?.trim() || '';
  const phone = input.phone?.trim() || '';
  const telegram = cleanTelegram(input.telegram ?? '');
  const telegramChatId = input.telegramChatId?.trim() || '';
  const bio = input.bio?.trim() || '';
  const supabase = await createClient();
  const { data: profile, error } = await supabase
    .from('profiles')
    .update({
      full_name: fullName,
      job_title: jobTitle,
      avatar_url: avatarUrl || null,
      phone: phone || null,
      telegram: telegram || null,
      telegram_chat_id: telegramChatId || null,
      telegram_notifications_enabled: telegramChatId ? Boolean(input.telegramNotificationsEnabled) : false,
      bio: bio || null,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', user.id)
    .select('id,user_id,email,full_name,job_title,role,avatar_url,phone,telegram,telegram_chat_id,telegram_notifications_enabled,telegram_last_test_at,bio,created_at,updated_at')
    .maybeSingle();

  if (error) return { ok: false, error: 'save-failed' };
  if (!profile?.id) return { ok: false, error: 'profile-not-found' };
  return { ok: true, item: mapProfile(profile as Record<string, unknown>, user) };
}
