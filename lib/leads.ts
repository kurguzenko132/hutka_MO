import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { activity, leads as mockLeads, type Lead, type LeadType, type Priority } from '@/lib/data';

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
    notes: row.notes ? String(row.notes) : undefined
  };
}

const leadSelect = 'id,name,type,niche,city,phone,telegram,instagram,email,priority_score,notes,next_step,next_contact_date,created_at,sources(name),funnel_stages(name),lead_tags(tags(name))';

export async function getLeads(): Promise<Lead[]> {
  if (!isSupabaseConfigured()) {
    return mockLeads;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('leads')
    .select(leadSelect)
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
