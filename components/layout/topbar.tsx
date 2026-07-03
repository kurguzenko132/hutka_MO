import Link from 'next/link';
import { Bell, LogOut, Plus, Search } from 'lucide-react';
import { signOutAction } from '@/actions/auth.actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { can, roleLabels, roleTone, type UserRole } from '@/lib/roles';
import { getInitials } from '@/lib/utils';
import { Logo } from './logo';
import { MobileNav } from './mobile-nav';

export function Topbar({
  userEmail,
  userName,
  userJobTitle,
  userAvatarUrl,
  role,
  unreadCount = 0
}: {
  userEmail?: string;
  userName?: string;
  userJobTitle?: string;
  userAvatarUrl?: string;
  role: UserRole;
  unreadCount?: number;
}) {
  const initials = getInitials(userName, 'H');

  return (
    <header className="sticky top-0 z-30 border-b border-app-line bg-white/80 backdrop-blur-xl">
      <div className="flex h-16 min-w-0 items-center gap-3 px-4 sm:gap-4 lg:px-8">
        <div className="lg:hidden">
          <Logo compact />
        </div>
        <MobileNav role={role} userName={userName} userJobTitle={userJobTitle} userAvatarUrl={userAvatarUrl} unreadCount={unreadCount} />
        <form action="/people" className="relative hidden min-w-0 flex-1 md:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-app-faint" />
          <Input name="q" className="pl-10 pr-16" placeholder="Поиск по контактам, компаниям, тегам..." />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg border border-app-line bg-slate-50 px-2 py-0.5 text-xs text-app-faint">Enter</span>
        </form>
        <Link href="/notifications" className="relative shrink-0 rounded-xl border border-app-line p-2 text-app-muted transition hover:bg-purple-50 hover:text-app-purple" aria-label="Уведомления">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-app-red px-1 text-[10px] font-bold text-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Link>
        {can(role, 'manageContacts') && (
          <Button asChild className="hidden shrink-0 sm:inline-flex">
            <Link href="/people/new">
              <Plus className="h-4 w-4" />
              Добавить контакт
            </Link>
          </Button>
        )}
        <div className="hidden min-w-0 items-center gap-2 xl:flex">
          <Badge tone={roleTone(role)}>{roleLabels[role]}</Badge>
          <Link href="/profile" className="flex max-w-[240px] items-center gap-2 rounded-xl border border-app-line bg-white px-2.5 py-1.5 text-xs transition hover:border-purple-200 hover:bg-purple-50">
            {userAvatarUrl ? (
              <img src={userAvatarUrl} alt="" className="h-7 w-7 rounded-full object-cover" />
            ) : (
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-pink-400 to-purple-600 text-[10px] font-black text-white">
                {initials}
              </span>
            )}
            <span className="min-w-0">
              <span className="block truncate font-bold text-app-text">{userName || userEmail || 'Профиль'}</span>
              <span className="block truncate text-app-muted">{userJobTitle || userEmail}</span>
            </span>
          </Link>
        </div>
        <form action={signOutAction}>
          <Button variant="ghost" aria-label="Выйти">
            <LogOut className="h-4 w-4" />
            <span className="hidden xl:inline">Выйти</span>
          </Button>
        </form>
      </div>
    </header>
  );
}
