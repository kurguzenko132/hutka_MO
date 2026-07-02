import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { can, normalizeRole, type Permission, type UserRole } from '@/lib/roles';

export type CurrentUserContext = {
  id: string;
  email: string;
  profileId: string | null;
  fullName: string;
  role: UserRole;
};

export async function getCurrentUserContext(): Promise<CurrentUserContext | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const { data: userResult } = await supabase.auth.getUser();
  const user = userResult.user;
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .eq('user_id', user.id)
    .maybeSingle();

  return {
    id: user.id,
    email: user.email ?? 'Аккаунт',
    profileId: profile?.id ? String(profile.id) : null,
    fullName: profile?.full_name ? String(profile.full_name) : user.email ?? 'Аккаунт',
    role: profile?.role ? normalizeRole(profile.role) : 'viewer'
  };
}

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
