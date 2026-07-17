'use client';

import Link from 'next/link';
import Image from 'next/image';
import Form from 'next/form';
import { LogOut, Plus, Search } from 'lucide-react';
import { signOutAction } from '@/actions/auth.actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SubmitButton } from '@/components/ui/submit-button';
import { Input } from '@/components/ui/input';
import { can, roleLabels, roleTone, type UserRole } from '@/lib/roles';
import { getInitials } from '@/lib/utils';
import { Logo } from './logo';
import { MobileNav } from './mobile-nav';
import { NotificationLink } from './notification-link';
import { useProfilePresentation } from './profile-presentation';

export function Topbar({
  userEmail,
  userName,
  userJobTitle,
  userAvatarUrl,
  role
}: {
  userEmail?: string;
  userName?: string;
  userJobTitle?: string;
  userAvatarUrl?: string;
  role: UserRole;
}) {
  const profile = useProfilePresentation({ fullName: userName, jobTitle: userJobTitle, avatarUrl: userAvatarUrl });
  const initials = getInitials(profile.fullName, 'H');

  return (
    <header className="sticky top-0 z-30 border-b border-app-line bg-white">
      <div className="flex h-16 min-w-0 items-center gap-3 px-4 sm:gap-4 lg:px-8">
        <div className="lg:hidden">
          <Logo compact />
        </div>
        <MobileNav role={role} userName={profile.fullName} userJobTitle={profile.jobTitle} userAvatarUrl={profile.avatarUrl} />
        <Form action="/people" prefetch={false} className="relative hidden min-w-0 flex-1 md:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-app-faint" />
          <Input name="q" className="pl-10 pr-16" placeholder="Поиск по контактам, компаниям, тегам..." />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg border border-app-line bg-slate-50 px-2 py-0.5 text-xs text-app-faint">Enter</span>
        </Form>
        <NotificationLink />
        {can(role, 'manageContacts') && (
          <Button asChild className="hidden shrink-0 sm:inline-flex">
            <Link prefetch={false} href="/people/new">
              <Plus className="h-4 w-4" />
              Добавить контакт
            </Link>
          </Button>
        )}
        <div className="hidden min-w-0 items-center gap-2 xl:flex">
          <Badge tone={roleTone(role)}>{roleLabels[role]}</Badge>
          <Link prefetch={false} href="/profile" className="flex max-w-[240px] items-center gap-2 rounded-xl border border-app-line bg-white px-2.5 py-1.5 text-xs transition hover:border-purple-200 hover:bg-purple-50">
            {profile.avatarUrl ? (
              <Image src={profile.avatarUrl} alt="" width={28} height={28} className="h-7 w-7 rounded-full object-cover" />
            ) : (
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-pink-400 to-purple-600 text-[10px] font-black text-white">
                {initials}
              </span>
            )}
            <span className="min-w-0">
              <span className="block truncate font-bold text-app-text">{profile.fullName || userEmail || 'Профиль'}</span>
              <span className="block truncate text-app-muted">{profile.jobTitle || userEmail}</span>
            </span>
          </Link>
        </div>
        <form action={signOutAction}>
          <SubmitButton variant="ghost" aria-label="Выйти">
            <LogOut className="h-4 w-4" />
            <span className="hidden xl:inline">Выйти</span>
          </SubmitButton>
        </form>
      </div>
    </header>
  );
}
