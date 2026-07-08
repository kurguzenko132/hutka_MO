import Link from 'next/link';
import { AlarmClockCheck, AlertTriangle, BellRing, Heart, Send, Timer, Users, Sparkles } from 'lucide-react';
import { BarList } from '@/components/dashboard/bar-list';
import { FunnelOverview } from '@/components/dashboard/funnel-overview';
import { HotContactsCard } from '@/components/dashboard/hot-contacts-card';
import { RecentActivityCard } from '@/components/dashboard/recent-activity-card';
import { StatCard } from '@/components/dashboard/stat-card';
import { TodayWorkCard } from '@/components/dashboard/today-work-card';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getDashboardData } from '@/lib/dashboard';
import { getCurrentUserContext } from '@/lib/permissions';
import { can } from '@/lib/roles';
import { getFollowUpRecommendations } from '@/lib/followups';

const kpiIcons = [Users, Send, Heart, Timer];

export default async function DashboardPage() {
  const [dashboard, followups] = await Promise.all([getDashboardData(), getFollowUpRecommendations()]);
  const user = await getCurrentUserContext();
  const role = user?.role ?? 'viewer';
  const statusItems = dashboard.funnel.map((step) => ({ name: step.label, value: step.count, width: step.percent }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Главная"
        subtitle={`${dashboard.periodLabel} · рабочий центр маркетингового запуска Hutka`}
        actionLabel={can(role, 'manageContacts') ? 'Добавить контакт' : undefined}
        actionHref={can(role, 'manageContacts') ? '/people/new' : undefined}
      />

      <Card className="overflow-hidden border-purple-100 bg-white">
        <CardContent className="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-4">
            <div className="hidden rounded-3xl bg-white p-4 text-app-purple shadow-sm sm:block">
              <BellRing className="h-6 w-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-black text-app-text">Фокус на сегодня</h2>
                {dashboard.demoMode && <Badge tone="yellow">Demo fallback</Badge>}
              </div>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-app-muted">{dashboard.focus}</p>
            </div>
          </div>
          <div className="grid gap-2 sm:flex sm:flex-wrap">
            <Link href="/tasks" className="rounded-xl border border-app-line bg-white px-4 py-2 text-center text-sm font-bold text-app-text transition hover:border-purple-200 hover:bg-purple-50 hover:text-app-purple">
              Открыть задачи
            </Link>
            <Link href="/reports" className="rounded-xl bg-app-purple px-4 py-2 text-center text-sm font-bold text-white transition hover:bg-purple-700">
              Отчет команде
            </Link>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {dashboard.kpis.map((kpi, index) => {
          const Icon = kpiIcons[index] ?? Users;
          return <StatCard key={kpi.label} {...kpi} icon={Icon} />;
        })}
      </div>

      {followups.summary.total > 0 && (
        <Card className="border-amber-100 bg-white">
          <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex gap-4">
              <div className="rounded-2xl bg-amber-100 p-3 text-amber-700">
                <AlarmClockCheck className="h-5 w-5" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-black text-app-text">Что нужно сделать</h2>
                  <Badge tone="yellow">{followups.summary.total} действий</Badge>
                  {followups.summary.urgent > 0 ? <Badge tone="red">{followups.summary.urgent} срочно</Badge> : null}
                </div>
                <p className="mt-2 text-sm leading-6 text-app-muted">
                  Hutka нашла контакты с просроченными датами, анкетами без ответа или высоким интересом без закрепленной задачи.
                </p>
              </div>
            </div>
            <Link href="/followups" className="rounded-xl bg-app-purple px-4 py-2 text-center text-sm font-bold text-white transition hover:bg-purple-700">
              Открыть список
            </Link>
          </CardContent>
        </Card>
      )}

      <FunnelOverview steps={dashboard.funnel} />

      <div className="grid gap-6 xl:grid-cols-2">
        <BarList title="Распределение контактов по статусам" items={statusItems} color="purple" />
        <BarList title="Что нужно сделать" items={[
          { name: 'Просрочено', value: followups.summary.urgent, width: followups.summary.total ? `${Math.max(8, Math.round((followups.summary.urgent / followups.summary.total) * 100))}%` : '0%' },
          { name: 'Всего действий', value: followups.summary.total, width: followups.summary.total ? '100%' : '0%' }
        ].filter((item) => item.value > 0)} color="pink" />
      </div>

      {dashboard.refusals.total > 0 && (
        <Card className="border-red-100 bg-white">
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-app-red" /> Причины отказов</CardTitle>
            <Link href="/reports" className="text-xs font-bold text-app-purple">В отчет →</Link>
          </CardHeader>
          <CardContent className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
            <div>
              <p className="text-3xl font-black text-app-text">{dashboard.refusals.total}</p>
              <p className="mt-1 text-sm text-app-muted">контактов с зафиксированной причиной отказа</p>
              <div className="mt-4 space-y-3">
                {dashboard.refusals.topReasons.slice(0, 4).map((item) => (
                  <div key={item.reason}>
                    <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                      <span className="font-semibold text-app-text">{item.reason}</span>
                      <span className="text-xs font-bold text-app-muted">{item.count}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-red-100">
                      <div className="h-full rounded-full bg-app-red" style={{ width: item.width }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              {dashboard.refusals.recent.slice(0, 3).map((item) => (
                <Link key={item.id} href={item.href} className="block rounded-2xl border border-red-100 bg-white p-4 transition hover:border-red-200 hover:shadow-card">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="red">{item.reason}</Badge>
                    <Badge tone="gray">{item.refusedAt}</Badge>
                  </div>
                  <p className="mt-3 text-sm font-black text-app-text">{item.name}</p>
                  <p className="mt-1 text-xs text-app-muted">{item.meta}</p>
                  {item.comment && <p className="mt-2 line-clamp-2 text-xs leading-5 text-app-muted">{item.comment}</p>}
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}


      <div className="grid gap-6 xl:grid-cols-[1fr_1fr_1.25fr]">
        <TodayWorkCard tasks={dashboard.todayTasks} />
        <HotContactsCard contacts={dashboard.hotContacts} />
        <RecentActivityCard activities={dashboard.recentActivities} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr_1.2fr]">
        <BarList title="Лучшие каналы" items={dashboard.channels} color="purple" />
        <BarList title="Лучшие ниши" items={dashboard.niches} color="pink" />

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Главные выводы недели</CardTitle>
            <Link href="/insights" className="text-xs font-bold text-app-purple">Все →</Link>
          </CardHeader>
          <CardContent className="space-y-4">
            {dashboard.insights.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-app-line p-4 text-sm text-app-muted">
                Пока нет выводов. Создай первый вывод после анкеты, кампании или интервью.
              </div>
            ) : (
              dashboard.insights.slice(0, 3).map((insight) => (
                <div key={insight} className="rounded-2xl border border-app-line bg-white p-4">
                  <div className="flex gap-3">
                    <div className="rounded-xl bg-purple-50 p-2 text-app-purple">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold leading-6 text-app-text">{insight}</p>
                      <Link href="/insights" className="mt-2 inline-block text-xs font-bold text-app-purple">Смотреть детали →</Link>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
