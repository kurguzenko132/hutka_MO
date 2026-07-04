import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { isInterestedStage, isTestingStage, normalizeStageName } from '@/lib/stages';

export type CampaignStatus = 'draft' | 'active' | 'paused' | 'finished';


export type CampaignOption = {
  id: string;
  name: string;
};

export type CampaignContact = {
  id: string;
  name: string;
  type: string;
  niche: string;
  city: string;
  stage: string;
  source: string;
  score: number;
};

export type CampaignMetrics = {
  contacts: number;
  responses: number;
  surveys: number;
  participants: number;
  conversion: string;
};

export type CampaignListItem = {
  id: string;
  name: string;
  goal?: string;
  channel: string;
  city?: string;
  niche?: string;
  budget: number;
  offerText?: string;
  status: CampaignStatus;
  statusLabel: string;
  resultNotes?: string;
  startDate?: string;
  endDate?: string;
  createdAt: string;
  metrics: CampaignMetrics;
};

export type CampaignDetail = CampaignListItem & {
  contacts: CampaignContact[];
};

const demoCampaigns: CampaignDetail[] = [
  {
    id: 'demo-campaign-1',
    name: 'Мастера маникюра Минск — Instagram',
    goal: 'Найти 30 мастеров, получить 15 ответов и 5 участников тестирования.',
    channel: 'Instagram',
    city: 'Минск',
    niche: 'Маникюр',
    budget: 0,
    offerText: 'Клиенты смогут находить вас на карте и записываться онлайн.',
    status: 'active',
    statusLabel: 'Активна',
    resultNotes: 'Оффер про новых клиентов цепляет лучше, чем сообщение про CRM.',
    startDate: '20.05.2025',
    endDate: '—',
    createdAt: '20.05.2025',
    metrics: { contacts: 60, responses: 22, surveys: 10, participants: 4, conversion: '6,7%' },
    contacts: [
      { id: 'anna-smirnova', name: 'Анна Смирнова', type: 'Мастер', niche: 'Брови и ресницы', city: 'Москва', stage: 'Тестирует', source: 'Instagram', score: 86 },
      { id: 'darya-volkova', name: 'Дарья Волкова', type: 'Мастер', niche: 'Маникюр', city: 'Екатеринбург', stage: 'Новый', source: 'TikTok', score: 38 }
    ]
  },
  {
    id: 'demo-campaign-2',
    name: 'Бровисты Брест — Telegram',
    goal: 'Проверить качество лидов из Telegram-чата.',
    channel: 'Telegram',
    city: 'Брест',
    niche: 'Брови и ресницы',
    budget: 0,
    offerText: 'Ищем первых мастеров для тестирования карты и онлайн-записи.',
    status: 'active',
    statusLabel: 'Активна',
    resultNotes: 'Меньше контактов, но выше готовность к диалогу.',
    startDate: '22.05.2025',
    endDate: '—',
    createdAt: '22.05.2025',
    metrics: { contacts: 38, responses: 19, surveys: 12, participants: 6, conversion: '15,8%' },
    contacts: []
  },
  {
    id: 'demo-campaign-3',
    name: 'Опрос клиентов — карта мастеров',
    goal: 'Собрать 100 ответов клиентов о поиске мастеров на карте.',
    channel: 'Instagram',
    city: 'Минск',
    niche: 'Клиенты',
    budget: 20,
    offerText: 'Помоги сделать удобную карту мастеров рядом с тобой.',
    status: 'finished',
    statusLabel: 'Завершена',
    resultNotes: 'Клиентам важны цена, отзывы, фото работ и ближайшее свободное время.',
    startDate: '10.05.2025',
    endDate: '18.05.2025',
    createdAt: '10.05.2025',
    metrics: { contacts: 130, responses: 82, surveys: 56, participants: 0, conversion: '43,1%' },
    contacts: []
  }
];

const stageResponseNames = new Set(['Ответил', 'Заинтересован', 'Тестирует']);

const statusToLabel: Record<CampaignStatus, string> = {
  draft: 'Планируется',
  active: 'Активна',
  paused: 'На паузе',
  finished: 'Завершена'
};

export const campaignStatusToDb: Record<string, CampaignStatus> = {
  'Планируется': 'draft',
  'Активна': 'active',
  'На паузе': 'paused',
  'Завершена': 'finished'
};

export function statusLabel(status: string) {
  return statusToLabel[status as CampaignStatus] ?? 'Планируется';
}

export function statusTone(status: string): 'purple' | 'pink' | 'green' | 'yellow' | 'red' | 'blue' | 'gray' {
  if (status === 'active') return 'green';
  if (status === 'paused') return 'yellow';
  if (status === 'finished') return 'blue';
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
  return undefined;
}

function mapType(value: unknown) {
  const map: Record<string, string> = {
    master: 'Мастер',
    salon: 'Салон',
    client: 'Клиент',
    partner: 'Партнер'
  };
  return map[String(value)] ?? 'Контакт';
}

function getLeadFromCampaignLead(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null;
  const rawLead = (value as { leads?: unknown }).leads;
  if (Array.isArray(rawLead)) {
    return rawLead[0] && typeof rawLead[0] === 'object' ? rawLead[0] as Record<string, unknown> : null;
  }
  return rawLead && typeof rawLead === 'object' ? rawLead as Record<string, unknown> : null;
}

function mapCampaignContact(row: Record<string, unknown>): CampaignContact {
  const stage = normalizeStageName(relatedName(row.funnel_stages));
  const score = typeof row.priority_score === 'number' ? row.priority_score : Number(row.priority_score ?? 0);
  return {
    id: String(row.id),
    name: String(row.name ?? 'Без имени'),
    type: mapType(row.type),
    niche: String(row.niche ?? 'Не указана'),
    city: String(row.city ?? 'Не указан'),
    stage,
    source: relatedName(row.sources) ?? 'Не указан',
    score: Number.isFinite(score) ? score : 0
  };
}

function calculateMetrics(contacts: CampaignContact[]): CampaignMetrics {
  const total = contacts.length;
  const responses = contacts.filter((contact) => stageResponseNames.has(contact.stage)).length;
  const surveys = contacts.filter((contact) => isInterestedStage(contact.stage) || isTestingStage(contact.stage)).length;
  const participants = contacts.filter((contact) => isTestingStage(contact.stage) || contact.score >= 75).length;
  const base = total || 1;

  return {
    contacts: total,
    responses,
    surveys,
    participants,
    conversion: `${Math.round((participants / base) * 1000) / 10}%`
  };
}

function mapCampaign(row: Record<string, unknown>): CampaignDetail {
  const rawCampaignLeads = Array.isArray(row.campaign_leads) ? row.campaign_leads : [];
  const contacts = rawCampaignLeads
    .map((item) => getLeadFromCampaignLead(item))
    .filter((lead): lead is Record<string, unknown> => Boolean(lead))
    .map((lead) => mapCampaignContact(lead));

  const status = String(row.status ?? 'draft') as CampaignStatus;

  return {
    id: String(row.id),
    name: String(row.name ?? 'Без названия'),
    goal: row.goal ? String(row.goal) : undefined,
    channel: String(row.channel ?? 'Не указан'),
    city: row.city ? String(row.city) : undefined,
    niche: row.niche ? String(row.niche) : undefined,
    budget: Number(row.budget ?? 0),
    offerText: row.offer_text ? String(row.offer_text) : undefined,
    status,
    statusLabel: statusLabel(status),
    resultNotes: row.result_notes ? String(row.result_notes) : undefined,
    startDate: formatDate(row.start_date ? String(row.start_date) : null),
    endDate: formatDate(row.end_date ? String(row.end_date) : null),
    createdAt: formatDate(row.created_at ? String(row.created_at) : null),
    metrics: calculateMetrics(contacts),
    contacts
  };
}

const campaignSelect = `
  id,name,goal,channel,city,niche,budget,offer_text,status,start_date,end_date,result_notes,created_at,
  campaign_leads(
    leads(
      id,name,type,niche,city,priority_score,
      funnel_stages(name),
      sources(name)
    )
  )
`;

export async function getCampaigns(): Promise<CampaignListItem[]> {
  if (!isSupabaseConfigured()) return demoCampaigns;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('campaigns')
    .select(campaignSelect)
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  return data.map((row) => mapCampaign(row as Record<string, unknown>));
}

export async function getCampaignById(id: string): Promise<CampaignDetail | null> {
  if (!isSupabaseConfigured()) {
    return demoCampaigns.find((campaign) => campaign.id === id) ?? null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('campaigns')
    .select(campaignSelect)
    .eq('id', id)
    .maybeSingle();

  if (error || !data) return null;

  return mapCampaign(data as Record<string, unknown>);
}


export async function getCampaignOptions(): Promise<CampaignOption[]> {
  if (!isSupabaseConfigured()) {
    return demoCampaigns.map((campaign) => ({ id: campaign.id, name: campaign.name }));
  }

  const supabase = await createClient();
  const { data, error } = await supabase.from('campaigns').select('id,name').order('created_at', { ascending: false });
  if (error || !data) return [];

  return data.map((campaign) => ({ id: String(campaign.id), name: String(campaign.name) }));
}
