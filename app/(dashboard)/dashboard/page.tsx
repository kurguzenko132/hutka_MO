import Link from 'next/link';
import { BellRing, Heart, Send, Timer, Users, Zap, Flame, Sparkles } from 'lucide-react';
import { ActionGrid } from '@/components/dashboard/action-grid';
import { BarList } from '@/components/dashboard/bar-list';
import { FunnelOverview } from '@/components/dashboard/funnel-overview';
import { GettingStartedCard } from '@/components/dashboard/getting-started-card';
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
import { hypothesisStatusTone } from '@/lib/hypotheses';

const kpiIcons = [Users, Send, Heart, Flame, Timer, Zap];

export default async function DashboardPage() {
  const dashboard = await getDashboardData();
  const user = await getCurrentUserContext();
  const role = user?.role ?? 'viewer';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Главная"
        subtitle={`${dashboard.periodLabel} · рабочий центр маркетингового запуска Hutka`}
        actionLabel={can(role, 'manageContacts') ? 'Добавить контакт' : undefined}
        actionHref={can(role, 'manageContacts') ? '/people/new' : undefined}
      />

      <Card className="overflow-hidden border-purple-100 bg-gradient-to-br from-purple-50 via-white to-pink-50">
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

      <GettingStartedCard role={role} />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {dashboard.kpis.map((kpi, index) => {
          const Icon = kpiIcons[index] ?? Users;
          return <StatCard key={kpi.label} {...kpi} icon={Icon} />;
        })}
      </div>

      <ActionGrid role={role} />

      <FunnelOverview steps={dashboard.funnel} />

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
            <CardTitle>Главные инсайты недели</CardTitle>
            <Link href="/insights" className="text-xs font-bold text-app-purple">Все →</Link>
          </CardHeader>
          <CardContent className="space-y-4">
            {dashboard.insights.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-app-line p-4 text-sm text-app-muted">
                Пока нет инсайтов. Создай первый вывод после опроса, кампании или интервью.
              </div>
            ) : (
              dashboard.insights.slice(0, 3).map((insight) => (
                <div key={insight} className="rounded-2xl border border-app-line bg-gradient-to-br from-white to-purple-50 p-4">
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

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Гипотезы в проверке</CardTitle>
          <Link href="/hypotheses" className="text-xs font-bold text-app-purple">Все гипотезы →</Link>
        </CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-3">
          {dashboard.hypotheses.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-app-line p-4 text-sm text-app-muted lg:col-span-3">
              Пока нет гипотез в проверке. Добавь предположение, метрику успеха и следующий эксперимент.
            </div>
          ) : (
            dashboard.hypotheses.slice(0, 3).map((hypothesis) => (
              <Link key={hypothesis.id} href={`/hypotheses/${hypothesis.id}`} className="rounded-2xl border border-app-line bg-gradient-to-br from-white to-pink-50 p-4 transition hover:border-purple-200 hover:shadow-card">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={hypothesisStatusTone(hypothesis.status)}>{hypothesis.statusLabel}</Badge>
                  <Badge tone="gray">{hypothesis.category}</Badge>
                </div>
                <p className="mt-3 text-sm font-black leading-6 text-app-text">{hypothesis.title}</p>
                <p className="mt-2 line-clamp-2 text-xs leading-5 text-app-muted">{hypothesis.nextAction || hypothesis.testMethod || 'Следующее действие пока не указано.'}</p>
              </Link>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
