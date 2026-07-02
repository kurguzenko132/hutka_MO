import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { insights as dashboardMockInsights, leads as mockLeads } from '@/lib/data';

export type InsightImportance = 'low' | 'medium' | 'high' | 'critical';
export type InsightStatus = 'new' | 'in_review' | 'accepted' | 'archived';

export type InsightRelation = {
  id: string;
  name: string;
  href: string;
  type: 'lead' | 'campaign' | 'survey';
};

export type InsightListItem = {
  id: string;
  title: string;
  description?: string;
  category: string;
  evidence?: string;
  importance: InsightImportance;
  importanceLabel: string;
  status: InsightStatus;
  statusLabel: string;
  nextAction?: string;
  createdAt: string;
  relationsCount: number;
};

export type InsightDetail = InsightListItem & {
  leads: InsightRelation[];
  campaigns: InsightRelation[];
  surveys: InsightRelation[];
};

export type InsightOption = {
  id: string;
  name: string;
};

const demoInsights: InsightDetail[] = [
  {
    id: 'demo-insight-1',
    title: 'Мастера реагируют на “новые клиенты”, а не на “CRM”',
    description: 'Большинство индивидуальных мастеров воспринимают CRM как второстепенную ценность. Основной интерес появляется, когда речь идет о новых заявках с карты.',
    category: 'Маркетинговый вывод',
    evidence: '31 из 47 мастеров сказали, что главная боль — нехватка клиентов. В кампаниях оффер про карту дал больше ответов, чем оффер про CRM.',
    importance: 'critical',
    importanceLabel: 'Критично',
    status: 'accepted',
    statusLabel: 'Принят',
    nextAction: 'В коммуникации продавать “новые заявки с карты”, а CRM показывать как удобный инструмент внутри.',
    createdAt: '21.05.2025',
    relationsCount: 3,
    leads: mockLeads.slice(0, 2).map((lead) => ({ id: lead.id, name: lead.name, href: `/people/${lead.id}`, type: 'lead' })),
    campaigns: [{ id: 'demo-campaign-1', name: 'Мастера маникюра Минск — Instagram', href: '/campaigns/demo-campaign-1', type: 'campaign' }],
    surveys: []
  },
  {
    id: 'demo-insight-2',
    title: 'Главный барьер — заполнение профиля без гарантии заявок',
    description: 'Мастера готовы смотреть продукт, но не хотят тратить время на заполнение профиля, если не понимают, будут ли реальные клиенты.',
    category: 'Онбординг',
    evidence: 'В переписках повторяется вопрос: “А клиенты точно будут?”. В опросах несколько мастеров указали, что им нужен быстрый старт.',
    importance: 'high',
    importanceLabel: 'Высокая',
    status: 'in_review',
    statusLabel: 'На проверке',
    nextAction: 'Сделать короткий онбординг профиля за 3–5 минут и шаблон заполнения услуг.',
    createdAt: '22.05.2025',
    relationsCount: 1,
    leads: [mockLeads[2]].filter(Boolean).map((lead) => ({ id: lead.id, name: lead.name, href: `/people/${lead.id}`, type: 'lead' })),
    campaigns: [],
    surveys: []
  },
  {
    id: 'demo-insight-3',
    title: 'Telegram дает меньше контактов, но выше качество',
    description: 'В Telegram меньше объем, но люди чаще отвечают развернуто и быстрее соглашаются на опрос или пилот.',
    category: 'Канал привлечения',
    evidence: 'В демо-кампании Telegram конверсия в пилот выше, чем в Instagram.',
    importance: 'medium',
    importanceLabel: 'Средняя',
    status: 'new',
    statusLabel: 'Новый',
    nextAction: 'Проверить еще 2–3 тематических чата и сравнить качество контактов.',
    createdAt: '22.05.2025',
    relationsCount: 1,
    leads: [],
    campaigns: [{ id: 'demo-campaign-2', name: 'Бровисты Брест — Telegram', href: '/campaigns/demo-campaign-2', type: 'campaign' }],
    surveys: []
  }
];

export const insightCategories = [
  'Боль',
  'Возражение',
  'Желание',
  'Продуктовая идея',
  'Маркетинговый вывод',
  'Сегмент',
  'Канал привлечения',
  'Цена',
  'Конкуренты',
  'Онбординг',
  'Карта',
  'CRM'
];

export const insightImportanceToDb: Record<string, InsightImportance> = {
  'Низкая': 'low',
  'Средняя': 'medium',
  'Высокая': 'high',
  'Критично': 'critical'
};

export const insightStatusToDb: Record<string, InsightStatus> = {
  'Новый': 'new',
  'На проверке': 'in_review',
  'Принят': 'accepted',
  'В архиве': 'archived'
};

const importanceLabelMap: Record<string, string> = {
  low: 'Низкая',
  medium: 'Средняя',
  high: 'Высокая',
  critical: 'Критично'
};

const statusLabelMap: Record<string, string> = {
  new: 'Новый',
  in_review: 'На проверке',
  accepted: 'Принят',
  archived: 'В архиве'
};

export function insightImportanceLabel(value?: string | null) {
  return importanceLabelMap[value ?? ''] ?? 'Средняя';
}

export function insightStatusLabel(value?: string | null) {
  return statusLabelMap[value ?? ''] ?? 'Новый';
}

export function insightImportanceTone(value?: string | null): 'purple' | 'pink' | 'green' | 'yellow' | 'red' | 'blue' | 'gray' {
  if (value === 'critical') return 'red';
  if (value === 'high') return 'pink';
  if (value === 'medium') return 'purple';
  return 'gray';
}

export function insightStatusTone(value?: string | null): 'purple' | 'pink' | 'green' | 'yellow' | 'red' | 'blue' | 'gray' {
  if (value === 'accepted') return 'green';
  if (value === 'in_review') return 'yellow';
  if (value === 'archived') return 'gray';
  return 'blue';
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('ru-RU');
}

function relatedName(value: unknown): string | undefined {
  if (!value) return undefined;
  if (Array.isArray(value)) return relatedName(value[0]);
  if (typeof value === 'object' && 'name' in value) {
    const name = (value as { name?: unknown }).name;
    return typeof name === 'string' ? name : undefined;
  }
  if (typeof value === 'object' && 'title' in value) {
    const title = (value as { title?: unknown }).title;
    return typeof title === 'string' ? title : undefined;
  }
  return undefined;
}

function getRelatedRow(item: unknown, key: string): Record<string, unknown> | null {
  if (!item || typeof item !== 'object') return null;
  const raw = (item as Record<string, unknown>)[key];
  if (Array.isArray(raw)) {
    return raw[0] && typeof raw[0] === 'object' ? raw[0] as Record<string, unknown> : null;
  }
  return raw && typeof raw === 'object' ? raw as Record<string, unknown> : null;
}

function mapRelations(rawItems: unknown, key: 'leads' | 'campaigns' | 'surveys', type: InsightRelation['type'], baseHref: string): InsightRelation[] {
  const rows = Array.isArray(rawItems) ? rawItems : [];
  return rows
    .map((item) => getRelatedRow(item, key))
    .filter((row): row is Record<string, unknown> => Boolean(row))
    .map((row) => {
      const id = String(row.id);
      return {
        id,
        name: relatedName(row) ?? 'Без названия',
        href: `${baseHref}/${id}`,
        type
      };
    });
}

function mapInsight(row: Record<string, unknown>): InsightDetail {
  const importance = String(row.importance ?? 'medium') as InsightImportance;
  const status = String(row.status ?? 'new') as InsightStatus;
  const leads = mapRelations(row.insight_leads, 'leads', 'lead', '/people');
  const campaigns = mapRelations(row.insight_campaigns, 'campaigns', 'campaign', '/campaigns');
  const surveys = mapRelations(row.insight_surveys, 'surveys', 'survey', '/surveys');

  return {
    id: String(row.id),
    title: String(row.title ?? 'Без названия'),
    description: row.description ? String(row.description) : undefined,
    category: String(row.category ?? 'Инсайт'),
    evidence: row.evidence ? String(row.evidence) : undefined,
    importance,
    importanceLabel: insightImportanceLabel(importance),
    status,
    statusLabel: insightStatusLabel(status),
    nextAction: row.next_action ? String(row.next_action) : undefined,
    createdAt: formatDate(row.created_at ? String(row.created_at) : null),
    relationsCount: leads.length + campaigns.length + surveys.length,
    leads,
    campaigns,
    surveys
  };
}

const insightSelect = `
  id,title,description,category,evidence,importance,status,next_action,created_at,
  insight_leads(leads(id,name)),
  insight_campaigns(campaigns(id,name)),
  insight_surveys(surveys(id,title))
`;

export async function getInsights(): Promise<InsightListItem[]> {
  if (!isSupabaseConfigured()) return demoInsights;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('insights')
    .select(insightSelect)
    .order('created_at', { ascending: false });

  if (error || !data) return demoInsights;

  return data.map((row) => mapInsight(row as Record<string, unknown>));
}

export async function getInsightById(id: string): Promise<InsightDetail | null> {
  if (!isSupabaseConfigured()) return demoInsights.find((insight) => insight.id === id) ?? null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('insights')
    .select(insightSelect)
    .eq('id', id)
    .maybeSingle();

  if (error || !data) return demoInsights.find((insight) => insight.id === id) ?? null;

  return mapInsight(data as Record<string, unknown>);
}

export async function getDashboardInsights(): Promise<string[]> {
  const items = await getInsights();
  if (items.length === 0) return dashboardMockInsights;
  return items.slice(0, 3).map((item) => item.title);
}


export async function getInsightOptions(): Promise<InsightOption[]> {
  if (!isSupabaseConfigured()) {
    return demoInsights.map((insight) => ({ id: insight.id, name: insight.title }));
  }

  const supabase = await createClient();
  const { data, error } = await supabase.from('insights').select('id,title').order('created_at', { ascending: false });
  if (error || !data) return [];
  return data.map((item) => ({ id: String(item.id), name: String(item.title) }));
}

export async function getCampaignOptions(): Promise<InsightOption[]> {
  if (!isSupabaseConfigured()) {
    return [
      { id: 'demo-campaign-1', name: 'Мастера маникюра Минск — Instagram' },
      { id: 'demo-campaign-2', name: 'Бровисты Брест — Telegram' }
    ];
  }

  const supabase = await createClient();
  const { data, error } = await supabase.from('campaigns').select('id,name').order('created_at', { ascending: false });
  if (error || !data) return [];
  return data.map((item) => ({ id: String(item.id), name: String(item.name) }));
}

export async function getSurveyOptions(): Promise<InsightOption[]> {
  if (!isSupabaseConfigured()) {
    return [
      { id: 'demo-survey-1', name: 'Опрос для мастеров' },
      { id: 'demo-survey-2', name: 'Опрос клиентов' }
    ];
  }

  const supabase = await createClient();
  const { data, error } = await supabase.from('surveys').select('id,title').order('created_at', { ascending: false });
  if (error || !data) return [];
  return data.map((item) => ({ id: String(item.id), name: String(item.title) }));
}
