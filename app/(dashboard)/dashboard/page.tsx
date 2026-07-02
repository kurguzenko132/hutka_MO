import { BarList } from '@/components/dashboard/bar-list';
import { FunnelOverview } from '@/components/dashboard/funnel-overview';
import { StatCard } from '@/components/dashboard/stat-card';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { channels, insights, kpis, niches, todayTasks } from '@/lib/data';

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Главная" subtitle="Среда, 21 мая 2025 · маркетинговый запуск Hutka" actionLabel="Добавить лида" />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {kpis.map((kpi) => (
          <StatCard key={kpi.label} {...kpi} />
        ))}
      </div>

      <FunnelOverview />

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1fr_1fr_1.25fr]">
        <Card>
          <CardHeader><CardTitle>Сегодня нужно сделать</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {todayTasks.map((task) => (
              <label key={task.title} className="flex items-center justify-between rounded-xl p-2 transition hover:bg-slate-50">
                <span className="flex items-center gap-3 text-sm font-medium text-app-text">
                  <input type="checkbox" className="rounded border-app-line" />
                  {task.title}
                </span>
                <span className="rounded-full bg-purple-50 px-2.5 py-1 text-xs font-bold text-app-purple">{task.count}</span>
              </label>
            ))}
            <button className="pt-2 text-sm font-semibold text-app-purple">Смотреть все задачи →</button>
          </CardContent>
        </Card>

        <BarList title="Лучшие каналы" items={channels} color="purple" />
        <BarList title="Лучшие ниши" items={niches} color="pink" />

        <Card>
          <CardHeader><CardTitle>Главные инсайты недели</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {insights.map((insight, index) => (
              <div key={insight} className="rounded-2xl border border-app-line bg-gradient-to-br from-white to-purple-50 p-4">
                <p className="text-sm font-semibold text-app-text">{insight}</p>
                <button className="mt-2 text-xs font-bold text-app-purple">Смотреть детали</button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
