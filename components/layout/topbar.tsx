import Link from 'next/link';
import { Bell, LogOut, Plus, Search } from 'lucide-react';
import { signOutAction } from '@/actions/auth.actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { can, roleLabels, roleTone, type UserRole } from '@/lib/roles';
import { Logo } from './logo';
import { MobileNav } from './mobile-nav';

export function Topbar({ userEmail, role, unreadCount = 0 }: { userEmail?: string; role: UserRole; unreadCount?: number }) {
  return (
    <header className="sticky top-0 z-30 border-b border-app-line bg-white/80 backdrop-blur-xl">
      <div className="flex h-16 items-center gap-4 px-4 lg:px-8">
        <div className="lg:hidden">
          <Logo compact />
        </div>
        <MobileNav role={role} unreadCount={unreadCount} />
        <form action="/people" className="relative hidden flex-1 md:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-app-faint" />
          <Input name="q" className="pl-10 pr-16" placeholder="Поиск по контактам, компаниям, тегам..." />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg border border-app-line bg-slate-50 px-2 py-0.5 text-xs text-app-faint">Enter</span>
        </form>
        <Link href="/notifications" className="relative rounded-xl border border-app-line p-2 text-app-muted transition hover:bg-purple-50 hover:text-app-purple" aria-label="Уведомления">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-app-red px-1 text-[10px] font-bold text-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Link>
        {can(role, 'manageContacts') && (
          <Button asChild className="hidden sm:inline-flex">
            <Link href="/people/new">
              <Plus className="h-4 w-4" />
              Добавить контакт
            </Link>
          </Button>
        )}
        <div className="hidden items-center gap-2 xl:flex">
          <Badge tone={roleTone(role)}>{roleLabels[role]}</Badge>
          {userEmail && (
            <div className="max-w-[180px] truncate rounded-xl border border-app-line bg-white px-3 py-2 text-xs font-bold text-app-muted">
              {userEmail}
            </div>
          )}
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
