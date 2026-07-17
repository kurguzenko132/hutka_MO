import Link from 'next/link';
import { Archive, Database, Download, ExternalLink, FileText, Rocket, ShieldCheck } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { requireAdmin } from '@/lib/permissions';
import { getLaunchReadiness, launchDocs, type LaunchCheck } from '@/lib/launch';

function checkTone(status: LaunchCheck['status']): BadgeTone {
  if (status === 'ready') return 'green';
  if (status === 'warning') return 'yellow';
  return 'gray';
}

function checkLabel(status: LaunchCheck['status']) {
  if (status === 'ready') return 'Готово';
  if (status === 'warning') return 'Проверить';
  return 'Сделать';
}

export default async function LaunchPage() {
  await requireAdmin('/dashboard?error=admin-only');
  const readiness = await getLaunchReadiness();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Запуск команды"
        subtitle="Финальная подготовка Hutka к реальной работе: чеклист, стартовые данные, резервный экспорт и внутренняя документация."
      />

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="overflow-hidden">
          <CardContent className="grid gap-6 p-6 md:grid-cols-[auto_1fr] md:items-center">
            <div className="relative flex h-32 w-32 items-center justify-center rounded-[2rem] bg-gradient-to-br from-purple-100 via-pink-50 to-white text-app-purple">
              <Rocket className="h-14 w-14" />
              <div className="absolute -right-2 -top-2 rounded-full bg-white px-3 py-1 text-sm font-black text-app-purple shadow-sm">{readiness.readyPercent}%</div>
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-app-muted">Готовность MVP</p>
              <h2 className="mt-2 text-2xl font-black text-app-text">Hutka почти готова к работе команды</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-app-muted">
                Перед активным использованием проверь роли, создай первые справочники, добавь контакты, настрой анкеты и обязательно сделай резервный экспорт данных.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Button asChild>
                  <Link prefetch={false} href="/backup/export">
                    <Download className="h-4 w-4" />
                    Скачать бэкап JSON
                  </Link>
                </Button>
                <Button asChild variant="secondary">
                  <Link href="/settings">
                    <ShieldCheck className="h-4 w-4" />
                    Проверить настройки
                  </Link>
                </Button>
                <Button asChild variant="secondary">
                  <Link href="/quality">
                    <Database className="h-4 w-4" />
                    Проверить качество
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Быстрая сводка</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {readiness.metrics.map((metric) => (
              <div key={metric.label} className="rounded-2xl border border-app-line bg-slate-50 p-4">
                <p className="text-2xl font-black text-app-text">{metric.value}</p>
                <p className="mt-1 text-sm font-bold text-app-text">{metric.label}</p>
                <p className="mt-1 text-xs leading-5 text-app-muted">{metric.hint}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Чеклист запуска</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {readiness.checks.map((check) => (
              <div key={check.id} className="rounded-2xl border border-app-line p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-app-text">{check.title}</p>
                    <p className="mt-1 text-sm leading-6 text-app-muted">{check.description}</p>
                    <p className="mt-2 text-xs font-bold uppercase tracking-[0.16em] text-app-faint">Ответственный: {check.owner}</p>
                  </div>
                  <Badge tone={checkTone(check.status)}>{checkLabel(check.status)}</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Проверка таблиц</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {readiness.tableStatus.map((item) => (
              <div key={item.table} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-app-text">{item.label}</p>
                  {item.error ? <p className="mt-1 truncate text-xs text-app-red">{item.error}</p> : <p className="mt-1 truncate text-xs text-app-muted">{item.table} · доступна</p>}
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={item.ok ? 'green' : 'red'}>{item.ok ? 'OK' : 'Ошибка'}</Badge>
                  <span className="text-sm font-black text-app-text">{item.count}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        {launchDocs.map((doc) => (
          <Card key={doc.title}>
            <CardContent className="p-5">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-50 text-app-purple">
                <FileText className="h-5 w-5" />
              </div>
              <h3 className="font-black text-app-text">{doc.title}</h3>
              <p className="mt-2 min-h-[48px] text-sm leading-6 text-app-muted">{doc.description}</p>
              <Button asChild variant="secondary" className="mt-4 w-full">
                <Link href={doc.href} target="_blank">
                  Открыть документ
                  <ExternalLink className="h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Резервное копирование</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-app-muted">
            Экспорт выгружает все таблицы рабочей схемы в один JSON-файл: контакты, задачи, анкеты, вопросы для контактов, кампании, выводы, настройки, справочники, шаблоны, причины отказов, сохраненные фильтры и Telegram-логи. Делай такой экспорт перед массовыми импортами, изменением schema.sql и активным использованием команды.
          </div>
          <Button asChild size="lg">
            <Link prefetch={false} href="/backup/export">
              <Archive className="h-4 w-4" />
              Экспортировать базу
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
