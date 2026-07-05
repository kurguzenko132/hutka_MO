import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { channels, funnel as mockFunnel, kpis as mockKpis, leads as mockLeads, niches, todayTasks } from '@/lib/data';
import { getTasks, type TaskListItem } from '@/lib/tasks';
import { getDashboardInsights } from '@/lib/insights';
import { getDashboardHypotheses, type HypothesisListItem } from '@/lib/hypotheses';
import { getRefusalAnalytics, type RefusalAnalytics } from '@/lib/refusals';
import { isInterestedStage, isTestingStage, normalizeStageName } from '@/lib/stages';

export type DashboardKpi = {
  label: string;
  value: string;
  delta: string;
  tone: 'purple' | 'pink' | 'green' | 'yellow' | 'red' | 'blue';
};

export type DashboardFunnelStep = {
  label: string;
  count: number;
  percent: string;
};

export type DashboardBarItem = {
  name: string;
  value: number;
  width: string;
};

export type DashboardHotContact = {
  id: string;
  name: string;
  meta: string;
  stage: string;
  score: number;
  href: string;
};

export type DashboardActivity = {
  id: string;
  title: string;
  text: string;
  date: string;
  href?: string;
};

export type DashboardData = {
  demoMode: boolean;
  periodLabel: string;
  kpis: DashboardKpi[];
  funnel: DashboardFunnelStep[];
  channels: DashboardBarItem[];
  niches: DashboardBarItem[];
  todayTasks: TaskListItem[];
  hotContacts: DashboardHotContact[];
  recentActivities: DashboardActivity[];
  insights: string[];
  hypotheses: HypothesisListItem[];
  refusals: RefusalAnalytics;
  focus: string;
};

type OverviewRow = {
  total_contacts?: number | null;
  new_contacts_week?: number | null;
  ready_to_pilot?: number | null;
  active_participants?: number | null;
  interested_contacts?: number | null;
  testing_contacts?: number | null;
  need_action_contacts?: number | null;
  overdue_tasks?: number | null;
  hot_contacts?: number | null;
};

type StageRow = {
  name?: string | null;
  stage?: string | null;
  contacts?: number | null;
};

type DistributionRow = {
  source?: string | null;
  niche?: string | null;
  contacts?: number | null;
};

type LeadRow = {
  id: string;
  name?: string | null;
  type?: string | null;
  niche?: string | null;
  city?: string | null;
  priority_score?: number | null;
  funnel_stages?: unknown;
};

type InteractionRow = {
  id: string;
  type?: string | null;
  text?: string | null;
  result?: string | null;
  created_at?: string | null;
  leads?: unknown;
};

function relatedLead(value: unknown): { id?: string; name?: string } {
  if (!value) return {};
  if (Array.isArray(value)) return relatedLead(value[0]);
  if (typeof value === 'object') {
    const item = value as { id?: unknown; name?: unknown };
    return {
      id: typeof item.id === 'string' ? item.id : undefined,
      name: typeof item.name === 'string' ? item.name : undefined
    };
  }
  return {};
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

function formatNumber(value?: number | null) {
  return new Intl.NumberFormat('ru-RU').format(value ?? 0);
}

function percent(part: number, total: number) {
  if (!total) return '0%';
  return `${Math.round((part / total) * 1000) / 10}%`;
}

function widthItems(items: Array<{ name: string; value: number }>, limit = 5): DashboardBarItem[] {
  const sorted = items.filter((item) => item.name).sort((a, b) => b.value - a.value).slice(0, limit);
  const max = sorted[0]?.value || 1;
  return sorted.map((item) => ({ ...item, width: `${Math.max(8, Math.round((item.value / max) * 100))}%` }));
}

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function interactionTitle(type?: string | null) {
  const map: Record<string, string> = {
    message: 'Сообщение',
    call: 'Звонок',
    meeting: 'Встреча',
    survey_sent: 'Анкета отправлена',
    survey_completed: 'Анкета пройдена',
    note: 'Заметка',
    status_change: 'Смена стадии',
    task_status: 'Обновление задачи'
  };
  return map[type ?? ''] ?? 'Активность';
}

function typeLabel(value?: string | null) {
  const map: Record<string, string> = {
    master: 'Мастер',
    salon: 'Салон',
    client: 'Клиент',
    partner: 'Партнер'
  };
  return map[value ?? ''] ?? 'Контакт';
}

function buildFocus({ needAction, interested, testing }: { needAction: number; interested: number; testing: number }) {
  if (needAction > 0) return `Закрой ${needAction} действий без внимания: это самый быстрый способ не потерять теплые контакты.`;
  if (interested > testing) return `Переведи ${interested - testing} заинтересованных контактов к конкретному тестированию или следующему шагу.`;
  if (testing > 0) return `Собери обратную связь у ${testing} контактов в тестировании и зафиксируй выводы для команды.`;
  return 'Добавь первые контакты, запусти анкету и собери первые выводы по beauty-рынку.';
}

function demoDashboardData(insights: string[], hypotheses: HypothesisListItem[], refusals: RefusalAnalytics): DashboardData {
  const demoTasks: TaskListItem[] = todayTasks.map((task, index) => ({
    id: `demo-dashboard-task-${index}`,
    title: task.title,
    dueDate: 'Сегодня',
    dueDateRaw: new Date().toISOString().slice(0, 10),
    priority: index === 0 ? 'Высокий' : 'Средний',
    priorityValue: index === 0 ? 'high' : 'medium',
    status: 'К выполнению',
    statusValue: 'todo',
    assignees: [],
    group: 'Сегодня'
  }));

  return {
    demoMode: true,
    periodLabel: new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    kpis: mockKpis.map((item) => ({ label: item.label, value: item.value, delta: item.delta, tone: item.tone as DashboardKpi['tone'] })),
    funnel: mockFunnel.map((item) => ({ label: item.label, count: item.count, percent: item.percent })),
    channels,
    niches,
    todayTasks: demoTasks,
    hotContacts: mockLeads.slice(0, 4).map((lead) => ({
      id: lead.id,
      name: lead.name,
      meta: `${lead.type} · ${lead.niche} · ${lead.city}`,
      stage: lead.stage,
      score: lead.score,
      href: `/people/${lead.id}`
    })),
    recentActivities: [
      { id: 'demo-a1', title: 'Анкета пройдена', text: 'Анна Смирнова оставила ответы по тестированию карты', date: 'Сегодня, 10:30', href: '/people/anna-smirnova' },
      { id: 'demo-a2', title: 'Смена стадии', text: 'Ольга Кузнецова переведена в “Ответил”', date: 'Сегодня, 09:15', href: '/people/olga-kuznetsova' },
      { id: 'demo-a3', title: 'Новый контакт', text: 'Добавлен салон Beauty Line из офлайн-канала', date: 'Вчера, 18:10', href: '/people/beauty-line' }
    ],
    insights,
    hypotheses,
    refusals,
    focus: 'В demo-режиме: добавь реальные контакты и подключи Supabase, чтобы dashboard начал считать запуск по твоим данным.'
  };
}

function emptyDashboardData(insights: string[], hypotheses: HypothesisListItem[], refusals: RefusalAnalytics): DashboardData {
  return {
    demoMode: false,
    periodLabel: new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    kpis: [
      { label: 'Всего контактов', value: '0', delta: '+0 за неделю', tone: 'purple' },
      { label: 'Заинтересованы', value: '0', delta: '0% от базы', tone: 'pink' },
      { label: 'Тестируют', value: '0', delta: '0% от базы', tone: 'green' },
      { label: 'Нужно действие', value: '0', delta: 'всё закрыто', tone: 'green' }
    ],
    funnel: [],
    channels: [],
    niches: [],
    todayTasks: [],
    hotContacts: [],
    recentActivities: [],
    insights,
    hypotheses,
    refusals,
    focus: 'Добавь первые контакты, запусти анкету и собери первые выводы по beauty-рынку.'
  };
}

export async function getDashboardData(): Promise<DashboardData> {
  const [insights, hypotheses, refusals] = await Promise.all([getDashboardInsights(), getDashboardHypotheses(), getRefusalAnalytics()]);

  if (!isSupabaseConfigured()) {
    return demoDashboardData(insights, hypotheses, refusals);
  }

  try {
    const supabase = await createClient();
    const [overviewRes, stagesRes, sourcesRes, nichesRes, tasks, hotRes, activitiesRes] = await Promise.all([
      supabase.from('view_report_overview').select('*').maybeSingle(),
      supabase.from('view_funnel_stage_summary').select('name,contacts').order('order_index', { ascending: true }),
      supabase.from('view_report_source_distribution').select('source,contacts').limit(5),
      supabase.from('view_report_niche_distribution').select('niche,contacts').limit(5),
      getTasks({ status: 'active' }),
      supabase
        .from('leads')
        .select('id,name,type,niche,city,priority_score,funnel_stages(name)')
        .order('priority_score', { ascending: false })
        .limit(5),
      supabase
        .from('lead_interactions')
        .select('id,type,text,result,created_at,leads(id,name)')
        .order('created_at', { ascending: false })
        .limit(6)
    ]);

    if (overviewRes.error) throw overviewRes.error;

    const overview = (overviewRes.data ?? {}) as OverviewRow;
    const total = overview.total_contacts ?? 0;
    const overdue = overview.overdue_tasks ?? 0;

    const stageMap = new Map<string, number>();
    for (const row of ((stagesRes.data ?? []) as StageRow[]).filter((item) => (item.contacts ?? 0) > 0)) {
      const name = normalizeStageName(row.name ?? row.stage);
      stageMap.set(name, (stageMap.get(name) ?? 0) + (row.contacts ?? 0));
    }
    const stageRows = Array.from(stageMap.entries()).map(([name, contacts]) => ({ name, contacts }));
    const funnel = stageRows.map((row) => ({ label: row.name, count: row.contacts, percent: percent(row.contacts, total) }));
    const interestedByStage = stageRows.reduce((sum, row) => sum + (isInterestedStage(row.name) ? row.contacts : 0), 0);
    const testingByStage = stageRows.reduce((sum, row) => sum + (isTestingStage(row.name) ? row.contacts : 0), 0);
    const interested = overview.interested_contacts ?? (interestedByStage > 0 ? interestedByStage : overview.ready_to_pilot ?? 0);
    const testing = overview.testing_contacts ?? (testingByStage > 0 ? testingByStage : overview.active_participants ?? 0);
    const needAction = overview.need_action_contacts ?? overdue;

    const hotContacts = ((hotRes.data ?? []) as LeadRow[]).map((lead) => ({
      id: lead.id,
      name: lead.name ?? 'Без имени',
      meta: `${typeLabel(lead.type)} · ${lead.niche || 'Ниша не указана'} · ${lead.city || 'Город не указан'}`,
      stage: normalizeStageName(relatedName(lead.funnel_stages)),
      score: lead.priority_score ?? 0,
      href: `/people/${lead.id}`
    }));

    const recentActivities = ((activitiesRes.data ?? []) as InteractionRow[]).map((item) => {
      const lead = relatedLead(item.leads);
      return {
        id: item.id,
        title: interactionTitle(item.type),
        text: `${lead.name ? `${lead.name}: ` : ''}${item.text || item.result || 'Без описания'}`,
        date: formatDateTime(item.created_at),
        href: lead.id ? `/people/${lead.id}` : undefined
      };
    });

    return {
      demoMode: false,
      periodLabel: new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
      kpis: [
        { label: 'Всего контактов', value: formatNumber(total), delta: `+${formatNumber(overview.new_contacts_week)} за неделю`, tone: 'purple' },
        { label: 'Заинтересованы', value: formatNumber(interested), delta: `${percent(interested, total)} от базы`, tone: 'pink' },
        { label: 'Тестируют', value: formatNumber(testing), delta: `${percent(testing, total)} от базы`, tone: 'green' },
        { label: 'Нужно действие', value: formatNumber(needAction), delta: needAction > 0 ? 'требуют внимания' : 'всё закрыто', tone: needAction > 0 ? 'red' : 'green' }
      ],
      funnel,
      channels: widthItems(((sourcesRes.data ?? []) as DistributionRow[]).map((row) => ({ name: row.source ?? 'Не указан', value: row.contacts ?? 0 }))),
      niches: widthItems(((nichesRes.data ?? []) as DistributionRow[]).map((row) => ({ name: row.niche ?? 'Не указана', value: row.contacts ?? 0 }))),
      todayTasks: tasks.slice(0, 5),
      hotContacts,
      recentActivities,
      insights,
      hypotheses,
      refusals,
      focus: buildFocus({ needAction, interested, testing })
    };
  } catch {
    return emptyDashboardData(insights, hypotheses, refusals);
  }
}
