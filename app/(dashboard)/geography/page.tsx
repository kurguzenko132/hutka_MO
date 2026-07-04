import Link from 'next/link';
import { ArrowUpRight, Building2, MapPinned, Sparkles, Target, Users } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getGeographyData, readinessTone } from '@/lib/geography';

function Progress({ value }: { value: number }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
      <div className="h-full rounded-full bg-gradient-to-r from-app-purple to-app-pink" style={{ width: `${Math.min(value, 100)}%` }} />
    </div>
  );
}

function MetricCard({ label, value, helper, icon: Icon }: { label: string; value: string | number; helper: string; icon: typeof Users }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-50 text-app-purple">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm text-app-muted">{label}</p>
          <p className="mt-1 text-2xl font-black text-app-text">{value}</p>
          <p className="mt-1 text-xs text-app-muted">{helper}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default async function GeographyPage() {
  const data = await getGeographyData();
  const topCities = data.cities.slice(0, 4);
  const topNiches = data.nichesByCity.slice(0, 6);

  return (
    <div className="space-y-6">
      <PageHeader title="География" subtitle="Города, ниши и готовность к первой локальной волне запуска" />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Городов в базе" value={data.totals.cities} helper="с контактами в системе" icon={MapPinned} />
        <MetricCard label="Контактов" value={data.totals.contacts} helper="мастера, салоны, клиенты" icon={Users} />
        <MetricCard label="Заинтересованы" value={data.totals.readyToPilot} helper="интерес или высокий score" icon={Target} />
        <MetricCard label="Тестируют" value={data.totals.activeParticipants} helper="стадия тестирования" icon={Sparkles} />
        <MetricCard label="Высокий score" value={data.totals.hotContacts} helper="score 75+" icon={Building2} />
      </div>

      <Card className="overflow-hidden">
        <CardContent className="grid gap-8 bg-gradient-to-br from-purple-50 via-white to-pink-50 p-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="purple">Рекомендация запуска</Badge>
              <Badge tone={readinessTone(data.recommendation.score)}>Готовность {data.recommendation.score}%</Badge>
            </div>
            <h2 className="mt-4 max-w-3xl text-3xl font-black tracking-tight text-app-text">{data.recommendation.title}</h2>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-app-muted">{data.recommendation.reason}</p>
            <div className="mt-6 max-w-xl">
              <Progress value={data.recommendation.score} />
            </div>
          </div>

          <div className="rounded-3xl border border-white/80 bg-white/80 p-5 shadow-card backdrop-blur">
            <p className="text-sm font-black text-app-text">Что сделать дальше</p>
            <div className="mt-4 space-y-3">
              {data.recommendation.nextActions.map((action, index) => (
                <div key={action} className="flex gap-3 rounded-2xl bg-slate-50 p-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-app-purple text-xs font-black text-white">{index + 1}</span>
                  <p className="text-sm leading-5 text-app-text">{action}</p>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader>
            <CardTitle>Города по готовности</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {topCities.map((city) => (
              <div key={city.city} className="rounded-2xl border border-app-line p-4 transition hover:border-purple-200 hover:shadow-card">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-base font-black text-app-text">{city.city}</p>
                    <p className="mt-1 text-sm text-app-muted">{city.contacts} контактов · {city.masters} мастеров · {city.salons} салонов</p>
                  </div>
                  <Badge tone={readinessTone(city.pilotReadiness)}>{city.pilotReadiness}%</Badge>
                </div>
                <div className="mt-4">
                  <Progress value={city.pilotReadiness} />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {city.topNiches.slice(0, 3).map((niche) => <Badge key={niche} tone="pink">{niche}</Badge>)}
                  {city.topSources.slice(0, 2).map((source) => <Badge key={source} tone="blue">{source}</Badge>)}
                </div>
                <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-xl bg-purple-50 p-3">
                    <p className="text-lg font-black text-app-purple">{city.readyToPilot}</p>
                    <p className="text-[11px] text-app-muted">интерес</p>
                  </div>
                  <div className="rounded-xl bg-emerald-50 p-3">
                    <p className="text-lg font-black text-emerald-600">{city.activeParticipants}</p>
                    <p className="text-[11px] text-app-muted">тестируют</p>
                  </div>
                  <div className="rounded-xl bg-pink-50 p-3">
                    <p className="text-lg font-black text-app-pink">{city.hotContacts}</p>
                    <p className="text-[11px] text-app-muted">score 75+</p>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Лучшие связки город + ниша</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {topNiches.length === 0 && <p className="text-sm text-app-muted">Пока недостаточно данных по нишам.</p>}
            {topNiches.map((item, index) => (
              <div key={`${item.city}-${item.niche}`} className="rounded-2xl border border-app-line p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-black text-app-text">#{index + 1} {item.city} · {item.niche}</p>
                    <p className="mt-1 text-xs text-app-muted">{item.contacts} контактов · {item.readyToPilot} заинтересованы · {item.activeParticipants} тестируют</p>
                  </div>
                  <Badge tone={readinessTone(item.readiness)}>{item.readiness}%</Badge>
                </div>
                <div className="mt-4">
                  <Progress value={item.readiness} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Полная таблица городов</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-2xl border border-app-line">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-app-muted">
                <tr>
                  <th className="px-4 py-3">Город</th>
                  <th className="px-4 py-3">Контакты</th>
                  <th className="px-4 py-3">Мастера</th>
                  <th className="px-4 py-3">Салоны</th>
                  <th className="px-4 py-3">Заинтересованы</th>
                  <th className="px-4 py-3">Тестируют</th>
                  <th className="px-4 py-3">Топ-ниши</th>
                  <th className="px-4 py-3">Действие</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-app-line bg-white">
                {data.cities.map((city) => (
                  <tr key={city.city} className="hover:bg-slate-50">
                    <td className="px-4 py-4 font-bold text-app-text">{city.city}</td>
                    <td className="px-4 py-4 text-app-muted">{city.contacts}</td>
                    <td className="px-4 py-4 text-app-muted">{city.masters}</td>
                    <td className="px-4 py-4 text-app-muted">{city.salons}</td>
                    <td className="px-4 py-4 font-bold text-app-purple">{city.readyToPilot}</td>
                    <td className="px-4 py-4 font-bold text-emerald-600">{city.activeParticipants}</td>
                    <td className="px-4 py-4 text-app-muted">{city.topNiches.slice(0, 3).join(', ') || '—'}</td>
                    <td className="px-4 py-4">
                      <Link href={`/people?city=${encodeURIComponent(city.city)}`} className="inline-flex items-center gap-1 text-xs font-bold text-app-purple hover:text-purple-700">
                        Контакты <ArrowUpRight className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
