import { redirect } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import { buildLoginPath } from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { getCurrentUserContext } from '@/lib/permissions';
import { getUnreadNotificationCount } from '@/lib/notifications';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured()) {
    redirect(buildLoginPath('/dashboard', 'config'));
  }

  const user = await getCurrentUserContext();

  if (!user) {
    redirect('/login');
  }

  const unreadCount = await getUnreadNotificationCount();

  return (
    <AppShell userEmail={user.email} userName={user.fullName} userJobTitle={user.jobTitle} userAvatarUrl={user.avatarUrl} role={user.role} unreadCount={unreadCount}>
      {children}
    </AppShell>
  );
}
