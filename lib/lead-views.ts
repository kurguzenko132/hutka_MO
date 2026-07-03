import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import type { Lead } from '@/lib/data';
import type { LeadFilters } from '@/lib/leads';

export type LeadSmartView = {
  id: string;
  title: string;
  description: string;
  href: string;
  count: number;
  tone: 'purple' | 'blue' | 'green' | 'yellow' | 'red' | 'gray' | 'pink';
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

function isPilotLead(lead: Lead) {
  const text = `${lead.stage} ${lead.tags.join(' ')}`.toLowerCase();
  return text.includes('тест') || text.includes('пилот') || text.includes('активен') || text.includes('готов');
}

function isFollowUpLead(lead: Lead) {
  if (lead.stage === 'Отказ' || lead.stage === 'Активен') return false;
  return isTodayOrPast(lead.nextDateRaw) || lead.tags.some((tag) => tag.toLowerCase().includes('вернуться'));
}

function isNoNextStepLead(lead: Lead) {
  if (lead.stage === 'Отказ' || lead.stage === 'Активен') return false;
  const nextStep = String(lead.nextStep ?? '').trim().toLowerCase();
  return !nextStep || nextStep === 'связаться' || nextStep === '—' || !lead.nextDateRaw;
}

export function matchesSmartView(lead: Lead, view?: string) {
  if (!view) return true;

  if (view === 'hot') return lead.priority === 'Высокий' || lead.score >= 75 || lead.tags.includes('Горячий лид');
  if (view === 'pilot') return isPilotLead(lead);
  if (view === 'followup') return isFollowUpLead(lead);
  if (view === 'unanswered') return lead.stage === 'Написал' || lead.stage === 'Найден';
  if (view === 'refusals') return lead.stage === 'Отказ' || Boolean(lead.refusalReason);
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

export function getSmartLeadViews(leads: Lead[]): LeadSmartView[] {
  const count = (view: string) => leads.filter((lead) => matchesSmartView(lead, view)).length;

  return [
    {
      id: 'hot',
      title: 'Горячие контакты',
      description: 'Высокий приоритет, сильная боль или готовность двигаться дальше.',
      href: '/people?view=hot',
      count: count('hot'),
      tone: 'red'
    },
    {
      id: 'pilot',
      title: 'Готовы к пилоту',
      description: 'Контакты на стадии теста, пилота или с тегом готовности.',
      href: '/people?view=pilot',
      count: count('pilot'),
      tone: 'green'
    },
    {
      id: 'followup',
      title: 'Нужен follow-up',
      description: 'Просроченная дата следующего касания или тег «вернуться позже».',
      href: '/people?view=followup',
      count: count('followup'),
      tone: 'yellow'
    },
    {
      id: 'unanswered',
      title: 'Без ответа',
      description: 'Найденные контакты или те, кому уже написали, но они еще не ответили.',
      href: '/people?view=unanswered',
      count: count('unanswered'),
      tone: 'blue'
    },
    {
      id: 'refusals',
      title: 'Отказы',
      description: 'Контакты, которые отказались или имеют зафиксированную причину отказа.',
      href: '/people?view=refusals',
      count: count('refusals'),
      tone: 'red'
    },
    {
      id: 'no-next-step',
      title: 'Без следующего шага',
      description: 'Контакты, где нужно назначить конкретное действие и дату.',
      href: '/people?view=no-next-step',
      count: count('no-next-step'),
      tone: 'gray'
    }
  ];
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
