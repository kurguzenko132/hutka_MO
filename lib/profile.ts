import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { requireUser } from '@/lib/permissions';
import { normalizeRole, type UserRole } from '@/lib/roles';

export type MarketingProfile = {
  id: string;
  userId: string;
  email: string;
  fullName: string;
  jobTitle: string;
  role: UserRole;
  avatarUrl: string;
  phone: string;
  telegram: string;
  telegramChatId: string;
  telegramNotificationsEnabled: boolean;
  telegramLastTestAt: string;
  bio: string;
  createdAt: string;
  updatedAt: string;
  isDemo: boolean;
};

function asString(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

type AuthenticatedUser = Awaited<ReturnType<typeof requireUser>>;

function buildProfileFallback(user: AuthenticatedUser, isDemo: boolean): MarketingProfile {
  return {
    id: user.profileId ?? (isDemo ? 'demo-profile' : 'missing-profile'),
    userId: user.id,
    email: user.email,
    fullName: user.fullName,
    jobTitle: user.jobTitle || 'Маркетолог',
    role: user.role,
    avatarUrl: user.avatarUrl ?? '',
    phone: '',
    telegram: '',
    telegramChatId: '',
    telegramNotificationsEnabled: false,
    telegramLastTestAt: '',
    bio: '',
    createdAt: '',
    updatedAt: '',
    isDemo
  };
}

export async function getOwnMarketingProfile(): Promise<MarketingProfile> {
  const user = await requireUser('/profile');

  if (!isSupabaseConfigured()) {
    return buildProfileFallback(user, true);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('id,user_id,email,full_name,job_title,role,avatar_url,phone,telegram,telegram_chat_id,telegram_notifications_enabled,telegram_last_test_at,bio,created_at,updated_at')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error || !data) {
    return buildProfileFallback(user, false);
  }

  return {
    id: String(data.id),
    userId: String(data.user_id),
    email: asString(data.email, user.email),
    fullName: asString(data.full_name, user.fullName),
    jobTitle: asString(data.job_title, user.jobTitle || 'Маркетолог'),
    role: normalizeRole(data.role),
    avatarUrl: asString(data.avatar_url),
    phone: asString(data.phone),
    telegram: asString(data.telegram),
    telegramChatId: asString(data.telegram_chat_id),
    telegramNotificationsEnabled: Boolean(data.telegram_notifications_enabled),
    telegramLastTestAt: asString(data.telegram_last_test_at),
    bio: asString(data.bio),
    createdAt: asString(data.created_at),
    updatedAt: asString(data.updated_at),
    isDemo: false
  };
}
