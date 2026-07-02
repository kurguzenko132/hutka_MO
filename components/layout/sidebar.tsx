'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { navItems } from '@/lib/data';
import { cn } from '@/lib/utils';
import { Logo } from './logo';

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-40 hidden h-screen w-72 border-r border-app-line bg-white/80 px-4 py-5 backdrop-blur-xl lg:block">
      <div className="mb-8 px-2">
        <Logo />
      </div>

      <nav className="space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'group flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-semibold transition',
                active ? 'bg-purple-50 text-app-purple' : 'text-app-muted hover:bg-slate-50 hover:text-app-text'
              )}
            >
              <span className="flex items-center gap-3">
                <Icon className="h-4 w-4" />
                {item.title}
              </span>
              {item.badge && <span className="rounded-full bg-app-red px-2 py-0.5 text-[10px] font-bold text-white">{item.badge}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="absolute bottom-5 left-4 right-4 rounded-2xl border border-app-line bg-gradient-to-br from-white to-purple-50 p-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-pink-400 to-purple-600 text-sm font-bold text-white">ДК</div>
          <div>
            <p className="text-sm font-bold text-app-text">Даниил</p>
            <p className="text-xs text-app-muted">Маркетолог</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
