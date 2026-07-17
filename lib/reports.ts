import { getCampaigns } from '@/lib/campaigns';
import { getInsights } from '@/lib/insights';
import { getSurveys } from '@/lib/surveys';
import { getRefusalAnalytics, type RefusalAnalytics } from '@/lib/refusals';
import { getTaskReportSummary } from '@/lib/tasks';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { channels as demoChannels, funnel as demoFunnel, insights as demoDashboardInsights, niches as demoNiches } from '@/lib/data';
import { canonicalFunnelStageNames, isInterestedStage, isTestingStage, normalizeStageName } from '@/lib/stages';

export type ReportMetricTone = 'purple' | 'pink' | 'green' | 'yellow' | 'red' | 'blue' | 'gray';

export type ReportMetric = {
  label: string;
  value: string;
  helper: string;
  tone: ReportMetricTone;
};

export type ReportBarItem = {
  name: string;
  value: number;
  width: string;
  helper?: string;
};

export type ReportHighlight = {
  id: string;
  title: string;
  subtitle?: string;
  href?: string;
  tone: ReportMetricTone;
};

export type WeeklyReport = {
  periodLabel: string;
  generatedAt: string;
  metrics: ReportMetric[];
  weeklyDynamics: ReportBarItem[];
  funnel: ReportBarItem[];
  topChannels: ReportBarItem[];
  topNiches: ReportBarItem[];
  campaignEfficiency: ReportBarItem[];
  nicheReaction: ReportBarItem[];
  taskSummary: {
    total: number;
    overdue: number;
    today: number;
    later: number;
  };
  campaignHighlights: ReportHighlight[];
  surveyHighlights: ReportHighlight[];
  insightHighlights: ReportHighlight[];
  refusalSummary: RefusalAnalytics;
  recommendations: string[];
  teamText: string;
};

type RawLead = {
  id: string;
  name: string;
  type?: string | null;
  niche?: string | null;
  city?: string | null;
  priority_score?: number | null;
  created_at?: string | null;
  sources?: unknown;
  funnel_stages?: unknown;
};

type ReportLeadAggregates = {
  totalContacts: number;
  newContacts: number;
  interestedContacts: number;
  testingContacts: number;
  weeklyDynamics: ReportBarItem[];
  stageEntries: Array<[string, number]>;
  topChannels: ReportBarItem[];
  topNiches: ReportBarItem[];
  nicheReaction: ReportBarItem[];
};

function formatDate(value: Date) {
  return value.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDateTime(value: Date) {
  return value.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function relatedName(value: unknown): string | undefined {
  if (!value) return undefined;
  if (Array.isArray(value)) return relatedName(value[0]);
  if (typeof value === 'object' && 'name' in value) {
    const name = (value as { name?: unknown }).name;
    return typeof name === 'string' ? name : undefined;
  }
  return undefined;
}

function isDateWithin(value: string | null | undefined, start: Date) {
  if (!value) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date >= start;
}

function normalizeStage(value: unknown) {
  return normalizeStageName(relatedName(value));
}

function normalizeSource(value: unknown) {
  return relatedName(value) ?? 'Не указан';
}

function percentage(part: number, total: number) {
  if (total <= 0) return '0%';
  return `${Math.round((part / total) * 1000) / 10}%`;
}

function makeBarItems(entries: Array<[string, number]>, maxItems = 5): ReportBarItem[] {
  const sorted = entries.sort((a, b) => b[1] - a[1]).slice(0, maxItems);
  const max = sorted[0]?.[1] ?? 1;

  return sorted.map(([name, value]) => ({
    name,
    value,
    width: `${Math.max(8, Math.round((value / max) * 100))}%`
  }));
}

function makeOrderedBarItems(entries: Array<[string, number]>): ReportBarItem[] {
  const max = Math.max(...entries.map(([, value]) => value), 1);
  return entries.map(([name, value]) => ({
    name,
    value,
    width: value > 0 ? `${Math.max(8, Math.round((value / max) * 100))}%` : '0%'
  }));
}

function groupCount(items: string[]) {
  return Array.from(
    items.reduce((acc, item) => {
      acc.set(item, (acc.get(item) ?? 0) + 1);
      return acc;
    }, new Map<string, number>())
  );
}

function buildWeeklyDynamics(leads: RawLead[], now: Date) {
  const buckets: Array<{ label: string; start: Date; end: Date; count: number }> = [];

  for (let index = 5; index >= 0; index -= 1) {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - index * 7);
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    buckets.push({
      label: start.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }),
      start,
      end,
      count: 0
    });
  }

  leads.forEach((lead) => {
    if (!lead.created_at) return;
    const createdAt = new Date(lead.created_at);
    if (Number.isNaN(createdAt.getTime())) return;
    const bucket = buckets.find((item) => createdAt >= item.start && createdAt < item.end);
    if (bucket) bucket.count += 1;
  });

  return makeOrderedBarItems(buckets.map((bucket) => [bucket.label, bucket.count]));
}

function buildNicheReaction(leads: RawLead[]) {
  const byNiche = new Map<string, { total: number; reacted: number }>();
  leads.forEach((lead) => {
    const niche = lead.niche || 'Не указана';
    const current = byNiche.get(niche) ?? { total: 0, reacted: 0 };
    const stage = normalizeStage(lead.funnel_stages);
    current.total += 1;
    if (['Ответил', 'Заинтересован', 'Тестирует'].includes(stage)) current.reacted += 1;
    byNiche.set(niche, current);
  });

  return Array.from(byNiche.entries())
    .sort((a, b) => b[1].reacted - a[1].reacted || b[1].total - a[1].total)
    .slice(0, 5)
    .map(([name, value]) => ({
      name,
      value: value.reacted,
      helper: `${percentage(value.reacted, value.total)} реакции`,
      width: '0%'
    }))
    .map((item, _, items) => {
      const max = Math.max(...items.map((entry) => entry.value), 1);
      return { ...item, width: item.value > 0 ? `${Math.max(8, Math.round((item.value / max) * 100))}%` : '0%' };
    });
}

async function getRawLeads(): Promise<RawLead[]> {
  if (!isSupabaseConfigured()) {
    return [
      { id: 'demo-1', name: 'Анна Смирнова', type: 'master', niche: 'Брови и ресницы', city: 'Москва', priority_score: 86, created_at: new Date().toISOString(), sources: { name: 'Instagram' }, funnel_stages: { name: 'Тестирует' } },
      { id: 'demo-2', name: 'Екатерина Лебедева', type: 'salon', niche: 'Маникюр', city: 'Санкт-Петербург', priority_score: 62, created_at: new Date().toISOString(), sources: { name: 'Telegram' }, funnel_stages: { name: 'Заинтересован' } },
      { id: 'demo-3', name: 'Ольга Кузнецова', type: 'master', niche: 'Косметология', city: 'Казань', priority_score: 67, created_at: new Date().toISOString(), sources: { name: 'Рекомендация' }, funnel_stages: { name: 'Ответил' } },
      { id: 'demo-4', name: 'Салон Beauty Line', type: 'salon', niche: 'Парикмахерские', city: 'Новосибирск', priority_score: 41, created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString(), sources: { name: 'Офлайн' }, funnel_stages: { name: 'Написали' } },
      { id: 'demo-5', name: 'Дарья Волкова', type: 'master', niche: 'Маникюр', city: 'Екатеринбург', priority_score: 38, created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(), sources: { name: 'TikTok' }, funnel_stages: { name: 'Новый' } }
    ];
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('leads')
    .select('id,name,type,niche,city,priority_score,created_at,sources(name),funnel_stages(name)')
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return data.map((row) => row as RawLead);
}

function aggregateRawLeads(leads: RawLead[], now: Date): ReportLeadAggregates {
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - 7);
  const stageCounts = new Map(canonicalFunnelStageNames.map((stage) => [stage, 0]));

  leads.forEach((lead) => {
    const stage = normalizeStage(lead.funnel_stages);
    stageCounts.set(stage, (stageCounts.get(stage) ?? 0) + 1);
  });

  return {
    totalContacts: leads.length,
    newContacts: leads.filter((lead) => isDateWithin(lead.created_at, weekStart)).length,
    interestedContacts: leads.filter((lead) => isInterestedStage(normalizeStage(lead.funnel_stages)) || (lead.priority_score ?? 0) >= 75).length,
    testingContacts: leads.filter((lead) => isTestingStage(normalizeStage(lead.funnel_stages))).length,
    weeklyDynamics: buildWeeklyDynamics(leads, now),
    stageEntries: canonicalFunnelStageNames.map((stage) => [stage, stageCounts.get(stage) ?? 0]),
    topChannels: makeBarItems(groupCount(leads.map((lead) => normalizeSource(lead.sources)))),
    topNiches: makeBarItems(groupCount(leads.map((lead) => lead.niche || 'Не указана'))),
    nicheReaction: buildNicheReaction(leads)
  };
}

function payloadRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function safeNumber(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function namedValueEntries(value: unknown): Array<[string, number]> {
  return (Array.isArray(value) ? value : [])
    .map((item) => payloadRecord(item))
    .filter((item): item is Record<string, unknown> => Boolean(item))
    .map((item) => [String(item.name ?? 'Не указано'), safeNumber(item.value)]);
}

function parseReportLeadAggregates(value: unknown): ReportLeadAggregates | null {
  const payload = payloadRecord(value);
  if (!payload) return null;

  const summary = payloadRecord(payload.summary) ?? {};
  const weeklyEntries = (Array.isArray(payload.weekly) ? payload.weekly : [])
    .map((item) => payloadRecord(item))
    .filter((item): item is Record<string, unknown> => Boolean(item))
    .map((item): [string, number] => {
      const date = new Date(`${String(item.period_start ?? '')}T00:00:00`);
      const label = Number.isNaN(date.getTime())
        ? String(item.period_start ?? '')
        : date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
      return [label, safeNumber(item.value)];
    });

  const nicheReactionRows = (Array.isArray(payload.niche_reaction) ? payload.niche_reaction : [])
    .map((item) => payloadRecord(item))
    .filter((item): item is Record<string, unknown> => Boolean(item))
    .map((item) => ({
      name: String(item.name ?? 'Не указана'),
      value: safeNumber(item.reacted),
      total: safeNumber(item.total)
    }));
  const maxReaction = Math.max(...nicheReactionRows.map((item) => item.value), 1);

  return {
    totalContacts: safeNumber(summary.total),
    newContacts: safeNumber(summary.new_contacts),
    interestedContacts: safeNumber(summary.interested),
    testingContacts: safeNumber(summary.testing),
    weeklyDynamics: makeOrderedBarItems(weeklyEntries),
    stageEntries: namedValueEntries(payload.stages),
    topChannels: makeBarItems(namedValueEntries(payload.sources)),
    topNiches: makeBarItems(namedValueEntries(payload.niches)),
    nicheReaction: nicheReactionRows.map((item) => ({
      name: item.name,
      value: item.value,
      helper: `${percentage(item.value, item.total)} реакции`,
      width: item.value > 0 ? `${Math.max(8, Math.round((item.value / maxReaction) * 100))}%` : '0%'
    }))
  };
}

async function getReportLeadAggregates(now: Date): Promise<ReportLeadAggregates> {
  if (!isSupabaseConfigured()) {
    return aggregateRawLeads(await getRawLeads(), now);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_report_lead_aggregates');
  if (!error) {
    const aggregates = parseReportLeadAggregates(data);
    if (aggregates) return aggregates;
  }

  return aggregateRawLeads(await getRawLeads(), now);
}

function buildRecommendations({
  topChannel,
  topNiche,
  overdueTasks,
  activeCampaigns,
  acceptedInsights
}: {
  topChannel?: string;
  topNiche?: string;
  overdueTasks: number;
  activeCampaigns: number;
  acceptedInsights: number;
}) {
  const recommendations: string[] = [];

  if (topChannel) {
    recommendations.push(`Усилить канал «${topChannel}»: он сейчас дает лучший объем контактов.`);
  }

  if (topNiche) {
    recommendations.push(`Сфокусировать ближайшую выборку на нише «${topNiche}», чтобы быстрее набрать плотность для тестирования.`);
  }

  if (overdueTasks > 0) {
    recommendations.push(`Закрыть ${overdueTasks} просроченных действий, чтобы не терять теплые контакты.`);
  }

  if (activeCampaigns > 0) {
    recommendations.push('По активным кампаниям зафиксировать вывод: какой оффер дал ответы, а какой нужно отключить.');
  }

  if (acceptedInsights > 0) {
    recommendations.push('Принятые выводы сразу переносить в продуктовые задачи и тексты первого сообщения.');
  }

  return recommendations.slice(0, 5);
}

function buildTeamText(report: Omit<WeeklyReport, 'teamText'>) {
  const metricsText = report.metrics.map((metric) => `— ${metric.label}: ${metric.value}`).join('\n');
  const recommendationsText = report.recommendations.map((item, index) => `${index + 1}. ${item}`).join('\n');
  const insightsText = report.insightHighlights.map((item, index) => `${index + 1}. ${item.title}`).join('\n') || 'Пока нет новых выводов.';
  const refusalsText = report.refusalSummary.topReasons.slice(0, 5).map((item, index) => `${index + 1}. ${item.reason}: ${item.count}`).join('\n') || 'Причины отказов пока не зафиксированы.';

  return `Hutka — отчет за период: ${report.periodLabel}\n\nПоказатели:\n${metricsText}\n\nГлавные выводы:\n${insightsText}\n\nПричины отказов:\n${refusalsText}\n\nЧто делаем дальше:\n${recommendationsText || 'Следующее действие пока не указано.'}`;
}

export async function getWeeklyReport(): Promise<WeeklyReport> {
  const demoMode = !isSupabaseConfigured();
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - 7);

  const [leadAggregates, taskSummary, campaigns, surveys, insights, refusalSummary] = await Promise.all([
    getReportLeadAggregates(now),
    getTaskReportSummary(),
    getCampaigns(),
    getSurveys(),
    getInsights(),
    getRefusalAnalytics()
  ]);

  const totalContacts = leadAggregates.totalContacts;
  const newContacts = leadAggregates.newContacts;
  const interestedContacts = leadAggregates.interestedContacts;
  const testingContacts = leadAggregates.testingContacts;
  const surveyResponses = surveys.reduce((sum, survey) => sum + survey.answersCount, 0);

  const stageValues = new Map(leadAggregates.stageEntries);
  const funnelItems = canonicalFunnelStageNames
    .map((stage) => [stage, stageValues.get(stage) ?? 0] as [string, number])
    .filter(([, value]) => value > 0);

  const funnel = funnelItems.length > 0
    ? makeBarItems(funnelItems, 7).map((item) => ({ ...item, helper: percentage(item.value, totalContacts) }))
    : demoMode
      ? demoFunnel.map((item) => ({ name: item.label, value: item.count, width: item.percent, helper: item.percent }))
      : [];

  const topChannels = leadAggregates.topChannels.length > 0
    ? leadAggregates.topChannels
    : demoMode
      ? demoChannels.map((item) => ({ name: item.name, value: item.value, width: item.width }))
      : [];

  const topNiches = leadAggregates.topNiches.length > 0
    ? leadAggregates.topNiches
    : demoMode
      ? demoNiches.map((item) => ({ name: item.name, value: item.value, width: item.width }))
      : [];

  const weeklyDynamics = leadAggregates.weeklyDynamics;

  const overdueTasks = taskSummary.overdue;
  const todayTasks = taskSummary.today;
  const laterTasks = taskSummary.later;

  const activeCampaigns = campaigns.filter((campaign) => campaign.status === 'active').length;
  const acceptedInsights = insights.filter((insight) => insight.status === 'accepted').length;
  const campaignEfficiency = campaigns
    .map((campaign) => {
      const value = campaign.metrics.participants || campaign.metrics.surveys || campaign.metrics.responses;
      return {
        name: campaign.name,
        value,
        helper: `${campaign.metrics.contacts} контактов · ${campaign.metrics.conversion}`,
        width: '0%'
      };
    })
    .sort((a, b) => b.value - a.value)
    .slice(0, 5)
    .map((item, _, items) => {
      const max = Math.max(...items.map((entry) => entry.value), 1);
      return { ...item, width: item.value > 0 ? `${Math.max(8, Math.round((item.value / max) * 100))}%` : '0%' };
    });
  const nicheReaction = leadAggregates.nicheReaction;

  const metrics: ReportMetric[] = [
    { label: 'Всего контактов', value: String(demoMode ? totalContacts || 2842 : totalContacts), helper: `${demoMode ? newContacts || 312 : newContacts} новых за 7 дней`, tone: 'purple' },
    { label: 'Заинтересованы', value: String(demoMode ? interestedContacts || 128 : interestedContacts), helper: 'стадия “Заинтересован” или высокий score', tone: 'pink' },
    { label: 'Тестируют', value: String(demoMode ? testingContacts || 63 : testingContacts), helper: 'стадия “Тестирует”', tone: 'green' },
    { label: 'Ответов на анкеты', value: String(demoMode ? surveyResponses || 145 : surveyResponses), helper: `${surveys.length} анкет`, tone: 'blue' },
    { label: 'Просроченные действия', value: String(overdueTasks), helper: `${todayTasks} задач на сегодня`, tone: overdueTasks > 0 ? 'red' : 'green' },
    { label: 'Отказы', value: String(refusalSummary.total), helper: refusalSummary.topReasons[0] ? `топ: ${refusalSummary.topReasons[0].reason}` : 'причины не зафиксированы', tone: refusalSummary.total > 0 ? 'red' : 'gray' }
  ];

  const campaignHighlights: ReportHighlight[] = campaigns.slice(0, 3).map((campaign) => ({
    id: campaign.id,
    title: campaign.name,
    subtitle: `${campaign.channel} · ${campaign.metrics.contacts} контактов · ${campaign.metrics.conversion} в участников`,
    href: `/campaigns/${campaign.id}`,
    tone: campaign.status === 'finished' ? 'blue' : campaign.status === 'active' ? 'green' : 'gray'
  }));

  const surveyHighlights: ReportHighlight[] = surveys.slice(0, 3).map((survey) => ({
    id: survey.id,
    title: survey.title,
    subtitle: `${survey.answersCount} ответов · ${survey.questionsCount} вопросов`,
    href: `/surveys/${survey.id}`,
    tone: survey.status === 'active' ? 'green' : survey.status === 'draft' ? 'yellow' : 'gray'
  }));

  const insightHighlights: ReportHighlight[] = (insights.length > 0
    ? insights
    : demoMode
      ? demoDashboardInsights.map((title, index) => ({
        id: `demo-dashboard-${index}`,
        title,
        category: 'Маркетинговый вывод',
        importance: 'medium',
        status: 'new',
        importanceLabel: 'Средняя',
        statusLabel: 'Новый',
        createdAt: formatDate(now),
        relationsCount: 0
      }))
      : []
  ).slice(0, 4).map((insight) => ({
    id: insight.id,
    title: insight.title,
    subtitle: `${insight.category} · ${insight.importanceLabel}`,
    href: insight.id.startsWith('demo-dashboard') ? undefined : `/insights/${insight.id}`,
    tone: insight.importance === 'critical' ? 'red' : insight.importance === 'high' ? 'pink' : 'purple'
  }));

  const recommendations = buildRecommendations({
    topChannel: topChannels[0]?.name,
    topNiche: topNiches[0]?.name,
    overdueTasks,
    activeCampaigns,
    acceptedInsights
  });

  const reportWithoutText: Omit<WeeklyReport, 'teamText'> = {
    periodLabel: `${formatDate(weekStart)} — ${formatDate(now)}`,
    generatedAt: formatDateTime(now),
    metrics,
    weeklyDynamics,
    funnel,
    topChannels,
    topNiches,
    campaignEfficiency,
    nicheReaction,
    taskSummary: {
      total: taskSummary.total,
      overdue: overdueTasks,
      today: todayTasks,
      later: laterTasks
    },
    campaignHighlights,
    surveyHighlights,
    insightHighlights,
    refusalSummary,
    recommendations
  };

  return {
    ...reportWithoutText,
    teamText: buildTeamText(reportWithoutText)
  };
}
