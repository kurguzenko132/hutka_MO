import { after } from 'next/server';
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

export type ActivityLogDirectory = {
  items: ActivityLogItem[];
  total: number;
  currentPage: number;
  pageCount: number;
  pageSize: number;
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

export async function writeActivityLog(input: ActivityLogInput) {
  if (!isSupabaseConfigured()) return;

  const supabase = await createClient();
  const { error } = await supabase.from('activity_logs').insert({
    user_id: input.userId || null,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId || null,
    entity_title: input.entityTitle || null,
    details: input.details ?? {}
  });
  if (error) throw error;
}

export async function recordActivityLog(input: ActivityLogInput) {
  if (!isSupabaseConfigured()) return;

  after(async () => {
    try {
      await writeActivityLog(input);
    } catch {
      // Лог не должен ломать основное рабочее действие.
    }
  });
}

function mapActivityLogRows(data: Array<Record<string, unknown>>): ActivityLogItem[] {
  return data.map((row) => ({
    id: String(row.id),
    userName: profileName(row.profiles),
    action: String(row.action ?? 'действие'),
    entityType: String(row.entity_type ?? 'object'),
    entityId: row.entity_id ? String(row.entity_id) : undefined,
    entityTitle: String(row.entity_title ?? '—'),
    details: detailsText(row.details),
    createdAt: formatDateTime(String(row.created_at ?? ''))
  }));
}

export async function getActivityLogs(
  filters: ActivityLogFilters = {},
  requestedPage = 1,
  requestedPageSize = 50
): Promise<ActivityLogDirectory> {
  const pageSize = Math.min(Math.max(Math.floor(requestedPageSize) || 50, 1), 100);
  const page = Math.max(Math.floor(requestedPage) || 1, 1);

  if (!isSupabaseConfigured()) {
    const items = [
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
    return { items, total: items.length, currentPage: 1, pageCount: 1, pageSize };
  }

  try {
    const supabase = await createClient();
    const runQuery = async (currentPage: number) => {
      let query = supabase
        .from('activity_logs')
        .select(
          'id,user_id,action,entity_type,entity_id,entity_title,details,created_at,profiles(full_name,email)',
          { count: 'exact' }
        )
        .order('created_at', { ascending: false })
        .range((currentPage - 1) * pageSize, currentPage * pageSize - 1);

      if (filters.userId) query = query.eq('user_id', filters.userId);
      if (filters.entityType) query = query.eq('entity_type', filters.entityType);
      if (filters.action) query = query.ilike('action', `%${filters.action}%`);
      if (filters.date) {
        const start = new Date(`${filters.date}T00:00:00.000Z`);
        const end = new Date(start);
        end.setUTCDate(end.getUTCDate() + 1);
        query = query.gte('created_at', start.toISOString()).lt('created_at', end.toISOString());
      }

      return query;
    };

    const firstResult = await runQuery(page);
    if (firstResult.error || !firstResult.data) {
      return { items: [], total: 0, currentPage: 1, pageCount: 1, pageSize };
    }

    const total = Math.max(0, firstResult.count ?? 0);
    const pageCount = Math.max(1, Math.ceil(total / pageSize));
    const currentPage = Math.min(page, pageCount);
    const result = currentPage === page ? firstResult : await runQuery(currentPage);
    const data = result.error || !result.data ? [] : result.data;

    return {
      items: mapActivityLogRows(data as Array<Record<string, unknown>>),
      total,
      currentPage,
      pageCount,
      pageSize
    };
  } catch {
    return { items: [], total: 0, currentPage: 1, pageCount: 1, pageSize };
  }
}
