import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';

export type ActivityLogInput = {
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  entityTitle?: string | null;
  details?: Record<string, unknown>;
};

export type ActivityLogItem = {
  id: string;
  userName: string;
  action: string;
  entityType: string;
  entityId?: string;
  entityTitle: string;
  details: string;
  createdAt: string;
};

export type ActivityLogFilters = {
  userId?: string;
  entityType?: string;
  action?: string;
  date?: string;
};

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function profileName(value: unknown) {
  if (!value) return 'Система';
  if (Array.isArray(value)) return profileName(value[0]);
  if (typeof value === 'object') {
    const profile = value as { full_name?: unknown; email?: unknown };
    return String(profile.full_name || profile.email || 'Пользователь');
  }
  return 'Система';
}

function detailsText(value: unknown) {
  if (!value || typeof value !== 'object') return '—';
  const entries = Object.entries(value as Record<string, unknown>);
  if (!entries.length) return '—';
  return entries
    .map(([key, item]) => `${key}: ${typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean' ? item : JSON.stringify(item)}`)
    .join(' · ');
}

export async function recordActivityLog(input: ActivityLogInput) {
  if (!isSupabaseConfigured()) return;

  try {
    const supabase = await createClient();
    await supabase.from('activity_logs').insert({
      user_id: input.userId || null,
      action: input.action,
      entity_type: input.entityType,
      entity_id: input.entityId || null,
      entity_title: input.entityTitle || null,
      details: input.details ?? {}
    });
  } catch {
    // Лог не должен ломать основное рабочее действие.
  }
}

export async function getActivityLogs(filters: ActivityLogFilters = {}) {
  if (!isSupabaseConfigured()) {
    return [
      {
        id: 'demo-1',
        userName: 'Демо пользователь',
        action: 'изменил контакт',
        entityType: 'contact',
        entityId: 'demo',
        entityTitle: 'Анна Смирнова',
        details: 'stage: Заинтересован',
        createdAt: formatDateTime(new Date().toISOString())
      }
    ] satisfies ActivityLogItem[];
  }

  try {
    const supabase = await createClient();
    let query = supabase
      .from('activity_logs')
      .select('id,user_id,action,entity_type,entity_id,entity_title,details,created_at,profiles(full_name,email)')
      .order('created_at', { ascending: false })
      .limit(150);

    if (filters.userId) query = query.eq('user_id', filters.userId);
    if (filters.entityType) query = query.eq('entity_type', filters.entityType);
    if (filters.action) query = query.ilike('action', `%${filters.action}%`);
    if (filters.date) {
      const start = new Date(`${filters.date}T00:00:00.000Z`);
      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 1);
      query = query.gte('created_at', start.toISOString()).lt('created_at', end.toISOString());
    }

    const { data, error } = await query;
    if (error || !data) return [];

    return data.map((row) => ({
      id: String(row.id),
      userName: profileName((row as { profiles?: unknown }).profiles),
      action: String(row.action ?? 'действие'),
      entityType: String(row.entity_type ?? 'object'),
      entityId: row.entity_id ? String(row.entity_id) : undefined,
      entityTitle: String(row.entity_title ?? '—'),
      details: detailsText(row.details),
      createdAt: formatDateTime(String(row.created_at ?? ''))
    })) satisfies ActivityLogItem[];
  } catch {
    return [];
  }
}
