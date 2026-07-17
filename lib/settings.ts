import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { canonicalFunnelStages, normalizeContactTagName, normalizeStageName, orderStageNames } from '@/lib/stages';
import { normalizeSourceName } from '@/lib/source-normalization';

export type DirectoryItem = {
  id: string;
  name: string;
  type?: string;
  color?: string;
  orderIndex?: number;
  usageCount?: number;
  isVirtual?: boolean;
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
  jobTitle?: string;
  avatarUrl?: string;
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

const defaultAppSettings: AppSettings = {
  productName: 'Hutka',
  workspaceName: 'Beauty CRM Launch',
  defaultCity: 'Минск',
  weeklyReportDay: 'Понедельник'
};

const demoSettings: SettingsData = {
  isDemo: true,
  app: defaultAppSettings,
  sources: [
    { id: 'instagram', name: 'Instagram', type: 'social', usageCount: 12 },
    { id: 'telegram', name: 'Telegram', type: 'social', usageCount: 8 },
    { id: 'referral', name: 'Рекомендация', type: 'referral', usageCount: 4 },
    { id: 'school', name: 'Beauty-школа', type: 'partner', usageCount: 2 }
  ],
  stages: [
    { id: 'found', name: 'Новый', type: 'master', orderIndex: 1, color: 'gray', usageCount: 5 },
    { id: 'message', name: 'Написали', type: 'master', orderIndex: 2, color: 'purple', usageCount: 4 },
    { id: 'reply', name: 'Ответил', type: 'master', orderIndex: 3, color: 'blue', usageCount: 3 },
    { id: 'survey', name: 'Заинтересован', type: 'master', orderIndex: 4, color: 'yellow', usageCount: 2 },
    { id: 'pilot', name: 'Тестирует', type: 'master', orderIndex: 5, color: 'green', usageCount: 2 },
    { id: 'pause', name: 'Пауза', type: 'master', orderIndex: 6, color: 'gray', usageCount: 1 },
    { id: 'lost', name: 'Отказ', type: 'master', orderIndex: 7, color: 'red', usageCount: 1 }
  ],
  tags: [
    { id: 'clients', name: 'Нужны клиенты', color: 'pink', usageCount: 9 },
    { id: 'no-crm', name: 'Нет CRM', color: 'purple', usageCount: 6 },
    { id: 'windows', name: 'Пустые окна', color: 'yellow', usageCount: 5 },
    { id: 'testing', name: 'Тестирует', color: 'green', usageCount: 4 },
    { id: 'interested', name: 'Заинтересован', color: 'yellow', usageCount: 3 }
  ],
  users: [
    { id: 'demo-admin', email: 'admin@hutka.local', fullName: 'Администратор', jobTitle: 'Владелец пространства', role: 'admin' },
    { id: 'demo-marketer', email: 'marketer@hutka.local', fullName: 'Маркетолог', jobTitle: 'Growth-маркетолог', role: 'marketer' },
    { id: 'demo-viewer', email: 'viewer@hutka.local', fullName: 'Наблюдатель', jobTitle: 'Наблюдатель команды', role: 'viewer' }
  ]
};

const emptySettingsData: SettingsData = {
  isDemo: false,
  app: defaultAppSettings,
  sources: [],
  stages: [],
  tags: [],
  users: []
};

function asString(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function asNumber(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function normalizeStageDirectory(items: DirectoryItem[]) {
  const byName = new Map<string, DirectoryItem>();
  const metaByName = new Map(canonicalFunnelStages.map((stage) => [stage.name, stage]));

  for (const item of items) {
    const name = normalizeStageName(item.name);
    const meta = metaByName.get(name);
    const current = byName.get(name);

    byName.set(name, {
      id: current?.id ?? item.id,
      name,
      type: item.type ?? current?.type ?? 'master',
      color: meta?.color ?? item.color ?? current?.color ?? 'purple',
      orderIndex: meta?.orderIndex ?? item.orderIndex ?? current?.orderIndex ?? 99,
      usageCount: (current?.usageCount ?? 0) + (item.usageCount ?? 0)
    });
  }

  for (const stage of canonicalFunnelStages) {
    if (!byName.has(stage.name)) {
      byName.set(stage.name, {
        id: `canonical-${stage.id}`,
        name: stage.name,
        type: 'master',
        color: stage.color,
        orderIndex: stage.orderIndex,
        usageCount: 0,
        isVirtual: true
      });
    }
  }

  return orderStageNames(Array.from(byName.keys())).map((name) => byName.get(name) as DirectoryItem);
}

function normalizeTagDirectory(items: DirectoryItem[]) {
  const byName = new Map<string, DirectoryItem>();

  for (const item of items) {
    const name = normalizeContactTagName(item.name);
    if (!name) continue;
    const current = byName.get(name);
    byName.set(name, {
      ...item,
      id: current?.id ?? item.id,
      name,
      usageCount: (current?.usageCount ?? 0) + (item.usageCount ?? 0)
    });
  }

  return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name, 'ru'));
}

function normalizeSettings(rows: Array<{ key?: string | null; value?: string | null }>): AppSettings {
  const map = new Map(rows.map((row) => [String(row.key), String(row.value ?? '')]));

  return {
    productName: map.get('product_name') || defaultAppSettings.productName,
    workspaceName: map.get('workspace_name') || defaultAppSettings.workspaceName,
    defaultCity: map.get('default_city') || defaultAppSettings.defaultCity,
    weeklyReportDay: map.get('weekly_report_day') || defaultAppSettings.weeklyReportDay
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
        .select('id, full_name, job_title, avatar_url, role, created_at, email, user_id')
        .order('created_at', { ascending: true })
    ]);

    const sources = (sourcesResult.data ?? []).map((row) => ({
      id: String(row.id),
      name: normalizeSourceName(asString(row.name, 'Без названия')),
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
      jobTitle: asString(row.job_title, ''),
      avatarUrl: asString(row.avatar_url, ''),
      role: row.role === 'admin' || row.role === 'viewer' || row.role === 'marketer' ? row.role : 'viewer',
      createdAt: asString(row.created_at, '')
    }));

    return {
      isDemo: false,
      app: settingsResult.error ? defaultAppSettings : normalizeSettings(settingsResult.data ?? []),
      sources: sourcesResult.error ? [] : sources,
      stages: stagesResult.error ? normalizeStageDirectory([]) : normalizeStageDirectory(stages),
      tags: tagsResult.error ? [] : normalizeTagDirectory(tags),
      users: usersResult.error ? [] : users
    };
  } catch {
    return emptySettingsData;
  }
}
