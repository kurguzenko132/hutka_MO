import Link from 'next/link';
import { AlertTriangle, ArrowRight, BellRing, CheckCircle2, ClipboardList, Megaphone, MessageSquareText, Timer, Users } from 'lucide-react';
import { markAllNotificationsReadAction, markNotificationReadAction } from '@/actions/notifications.actions';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/layout/page-header';
import { getNotificationCenterData, type NotificationCategory, type NotificationTone, type WorkspaceNotification } from '@/lib/notifications';
import { getCurrentUserContext } from '@/lib/permissions';
import { can } from '@/lib/roles';

const categoryLabel: Record<NotificationCategory, string> = {
  followup: 'Follow-up',
  survey: 'Опрос',
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

function NotificationItem({ item }: { item: WorkspaceNotification }) {
  const Icon = categoryIcon[item.category];

  return (
    <div className="group rounded-2xl border border-app-line bg-white p-4 transition hover:border-purple-200 hover:bg-purple-50/40">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <Link href={item.href} className="flex min-w-0 flex-1 gap-4">
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
          <form action={markNotificationReadAction}>
            <input type="hidden" name="event_key" value={item.key} />
            <input type="hidden" name="return_to" value="/notifications" />
            <Button variant="secondary" size="sm">
              <CheckCircle2 className="h-4 w-4" />
              Прочитано
            </Button>
          </form>
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
          Здесь появятся новые ответы на опросы, просроченные follow-up, горячие контакты, действия по карточкам и результаты кампаний.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button asChild>
            <Link href={canManageContacts ? '/people/new' : '/people'}>{canManageContacts ? 'Добавить контакт' : 'Открыть контакты'}</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href={canManageTasks ? '/tasks/new' : '/tasks'}>{canManageTasks ? 'Создать задачу' : 'Открыть задачи'}</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Notice({ error }: { error?: string }) {
  if (!error) return null;

  const message = error === 'notification-read-failed'
    ? 'Не удалось отметить уведомления прочитанными. Проверь Supabase/RLS и попробуй еще раз.'
    : 'Не удалось выполнить действие с уведомлениями.';

  return (
    <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
      <AlertTriangle className="mt-0.5 h-4 w-4" />
      <span>{message}</span>
    </div>
  );
}

export default async function NotificationsPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const [data, currentUser, params] = await Promise.all([
    getNotificationCenterData(),
    getCurrentUserContext(),
    searchParams
  ]);
  const currentRole = currentUser?.role ?? 'viewer';
  const canManageContacts = can(currentRole, 'manageContacts');
  const canManageTasks = can(currentRole, 'manageTasks');
  const unreadItems = data.notifications.filter((item) => item.unread);
  const urgentItems = data.notifications.filter((item) => item.urgent);
  const otherItems = data.notifications.filter((item) => !item.urgent);

  return (
    <div>
      <PageHeader
        title="Уведомления"
        subtitle="Центр событий: follow-up, ответы на опросы, горячие контакты и важные изменения в запуске."
      />

      <Notice error={typeof params?.error === 'string' ? params.error : undefined} />

      {data.demoMode && (
        <div className="mb-6 rounded-2xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
          Демо-режим: подключи Supabase и создай первые контакты, задачи и опросы, чтобы видеть реальные события.
        </div>
      )}

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Всего событий" value={data.stats.total} tone="purple" />
        <StatCard label="Новые" value={data.stats.unread} tone="pink" />
        <StatCard label="Срочные" value={data.stats.urgent} tone="red" />
        <StatCard label="Ответы на опросы" value={data.stats.surveyResponses} tone="blue" />
        <StatCard label="Горячие контакты" value={data.stats.hotContacts} tone="green" />
      </div>

      <div className="mb-6 flex flex-col justify-between gap-3 rounded-2xl border border-app-line bg-white p-4 sm:flex-row sm:items-center">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-red-50 p-2 text-app-red">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <p className="font-black text-app-text">Фокус дня</p>
            <p className="text-sm text-app-muted">
              {data.stats.overdueFollowUps > 0
                ? `Сначала закрой ${data.stats.overdueFollowUps} просроченных follow-up.`
                : data.stats.unread > 0
                  ? `Разбери ${data.stats.unread} новых событий и назначь следующие шаги.`
                  : 'Критичных уведомлений нет. Можно работать с новыми контактами и кампаниями.'}
            </p>
          </div>
        </div>

        {unreadItems.length > 0 && (
          <form action={markAllNotificationsReadAction}>
            <input type="hidden" name="return_to" value="/notifications" />
            {data.eventKeys.map((key) => (
              <input key={key} type="hidden" name="event_key" value={key} />
            ))}
            <Button variant="secondary">
              <CheckCircle2 className="h-4 w-4" />
              Прочитать все
            </Button>
          </form>
        )}
      </div>

      {data.notifications.length === 0 ? (
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
                  {urgentItems.map((item) => <NotificationItem key={item.key} item={item} />)}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Лента событий</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {otherItems.map((item) => <NotificationItem key={item.key} item={item} />)}
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
                <p>• новые ответы на публичные опросы;</p>
                <p>• последние действия в карточках контактов;</p>
                <p>• горячие контакты с высоким приоритетом;</p>
                <p>• активные кампании с набранными контактами.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Быстрые действия</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3">
                <Button asChild variant="secondary">
                  <Link href="/tasks">Открыть задачи</Link>
                </Button>
                <Button asChild variant="secondary">
                  <Link href="/surveys">Открыть опросы</Link>
                </Button>
                <Button asChild variant="secondary">
                  <Link href="/people?priority=Высокий">Горячие контакты</Link>
                </Button>
                <Button asChild variant="secondary">
                  <Link href="/campaigns">Кампании</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
