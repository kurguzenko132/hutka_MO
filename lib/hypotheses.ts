import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { leads as mockLeads } from '@/lib/data';

export type HypothesisStatus = 'new' | 'testing' | 'validated' | 'invalidated' | 'needs_data' | 'closed';
export type HypothesisConfidence = 'low' | 'medium' | 'high';

export type HypothesisRelation = {
  id: string;
  name: string;
  href: string;
  type: 'lead' | 'insight' | 'campaign' | 'survey';
};

export type HypothesisListItem = {
  id: string;
  title: string;
  description?: string;
  category: string;
  status: HypothesisStatus;
  statusLabel: string;
  confidence: HypothesisConfidence;
  confidenceLabel: string;
  testMethod?: string;
  successMetric?: string;
  evidenceFor?: string;
  evidenceAgainst?: string;
  result?: string;
  nextAction?: string;
  createdAt: string;
  relationsCount: number;
};

export type HypothesisDetail = HypothesisListItem & {
  leads: HypothesisRelation[];
  insights: HypothesisRelation[];
  campaigns: HypothesisRelation[];
  surveys: HypothesisRelation[];
};

export type HypothesisOption = {
  id: string;
  name: string;
};

const demoHypotheses: HypothesisDetail[] = [
  {
    id: 'demo-hypothesis-1',
    title: 'Мастерам важнее новые клиенты, чем CRM',
    description: 'Предполагаем, что индивидуальные beauty-мастера лучше реагируют на ценность карты и новых заявок, чем на описание CRM-функций.',
    category: 'Оффер',
    status: 'validated',
    statusLabel: 'Подтверждается',
    confidence: 'high',
    confidenceLabel: 'Высокая',
    testMethod: 'Сравнить два сообщения: “удобная CRM” и “клиенты смогут находить вас на карте”.',
    successMetric: 'Оффер про клиентов должен дать минимум в 2 раза больше ответов и согласий на тестирование.',
    evidenceFor: '31 из 47 мастеров упомянули нехватку клиентов. Оффер про карту дал больше ответов в Instagram и Telegram.',
    evidenceAgainst: 'Часть мастеров просит сначала показать реальные заявки, а не просто обещание карты.',
    result: 'Идея подтверждается: в коммуникации нужно продавать не CRM, а поток новых заявок с карты.',
    nextAction: 'Переписать первые сообщения и лендинг под “новые клиенты с карты”.',
    createdAt: '21.05.2025',
    relationsCount: 3,
    leads: mockLeads.slice(0, 2).map((lead) => ({ id: lead.id, name: lead.name, href: `/people/${lead.id}`, type: 'lead' })),
    insights: [{ id: 'demo-insight-1', name: 'Мастера реагируют на “новые клиенты”, а не на “CRM”', href: '/insights/demo-insight-1', type: 'insight' }],
    campaigns: [{ id: 'demo-campaign-1', name: 'Мастера маникюра Минск — Instagram', href: '/campaigns/demo-campaign-1', type: 'campaign' }],
    surveys: []
  },
  {
    id: 'demo-hypothesis-2',
    title: 'Салоны не хотят менять CRM, но могут подключиться ради карты',
    description: 'Салоны с действующей системой записи не готовы быстро переходить, но могут рассмотреть Hutka как дополнительный канал заявок.',
    category: 'Салон',
    status: 'testing',
    statusLabel: 'В проверке',
    confidence: 'medium',
    confidenceLabel: 'Средняя',
    testMethod: 'Провести 10 интервью с владельцами салонов и сравнить реакцию на “замену CRM” и “дополнительный канал заявок”.',
    successMetric: 'Минимум 4 из 10 салонов должны согласиться на мягкое тестирование карты без переноса процессов.',
    evidenceFor: 'В ранних разговорах владельцы интересуются привлечением клиентов, но осторожны к замене текущей CRM.',
    evidenceAgainst: '6 из 8 салонов не готовы менять текущую систему в ближайшее время.',
    result: '',
    nextAction: 'Собрать еще интервью и протестировать оффер “карта без замены вашей CRM”.',
    createdAt: '22.05.2025',
    relationsCount: 1,
    leads: [],
    insights: [{ id: 'demo-insight-2', name: 'Для салонов барьер перехода выше', href: '/insights/demo-insight-2', type: 'insight' }],
    campaigns: [],
    surveys: []
  },
  {
    id: 'demo-hypothesis-3',
    title: 'Профиль мастера должен заполняться за 5 минут',
    description: 'Если онбординг занимает больше 5 минут, мастера будут откладывать заполнение профиля и не дойдут до тестирования.',
    category: 'Онбординг',
    status: 'needs_data',
    statusLabel: 'Нужно больше данных',
    confidence: 'medium',
    confidenceLabel: 'Средняя',
    testMethod: 'Дать 10 мастерам заполнить профиль и замерить время до публикации.',
    successMetric: '70% мастеров должны дойти до публикации профиля без помощи за 5 минут.',
    evidenceFor: 'В переписках повторяется страх “не хочу долго заполнять профиль”.',
    evidenceAgainst: 'Пока нет точного замера времени онбординга.',
    result: '',
    nextAction: 'Сделать тестовый сценарий онбординга и собрать замеры.',
    createdAt: '23.05.2025',
    relationsCount: 0,
    leads: [],
    insights: [],
    campaigns: [],
    surveys: []
  }
];

export const hypothesisCategories = [
  'Аудитория',
  'Оффер',
  'Канал',
  'Продукт',
  'Цена',
  'Город',
  'Ниша',
  'Онбординг',
  'Салон',
  'Карта',
  'CRM'
];

export const hypothesisStatusToDb: Record<string, HypothesisStatus> = {
  'Новая': 'new',
  'В проверке': 'testing',
  'Подтверждается': 'validated',
  'Не подтверждается': 'invalidated',
  'Нужно больше данных': 'needs_data',
  'Закрыта': 'closed'
};

export const hypothesisConfidenceToDb: Record<string, HypothesisConfidence> = {
  'Низкая': 'low',
  'Средняя': 'medium',
  'Высокая': 'high'
};

const statusLabelMap: Record<string, string> = {
  new: 'Новая',
  testing: 'В проверке',
  validated: 'Подтверждается',
  invalidated: 'Не подтверждается',
  needs_data: 'Нужно больше данных',
  closed: 'Закрыта'
};

const confidenceLabelMap: Record<string, string> = {
  low: 'Низкая',
  medium: 'Средняя',
  high: 'Высокая'
};

export function hypothesisStatusLabel(value?: string | null) {
  return statusLabelMap[value ?? ''] ?? 'Новая';
}

export function hypothesisConfidenceLabel(value?: string | null) {
  return confidenceLabelMap[value ?? ''] ?? 'Средняя';
}

export function hypothesisStatusTone(value?: string | null): 'purple' | 'pink' | 'green' | 'yellow' | 'red' | 'blue' | 'gray' {
  if (value === 'validated') return 'green';
  if (value === 'invalidated') return 'red';
  if (value === 'testing') return 'yellow';
  if (value === 'needs_data') return 'blue';
  if (value === 'closed') return 'gray';
  return 'purple';
}

export function hypothesisConfidenceTone(value?: string | null): 'purple' | 'pink' | 'green' | 'yellow' | 'red' | 'blue' | 'gray' {
  if (value === 'high') return 'pink';
  if (value === 'medium') return 'purple';
  return 'gray';
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

function mapRelations(rawItems: unknown, key: 'leads' | 'insights' | 'campaigns' | 'surveys', type: HypothesisRelation['type'], baseHref: string): HypothesisRelation[] {
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

function mapHypothesis(row: Record<string, unknown>): HypothesisDetail {
  const status = String(row.status ?? 'new') as HypothesisStatus;
  const confidence = String(row.confidence ?? 'medium') as HypothesisConfidence;
  const leads = mapRelations(row.hypothesis_leads, 'leads', 'lead', '/people');
  const insights = mapRelations(row.hypothesis_insights, 'insights', 'insight', '/insights');
  const campaigns = mapRelations(row.hypothesis_campaigns, 'campaigns', 'campaign', '/campaigns');
  const surveys = mapRelations(row.hypothesis_surveys, 'surveys', 'survey', '/surveys');

  return {
    id: String(row.id),
    title: String(row.title ?? 'Без названия'),
    description: row.description ? String(row.description) : undefined,
    category: String(row.category ?? 'Идея'),
    status,
    statusLabel: hypothesisStatusLabel(status),
    confidence,
    confidenceLabel: hypothesisConfidenceLabel(confidence),
    testMethod: row.test_method ? String(row.test_method) : undefined,
    successMetric: row.success_metric ? String(row.success_metric) : undefined,
    evidenceFor: row.evidence_for ? String(row.evidence_for) : undefined,
    evidenceAgainst: row.evidence_against ? String(row.evidence_against) : undefined,
    result: row.result ? String(row.result) : undefined,
    nextAction: row.next_action ? String(row.next_action) : undefined,
    createdAt: formatDate(row.created_at ? String(row.created_at) : null),
    relationsCount: leads.length + insights.length + campaigns.length + surveys.length,
    leads,
    insights,
    campaigns,
    surveys
  };
}

const hypothesisSelect = `
  id,title,description,category,status,test_method,success_metric,evidence_for,evidence_against,result,next_action,confidence,created_at,
  hypothesis_leads(leads(id,name)),
  hypothesis_insights(insights(id,title)),
  hypothesis_campaigns(campaigns(id,name)),
  hypothesis_surveys(surveys(id,title))
`;

export async function getHypotheses(): Promise<HypothesisListItem[]> {
  if (!isSupabaseConfigured()) return demoHypotheses;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('hypotheses')
    .select(hypothesisSelect)
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return data.map((row) => mapHypothesis(row as Record<string, unknown>));
}

export async function getHypothesisById(id: string): Promise<HypothesisDetail | null> {
  if (!isSupabaseConfigured()) return demoHypotheses.find((item) => item.id === id) ?? null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('hypotheses')
    .select(hypothesisSelect)
    .eq('id', id)
    .maybeSingle();

  if (error || !data) return null;
  return mapHypothesis(data as Record<string, unknown>);
}

export async function getDashboardHypotheses(): Promise<HypothesisListItem[]> {
  const items = await getHypotheses();
  return items.filter((item) => item.status !== 'closed').slice(0, 3);
}


export async function getHypothesisOptions(): Promise<HypothesisOption[]> {
  if (!isSupabaseConfigured()) {
    return demoHypotheses.map((hypothesis) => ({ id: hypothesis.id, name: hypothesis.title }));
  }

  const supabase = await createClient();
  const { data, error } = await supabase.from('hypotheses').select('id,title').order('created_at', { ascending: false });
  if (error || !data) return [];
  return data.map((item) => ({ id: String(item.id), name: String(item.title) }));
}

export async function getInsightOptions(): Promise<HypothesisOption[]> {
  if (!isSupabaseConfigured()) {
    return [
      { id: 'demo-insight-1', name: 'Мастера реагируют на “новые клиенты”, а не на “CRM”' },
      { id: 'demo-insight-2', name: 'Главный барьер — заполнение профиля без гарантии заявок' }
    ];
  }

  const supabase = await createClient();
  const { data, error } = await supabase.from('insights').select('id,title').order('created_at', { ascending: false });
  if (error || !data) return [];
  return data.map((item) => ({ id: String(item.id), name: String(item.title) }));
}
