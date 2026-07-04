import type { ReactNode } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowUpRight, BarChart3, ClipboardList, Lightbulb, Target, Timer } from 'lucide-react';
import { CopyReportButton } from '@/components/reports/copy-report-button';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { getWeeklyReport, type ReportBarItem, type ReportHighlight, type ReportMetricTone } from '@/lib/reports';

const toneClass: Record<ReportMetricTone, string> = {
  purple: 'bg-purple-50 text-purple-700 ring-purple-100',
  pink: 'bg-pink-50 text-pink-700 ring-pink-100',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  yellow: 'bg-amber-50 text-amber-700 ring-amber-100',
  red: 'bg-red-50 text-red-700 ring-red-100',
  blue: 'bg-blue-50 text-blue-700 ring-blue-100',
  gray: 'bg-slate-100 text-slate-700 ring-slate-200'
};

const barToneClass: Record<'purple' | 'pink' | 'blue', string> = {
  purple: 'bg-app-purple',
  pink: 'bg-app-pink',
  blue: 'bg-blue-500'
};

export default async function ReportsPage() {
  const report = await getWeeklyReport();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Отчеты"
        subtitle={`Автоматическая сводка для команды · ${report.periodLabel}`}
      />

      <Card className="overflow-hidden border-purple-100 bg-gradient-to-br from-white via-white to-purple-50">
        <CardContent className="grid gap-6 p-6 xl:grid-cols-[1.25fr_0.75fr]">
          <div>
            <Badge tone="purple">Сформировано: {report.generatedAt}</Badge>
            <h2 className="mt-4 text-2xl font-black tracking-tight text-app-text">Еженедельный маркетинг-отчет Hutka</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-app-muted">
              Здесь собирается единая картина запуска: контакты, тестирование, задачи, кампании, опросы, выводы и идеи.
              Этот блок можно использовать на командной встрече или отправить в чат.
            </p>
          </div>
          <div className="rounded-3xl border border-purple-100 bg-white/80 p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-app-faint">Фокус недели</p>
            <p className="mt-3 text-sm font-semibold leading-6 text-app-text">
              Проверить, какие каналы и ниши дают самых заинтересованных участников, и перенести принятые выводы в офферы и продуктовые задачи.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {report.metrics.map((metric) => (
          <Card key={metric.label}>
            <CardContent className="p-5">
              <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${toneClass[metric.tone]}`}>{metric.label}</span>
              <p className="mt-4 text-3xl font-black text-app-text">{metric.value}</p>
              <p className="mt-2 text-xs font-semibold text-app-muted">{metric.helper}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><BarChart3 className="h-4 w-4 text-app-purple" /> Воронка по стадиям</CardTitle>
          </CardHeader>
          <CardContent>
            <Bars items={report.funnel} tone="purple" />
          </CardContent>
        </Card>



        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-app-red" /> Причины отказов</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {report.refusalSummary.total === 0 ? (
              <p className="rounded-2xl bg-slate-50 p-4 text-sm text-app-muted">Отказов с причинами пока нет. Когда контакт переводится в отказ, выбирай причину в карточке контакта.</p>
            ) : (
              <>
                <div className="rounded-2xl border border-red-100 bg-red-50/50 p-4">
                  <p className="text-3xl font-black text-app-text">{report.refusalSummary.total}</p>
                  <p className="mt-1 text-sm text-app-muted">зафиксированных отказов</p>
                </div>
                <Bars items={report.refusalSummary.topReasons.map((item) => ({ name: item.reason, value: item.count, width: item.width }))} tone="pink" />
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Timer className="h-4 w-4 text-app-purple" /> Задачи и follow-up</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <SmallMetric label="Всего задач" value={report.taskSummary.total} />
            <SmallMetric label="Просрочено" value={report.taskSummary.overdue} tone="red" />
            <SmallMetric label="Сегодня" value={report.taskSummary.today} tone="yellow" />
            <SmallMetric label="Позже" value={report.taskSummary.later} tone="blue" />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Лучшие каналы</CardTitle></CardHeader>
          <CardContent><Bars items={report.topChannels} tone="blue" /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Лучшие ниши</CardTitle></CardHeader>
          <CardContent><Bars items={report.topNiches} tone="pink" /></CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <HighlightCard icon={<Target className="h-4 w-4 text-app-purple" />} title="Кампании" items={report.campaignHighlights} empty="Кампаний пока нет." />
        <HighlightCard icon={<ClipboardList className="h-4 w-4 text-app-purple" />} title="Опросники" items={report.surveyHighlights} empty="Опросников пока нет." />
        <HighlightCard icon={<Lightbulb className="h-4 w-4 text-app-purple" />} title="Главные выводы" items={report.insightHighlights} empty="Выводов пока нет." />
        <HighlightCard icon={<Target className="h-4 w-4 text-app-purple" />} title="Идеи и проверки" items={report.hypothesisHighlights} empty="Идей пока нет." />
      </div>

      <Card>
        <CardHeader><CardTitle>Рекомендации на следующий шаг</CardTitle></CardHeader>
        <CardContent>
          <ol className="grid gap-3 lg:grid-cols-2">
            {report.recommendations.map((recommendation, index) => (
              <li key={recommendation} className="rounded-2xl border border-app-line bg-slate-50 p-4 text-sm font-semibold leading-6 text-app-text">
                <span className="mr-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white text-xs font-black text-app-purple shadow-sm">{index + 1}</span>
                {recommendation}
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Текст отчета для команды</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea readOnly value={report.teamText} className="min-h-72 resize-none font-mono text-xs leading-6" />
          <div className="flex flex-wrap gap-3">
            <CopyReportButton text={report.teamText} />
            <Link href="/campaigns" className="inline-flex h-10 items-center justify-center rounded-xl border border-app-line bg-white px-4 text-sm font-semibold text-app-text transition hover:border-purple-200 hover:bg-purple-50">
              Открыть кампании
            </Link>
            <Link href="/hypotheses" className="inline-flex h-10 items-center justify-center rounded-xl border border-app-line bg-white px-4 text-sm font-semibold text-app-text transition hover:border-purple-200 hover:bg-purple-50">
              Открыть идеи
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Bars({ items, tone }: { items: ReportBarItem[]; tone: 'purple' | 'pink' | 'blue' }) {
  if (!items.length) {
    return <p className="rounded-2xl bg-slate-50 p-4 text-sm text-app-muted">Данных пока нет.</p>;
  }

  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div key={item.name} className="rounded-2xl border border-app-line bg-white p-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-50 text-xs font-black text-app-muted">
              {index + 1}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <span className="min-w-0 truncate text-sm font-black text-app-text">{item.name}</span>
                <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-black text-app-muted">
                  {item.value.toLocaleString('ru-RU')}{item.helper ? ` · ${item.helper}` : ''}
                </span>
              </div>
              <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-100">
                <div className={`h-full rounded-full ${barToneClass[tone]}`} style={{ width: item.width }} />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function SmallMetric({ label, value, tone = 'purple' }: { label: string; value: number; tone?: ReportMetricTone }) {
  return (
    <div className="rounded-2xl border border-app-line bg-slate-50 p-4">
      <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ${toneClass[tone]}`}>{label}</span>
      <p className="mt-3 text-2xl font-black text-app-text">{value}</p>
    </div>
  );
}

function HighlightCard({ icon, title, items, empty }: { icon: ReactNode; title: string; items: ReportHighlight[]; empty: string }) {
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2">{icon} {title}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 && <p className="rounded-2xl bg-slate-50 p-4 text-sm text-app-muted">{empty}</p>}
        {items.map((item) => {
          const content = (
            <div className="rounded-2xl border border-app-line bg-white p-4 transition hover:border-purple-200 hover:shadow-card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Badge tone={item.tone}>{item.subtitle?.split(' · ')[0] ?? 'Hutka'}</Badge>
                  <p className="mt-3 text-sm font-black leading-6 text-app-text">{item.title}</p>
                  {item.subtitle && <p className="mt-1 text-xs leading-5 text-app-muted">{item.subtitle}</p>}
                </div>
                {item.href && <ArrowUpRight className="h-4 w-4 shrink-0 text-app-faint" />}
              </div>
            </div>
          );

          return item.href ? <Link key={item.id} href={item.href}>{content}</Link> : <div key={item.id}>{content}</div>;
        })}
      </CardContent>
    </Card>
  );
}
