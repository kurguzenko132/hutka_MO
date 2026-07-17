import Link from 'next/link';
import { AlertTriangle, ClipboardCheck, ExternalLink, ShieldCheck, Terminal } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { requireAdmin } from '@/lib/permissions';
import { getProductionReadiness, type ProductionCheckStatus } from '@/lib/production';

function statusTone(status: ProductionCheckStatus): BadgeTone {
  if (status === 'ok') return 'green';
  if (status === 'warning') return 'yellow';
  return 'red';
}

function statusLabel(status: ProductionCheckStatus) {
  if (status === 'ok') return 'OK';
  if (status === 'warning') return 'Проверить';
  return 'Ошибка';
}

function accessTone(access: 'public' | 'auth' | 'admin'): BadgeTone {
  if (access === 'public') return 'green';
  if (access === 'auth') return 'purple';
  return 'red';
}

function accessLabel(access: 'public' | 'auth' | 'admin') {
  if (access === 'public') return 'Публично';
  if (access === 'auth') return 'Вход';
  return 'Admin';
}

export default async function QaPage() {
  await requireAdmin('/dashboard?error=admin-only');
  const readiness = getProductionReadiness();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Production QA"
        subtitle="Финальная проверка окружения, маршрутов, Vercel-настроек и готовности Hutka к стабильному MVP-релизу."
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_0.85fr]">
        <Card className="overflow-hidden">
          <CardContent className="grid gap-6 p-6 md:grid-cols-[auto_1fr] md:items-center">
            <div className="relative flex h-32 w-32 items-center justify-center rounded-[2rem] bg-gradient-to-br from-emerald-100 via-purple-50 to-white text-app-purple">
              <ClipboardCheck className="h-14 w-14" />
              <div className="absolute -right-2 -top-2 rounded-full bg-white px-3 py-1 text-sm font-black text-app-purple shadow-sm">{readiness.score}%</div>
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-app-muted">v1.0 MVP readiness</p>
              <h2 className="mt-2 text-2xl font-black text-app-text">Финальная проверка перед использованием</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-app-muted">
                Здесь собраны проверки, которые помогают быстро понять, готов ли деплой к реальной работе: переменные окружения, безопасность маршрутов, версия Next.js, Vercel-конфигурация и smoke-test сценарии.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Button asChild>
                  <Link prefetch={false} href="/api/health" target="_blank">
                    <ShieldCheck className="h-4 w-4" />
                    Health endpoint
                  </Link>
                </Button>
                <Button asChild variant="secondary">
                  <Link prefetch={false} href="/docs/PRODUCTION_SMOKE_TEST.md" target="_blank">
                    Smoke test
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Сводка</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <div className="rounded-2xl border border-app-line bg-emerald-50 p-4">
              <p className="text-2xl font-black text-emerald-700">{readiness.ok}</p>
              <p className="mt-1 text-sm font-bold text-emerald-900">Проверок OK</p>
            </div>
            <div className="rounded-2xl border border-app-line bg-red-50 p-4">
              <p className="text-2xl font-black text-red-700">{readiness.blockers.length}</p>
              <p className="mt-1 text-sm font-bold text-red-900">Блокеров деплоя</p>
            </div>
            <div className="rounded-2xl border border-app-line bg-amber-50 p-4">
              <p className="text-2xl font-black text-amber-700">{readiness.warnings}</p>
              <p className="mt-1 text-sm font-bold text-amber-900">Предупреждений</p>
            </div>
            <div className="rounded-2xl border border-app-line bg-red-50 p-4">
              <p className="text-2xl font-black text-red-700">{readiness.errors}</p>
              <p className="mt-1 text-sm font-bold text-red-900">Ошибок</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Проверки окружения</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {readiness.checks.map((check) => (
            <div key={check.id} className="rounded-2xl border border-app-line p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-black text-app-text">{check.title}</p>
                  <p className="mt-1 text-sm leading-6 text-app-muted">{check.description}</p>
                </div>
                <Badge tone={statusTone(check.status)}>{statusLabel(check.status)}</Badge>
              </div>
              {check.action ? (
                <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-sm leading-6 text-app-muted">
                  Что сделать: {check.action}
                </p>
              ) : null}
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Ключевые маршруты для smoke-test</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {readiness.routeCheckGroups.map((group) => (
              <div key={group.title}>
                <h3 className="font-black text-app-text">{group.title}</h3>
                <p className="mt-1 text-sm leading-6 text-app-muted">{group.description}</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {group.routes.map((route) => (
                    <Link key={`${group.title}-${route.href}`} prefetch={false} href={route.href} className="rounded-2xl border border-app-line p-3 transition hover:border-purple-200 hover:bg-purple-50">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-black text-app-text">{route.label}</span>
                        <Badge tone={accessTone(route.access)}>{accessLabel(route.access)}</Badge>
                      </div>
                      <p className="mt-1 truncate text-xs text-app-muted">{route.href}</p>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Команды перед релизом</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              'pnpm install',
              'pnpm check',
              'pnpm smoke:local',
              'BASE_URL=https://hutka-mo.vercel.app pnpm smoke:url',
              'git add .',
              'git commit -m "Prepare Hutka v1.0 MVP"',
              'git push'
            ].map((command) => (
              <div key={command} className="flex items-center gap-3 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-bold text-white">
                <Terminal className="h-4 w-4 text-purple-300" />
                <code>{command}</code>
              </div>
            ))}
            <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
              <div className="mb-2 flex items-center gap-2 font-black"><AlertTriangle className="h-4 w-4" />Важно</div>
              После деплоя проверь сайт через кнопку <b>Visit</b> в последнем Vercel deployment, а не по старой ссылке.
            </div>
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-app-faint">Проверка сформирована: {new Date(readiness.generatedAt).toLocaleString('ru-RU')}</p>
    </div>
  );
}
