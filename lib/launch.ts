import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { databaseTableLabels, databaseTables } from '@/lib/database-tables';

export type LaunchCheck = {
  id: string;
  title: string;
  description: string;
  owner: string;
  status: 'ready' | 'warning' | 'todo';
};

export type LaunchMetric = {
  label: string;
  value: number;
  hint: string;
};

const launchChecks: LaunchCheck[] = [
  {
    id: 'auth',
    title: 'Авторизация и роли',
    description: 'Создан admin-пользователь, проверены роли admin / marketer / viewer и закрыт доступ без входа.',
    owner: 'Администратор',
    status: 'ready'
  },
  {
    id: 'data',
    title: 'Стартовые справочники',
    description: 'Источники, стадии, теги и рабочее пространство настроены под реальные процессы команды.',
    owner: 'Маркетолог',
    status: 'warning'
  },
  {
    id: 'contacts',
    title: 'Первые контакты',
    description: 'Добавлены первые мастера/салоны, проверены карточки, задачи, действия и история касаний.',
    owner: 'Маркетолог',
    status: 'warning'
  },
  {
    id: 'surveys',
    title: 'Анкеты',
    description: 'Создана минимум одна анкета для мастеров и проверена публичная ссылка /s/[slug].',
    owner: 'Маркетолог',
    status: 'todo'
  },
  {
    id: 'campaigns',
    title: 'Кампании',
    description: 'Создана первая кампания, к ней привязаны контакты и зафиксирован оффер для теста.',
    owner: 'Маркетолог',
    status: 'todo'
  },
  {
    id: 'backup',
    title: 'Резервный экспорт',
    description: 'Сделан первый JSON-экспорт рабочей базы перед активным использованием команды.',
    owner: 'Администратор',
    status: 'todo'
  }
];

export async function getLaunchReadiness() {
  const metrics: LaunchMetric[] = [];
  const tableStatus: { table: string; label: string; ok: boolean; count: number; error?: string }[] = [];

  if (!isSupabaseConfigured()) {
    return {
      checks: launchChecks,
      metrics,
      tableStatus: databaseTables.map((table) => ({ table, label: databaseTableLabels[table], ok: false, count: 0, error: 'Supabase env не настроен' })),
      readyPercent: 20
    };
  }

  const supabase = await createClient();

  for (const table of databaseTables) {
    const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
    tableStatus.push({ table, label: databaseTableLabels[table], ok: !error, count: count ?? 0, error: error?.message });
  }

  const getCount = (table: string) => tableStatus.find((item) => item.table === table)?.count ?? 0;
  metrics.push(
    { label: 'Контакты', value: getCount('leads'), hint: 'людей и организаций в базе' },
    { label: 'Задачи', value: getCount('tasks'), hint: 'рабочих задач и действий' },
    { label: 'Анкеты', value: getCount('surveys'), hint: 'исследовательских форм' },
    { label: 'Кампании', value: getCount('campaigns'), hint: 'маркетинговых активностей' },
    { label: 'Выводы', value: getCount('insights'), hint: 'выводов по рынку' }
  );

  const okTables = tableStatus.filter((item) => item.ok).length;
  const hasDataScore = metrics.filter((metric) => metric.value > 0).length;
  const readyPercent = Math.min(100, Math.round((okTables / databaseTables.length) * 55 + (hasDataScore / metrics.length) * 45));

  return {
    checks: launchChecks,
    metrics,
    tableStatus,
    readyPercent
  };
}

export const launchDocs = [
  { title: 'Чеклист запуска', href: '/docs/LAUNCH_CHECKLIST.md', description: 'Что проверить перед тем, как команда начнет пользоваться Hutka.' },
  { title: 'Гайд команды', href: '/docs/TEAM_GUIDE.md', description: 'Как маркетолог, admin и viewer должны работать в системе.' },
  { title: 'Бэкап и восстановление', href: '/docs/BACKUP_AND_RECOVERY.md', description: 'Как выгружать резервную копию и что делать при ошибке.' }
];
