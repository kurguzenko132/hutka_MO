import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { activity, leads as mockLeads, type Lead, type LeadType, type Priority } from '@/lib/data';
import { matchesSmartView } from '@/lib/lead-views';

const typeToDb: Record<LeadType, string> = {
  'Мастер': 'master',
  'Салон': 'salon',
  'Клиент': 'client',
  'Партнер': 'partner'
};

const dbToType: Record<string, LeadType> = {
  master: 'Мастер',
  salon: 'Салон',
  client: 'Клиент',
  partner: 'Партнер'
};

export const leadTypeToDb = typeToDb;

export type LeadOption = {
  id: string;
  name: string;
};

export type LeadFilters = {
  q?: string;
  type?: string;
  city?: string;
  niche?: string;
  stage?: string;
  source?: string;
  priority?: string;
  tag?: string;
  view?: string;
};

export type LeadFilterOptions = {
  types: string[];
  cities: string[];
  niches: string[];
  stages: string[];
  sources: string[];
  priorities: string[];
  tags: string[];
};

export type LeadInteraction = {
  id: string;
  date: string;
  title: string;
  text: string;
  channel?: string;
  result?: string;
};

export type LeadTask = {
  id: string;
  title: string;
  description?: string;
  dueDate: string;
  priority: string;
  status: string;
};

export function priorityToScore(priority: Priority) {
  if (priority === 'Высокий') return 85;
  if (priority === 'Средний') return 55;
  return 25;
}

function scoreToPriority(score?: number | null): Priority {
  if ((score ?? 0) >= 75) return 'Высокий';
  if ((score ?? 0) >= 45) return 'Средний';
  return 'Низкий';
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

function formatDate(value?: string | null, withTime = false) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('ru-RU', withTime ? { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' } : undefined);
}

function toDateInput(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function normalize(value?: string | null) {
  return String(value ?? '').trim().toLowerCase();
}

function unique(values: Array<string | undefined | null>) {
  return Array.from(new Set(values.map((value) => String(value ?? '').trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, 'ru')
  );
}

function matchesLeadFilters(lead: Lead, filters: LeadFilters = {}) {
  const q = normalize(filters.q);
  const exactChecks: Array<[string | undefined, string | undefined]> = [
    [lead.type, filters.type],
    [lead.city, filters.city],
    [lead.niche, filters.niche],
    [lead.stage, filters.stage],
    [lead.source, filters.source],
    [lead.priority, filters.priority]
  ];

  for (const [value, filter] of exactChecks) {
    if (filter && normalize(value) !== normalize(filter)) {
      return false;
    }
  }

  if (filters.tag && !lead.tags.some((tag) => normalize(tag) === normalize(filters.tag))) {
    return false;
  }

  if (filters.view && !matchesSmartView(lead, filters.view)) {
    return false;
  }

  if (!q) return true;

  const searchable = [
    lead.name,
    lead.type,
    lead.niche,
    lead.city,
    lead.stage,
    lead.source,
    lead.priority,
    lead.nextStep,
    lead.instagram,
    lead.telegram,
    lead.phone,
    lead.email,
    lead.notes,
    ...lead.tags
  ]
    .map((value) => normalize(value))
    .join(' ');

  return searchable.includes(q);
}

function interactionTitle(type?: string | null) {
  const map: Record<string, string> = {
    message: 'Сообщение',
    call: 'Звонок',
    meeting: 'Встреча',
    survey_sent: 'Опрос отправлен',
    survey_completed: 'Опрос пройден',
    note: 'Заметка',
    status_change: 'Изменение статуса'
  };

  return map[type ?? ''] ?? 'Активность';
}

function priorityLabel(priority?: string | null) {
  const map: Record<string, string> = {
    low: 'Низкий',
    medium: 'Средний',
    high: 'Высокий',
    urgent: 'Срочно'
  };

  return map[priority ?? ''] ?? 'Средний';
}

function statusLabel(status?: string | null) {
  const map: Record<string, string> = {
    todo: 'К выполнению',
    in_progress: 'В работе',
    done: 'Готово',
    cancelled: 'Отменено'
  };

  return map[status ?? ''] ?? 'К выполнению';
}

function mapDbLead(row: Record<string, unknown>): Lead {
  const score = typeof row.priority_score === 'number' ? row.priority_score : 0;
  const source = relatedName(row.sources) ?? 'Не указан';
  const stage = relatedName(row.funnel_stages) ?? 'Найден';
  const rawTags = Array.isArray(row.lead_tags) ? row.lead_tags : [];
  const tags = rawTags
    .map((item) => {
      if (!item || typeof item !== 'object') return undefined;
      return relatedName((item as { tags?: unknown }).tags);
    })
    .filter((tag): tag is string => Boolean(tag));

  return {
    id: String(row.id),
    name: String(row.name ?? 'Без имени'),
    type: dbToType[String(row.type)] ?? 'Мастер',
    niche: String(row.niche ?? 'Не указана'),
    city: String(row.city ?? 'Не указан'),
    stage,
    source,
    priority: scoreToPriority(score),
    nextStep: String(row.next_step ?? 'Связаться'),
    nextDate: formatDate(row.next_contact_date ? String(row.next_contact_date) : null),
    nextDateRaw: toDateInput(row.next_contact_date ? String(row.next_contact_date) : null),
    tags,
    score,
    instagram: row.instagram ? String(row.instagram) : undefined,
    telegram: row.telegram ? String(row.telegram) : undefined,
    phone: row.phone ? String(row.phone) : undefined,
    email: row.email ? String(row.email) : undefined,
    notes: row.notes ? String(row.notes) : undefined,
    refusalReason: row.refusal_reason ? String(row.refusal_reason) : relatedName(row.refusal_reasons),
    refusalComment: row.refusal_comment ? String(row.refusal_comment) : undefined,
    refusedAt: row.refused_at ? formatDate(String(row.refused_at), true) : undefined
  };
}

const leadSelect = 'id,name,type,niche,city,phone,telegram,instagram,email,priority_score,notes,next_step,next_contact_date,refusal_reason,refusal_comment,refused_at,created_at,sources(name),funnel_stages(name),refusal_reasons(name,color),lead_tags(tags(name))';

export async function getLeads(filters: LeadFilters = {}): Promise<Lead[]> {
  let items: Lead[];

  if (!isSupabaseConfigured()) {
    items = mockLeads;
  } else {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('leads')
      .select(leadSelect)
      .order('created_at', { ascending: false });

    if (error || !data) {
      items = mockLeads;
    } else {
      items = data.map((row) => mapDbLead(row as Record<string, unknown>));
    }
  }

  return items.filter((lead) => matchesLeadFilters(lead, filters));
}

export async function getLeadFilterOptions(): Promise<LeadFilterOptions> {
  const items = await getLeads();

  return {
    types: unique(items.map((lead) => lead.type)),
    cities: unique(items.map((lead) => lead.city)),
    niches: unique(items.map((lead) => lead.niche)),
    stages: unique(items.map((lead) => lead.stage)),
    sources: unique(items.map((lead) => lead.source)),
    priorities: unique(items.map((lead) => lead.priority)),
    tags: unique(items.flatMap((lead) => lead.tags))
  };
}

export async function getLeadById(id: string): Promise<Lead | null> {
  if (!isSupabaseConfigured()) {
    return mockLeads.find((lead) => lead.id === id) ?? null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('leads')
    .select(leadSelect)
    .eq('id', id)
    .maybeSingle();

  if (error || !data) {
    return mockLeads.find((lead) => lead.id === id) ?? null;
  }

  return mapDbLead(data as Record<string, unknown>);
}

export async function getLeadOptions(): Promise<LeadOption[]> {
  if (!isSupabaseConfigured()) {
    return mockLeads.map((lead) => ({ id: lead.id, name: lead.name }));
  }

  const supabase = await createClient();
  const { data, error } = await supabase.from('leads').select('id,name').order('name', { ascending: true });
  if (error || !data) return [];

  return data.map((lead) => ({ id: String(lead.id), name: String(lead.name) }));
}

export async function getLeadInteractions(leadId: string): Promise<LeadInteraction[]> {
  if (!isSupabaseConfigured()) {
    return activity.map((item, index) => ({ id: String(index), date: item.date, title: item.title, text: item.text }));
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('lead_interactions')
    .select('id,type,channel,text,result,created_at')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  return data.map((item) => ({
    id: String(item.id),
    date: formatDate(String(item.created_at), true),
    title: interactionTitle(item.type),
    text: String(item.text ?? '—'),
    channel: item.channel ? String(item.channel) : undefined,
    result: item.result ? String(item.result) : undefined
  }));
}

export async function getLeadTasks(leadId: string): Promise<LeadTask[]> {
  if (!isSupabaseConfigured()) {
    return [
      { id: 'demo-task-1', title: 'Написать повторно', description: 'Уточнить готовность к пилоту', dueDate: 'Сегодня', priority: 'Высокий', status: 'К выполнению' },
      { id: 'demo-task-2', title: 'Отправить опрос', description: 'Короткий опрос по текущей записи', dueDate: 'Завтра', priority: 'Средний', status: 'К выполнению' }
    ];
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('tasks')
    .select('id,title,description,due_date,priority,status')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  return data.map((task) => ({
    id: String(task.id),
    title: String(task.title),
    description: task.description ? String(task.description) : undefined,
    dueDate: formatDate(task.due_date ? String(task.due_date) : null),
    priority: priorityLabel(task.priority),
    status: statusLabel(task.status)
  }));
}

export type LeadStageOption = {
  id: string;
  name: string;
};

export type LeadRelationItem = {
  id: string;
  title: string;
  href: string;
  type: 'campaign' | 'survey' | 'insight' | 'hypothesis';
  label?: string;
  meta?: string;
};

export type LeadSurveyResponseGroup = {
  id: string;
  title: string;
  href: string;
  respondent?: string;
  contact?: string;
  date: string;
  answersCount: number;
};

export type LeadRelatedItems = {
  campaigns: LeadRelationItem[];
  surveys: LeadSurveyResponseGroup[];
  insights: LeadRelationItem[];
  hypotheses: LeadRelationItem[];
};

function relatedRow(item: unknown, key: string): Record<string, unknown> | null {
  if (!item || typeof item !== 'object') return null;
  const raw = (item as Record<string, unknown>)[key];
  if (Array.isArray(raw)) {
    return raw[0] && typeof raw[0] === 'object' ? raw[0] as Record<string, unknown> : null;
  }
  return raw && typeof raw === 'object' ? raw as Record<string, unknown> : null;
}

function relationTitle(row: Record<string, unknown>) {
  return String(row.title ?? row.name ?? 'Без названия');
}

function uniqueById<T extends { id: string }>(items: T[]) {
  const map = new Map<string, T>();
  for (const item of items) {
    if (!map.has(item.id)) map.set(item.id, item);
  }
  return Array.from(map.values());
}

export async function getLeadStageOptions(): Promise<LeadStageOption[]> {
  if (!isSupabaseConfigured()) {
    return unique(mockLeads.map((lead) => lead.stage)).map((stage, index) => ({ id: `demo-stage-${index}`, name: stage }));
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('funnel_stages')
    .select('id,name')
    .order('order_index', { ascending: true });

  if (error || !data) {
    return [];
  }

  return uniqueById(data.map((stage) => ({ id: String(stage.id), name: String(stage.name) })));
}

function buildFallbackRelatedItems(leadId: string): LeadRelatedItems {
  const lead = mockLeads.find((item) => item.id === leadId) ?? mockLeads[0];
  return {
    campaigns: [
      {
        id: 'demo-campaign-1',
        title: 'Мастера маникюра Минск — Instagram',
        href: '/campaigns/demo-campaign-1',
        type: 'campaign',
        label: 'Активна',
        meta: lead?.source ?? 'Instagram'
      }
    ],
    surveys: [
      {
        id: 'demo-survey-response-1',
        title: 'Опрос потребностей мастеров',
        href: '/surveys/demo-survey-1',
        respondent: lead?.name,
        contact: lead?.instagram ?? lead?.telegram,
        date: '21.05.2025',
        answersCount: 4
      }
    ],
    insights: [
      {
        id: 'demo-insight-1',
        title: 'Мастерам важнее новые клиенты, чем CRM',
        href: '/insights/demo-insight-1',
        type: 'insight',
        label: 'Высокая важность',
        meta: 'Маркетинговый вывод'
      }
    ],
    hypotheses: [
      {
        id: 'demo-hypothesis-1',
        title: 'Оффер про новых клиентов работает лучше CRM',
        href: '/hypotheses/demo-hypothesis-1',
        type: 'hypothesis',
        label: 'В проверке',
        meta: 'Оффер'
      }
    ]
  };
}

export async function getLeadRelatedItems(leadId: string): Promise<LeadRelatedItems> {
  if (!isSupabaseConfigured()) {
    return buildFallbackRelatedItems(leadId);
  }

  const supabase = await createClient();

  const [campaignsResult, surveysResult, insightsResult, hypothesesResult] = await Promise.all([
    supabase
      .from('campaign_leads')
      .select('campaigns(id,name,status,channel,created_at)')
      .eq('lead_id', leadId),
    supabase
      .from('survey_answers')
      .select('response_group_id,respondent_name,respondent_contact,created_at,surveys(id,title,type,status,slug)')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false }),
    supabase
      .from('insight_leads')
      .select('insights(id,title,category,importance,status,created_at)')
      .eq('lead_id', leadId),
    supabase
      .from('hypothesis_leads')
      .select('hypotheses(id,title,category,status,confidence,created_at)')
      .eq('lead_id', leadId)
  ]);

  const campaigns = campaignsResult.error || !campaignsResult.data
    ? []
    : campaignsResult.data
      .map((item) => relatedRow(item, 'campaigns'))
      .filter((row): row is Record<string, unknown> => Boolean(row))
      .map((campaign) => ({
        id: String(campaign.id),
        title: relationTitle(campaign),
        href: `/campaigns/${campaign.id}`,
        type: 'campaign' as const,
        label: String(campaign.status ?? 'active'),
        meta: String(campaign.channel ?? 'Кампания')
      }));

  const surveyGroups = new Map<string, LeadSurveyResponseGroup>();
  if (!surveysResult.error && surveysResult.data) {
    for (const item of surveysResult.data) {
      const row = item as Record<string, unknown>;
      const survey = relatedRow(row, 'surveys');
      const surveyId = survey?.id ? String(survey.id) : 'unknown';
      const responseGroupId = String(row.response_group_id ?? row.created_at ?? `${surveyId}-${surveyGroups.size}`);
      const key = `${surveyId}:${responseGroupId}`;
      const current = surveyGroups.get(key);
      if (current) {
        current.answersCount += 1;
        continue;
      }
      surveyGroups.set(key, {
        id: key,
        title: survey ? relationTitle(survey) : 'Опрос без названия',
        href: survey?.id ? `/surveys/${survey.id}` : '/surveys',
        respondent: row.respondent_name ? String(row.respondent_name) : undefined,
        contact: row.respondent_contact ? String(row.respondent_contact) : undefined,
        date: formatDate(row.created_at ? String(row.created_at) : null, true),
        answersCount: 1
      });
    }
  }

  const insights = insightsResult.error || !insightsResult.data
    ? []
    : insightsResult.data
      .map((item) => relatedRow(item, 'insights'))
      .filter((row): row is Record<string, unknown> => Boolean(row))
      .map((insight) => ({
        id: String(insight.id),
        title: relationTitle(insight),
        href: `/insights/${insight.id}`,
        type: 'insight' as const,
        label: String(insight.importance ?? 'medium'),
        meta: String(insight.category ?? 'Инсайт')
      }));

  const hypotheses = hypothesesResult.error || !hypothesesResult.data
    ? []
    : hypothesesResult.data
      .map((item) => relatedRow(item, 'hypotheses'))
      .filter((row): row is Record<string, unknown> => Boolean(row))
      .map((hypothesis) => ({
        id: String(hypothesis.id),
        title: relationTitle(hypothesis),
        href: `/hypotheses/${hypothesis.id}`,
        type: 'hypothesis' as const,
        label: String(hypothesis.status ?? 'new'),
        meta: String(hypothesis.category ?? 'Гипотеза')
      }));

  return {
    campaigns: uniqueById(campaigns),
    surveys: Array.from(surveyGroups.values()),
    insights: uniqueById(insights),
    hypotheses: uniqueById(hypotheses)
  };
}
