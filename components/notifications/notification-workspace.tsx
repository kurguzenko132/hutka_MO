'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  BellRing,
  Check,
  CheckCircle2,
  ClipboardList,
  LoaderCircle,
  Megaphone,
  MessageSquareText,
  Timer,
  Users
} from 'lucide-react';
import {
  markAllNotificationsReadMutationAction,
  markNotificationReadMutationAction
} from '@/actions/notifications.actions';
import { NotificationCountSync } from '@/components/layout/notification-count';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type {
  NotificationCategory,
  NotificationTone,
  WorkspaceNotification
} from '@/lib/notifications';

const categoryLabel: Record<NotificationCategory, string> = {
  followup: 'Что сделать',
  survey: 'Анкета',
  activity: 'Активность',
  contact: 'Контакт',
  campaign: 'Кампания'
};

const categoryIcon = {
  followup: Timer,
  survey: ClipboardList,
  activity: MessageSquareText,
  contact: Users,
  campaign: Megaphone
} satisfies Record<NotificationCategory, typeof Timer>;

const toneToBadge: Record<NotificationTone, BadgeTone> = {
  red: 'red',
  yellow: 'yellow',
  blue: 'blue',
  purple: 'purple',
  green: 'green',
  pink: 'pink',
  gray: 'gray'
};

function notificationStats(items: WorkspaceNotification[]) {
  return {
    total: items.length,
    unread: items.filter((item) => item.unread).length,
    urgent: items.filter((item) => item.urgent).length,
    overdueFollowUps: items.filter((item) => item.category === 'followup' && item.urgent).length,
    surveyResponses: items.filter((item) => item.category === 'survey').length,
    hotContacts: items.filter((item) => item.category === 'contact').length
  };
}

function StatCard({ label, value, tone }: { label: string; value: number; tone: BadgeTone }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-app-muted">{label}</p>
          <p className="mt-2 text-3xl font-black text-app-text">{value}</p>
        </div>
        <Badge tone={tone}>события</Badge>
      </CardContent>
    </Card>
  );
}

function NotificationItem({
  item,
  pending,
  onRead
}: {
  item: WorkspaceNotification;
  pending: boolean;
  onRead: (item: WorkspaceNotification) => void;
}) {
  const Icon = categoryIcon[item.category];

  return (
    <div className="performance-contain group rounded-2xl border border-app-line bg-white p-4 transition hover:border-purple-200 hover:bg-purple-50/40">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <Link prefetch={false} href={item.href} className="flex min-w-0 flex-1 gap-4">
          <div className="relative mt-0.5">
            <div className="rounded-2xl bg-purple-50 p-3 text-app-purple">
              <Icon className="h-5 w-5" />
            </div>
            {item.unread && <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-app-red ring-2 ring-white" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={toneToBadge[item.tone]}>{categoryLabel[item.category]}</Badge>
              {item.urgent && <Badge tone="red">срочно</Badge>}
              {item.unread ? <Badge tone="pink">новое</Badge> : <Badge tone="gray">прочитано</Badge>}
            </div>
            <div className="mt-3 flex items-start justify-between gap-3">
              <h3 className="text-base font-black text-app-text">{item.title}</h3>
              <span className="whitespace-nowrap text-xs font-semibold text-app-faint">{item.date}</span>
            </div>
            <p className="mt-2 line-clamp-2 text-sm leading-6 text-app-muted">{item.description}</p>
          </div>
          <ArrowRight className="mt-4 hidden h-5 w-5 text-app-faint transition group-hover:text-app-purple lg:block" />
        </Link>

        {item.unread && (
          <Button type="button" variant="secondary" size="sm" disabled={pending} onClick={() => onRead(item)}>
            {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Прочитано
          </Button>
        )}
      </div>
    </div>
  );
}

function EmptyState({ canManageContacts, canManageTasks }: { canManageContacts: boolean; canManageTasks: boolean }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-16 text-center">
        <div className="rounded-3xl bg-purple-50 p-5 text-app-purple">
          <BellRing className="h-9 w-9" />
        </div>
        <h2 className="mt-5 text-xl font-black text-app-text">Пока нет событий</h2>
        <p className="mt-2 max-w-xl text-sm leading-6 text-app-muted">
          Здесь появятся новые ответы на анкеты, просроченные действия, заинтересованные контакты, действия по карточкам и результаты кампаний.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button asChild>
            <Link prefetch={false} href={canManageContacts ? '/people/new' : '/people'}>{canManageContacts ? 'Добавить контакт' : 'Открыть контакты'}</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link prefetch={false} href={canManageTasks ? '/tasks/new' : '/tasks'}>{canManageTasks ? 'Создать задачу' : 'Открыть задачи'}</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ActionMessage({ text, error }: { text: string; error: boolean }) {
  return (
    <div
      aria-live="polite"
      className={`mb-6 flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold ${
        error ? 'border-red-100 bg-red-50 text-red-700' : 'border-emerald-100 bg-emerald-50 text-emerald-700'
      }`}
    >
      {error ? <AlertTriangle className="h-4 w-4 shrink-0" /> : <Check className="h-4 w-4 shrink-0" />}
      <span>{text}</span>
    </div>
  );
}

export function NotificationWorkspace({
  initialNotifications,
  demoMode,
  canManageContacts,
  canManageTasks,
  initialError
}: {
  initialNotifications: WorkspaceNotification[];
  demoMode: boolean;
  canManageContacts: boolean;
  canManageTasks: boolean;
  initialError?: string;
}) {
  const [items, setItems] = useState(initialNotifications);
  const [pendingKeys, setPendingKeys] = useState<string[]>([]);
  const [allPending, setAllPending] = useState(false);
  const [notice, setNotice] = useState(initialError ? 'Не удалось отметить уведомления прочитанными. Проверь Supabase/RLS и попробуй еще раз.' : '');
  const [noticeError, setNoticeError] = useState(Boolean(initialError));
  const stats = useMemo(() => notificationStats(items), [items]);
  const unreadItems = items.filter((item) => item.unread);
  const urgentItems = items.filter((item) => item.urgent);
  const otherItems = items.filter((item) => !item.urgent);

  async function markRead(item: WorkspaceNotification) {
    if (!item.unread || allPending || pendingKeys.includes(item.key)) return;

    setPendingKeys((current) => [...current, item.key]);
    setItems((current) => current.map((entry) => entry.key === item.key ? { ...entry, unread: false } : entry));
    setNotice('Сохраняю прочтение...');
    setNoticeError(false);

    try {
      const result = await markNotificationReadMutationAction({ eventKey: item.key });
      if (!result.ok) {
        setItems((current) => current.map((entry) => entry.key === item.key ? { ...entry, unread: true } : entry));
        setNotice('Не удалось отметить событие прочитанным. Изменение отменено.');
        setNoticeError(true);
      } else {
        setNotice('Событие отмечено прочитанным.');
      }
    } catch {
      setItems((current) => current.map((entry) => entry.key === item.key ? { ...entry, unread: true } : entry));
      setNotice('Не удалось связаться с сервером. Изменение отменено.');
      setNoticeError(true);
    } finally {
      setPendingKeys((current) => current.filter((key) => key !== item.key));
    }
  }

  async function markAllRead() {
    const keys = unreadItems.map((item) => item.key);
    if (keys.length === 0 || allPending) return;

    setAllPending(true);
    setItems((current) => current.map((item) => ({ ...item, unread: false })));
    setNotice('Отмечаю все события прочитанными...');
    setNoticeError(false);

    try {
      const result = await markAllNotificationsReadMutationAction({ eventKeys: keys });
      if (!result.ok) {
        const keySet = new Set(keys);
        setItems((current) => current.map((item) => keySet.has(item.key) ? { ...item, unread: true } : item));
        setNotice('Не удалось отметить все события прочитанными. Изменение отменено.');
        setNoticeError(true);
      } else {
        setNotice('Все события отмечены прочитанными.');
      }
    } catch {
      const keySet = new Set(keys);
      setItems((current) => current.map((item) => keySet.has(item.key) ? { ...item, unread: true } : item));
      setNotice('Не удалось связаться с сервером. Изменение отменено.');
      setNoticeError(true);
    } finally {
      setAllPending(false);
    }
  }

  return (
    <>
      <NotificationCountSync count={stats.unread} />

      {notice ? <ActionMessage text={notice} error={noticeError} /> : null}

      {demoMode && (
        <div className="mb-6 rounded-2xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
          Демо-режим: подключи Supabase и создай первые контакты, задачи и анкеты, чтобы видеть реальные события.
        </div>
      )}

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Всего событий" value={stats.total} tone="purple" />
        <StatCard label="Новые" value={stats.unread} tone="pink" />
        <StatCard label="Срочные" value={stats.urgent} tone="red" />
        <StatCard label="Ответы на анкеты" value={stats.surveyResponses} tone="blue" />
        <StatCard label="Заинтересованные" value={stats.hotContacts} tone="green" />
      </div>

      <div className="mb-6 flex flex-col justify-between gap-3 rounded-2xl border border-app-line bg-white p-4 sm:flex-row sm:items-center">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-red-50 p-2 text-app-red">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <p className="font-black text-app-text">Фокус дня</p>
            <p className="text-sm text-app-muted">
              {stats.overdueFollowUps > 0
                ? `Сначала закрой ${stats.overdueFollowUps} просроченных действий.`
                : stats.unread > 0
                  ? `Разбери ${stats.unread} новых событий и назначь следующие шаги.`
                  : 'Критичных уведомлений нет. Можно работать с новыми контактами и кампаниями.'}
            </p>
          </div>
        </div>

        {unreadItems.length > 0 && (
          <Button type="button" variant="secondary" disabled={allPending} onClick={() => void markAllRead()}>
            {allPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Прочитать все
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <EmptyState canManageContacts={canManageContacts} canManageTasks={canManageTasks} />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
          <div className="space-y-4">
            {urgentItems.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Срочные события</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {urgentItems.map((item) => (
                    <NotificationItem
                      key={item.key}
                      item={item}
                      pending={allPending || pendingKeys.includes(item.key)}
                      onRead={(entry) => void markRead(entry)}
                    />
                  ))}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Лента событий</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {otherItems.map((item) => (
                  <NotificationItem
                    key={item.key}
                    item={item}
                    pending={allPending || pendingKeys.includes(item.key)}
                    onRead={(entry) => void markRead(entry)}
                  />
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Что отслеживается</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-app-muted">
                <p>• просроченные и ближайшие задачи;</p>
                <p>• новые ответы на анкеты;</p>
                <p>• последние действия в карточках контактов;</p>
                <p>• заинтересованные контакты с высоким приоритетом;</p>
                <p>• активные кампании с набранными контактами.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Быстрые действия</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3">
                <Button asChild variant="secondary">
                  <Link prefetch={false} href="/tasks">Открыть задачи</Link>
                </Button>
                <Button asChild variant="secondary">
                  <Link prefetch={false} href="/surveys">Открыть анкеты</Link>
                </Button>
                <Button asChild variant="secondary">
                  <Link prefetch={false} href="/people?view=interested">Заинтересованные контакты</Link>
                </Button>
                <Button asChild variant="secondary">
                  <Link prefetch={false} href="/campaigns">Кампании</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
