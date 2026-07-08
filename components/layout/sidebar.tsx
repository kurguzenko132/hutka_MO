'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Settings } from 'lucide-react';
import { navItems } from '@/lib/data';
import { can, roleLabels, type UserRole } from '@/lib/roles';
import { getInitials } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { Logo } from './logo';

export function Sidebar({
  role,
  userName,
  userJobTitle,
  userAvatarUrl
}: {
  role: UserRole;
  userName?: string;
  userJobTitle?: string;
  userAvatarUrl?: string;
}) {
  const pathname = usePathname();
  const visibleItems = navItems.filter((item) => {
    const adminOnly = item.href === '/settings' || item.href === '/quality' || item.href === '/launch' || item.href === '/qa';
    return !adminOnly || can(role, 'manageSettings');
  });
  const initials = getInitials(userName, 'H');

  return (
    <aside className="fixed left-0 top-0 z-40 hidden h-screen w-72 border-r border-app-line bg-white px-4 py-5  lg:block">
      <div className="mb-8 px-2">
        <Logo />
      </div>

      <nav className="space-y-1">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              prefetch={false}
              href={item.href}
              className={cn(
                'group flex min-w-0 items-center justify-between rounded-xl px-3 py-2.5 text-sm font-semibold transition',
                active ? 'bg-purple-50 text-app-purple' : 'text-app-muted hover:bg-slate-50 hover:text-app-text'
              )}
            >
              <span className="flex min-w-0 items-center gap-3">
                <Icon className="h-4 w-4" />
                <span className="truncate">{item.title}</span>
              </span>
              {item.badge && <span className="rounded-full bg-app-red px-2 py-0.5 text-[10px] font-bold text-white">{item.badge}</span>}
            </Link>
          );
        })}
      </nav>

      <Link
        prefetch={false}
        href="/profile"
        className={cn(
          'absolute bottom-5 left-4 right-4 rounded-2xl border border-app-line bg-gradient-to-br from-white to-purple-50 p-3 transition hover:border-purple-200 hover:shadow-card',
          pathname === '/profile' ? 'border-purple-200 ring-4 ring-purple-50' : ''
        )}
      >
        <div className="flex items-center gap-3">
          {userAvatarUrl ? (
            <Image src={userAvatarUrl} alt="" width={40} height={40} unoptimized className="h-10 w-10 rounded-full object-cover" />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-pink-400 to-purple-600 text-sm font-bold text-white">
              {initials}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-app-text">{userName ?? 'Hutka'}</p>
            <p className="truncate text-xs text-app-muted">{userJobTitle || roleLabels[role]}</p>
          </div>
          <Settings className="h-4 w-4 shrink-0 text-app-faint" />
        </div>
      </Link>
    </aside>
  );
}
