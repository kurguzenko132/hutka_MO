import packageJson from '@/package.json';
import { isSupabaseConfigured, isSupabaseServiceConfigured } from '@/lib/supabase/config';

export type ProductionCheckStatus = 'ok' | 'warning' | 'error';

export type ProductionCheck = {
  id: string;
  title: string;
  description: string;
  status: ProductionCheckStatus;
  action?: string;
};

export const productionBlockingCheckIds = ['supabase-public-env', 'service-role', 'node-runtime'] as const;

export type RouteCheckGroup = {
  title: string;
  description: string;
  routes: Array<{
    href: string;
    label: string;
    access: 'public' | 'auth' | 'admin';
  }>;
};

export const routeCheckGroups: RouteCheckGroup[] = [
  {
    title: 'Публичные маршруты',
    description: 'Должны открываться без входа или корректно вести на вход.',
    routes: [
      { href: '/', label: 'Страница входа', access: 'public' },
      { href: '/login', label: 'Вход', access: 'public' },
      { href: '/s/demo', label: 'Публичный опрос по slug', access: 'public' }
    ]
  },
  {
    title: 'Рабочие разделы',
    description: 'Должны открываться только после авторизации.',
    routes: [
      { href: '/dashboard', label: 'Главная', access: 'auth' },
      { href: '/profile', label: 'Профиль маркетолога', access: 'auth' },
      { href: '/people', label: 'Контакты', access: 'auth' },
      { href: '/funnels', label: 'Воронки', access: 'auth' },
      { href: '/tasks', label: 'Задачи', access: 'auth' },
      { href: '/surveys', label: 'Опросники', access: 'auth' },
      { href: '/campaigns', label: 'Кампании', access: 'auth' },
      { href: '/insights', label: 'Инсайты', access: 'auth' },
      { href: '/hypotheses', label: 'Гипотезы', access: 'auth' },
      { href: '/reports', label: 'Отчеты', access: 'auth' },
      { href: '/notifications', label: 'Уведомления', access: 'auth' }
    ]
  },
  {
    title: 'Админ-разделы',
    description: 'Должны быть доступны только пользователям с ролью admin.',
    routes: [
      { href: '/settings', label: 'Настройки', access: 'admin' },
      { href: '/quality', label: 'Качество', access: 'admin' },
      { href: '/launch', label: 'Запуск', access: 'admin' },
      { href: '/qa', label: 'Production QA', access: 'admin' },
      { href: '/backup/export', label: 'JSON-бэкап', access: 'admin' }
    ]
  }
];

export function getProductionChecks(): ProductionCheck[] {
  const supabaseConfigured = isSupabaseConfigured();
  const serviceConfigured = isSupabaseServiceConfigured();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const isHttps = Boolean(appUrl?.startsWith('https://')) || appUrl?.includes('localhost');
  const vercelUrl = process.env.VERCEL_URL;
  const nodeEnv = process.env.NODE_ENV;
  const nodeMajor = Number.parseInt(process.versions.node.split('.')[0] ?? '0', 10);
  const nodeIsSupported = Number.isFinite(nodeMajor) && nodeMajor >= 22;

  return [
    {
      id: 'supabase-public-env',
      title: 'Supabase public env',
      description: 'NEXT_PUBLIC_SUPABASE_URL и NEXT_PUBLIC_SUPABASE_ANON_KEY нужны для входа, CRUD и публичных опросов.',
      status: supabaseConfigured ? 'ok' : 'error',
      action: supabaseConfigured ? undefined : 'Добавь NEXT_PUBLIC_SUPABASE_URL и NEXT_PUBLIC_SUPABASE_ANON_KEY в Vercel Environment Variables.'
    },
    {
      id: 'service-role',
      title: 'Service role key',
      description: 'SUPABASE_SERVICE_ROLE_KEY нужен для безопасных публичных форм, Telegram-уведомлений и резервного экспорта.',
      status: serviceConfigured ? 'ok' : 'error',
      action: serviceConfigured ? undefined : 'Добавь валидные NEXT_PUBLIC_SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY только в серверные env Vercel. Не используй service key на клиенте.'
    },
    {
      id: 'app-url',
      title: 'NEXT_PUBLIC_APP_URL',
      description: 'Нужен для корректных публичных ссылок на опросы, редиректов и командной документации.',
      status: appUrl ? (isHttps ? 'ok' : 'warning') : 'warning',
      action: appUrl ? (isHttps ? undefined : 'Для production лучше использовать https://домен.') : 'Укажи NEXT_PUBLIC_APP_URL в Vercel.'
    },
    {
      id: 'vercel-runtime',
      title: 'Vercel runtime',
      description: 'Проверяет, что приложение действительно собрано в окружении Vercel или локальной production-сборке.',
      status: vercelUrl || nodeEnv === 'production' ? 'ok' : 'warning',
      action: vercelUrl || nodeEnv === 'production' ? undefined : 'Для полной проверки запусти pnpm build или проверь deployed URL на Vercel.'
    },
    {
      id: 'node-runtime',
      title: 'Node.js runtime',
      description: `Текущая версия Node.js: ${process.versions.node}. В package.json закреплено ${packageJson.engines?.node ?? 'не указано'}.`,
      status: nodeIsSupported ? 'ok' : 'warning',
      action: nodeIsSupported ? undefined : 'Переключи runtime на Node.js 22+, чтобы убрать предупреждения @supabase/supabase-js и совпасть с package.json engines.'
    },
    {
      id: 'next-version',
      title: 'Next.js security patch',
      description: `Текущая версия Next.js: ${packageJson.dependencies.next}.`,
      status: String(packageJson.dependencies.next).startsWith('15.5.') ? 'ok' : 'warning',
      action: String(packageJson.dependencies.next).startsWith('15.5.') ? undefined : 'Проверь актуальность Next.js и обнови до патченной версии.'
    },
    {
      id: 'framework-config',
      title: 'Vercel framework config',
      description: 'vercel.json фиксирует framework nextjs без ручного outputDirectory, чтобы избежать системного 404.',
      status: 'ok'
    }
  ];
}

export function getProductionReadiness() {
  const checks = getProductionChecks();
  const ok = checks.filter((check) => check.status === 'ok').length;
  const warnings = checks.filter((check) => check.status === 'warning').length;
  const errors = checks.filter((check) => check.status === 'error').length;
  const blockers = checks.filter((check) => productionBlockingCheckIds.includes(check.id as (typeof productionBlockingCheckIds)[number]) && check.status !== 'ok');
  const score = Math.round((ok / checks.length) * 100);

  return {
    appName: packageJson.name,
    appVersion: packageJson.version,
    nextVersion: packageJson.dependencies.next,
    generatedAt: new Date().toISOString(),
    score,
    ok,
    warnings,
    errors,
    blockers,
    checks,
    routeCheckGroups
  };
}
