import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { activity, leads as mockLeads, type Lead, type LeadType, type Priority } from '@/lib/data';
import { matchesSmartView, type LeadSmartViewCounts } from '@/lib/lead-views';
import { canonicalFunnelStageNames, normalizeStageName, orderStageNames, uniqueNormalizedTags } from '@/lib/stages';

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

export type LeadDirectoryPage = {
  items: Lead[];
  total: number;
  currentPage: number;
  pageCount: number;
  pageSize: number;
};

export type LeadDirectoryMeta = {
  total: number;
  options: LeadFilterOptions;
  smartViewCounts: LeadSmartViewCounts;
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
    survey_sent: 'Анкета отправлена',
    survey_completed: 'Анкета пройдена',
    note: 'Заметка',
    status_change: 'Изменение статуса'
  };

  return map[type ?? ''] ?? 'Активность';
}

function priorityLabel(priority?: string | null) {
  const map: Record<string, string> = {
    none: 'Без приоритета',
    low: 'Низкий',
    medium: 'Средний',
    high: 'Высокий',
    urgent: 'Срочно'
  };

  return map[priority ?? ''] ?? 'Без приоритета';
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
  const stage = normalizeStageName(relatedName(row.funnel_stages));
  const rawTags = Array.isArray(row.lead_tags) ? row.lead_tags : [];
  const tags = uniqueNormalizedTags(rawTags
    .map((item) => {
      if (!item || typeof item !== 'object') return undefined;
      return relatedName((item as { tags?: unknown }).tags);
    })
    .filter((tag): tag is string => Boolean(tag)));

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
    refusedAt: row.refused_at ? formatDate(String(row.refused_at), true) : undefined,
    createdAt: row.created_at ? formatDate(String(row.created_at), true) : undefined
  };
}

const leadSelect = 'id,name,type,niche,city,phone,telegram,instagram,email,priority_score,notes,next_step,next_contact_date,refusal_reason,refusal_comment,refused_at,created_at,sources(name),funnel_stages(name),refusal_reasons(name,color),lead_tags(tags(name))';

const getAllLeads = cache(async (): Promise<Lead[]> => {
  if (!isSupabaseConfigured()) {
    return mockLeads;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('leads')
    .select(leadSelect)
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return data.map((row) => mapDbLead(row as Record<string, unknown>));
});

function safeNumber(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function stringList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return unique(value.map((item) => typeof item === 'string' ? item : String(item ?? '')));
}

function fallbackSmartViewCounts(items: Lead[]): LeadSmartViewCounts {
  const count = (view: string) => items.filter((lead) => matchesSmartView(lead, view)).length;
  return {
    all: items.length,
    interested: count('interested'),
    testing: count('testing'),
    'need-write': count('need-write'),
    unanswered: count('unanswered'),
    paused: count('paused'),
    refusals: count('refusals'),
    'no-next-step': count('no-next-step')
  };
}

function directoryMetaFromItems(items: Lead[]): LeadDirectoryMeta {
  return {
    total: items.length,
    options: {
      types: unique(items.map((lead) => lead.type)),
      cities: unique(items.map((lead) => lead.city)),
      niches: unique(items.map((lead) => lead.niche)),
      stages: orderStageNames(items.map((lead) => lead.stage)),
      sources: unique(items.map((lead) => lead.source)),
      priorities: unique(items.map((lead) => lead.priority)),
      tags: unique(items.flatMap((lead) => lead.tags))
    },
    smartViewCounts: fallbackSmartViewCounts(items)
  };
}

export async function getLeads(filters: LeadFilters = {}): Promise<Lead[]> {
  const items = await getAllLeads();
  return items.filter((lead) => matchesLeadFilters(lead, filters));
}

export async function getLeadFilterOptions(): Promise<LeadFilterOptions> {
  return (await getLeadDirectoryMeta()).options;
}

async function getLeadDirectoryPageFallback(filters: LeadFilters, requestedPage: number, pageSize: number): Promise<LeadDirectoryPage> {
  const items = await getLeads(filters);
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(Math.max(requestedPage, 1), pageCount);
  return {
    items: items.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    total: items.length,
    currentPage,
    pageCount,
    pageSize
  };
}

function directoryPageParams(filters: LeadFilters, page: number, pageSize: number) {
  return {
    p_q: filters.q || null,
    p_type: filters.type || null,
    p_city: filters.city || null,
    p_niche: filters.niche || null,
    p_stage: filters.stage || null,
    p_source: filters.source || null,
    p_priority: filters.priority || null,
    p_tag: filters.tag || null,
    p_view: filters.view || null,
    p_offset: (page - 1) * pageSize,
    p_limit: pageSize
  };
}

function parseDirectoryPagePayload(data: unknown) {
  if (!data || typeof data !== 'object') return null;
  const payload = data as { total?: unknown; items?: unknown };
  const rawItems = Array.isArray(payload.items) ? payload.items : [];
  return {
    total: Math.max(0, safeNumber(payload.total)),
    items: rawItems
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
      .map(mapDbLead)
  };
}

export async function getLeadDirectoryPage(
  filters: LeadFilters = {},
  requestedPage = 1,
  requestedPageSize = 50
): Promise<LeadDirectoryPage> {
  const pageSize = Math.min(Math.max(Math.floor(requestedPageSize) || 50, 1), 200);
  const page = Math.max(Math.floor(requestedPage) || 1, 1);

  if (!isSupabaseConfigured()) {
    return getLeadDirectoryPageFallback(filters, page, pageSize);
  }

  try {
    const supabase = await createClient();
    const firstResult = await supabase.rpc('get_lead_directory_page', directoryPageParams(filters, page, pageSize));
    if (firstResult.error) return getLeadDirectoryPageFallback(filters, page, pageSize);

    const firstPayload = parseDirectoryPagePayload(firstResult.data);
    if (!firstPayload) return getLeadDirectoryPageFallback(filters, page, pageSize);

    const pageCount = Math.max(1, Math.ceil(firstPayload.total / pageSize));
    const currentPage = Math.min(page, pageCount);
    if (currentPage === page) {
      return { ...firstPayload, currentPage, pageCount, pageSize };
    }

    const finalResult = await supabase.rpc('get_lead_directory_page', directoryPageParams(filters, currentPage, pageSize));
    const finalPayload = finalResult.error ? null : parseDirectoryPagePayload(finalResult.data);
    return {
      items: finalPayload?.items ?? [],
      total: finalPayload?.total ?? firstPayload.total,
      currentPage,
      pageCount,
      pageSize
    };
  } catch {
    return getLeadDirectoryPageFallback(filters, page, pageSize);
  }
}

const getLeadDirectoryMeta = cache(async (): Promise<LeadDirectoryMeta> => {
  if (!isSupabaseConfigured()) {
    return directoryMetaFromItems(await getAllLeads());
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('get_lead_directory_meta');
    if (error || !data || typeof data !== 'object') {
      return directoryMetaFromItems(await getAllLeads());
    }

    const payload = data as Record<string, unknown>;
    const rawCounts = payload.smart_counts && typeof payload.smart_counts === 'object'
      ? payload.smart_counts as Record<string, unknown>
      : {};

    return {
      total: Math.max(0, safeNumber(payload.total)),
      options: {
        types: stringList(payload.types),
        cities: stringList(payload.cities),
        niches: stringList(payload.niches),
        stages: orderStageNames(stringList(payload.stages)),
        sources: stringList(payload.sources),
        priorities: stringList(payload.priorities),
        tags: stringList(payload.tags)
      },
      smartViewCounts: {
        all: safeNumber(rawCounts.all),
        interested: safeNumber(rawCounts.interested),
        testing: safeNumber(rawCounts.testing),
        'need-write': safeNumber(rawCounts['need-write']),
        unanswered: safeNumber(rawCounts.unanswered),
        paused: safeNumber(rawCounts.paused),
        refusals: safeNumber(rawCounts.refusals),
        'no-next-step': safeNumber(rawCounts['no-next-step'])
      }
    };
  } catch {
    return directoryMetaFromItems(await getAllLeads());
  }
});

export { getLeadDirectoryMeta };

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

  if (error || !data) return null;

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

export async function getLeadOptionById(id: string): Promise<LeadOption | null> {
  const leadId = id.trim();
  if (!leadId) return null;
  if (!isSupabaseConfigured()) {
    const lead = mockLeads.find((item) => item.id === leadId);
    return lead ? { id: lead.id, name: lead.name } : null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('leads')
    .select('id,name')
    .eq('id', leadId)
    .maybeSingle();
  if (error || !data) return null;
  return { id: String(data.id), name: String(data.name) };
}

export async function getLeadInteractions(leadId: string, limit?: number): Promise<LeadInteraction[]> {
  if (!isSupabaseConfigured()) {
    const items = activity.map((item, index) => ({ id: String(index), date: item.date, title: item.title, text: item.text }));
    return limit ? items.slice(0, limit) : items;
  }

  const supabase = await createClient();
  let query = supabase
    .from('lead_interactions')
    .select('id,type,channel,text,result,created_at')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false });

  if (limit) {
    query = query.limit(limit);
  }

  const { data, error } = await query;

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
      { id: 'demo-task-1', title: 'Написать повторно', description: 'Уточнить интерес к тестированию', dueDate: 'Сегодня', priority: 'Высокий', status: 'К выполнению' },
      { id: 'demo-task-2', title: 'Отправить анкету', description: 'Короткая анкета по текущей записи', dueDate: 'Завтра', priority: 'Средний', status: 'К выполнению' }
    ];
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('tasks')
    .select('id,title,description,due_date,priority,status')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false })
    .limit(100);

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
    return canonicalFunnelStageNames.map((stage, index) => ({ id: `demo-stage-${index}`, name: stage }));
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('funnel_stages')
    .select('id,name')
    .order('order_index', { ascending: true });

  if (error || !data) {
    return [];
  }

  const normalized = new Map<string, LeadStageOption>();
  for (const stage of data) {
    const name = normalizeStageName(String(stage.name));
    if (!normalized.has(name)) normalized.set(name, { id: String(stage.id), name });
  }

  canonicalFunnelStageNames.forEach((name, index) => {
    if (!normalized.has(name)) normalized.set(name, { id: name, name });
  });

  return orderStageNames(Array.from(normalized.keys())).map((name) => normalized.get(name) as LeadStageOption);
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
        title: 'Анкета потребностей мастеров',
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
    ]
  };
}

export async function getLeadRelatedItems(leadId: string): Promise<LeadRelatedItems> {
  if (!isSupabaseConfigured()) {
    return buildFallbackRelatedItems(leadId);
  }

  const supabase = await createClient();

  const [campaignsResult, surveysResult, insightsResult] = await Promise.all([
    supabase
      .from('campaign_leads')
      .select('campaigns(id,name,status,channel,created_at)')
      .eq('lead_id', leadId)
      .limit(100),
    supabase
      .from('survey_answers')
      .select('response_group_id,respondent_name,respondent_contact,created_at,surveys(id,title,type,status,slug)')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .limit(500),
    supabase
      .from('insight_leads')
      .select('insights(id,title,category,importance,status,created_at)')
      .eq('lead_id', leadId)
      .limit(100)
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
        title: survey ? relationTitle(survey) : 'Анкета без названия',
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
        meta: String(insight.category ?? 'Вывод')
      }));

  return {
    campaigns: uniqueById(campaigns),
    surveys: Array.from(surveyGroups.values()),
    insights: uniqueById(insights)
  };
}
