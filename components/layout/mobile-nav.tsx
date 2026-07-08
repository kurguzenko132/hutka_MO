'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Menu, Plus, Settings, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { navItems } from '@/lib/data';
import { can, roleLabels, type UserRole } from '@/lib/roles';
import { getInitials } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { Logo } from './logo';

const bottomNavHrefs = ['/dashboard', '/people', '/tasks', '/notifications'];

export function MobileNav({
  role,
  userName,
  userJobTitle,
  userAvatarUrl,
  unreadCount = 0
}: {
  role: UserRole;
  userName?: string;
  userJobTitle?: string;
  userAvatarUrl?: string;
  unreadCount?: number;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const initials = getInitials(userName, 'H');

  const visibleItems = useMemo(
    () =>
      navItems.filter((item) => {
        const adminOnly = item.href === '/settings' || item.href === '/quality' || item.href === '/launch' || item.href === '/qa';
        return !adminOnly || can(role, 'manageSettings');
      }),
    [role]
  );

  const bottomItems = visibleItems.filter((item) => bottomNavHrefs.includes(item.href));

  return (
    <>
      <button
        type="button"
        className="rounded-xl border border-app-line bg-white p-2 text-app-muted transition hover:border-purple-200 hover:bg-purple-50 hover:text-app-purple lg:hidden"
        aria-label="Открыть меню"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <Menu className="h-5 w-5" />
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/40 "
            aria-label="Закрыть меню"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 top-0 flex h-full w-[86vw] max-w-sm flex-col border-r border-app-line bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-app-line px-4 py-4">
              <Logo />
              <button
                type="button"
                className="rounded-xl border border-app-line p-2 text-app-muted transition hover:bg-purple-50 hover:text-app-purple"
                aria-label="Закрыть меню"
                onClick={() => setOpen(false)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="scrollbar-thin flex-1 overflow-y-auto px-4 py-4">
              <Link
                prefetch={false}
                href="/profile"
                onClick={() => setOpen(false)}
                className={cn(
                  'mb-4 flex items-center gap-3 rounded-2xl border border-purple-100 bg-gradient-to-br from-purple-50 to-pink-50 p-4 transition hover:border-purple-200',
                  pathname === '/profile' ? 'ring-4 ring-purple-50' : ''
                )}
              >
                {userAvatarUrl ? (
                  <Image src={userAvatarUrl} alt="" width={48} height={48} unoptimized className="h-12 w-12 rounded-2xl object-cover" />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-400 to-purple-600 text-sm font-black text-white">
                    {initials}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black text-app-text">{userName || 'Профиль'}</p>
                  <p className="truncate text-xs font-semibold text-app-purple">{userJobTitle || roleLabels[role]}</p>
                  <p className="mt-1 text-[11px] text-app-muted">Системная роль: {roleLabels[role]}</p>
                </div>
                <Settings className="h-4 w-4 shrink-0 text-app-faint" />
              </Link>

              <nav className="space-y-1">
                {visibleItems.map((item) => {
                  const Icon = item.icon;
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

                  return (
                    <Link
                      key={item.href}
                      prefetch={false}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        'flex items-center justify-between rounded-2xl px-3 py-3 text-sm font-bold transition',
                        active ? 'bg-purple-50 text-app-purple' : 'text-app-muted hover:bg-slate-50 hover:text-app-text'
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <Icon className="h-5 w-5 shrink-0" />
                        <span className="truncate">{item.title}</span>
                      </span>
                      {item.href === '/notifications' && unreadCount > 0 ? (
                        <span className="rounded-full bg-app-red px-2 py-0.5 text-[10px] font-black text-white">{unreadCount > 99 ? '99+' : unreadCount}</span>
                      ) : null}
                    </Link>
                  );
                })}
              </nav>
            </div>

            {can(role, 'manageContacts') ? (
              <div className="border-t border-app-line p-4">
                <Button asChild className="w-full" size="lg">
                  <Link prefetch={false} href="/people/new" onClick={() => setOpen(false)}>
                    <Plus className="h-4 w-4" />
                    Добавить контакт
                  </Link>
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-app-line bg-white px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 shadow-[0_-12px_40px_rgba(17,24,39,0.08)]  lg:hidden">
        <div className="grid grid-cols-4 gap-1">
          {bottomItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const isNotifications = item.href === '/notifications';

            return (
              <Link
                key={item.href}
                prefetch={false}
                href={item.href}
                className={cn(
                  'relative flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-black transition',
                  active ? 'bg-purple-50 text-app-purple' : 'text-app-muted hover:bg-slate-50 hover:text-app-text'
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="truncate">{item.title}</span>
                {isNotifications && unreadCount > 0 ? (
                  <span className="absolute right-4 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-app-red px-1 text-[9px] font-black text-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
