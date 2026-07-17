import { redirect } from 'next/navigation';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { can, normalizeRole, type Permission, type UserRole } from '@/lib/roles';

export type CurrentUserContext = {
  id: string;
  email: string;
  profileId: string | null;
  fullName: string;
  jobTitle: string;
  avatarUrl: string;
  role: UserRole;
};

type ProfileRow = {
  id?: string | null;
  full_name?: string | null;
  job_title?: string | null;
  avatar_url?: string | null;
  role?: string | null;
};

export const getCurrentUserContext = cache(async (): Promise<CurrentUserContext | null> => {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const { data: userResult } = await supabase.auth.getUser();
  const user = userResult.user;
  if (!user) return null;

  let profile: ProfileRow | null = null;

  const extendedProfile = await supabase
    .from('profiles')
    .select('id, full_name, job_title, avatar_url, role')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!extendedProfile.error) {
    profile = extendedProfile.data as ProfileRow | null;
  } else {
    const fallbackProfile = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .eq('user_id', user.id)
      .maybeSingle();
    profile = (fallbackProfile.data as ProfileRow | null) ?? null;
  }

  return {
    id: user.id,
    email: user.email ?? 'Аккаунт',
    profileId: profile?.id ? String(profile.id) : null,
    fullName: profile?.full_name ? String(profile.full_name) : user.email ?? 'Аккаунт',
    jobTitle: profile?.job_title ? String(profile.job_title) : 'Маркетолог',
    avatarUrl: profile?.avatar_url ? String(profile.avatar_url) : '',
    role: profile?.role ? normalizeRole(profile.role) : 'viewer'
  };
});

export async function requireUser(nextPath = '/dashboard') {
  const context = await getCurrentUserContext();
  if (!context) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  return context;
}

export async function requirePermission(permission: Permission, redirectTo = '/dashboard?error=forbidden') {
  const context = await requireUser();
  if (!can(context.role, permission)) redirect(redirectTo);
  return context;
}

export async function requireAdmin(redirectTo = '/dashboard?error=admin-only') {
  return requirePermission('manageSettings', redirectTo);
}
