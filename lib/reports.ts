import { getCampaigns } from '@/lib/campaigns';
import { getHypotheses } from '@/lib/hypotheses';
import { getInsights } from '@/lib/insights';
import { getSurveys } from '@/lib/surveys';
import { getTasks } from '@/lib/tasks';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { channels as demoChannels, funnel as demoFunnel, insights as demoDashboardInsights, niches as demoNiches } from '@/lib/data';

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
  funnel: ReportBarItem[];
  topChannels: ReportBarItem[];
  topNiches: ReportBarItem[];
  taskSummary: {
    total: number;
    overdue: number;
    today: number;
    later: number;
  };
  campaignHighlights: ReportHighlight[];
  surveyHighlights: ReportHighlight[];
  insightHighlights: ReportHighlight[];
  hypothesisHighlights: ReportHighlight[];
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
  return relatedName(value) ?? 'Найден';
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

function groupCount(items: string[]) {
  return Array.from(
    items.reduce((acc, item) => {
      acc.set(item, (acc.get(item) ?? 0) + 1);
      return acc;
    }, new Map<string, number>())
  );
}

async function getRawLeads(): Promise<RawLead[]> {
  if (!isSupabaseConfigured()) {
    return [
      { id: 'demo-1', name: 'Анна Смирнова', type: 'master', niche: 'Брови и ресницы', city: 'Москва', priority_score: 86, created_at: new Date().toISOString(), sources: { name: 'Instagram' }, funnel_stages: { name: 'Тест' } },
      { id: 'demo-2', name: 'Екатерина Лебедева', type: 'salon', niche: 'Маникюр', city: 'Санкт-Петербург', priority_score: 62, created_at: new Date().toISOString(), sources: { name: 'Telegram' }, funnel_stages: { name: 'Опрос' } },
      { id: 'demo-3', name: 'Ольга Кузнецова', type: 'master', niche: 'Косметология', city: 'Казань', priority_score: 67, created_at: new Date().toISOString(), sources: { name: 'Рекомендация' }, funnel_stages: { name: 'Ответил' } },
      { id: 'demo-4', name: 'Салон Beauty Line', type: 'salon', niche: 'Парикмахерские', city: 'Новосибирск', priority_score: 41, created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString(), sources: { name: 'Офлайн' }, funnel_stages: { name: 'Написал' } },
      { id: 'demo-5', name: 'Дарья Волкова', type: 'master', niche: 'Маникюр', city: 'Екатеринбург', priority_score: 38, created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(), sources: { name: 'TikTok' }, funnel_stages: { name: 'Найден' } }
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

function buildRecommendations({
  topChannel,
  topNiche,
  overdueTasks,
  activeCampaigns,
  acceptedInsights,
  testingHypotheses
}: {
  topChannel?: string;
  topNiche?: string;
  overdueTasks: number;
  activeCampaigns: number;
  acceptedInsights: number;
  testingHypotheses: number;
}) {
  const recommendations: string[] = [];

  if (topChannel) {
    recommendations.push(`Усилить канал «${topChannel}»: он сейчас дает лучший объем контактов.`);
  }

  if (topNiche) {
    recommendations.push(`Сфокусировать ближайшую выборку на нише «${topNiche}», чтобы быстрее набрать плотность для пилота.`);
  }

  if (overdueTasks > 0) {
    recommendations.push(`Закрыть ${overdueTasks} просроченных действий, чтобы не терять теплые контакты.`);
  }

  if (activeCampaigns > 0) {
    recommendations.push('По активным кампаниям зафиксировать вывод: какой оффер дал ответы, а какой нужно отключить.');
  }

  if (testingHypotheses > 0) {
    recommendations.push(`Для ${testingHypotheses} гипотез в проверке назначить конкретный следующий замер или интервью.`);
  }

  if (acceptedInsights > 0) {
    recommendations.push('Принятые инсайты сразу переносить в продуктовые задачи и тексты первого сообщения.');
  }

  return recommendations.slice(0, 5);
}

function buildTeamText(report: Omit<WeeklyReport, 'teamText'>) {
  const metricsText = report.metrics.map((metric) => `— ${metric.label}: ${metric.value}`).join('\n');
  const recommendationsText = report.recommendations.map((item, index) => `${index + 1}. ${item}`).join('\n');
  const insightsText = report.insightHighlights.map((item, index) => `${index + 1}. ${item.title}`).join('\n') || 'Пока нет новых инсайтов.';
  const hypothesesText = report.hypothesisHighlights.map((item, index) => `${index + 1}. ${item.title}`).join('\n') || 'Пока нет гипотез в проверке.';

  return `Hutka — отчет за период: ${report.periodLabel}\n\nПоказатели:\n${metricsText}\n\nГлавные инсайты:\n${insightsText}\n\nГипотезы / проверки:\n${hypothesesText}\n\nЧто делаем дальше:\n${recommendationsText || 'Следующее действие пока не указано.'}`;
}

export async function getWeeklyReport(): Promise<WeeklyReport> {
  const demoMode = !isSupabaseConfigured();
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - 7);

  const [rawLeads, tasks, campaigns, surveys, insights, hypotheses] = await Promise.all([
    getRawLeads(),
    getTasks(),
    getCampaigns(),
    getSurveys(),
    getInsights(),
    getHypotheses()
  ]);

  const totalContacts = rawLeads.length;
  const newContacts = rawLeads.filter((lead) => isDateWithin(lead.created_at, weekStart)).length;
  const hotContacts = rawLeads.filter((lead) => (lead.priority_score ?? 0) >= 75).length;
  const readyToPilot = rawLeads.filter((lead) => ['Тест', 'Активен'].includes(normalizeStage(lead.funnel_stages)) || (lead.priority_score ?? 0) >= 75).length;
  const activeParticipants = rawLeads.filter((lead) => normalizeStage(lead.funnel_stages) === 'Активен').length;
  const surveyResponses = surveys.reduce((sum, survey) => sum + survey.answersCount, 0);

  const stageOrder = ['Найден', 'Написал', 'Ответил', 'Опрос', 'Тест', 'Активен', 'Отказ'];
  const stages = new Map(stageOrder.map((stage) => [stage, 0]));
  rawLeads.forEach((lead) => {
    const stage = normalizeStage(lead.funnel_stages);
    stages.set(stage, (stages.get(stage) ?? 0) + 1);
  });

  const funnelItems = stageOrder
    .map((stage) => [stage, stages.get(stage) ?? 0] as [string, number])
    .filter(([, value]) => value > 0);

  const funnel = funnelItems.length > 0
    ? makeBarItems(funnelItems, 7).map((item) => ({ ...item, helper: percentage(item.value, totalContacts) }))
    : demoMode
      ? demoFunnel.map((item) => ({ name: item.label, value: item.count, width: item.percent, helper: item.percent }))
      : [];

  const topChannels = rawLeads.length > 0
    ? makeBarItems(groupCount(rawLeads.map((lead) => normalizeSource(lead.sources))))
    : demoMode
      ? demoChannels.map((item) => ({ name: item.name, value: item.value, width: item.width }))
      : [];

  const topNiches = rawLeads.length > 0
    ? makeBarItems(groupCount(rawLeads.map((lead) => lead.niche || 'Не указана')))
    : demoMode
      ? demoNiches.map((item) => ({ name: item.name, value: item.value, width: item.width }))
      : [];

  const overdueTasks = tasks.filter((task) => task.group === 'Просрочено').length;
  const todayTasks = tasks.filter((task) => task.group === 'Сегодня').length;
  const laterTasks = tasks.filter((task) => task.group === 'Позже').length;

  const activeCampaigns = campaigns.filter((campaign) => campaign.status === 'active').length;
  const acceptedInsights = insights.filter((insight) => insight.status === 'accepted').length;
  const testingHypotheses = hypotheses.filter((hypothesis) => ['testing', 'needs_data', 'new'].includes(hypothesis.status)).length;

  const metrics: ReportMetric[] = [
    { label: 'Всего контактов', value: String(demoMode ? totalContacts || 2842 : totalContacts), helper: `${demoMode ? newContacts || 312 : newContacts} новых за 7 дней`, tone: 'purple' },
    { label: 'Готовы к пилоту', value: String(demoMode ? readyToPilot || 128 : readyToPilot), helper: `${demoMode ? hotContacts || 27 : hotContacts} горячих контактов`, tone: 'pink' },
    { label: 'Активные участники', value: String(demoMode ? activeParticipants || 63 : activeParticipants), helper: 'стадия “Активен”', tone: 'green' },
    { label: 'Ответов на опросы', value: String(demoMode ? surveyResponses || 145 : surveyResponses), helper: `${surveys.length} опросников`, tone: 'blue' },
    { label: 'Просроченные действия', value: String(overdueTasks), helper: `${todayTasks} задач на сегодня`, tone: overdueTasks > 0 ? 'red' : 'green' }
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

  const insightHighlights: ReportHighlight[] = (insights.length > 0 ? insights : demoDashboardInsights.map((title, index) => ({
    id: `demo-dashboard-${index}`,
    title,
    category: 'Маркетинговый вывод',
    importance: 'medium',
    status: 'new',
    importanceLabel: 'Средняя',
    statusLabel: 'Новый',
    createdAt: formatDate(now),
    relationsCount: 0
  }))).slice(0, 4).map((insight) => ({
    id: insight.id,
    title: insight.title,
    subtitle: `${insight.category} · ${insight.importanceLabel}`,
    href: insight.id.startsWith('demo-dashboard') ? undefined : `/insights/${insight.id}`,
    tone: insight.importance === 'critical' ? 'red' : insight.importance === 'high' ? 'pink' : 'purple'
  }));

  const hypothesisHighlights: ReportHighlight[] = hypotheses.slice(0, 4).map((hypothesis) => ({
    id: hypothesis.id,
    title: hypothesis.title,
    subtitle: `${hypothesis.statusLabel} · уверенность: ${hypothesis.confidenceLabel}`,
    href: `/hypotheses/${hypothesis.id}`,
    tone: hypothesis.status === 'validated' ? 'green' : hypothesis.status === 'invalidated' ? 'red' : hypothesis.status === 'testing' ? 'yellow' : 'blue'
  }));

  const recommendations = buildRecommendations({
    topChannel: topChannels[0]?.name,
    topNiche: topNiches[0]?.name,
    overdueTasks,
    activeCampaigns,
    acceptedInsights,
    testingHypotheses
  });

  const reportWithoutText: Omit<WeeklyReport, 'teamText'> = {
    periodLabel: `${formatDate(weekStart)} — ${formatDate(now)}`,
    generatedAt: formatDateTime(now),
    metrics,
    funnel,
    topChannels,
    topNiches,
    taskSummary: {
      total: tasks.length,
      overdue: overdueTasks,
      today: todayTasks,
      later: laterTasks
    },
    campaignHighlights,
    surveyHighlights,
    insightHighlights,
    hypothesisHighlights,
    recommendations
  };

  return {
    ...reportWithoutText,
    teamText: buildTeamText(reportWithoutText)
  };
}
