import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import type { Lead } from '@/lib/data';
import type { LeadFilters } from '@/lib/leads';
import { isInterestedStage, isPausedStage, isRefusedStage, isTestingStage, normalizeStageName } from '@/lib/stages';

export type LeadSmartView = {
  id: string;
  title: string;
  description: string;
  href: string;
  count: number;
  tone: 'purple' | 'blue' | 'green' | 'yellow' | 'red' | 'gray' | 'pink';
};

export type LeadSmartViewCounts = {
  all: number;
  interested: number;
  testing: number;
  'need-write': number;
  unanswered: number;
  paused: number;
  refusals: number;
  'no-next-step': number;
};

export type SavedLeadView = {
  id: string;
  name: string;
  filters: LeadFilters;
  href: string;
  createdAt?: string;
};

function isTodayOrPast(raw?: string) {
  if (!raw) return false;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return false;
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return date.getTime() <= today.getTime();
}

function isFollowUpLead(lead: Lead) {
  if (isRefusedStage(lead.stage) || isTestingStage(lead.stage)) return false;
  return isTodayOrPast(lead.nextDateRaw) || lead.tags.some((tag) => tag.toLowerCase().includes('вернуться'));
}

function isNoNextStepLead(lead: Lead) {
  if (isRefusedStage(lead.stage) || isTestingStage(lead.stage)) return false;
  const nextStep = String(lead.nextStep ?? '').trim().toLowerCase();
  return !nextStep || nextStep === 'связаться' || nextStep === '—' || !lead.nextDateRaw;
}

function isInterestedLead(lead: Lead) {
  return isInterestedStage(lead.stage) || lead.score >= 75 || lead.priority === 'Высокий' || lead.tags.includes('Заинтересован');
}

function isPausedLead(lead: Lead) {
  return isPausedStage(lead.stage) || lead.tags.some((tag) => tag.toLowerCase().includes('вернуться') || tag.toLowerCase().includes('пауза'));
}

export function matchesSmartView(lead: Lead, view?: string) {
  if (!view) return true;

  if (view === 'all') return true;
  if (view === 'interested' || view === 'hot') return isInterestedLead(lead);
  if (view === 'testing' || view === 'pilot') return isTestingStage(lead.stage) || lead.tags.includes('Тестирует');
  if (view === 'need-write' || view === 'followup') return isFollowUpLead(lead);
  if (view === 'unanswered') return ['Новый', 'Написали'].includes(normalizeStageName(lead.stage));
  if (view === 'paused') return isPausedLead(lead);
  if (view === 'refusals') return isRefusedStage(lead.stage) || Boolean(lead.refusalReason);
  if (view === 'no-next-step') return isNoNextStepLead(lead);

  return true;
}

export function buildLeadQuery(filters: LeadFilters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, String(value));
  });
  const query = params.toString();
  return query ? `/people?${query}` : '/people';
}

export function buildSmartLeadViews(counts: LeadSmartViewCounts): LeadSmartView[] {
  return [
    {
      id: 'all',
      title: 'Все',
      description: 'Вся база контактов без дополнительных условий.',
      href: '/people?view=all',
      count: counts.all,
      tone: 'purple'
    },
    {
      id: 'interested',
      title: 'Заинтересованные',
      description: 'Ответили положительно, имеют высокий приоритет или отмечены как заинтересованные.',
      href: '/people?view=interested',
      count: counts.interested,
      tone: 'pink'
    },
    {
      id: 'testing',
      title: 'Тестируют',
      description: 'Контакты, которые уже перешли к тестированию.',
      href: '/people?view=testing',
      count: counts.testing,
      tone: 'green'
    },
    {
      id: 'need-write',
      title: 'Нужно написать',
      description: 'Просроченная дата следующего касания или тег «вернуться позже».',
      href: '/people?view=need-write',
      count: counts['need-write'],
      tone: 'yellow'
    },
    {
      id: 'unanswered',
      title: 'Без ответа',
      description: 'Найденные контакты или те, кому уже написали, но они еще не ответили.',
      href: '/people?view=unanswered',
      count: counts.unanswered,
      tone: 'blue'
    },
    {
      id: 'paused',
      title: 'Пауза',
      description: 'Контакты, к которым нужно вернуться позже.',
      href: '/people?view=paused',
      count: counts.paused,
      tone: 'gray'
    },
    {
      id: 'refusals',
      title: 'Отказы',
      description: 'Контакты, которые отказались или имеют зафиксированную причину отказа.',
      href: '/people?view=refusals',
      count: counts.refusals,
      tone: 'red'
    },
    {
      id: 'no-next-step',
      title: 'Без следующего шага',
      description: 'Контакты, где нужно назначить конкретное действие и дату.',
      href: '/people?view=no-next-step',
      count: counts['no-next-step'],
      tone: 'gray'
    }
  ];
}

export function getSmartLeadViews(leads: Lead[]): LeadSmartView[] {
  const count = (view: string) => leads.filter((lead) => matchesSmartView(lead, view)).length;

  return buildSmartLeadViews({
    all: leads.length,
    interested: count('interested'),
    testing: count('testing'),
    'need-write': count('need-write'),
    unanswered: count('unanswered'),
    paused: count('paused'),
    refusals: count('refusals'),
    'no-next-step': count('no-next-step')
  });
}

function normalizeFilters(raw: unknown): LeadFilters {
  if (!raw || typeof raw !== 'object') return {};
  const allowed = ['q', 'type', 'city', 'niche', 'stage', 'source', 'priority', 'tag', 'view'] as const;
  const result: LeadFilters = {};
  const source = raw as Record<string, unknown>;

  for (const key of allowed) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) {
      result[key] = value.trim();
    }
  }

  return result;
}

export async function getSavedLeadViews(profileId?: string | null): Promise<SavedLeadView[]> {
  if (!profileId || !isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('saved_lead_views')
    .select('id,name,filters,created_at')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  return data.map((view) => {
    const filters = normalizeFilters(view.filters);
    return {
      id: String(view.id),
      name: String(view.name ?? 'Мой вид'),
      filters,
      href: buildLeadQuery(filters),
      createdAt: view.created_at ? String(view.created_at) : undefined
    };
  });
}
