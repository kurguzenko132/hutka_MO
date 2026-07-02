import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { leads as mockLeads, type Lead, type LeadType, type Priority } from '@/lib/data';

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

function mapDbLead(row: Record<string, unknown>): Lead {
  const score = typeof row.priority_score === 'number' ? row.priority_score : 0;
  const source = relatedName(row.sources) ?? 'Не указан';
  const stage = relatedName(row.funnel_stages) ?? 'Найдено';
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
    nextDate: row.next_contact_date ? new Date(String(row.next_contact_date)).toLocaleDateString('ru-RU') : '—',
    tags,
    score,
    instagram: row.instagram ? String(row.instagram) : undefined,
    phone: row.phone ? String(row.phone) : undefined,
    notes: row.notes ? String(row.notes) : undefined
  };
}

export async function getLeads(): Promise<Lead[]> {
  if (!isSupabaseConfigured()) {
    return mockLeads;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('leads')
    .select('id,name,type,niche,city,phone,telegram,instagram,email,priority_score,notes,next_step,next_contact_date,created_at,sources(name),funnel_stages(name),lead_tags(tags(name))')
    .order('created_at', { ascending: false });

  if (error || !data) {
    return mockLeads;
  }

  return data.map((row) => mapDbLead(row as Record<string, unknown>));
}

export async function getLeadById(id: string): Promise<Lead | null> {
  if (!isSupabaseConfigured()) {
    return mockLeads.find((lead) => lead.id === id) ?? null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('leads')
    .select('id,name,type,niche,city,phone,telegram,instagram,email,priority_score,notes,next_step,next_contact_date,created_at,sources(name),funnel_stages(name),lead_tags(tags(name))')
    .eq('id', id)
    .maybeSingle();

  if (error || !data) {
    return mockLeads.find((lead) => lead.id === id) ?? null;
  }

  return mapDbLead(data as Record<string, unknown>);
}
