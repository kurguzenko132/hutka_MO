import type { UserRole } from '@/lib/roles';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';
import { NotificationCountProvider } from './notification-count';

export function AppShell({
  children,
  userEmail,
  userName,
  userJobTitle,
  userAvatarUrl,
  role
}: {
  children: React.ReactNode;
  userEmail?: string;
  userName?: string;
  userJobTitle?: string;
  userAvatarUrl?: string;
  role: UserRole;
}) {
  return (
    <NotificationCountProvider>
    <div className="min-h-screen bg-app-bg">
      <a href="#content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-xl focus:bg-app-purple focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-white">Перейти к содержимому</a>
      <Sidebar role={role} userName={userName} userJobTitle={userJobTitle} userAvatarUrl={userAvatarUrl} />
      <div className="min-w-0 overflow-x-hidden lg:pl-72">
        <Topbar userEmail={userEmail} userName={userName} userJobTitle={userJobTitle} userAvatarUrl={userAvatarUrl} role={role} />
        <main id="content" className="min-w-0 overflow-x-hidden px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-8 lg:pt-6">{children}</main>
      </div>
    </div>
    </NotificationCountProvider>
  );
}
