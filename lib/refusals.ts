import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { leads as demoLeads } from '@/lib/data';

export type RefusalReason = {
  id: string;
  name: string;
  description?: string;
  color: string;
  isActive: boolean;
  orderIndex: number;
  usageCount?: number;
};

export type RefusalAnalyticsItem = {
  reason: string;
  count: number;
  width: string;
  color?: string;
};

export type RefusalLeadItem = {
  id: string;
  name: string;
  meta: string;
  reason: string;
  comment?: string;
  refusedAt: string;
  href: string;
};

export type RefusalAnalytics = {
  total: number;
  topReasons: RefusalAnalyticsItem[];
  recent: RefusalLeadItem[];
};

const defaultReasons: RefusalReason[] = [
  { id: 'no-time', name: 'Нет времени', description: 'Человеку интересно, но сейчас нет ресурса проходить тест или заполнять профиль.', color: 'yellow', isActive: true, orderIndex: 1, usageCount: 0 },
  { id: 'not-relevant', name: 'Неактуально сейчас', description: 'Потребность может появиться позже, контакт стоит вернуть в follow-up.', color: 'gray', isActive: true, orderIndex: 2, usageCount: 0 },
  { id: 'has-crm', name: 'Уже есть CRM', description: 'Пользуется другой системой и не видит причины менять процесс.', color: 'blue', isActive: true, orderIndex: 3, usageCount: 0 },
  { id: 'unclear-value', name: 'Не понимает пользу', description: 'Нужно лучше объяснить ценность карты, заявок и записи.', color: 'purple', isActive: true, orderIndex: 4, usageCount: 0 },
  { id: 'profile-friction', name: 'Не хочет заполнять профиль', description: 'Барьер онбординга: нужно упростить профиль или помочь заполнить.', color: 'pink', isActive: true, orderIndex: 5, usageCount: 0 },
  { id: 'no-belief-in-leads', name: 'Не верит, что будут заявки', description: 'Нужны кейсы, доказательства и примеры реального спроса.', color: 'red', isActive: true, orderIndex: 6, usageCount: 0 },
  { id: 'price', name: 'Не готов платить', description: 'Пока не видит окупаемости или ценности платного формата.', color: 'red', isActive: true, orderIndex: 7, usageCount: 0 },
  { id: 'wrong-segment', name: 'Не наш сегмент', description: 'Контакт не подходит для текущей фазы запуска.', color: 'gray', isActive: true, orderIndex: 8, usageCount: 0 },
  { id: 'other', name: 'Другое', description: 'Причина требует ручного комментария.', color: 'gray', isActive: true, orderIndex: 99, usageCount: 0 }
];

function asString(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function asNumber(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
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

function relatedColor(value: unknown): string | undefined {
  if (!value) return undefined;
  if (Array.isArray(value)) return relatedColor(value[0]);
  if (typeof value === 'object' && 'color' in value) {
    const color = (value as { color?: unknown }).color;
    return typeof color === 'string' ? color : undefined;
  }
  return undefined;
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function makeBars(entries: Array<{ reason: string; count: number; color?: string }>): RefusalAnalyticsItem[] {
  const sorted = entries.sort((a, b) => b.count - a.count);
  const max = sorted[0]?.count || 1;
  return sorted.map((item) => ({ ...item, width: `${Math.max(8, Math.round((item.count / max) * 100))}%` }));
}

export async function getRefusalReasons(includeInactive = false): Promise<RefusalReason[]> {
  if (!isSupabaseConfigured()) {
    return defaultReasons.filter((reason) => includeInactive || reason.isActive);
  }

  try {
    const supabase = await createClient();
    let query = supabase
      .from('refusal_reasons')
      .select('id,name,description,color,is_active,order_index,leads(count)')
      .order('order_index', { ascending: true })
      .order('name', { ascending: true });

    if (!includeInactive) query = query.eq('is_active', true);

    const { data, error } = await query;
    if (error || !data) return defaultReasons.filter((reason) => includeInactive || reason.isActive);

    return data.map((row) => ({
      id: String(row.id),
      name: asString(row.name, 'Без названия'),
      description: asString(row.description, ''),
      color: asString(row.color, 'gray'),
      isActive: Boolean(row.is_active),
      orderIndex: asNumber(row.order_index, 99),
      usageCount: Array.isArray(row.leads) ? asNumber(row.leads[0]?.count, 0) : 0
    }));
  } catch {
    return defaultReasons.filter((reason) => includeInactive || reason.isActive);
  }
}

export async function getRefusalReasonById(id: string): Promise<RefusalReason | null> {
  const reasons = await getRefusalReasons(true);
  return reasons.find((reason) => reason.id === id) ?? null;
}

export async function getRefusalAnalytics(): Promise<RefusalAnalytics> {
  if (!isSupabaseConfigured()) {
    const refused = demoLeads.filter((lead) => lead.stage === 'Отказ' || lead.tags.includes('Вернуться позже'));
    const topReasons = makeBars([
      { reason: 'Неактуально сейчас', count: Math.max(1, refused.length), color: 'gray' },
      { reason: 'Не понимает пользу', count: 1, color: 'purple' }
    ]);
    return {
      total: refused.length,
      topReasons,
      recent: refused.slice(0, 5).map((lead) => ({
        id: lead.id,
        name: lead.name,
        meta: `${lead.type} · ${lead.niche} · ${lead.city}`,
        reason: lead.tags.includes('Вернуться позже') ? 'Неактуально сейчас' : 'Отказ',
        comment: lead.notes,
        refusedAt: 'Demo',
        href: `/people/${lead.id}`
      }))
    };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('leads')
      .select('id,name,type,niche,city,refusal_reason,refusal_comment,refused_at,refusal_reasons(name,color),funnel_stages(name)')
      .or('refusal_reason.not.is.null,refused_at.not.is.null')
      .order('refused_at', { ascending: false, nullsFirst: false });

    if (error || !data) return { total: 0, topReasons: [], recent: [] };

    const counts = new Map<string, { count: number; color?: string }>();
    data.forEach((row) => {
      const reason = asString(row.refusal_reason, relatedName(row.refusal_reasons) ?? 'Причина не указана');
      const color = relatedColor(row.refusal_reasons) ?? 'gray';
      const current = counts.get(reason) ?? { count: 0, color };
      counts.set(reason, { count: current.count + 1, color: current.color ?? color });
    });

    const recent: RefusalLeadItem[] = data.slice(0, 8).map((row) => {
      const reason = asString(row.refusal_reason, relatedName(row.refusal_reasons) ?? 'Причина не указана');

      return {
        id: String(row.id),
        name: asString(row.name, 'Без имени'),
        meta: `${asString(row.type, 'contact')} · ${asString(row.niche, 'Ниша не указана')} · ${asString(row.city, 'Город не указан')}`,
        reason,
        comment: asString(row.refusal_comment, ''),
        refusedAt: formatDate(row.refused_at ? String(row.refused_at) : null),
        href: `/people/${row.id}`
      };
    });

    const allCounts = Array.from(counts.entries()).map(([reason, value]) => ({ reason, count: value.count, color: value.color }));
    return { total: data.length, topReasons: makeBars(allCounts), recent };
  } catch {
    return { total: 0, topReasons: [], recent: [] };
  }
}

export const refusalDemoReasons = defaultReasons;
