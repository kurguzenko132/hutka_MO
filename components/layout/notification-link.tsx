'use client';

import Link from 'next/link';
import { Bell } from 'lucide-react';
import { useNotificationCount } from './notification-count';

export function NotificationLink() {
  const unreadCount = useNotificationCount();

  return (
    <Link prefetch={false} href="/notifications" className="relative shrink-0 rounded-xl border border-app-line p-2 text-app-muted transition hover:bg-purple-50 hover:text-app-purple" aria-label="Уведомления">
      <Bell className="h-5 w-5" />
      {unreadCount > 0 && (
        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-app-red px-1 text-[10px] font-bold text-white">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </Link>
  );
}
