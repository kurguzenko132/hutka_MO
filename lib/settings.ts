import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';

export type DirectoryItem = {
  id: string;
  name: string;
  type?: string;
  color?: string;
  orderIndex?: number;
  usageCount?: number;
};

export type AppSettings = {
  productName: string;
  workspaceName: string;
  defaultCity: string;
  weeklyReportDay: string;
};

export type UserDirectoryItem = {
  id: string;
  email: string;
  fullName: string;
  role: 'admin' | 'marketer' | 'viewer';
  createdAt?: string;
};

export type SettingsData = {
  app: AppSettings;
  sources: DirectoryItem[];
  stages: DirectoryItem[];
  tags: DirectoryItem[];
  users: UserDirectoryItem[];
  isDemo: boolean;
};

const demoSettings: SettingsData = {
  isDemo: true,
  app: {
    productName: 'Hutka',
    workspaceName: 'Beauty CRM Launch',
    defaultCity: 'Минск',
    weeklyReportDay: 'Понедельник'
  },
  sources: [
    { id: 'instagram', name: 'Instagram', type: 'social', usageCount: 12 },
    { id: 'telegram', name: 'Telegram', type: 'social', usageCount: 8 },
    { id: 'referral', name: 'Рекомендация', type: 'referral', usageCount: 4 },
    { id: 'school', name: 'Beauty-школа', type: 'partner', usageCount: 2 }
  ],
  stages: [
    { id: 'found', name: 'Найден', type: 'master', orderIndex: 1, color: 'gray', usageCount: 5 },
    { id: 'message', name: 'Написал', type: 'master', orderIndex: 2, color: 'purple', usageCount: 4 },
    { id: 'reply', name: 'Ответил', type: 'master', orderIndex: 3, color: 'blue', usageCount: 3 },
    { id: 'survey', name: 'Опрос', type: 'master', orderIndex: 4, color: 'yellow', usageCount: 2 },
    { id: 'pilot', name: 'Тест', type: 'master', orderIndex: 5, color: 'green', usageCount: 2 },
    { id: 'active', name: 'Активен', type: 'master', orderIndex: 6, color: 'green', usageCount: 1 },
    { id: 'lost', name: 'Отказ', type: 'master', orderIndex: 7, color: 'red', usageCount: 1 }
  ],
  tags: [
    { id: 'clients', name: 'Нужны клиенты', color: 'pink', usageCount: 9 },
    { id: 'no-crm', name: 'Нет CRM', color: 'purple', usageCount: 6 },
    { id: 'windows', name: 'Пустые окна', color: 'yellow', usageCount: 5 },
    { id: 'pilot', name: 'Готов тестировать', color: 'green', usageCount: 4 },
    { id: 'hot', name: 'Горячий контакт', color: 'red', usageCount: 3 }
  ],
  users: [
    { id: 'demo-admin', email: 'admin@hutka.local', fullName: 'Администратор', role: 'admin' },
    { id: 'demo-marketer', email: 'marketer@hutka.local', fullName: 'Маркетолог', role: 'marketer' },
    { id: 'demo-viewer', email: 'viewer@hutka.local', fullName: 'Наблюдатель', role: 'viewer' }
  ]
};

function asString(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function asNumber(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function normalizeSettings(rows: Array<{ key?: string | null; value?: string | null }>): AppSettings {
  const map = new Map(rows.map((row) => [String(row.key), String(row.value ?? '')]));

  return {
    productName: map.get('product_name') || demoSettings.app.productName,
    workspaceName: map.get('workspace_name') || demoSettings.app.workspaceName,
    defaultCity: map.get('default_city') || demoSettings.app.defaultCity,
    weeklyReportDay: map.get('weekly_report_day') || demoSettings.app.weeklyReportDay
  };
}

export async function getSettingsData(): Promise<SettingsData> {
  if (!isSupabaseConfigured()) {
    return demoSettings;
  }

  try {
    const supabase = await createClient();
    const [settingsResult, sourcesResult, stagesResult, tagsResult, usersResult] = await Promise.all([
      supabase.from('app_settings').select('key,value'),
      supabase
        .from('sources')
        .select('id,name,type,leads(count)')
        .order('name', { ascending: true }),
      supabase
        .from('funnel_stages')
        .select('id,name,type,order_index,color,leads(count)')
        .order('order_index', { ascending: true }),
      supabase
        .from('tags')
        .select('id,name,color,lead_tags(count)')
        .order('name', { ascending: true }),
      supabase
        .from('profiles')
        .select('id, full_name, role, created_at, email, user_id')
        .order('created_at', { ascending: true })
    ]);

    const sources = (sourcesResult.data ?? []).map((row) => ({
      id: String(row.id),
      name: asString(row.name, 'Без названия'),
      type: asString(row.type, 'manual'),
      usageCount: Array.isArray(row.leads) ? asNumber(row.leads[0]?.count, 0) : 0
    }));

    const stages = (stagesResult.data ?? []).map((row) => ({
      id: String(row.id),
      name: asString(row.name, 'Без названия'),
      type: asString(row.type, 'master'),
      color: asString(row.color, 'purple'),
      orderIndex: asNumber(row.order_index, 0),
      usageCount: Array.isArray(row.leads) ? asNumber(row.leads[0]?.count, 0) : 0
    }));

    const tags = (tagsResult.data ?? []).map((row) => ({
      id: String(row.id),
      name: asString(row.name, 'Без названия'),
      color: asString(row.color, 'purple'),
      usageCount: Array.isArray(row.lead_tags) ? asNumber(row.lead_tags[0]?.count, 0) : 0
    }));

    const users = (usersResult.data ?? []).map((row) => ({
      id: String(row.id),
      email: asString(row.email, asString(row.user_id, 'Пользователь Supabase')),
      fullName: asString(row.full_name, 'Без имени'),
      role: row.role === 'admin' || row.role === 'viewer' || row.role === 'marketer' ? row.role : 'marketer',
      createdAt: asString(row.created_at, '')
    }));

    return {
      isDemo: Boolean(settingsResult.error || sourcesResult.error || stagesResult.error || tagsResult.error || usersResult.error),
      app: settingsResult.error ? demoSettings.app : normalizeSettings(settingsResult.data ?? []),
      sources: sourcesResult.error ? demoSettings.sources : sources,
      stages: stagesResult.error ? demoSettings.stages : stages,
      tags: tagsResult.error ? demoSettings.tags : tags,
      users: usersResult.error ? demoSettings.users : users
    };
  } catch {
    return demoSettings;
  }
}
