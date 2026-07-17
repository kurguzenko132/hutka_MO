'use client';

import Image from 'next/image';
import { LoaderCircle, UserRound } from 'lucide-react';
import {
  type FormEvent,
  type ReactNode,
  useRef,
  useState,
  useTransition
} from 'react';
import {
  updateAppSettingsMutation,
  updateProfileRoleMutation
} from '@/actions/settings.actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import type { AppSettings, UserDirectoryItem } from '@/lib/settings';
import {
  roleDescriptions,
  roleLabels,
  roleTone,
  type UserRole
} from '@/lib/roles';
import { getInitials } from '@/lib/utils';

const roles: UserRole[] = ['admin', 'marketer', 'viewer'];

function fieldLabel(text: string) {
  return <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-app-muted">{text}</label>;
}

function MutationButton({
  pending,
  children,
  ...props
}: React.ComponentProps<typeof Button> & { pending: boolean; children: ReactNode }) {
  return (
    <Button {...props} type="submit" disabled={props.disabled || pending} aria-busy={pending || undefined}>
      {pending && <LoaderCircle className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />}
      {children}
    </Button>
  );
}

export function SettingsGeneralWorkspace({
  app,
  initialUsers
}: {
  app: AppSettings;
  initialUsers: UserDirectoryItem[];
}) {
  const [users, setUsers] = useState(initialUsers);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [pendingKeys, setPendingKeys] = useState<string[]>([]);
  const pendingRef = useRef(new Set<string>());
  const [, startTransition] = useTransition();

  function runMutation(key: string, task: () => Promise<void>) {
    if (pendingRef.current.has(key)) return false;
    pendingRef.current.add(key);
    setPendingKeys((current) => [...current, key]);
    startTransition(async () => {
      try {
        await task();
      } finally {
        pendingRef.current.delete(key);
        setPendingKeys((current) => current.filter((item) => item !== key));
      }
    });
    return true;
  }

  function isPending(key: string) {
    return pendingKeys.includes(key);
  }

  function saveAppSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const key = 'app-settings';
    if (pendingRef.current.has(key)) return;

    runMutation(key, async () => {
      const result = await updateAppSettingsMutation({
        productName: String(formData.get('product_name') ?? ''),
        workspaceName: String(formData.get('workspace_name') ?? ''),
        defaultCity: String(formData.get('default_city') ?? ''),
        weeklyReportDay: String(formData.get('weekly_report_day') ?? '')
      });
      setNotice(result.ok
        ? { tone: 'success', text: 'Базовые настройки сохранены.' }
        : {
            tone: 'error',
            text: result.error === 'demo'
              ? 'Supabase не настроен, изменение не сохранено.'
              : 'Не удалось сохранить базовые настройки.'
          });
    });
  }

  function saveRole(event: FormEvent<HTMLFormElement>, user: UserDirectoryItem) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const requestedRole = String(formData.get('role') ?? '') as UserRole;
    const role = roles.includes(requestedRole) ? requestedRole : 'viewer';
    const key = `role:${user.id}`;
    if (pendingRef.current.has(key)) return;

    setUsers((current) => current.map((item) => (
      item.id === user.id ? { ...item, role } : item
    )));
    runMutation(key, async () => {
      const result = await updateProfileRoleMutation(user.id, role);
      if (!result.ok || !result.role) {
        setUsers((current) => current.map((item) => (
          item.id === user.id ? user : item
        )));
        setNotice({
          tone: 'error',
          text: result.error === 'demo'
            ? 'Supabase не настроен, изменение не сохранено.'
            : 'Не удалось изменить роль пользователя.'
        });
        return;
      }

      setUsers((current) => current.map((item) => (
        item.id === user.id ? { ...item, role: result.role as UserRole } : item
      )));
      setNotice({ tone: 'success', text: `Роль пользователя ${user.fullName} сохранена.` });
    });
  }

  return (
    <div className="space-y-6">
      {notice && (
        <div
          role="status"
          aria-live="polite"
          className={`rounded-xl border px-4 py-3 text-sm font-semibold ${
            notice.tone === 'error'
              ? 'border-red-100 bg-red-50 text-red-700'
              : 'border-emerald-100 bg-emerald-50 text-emerald-700'
          }`}
        >
          {notice.text}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Базовые настройки</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveAppSettings} className="grid gap-4 md:grid-cols-2">
            <div>
              {fieldLabel('Название продукта')}
              <Input name="product_name" defaultValue={app.productName} placeholder="Hutka" />
            </div>
            <div>
              {fieldLabel('Рабочее пространство')}
              <Input name="workspace_name" defaultValue={app.workspaceName} placeholder="Beauty CRM Launch" />
            </div>
            <div>
              {fieldLabel('Город по умолчанию')}
              <Input name="default_city" defaultValue={app.defaultCity} placeholder="Минск" />
            </div>
            <div>
              {fieldLabel('День недельного отчета')}
              <Select name="weekly_report_day" defaultValue={app.weeklyReportDay}>
                {['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'].map((day) => (
                  <option key={day} value={day}>{day}</option>
                ))}
              </Select>
            </div>
            <div className="md:col-span-2">
              <MutationButton pending={isPending('app-settings')}>Сохранить базовые настройки</MutationButton>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><UserRound className="h-4 w-4" /> Пользователи и роли</CardTitle>
          <p className="text-sm text-app-muted">
            Управляй доступом команды. Admin меняет настройки и роли, marketer работает с запуском, viewer только смотрит данные.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 lg:grid-cols-3">
            {roles.map((role) => (
              <div key={role} className="rounded-2xl border border-app-line bg-gradient-to-br from-white to-purple-50 p-4">
                <Badge tone={roleTone(role)}>{roleLabels[role]}</Badge>
                <p className="mt-3 text-xs leading-5 text-app-muted">{roleDescriptions[role]}</p>
              </div>
            ))}
          </div>

          <div className="space-y-3 pt-2">
            {users.length ? users.map((user) => {
              const pending = isPending(`role:${user.id}`);
              return (
                <div key={`${user.id}-${user.role}`} className="grid gap-3 rounded-2xl border border-app-line bg-white p-4 lg:grid-cols-[1fr_180px_auto] lg:items-end">
                  <div className="flex items-center gap-3">
                    {user.avatarUrl ? (
                      <Image src={user.avatarUrl} alt="" width={44} height={44} className="h-11 w-11 rounded-2xl object-cover" />
                    ) : (
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-400 to-purple-600 text-sm font-black text-white">
                        {getInitials(user.fullName, 'U')}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-app-text">{user.fullName}</p>
                      <p className="mt-1 truncate text-xs font-semibold text-app-purple">{user.jobTitle || roleLabels[user.role]}</p>
                      <p className="mt-1 truncate text-xs text-app-muted">{user.email}</p>
                      {user.createdAt && <p className="mt-1 text-[11px] text-app-faint">Создан: {new Date(user.createdAt).toLocaleDateString('ru-RU')}</p>}
                    </div>
                  </div>
                  <form onSubmit={(event) => saveRole(event, user)} className="contents">
                    <div>
                      {fieldLabel('Роль')}
                      <Select name="role" defaultValue={user.role}>
                        {roles.map((role) => <option key={role} value={role}>{roleLabels[role]}</option>)}
                      </Select>
                    </div>
                    <MutationButton variant="secondary" pending={pending}>Сохранить роль</MutationButton>
                  </form>
                </div>
              );
            }) : <p className="text-sm text-app-muted">Пользователи пока не найдены.</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
