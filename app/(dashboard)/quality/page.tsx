import { AlertTriangle, CheckCircle2, Database, ShieldCheck } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getQualityReport, type QualityStatus } from '@/lib/quality';
import { requireAdmin } from '@/lib/permissions';

function statusTone(status: QualityStatus) {
  if (status === 'ok') return 'green' as const;
  if (status === 'warning') return 'yellow' as const;
  return 'red' as const;
}

function statusLabel(status: QualityStatus) {
  if (status === 'ok') return 'OK';
  if (status === 'warning') return 'Внимание';
  return 'Ошибка';
}

export default async function QualityPage() {
  await requireAdmin('/dashboard?error=admin-only');
  const report = await getQualityReport();
  const ok = report.checks.filter((check) => check.status === 'ok').length;
  const warnings = report.checks.filter((check) => check.status === 'warning').length;
  const errors = report.checks.filter((check) => check.status === 'error').length;

  return (
    <div className="space-y-6">
      <PageHeader title="Качество MVP" subtitle="Проверка окружения, таблиц, дублей и базовой готовности Hutka к ежедневной работе" />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-black text-app-text">{ok}</p>
              <p className="text-sm text-app-muted">Проверок OK</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-black text-app-text">{warnings}</p>
              <p className="text-sm text-app-muted">Предупреждений</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-black text-app-text">{errors}</p>
              <p className="text-sm text-app-muted">Ошибок</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Проверки</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {report.checks.map((check) => (
            <div key={check.label} className="rounded-2xl border border-app-line p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-black text-app-text">{check.label}</p>
                  <p className="mt-1 text-sm leading-6 text-app-muted">{check.description}</p>
                </div>
                <Badge tone={statusTone(check.status)}>{statusLabel(check.status)}</Badge>
              </div>
              {check.action ? <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-sm text-app-muted">Что сделать: {check.action}</p> : null}
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Сводка таблиц</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {report.counts.map((item) => (
              <div key={item.label} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                <span className="flex items-center gap-2 text-sm font-bold text-app-text"><Database className="h-4 w-4 text-app-purple" />{item.label}</span>
                <span className="text-sm font-black text-app-text">{item.value}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Возможные дубли</CardTitle>
          </CardHeader>
          <CardContent>
            {report.duplicateGroups.length === 0 ? (
              <div className="rounded-2xl bg-emerald-50 p-5 text-sm leading-6 text-emerald-800">Дублей по основным контактным полям не найдено.</div>
            ) : (
              <div className="space-y-3">
                {report.duplicateGroups.map((duplicate) => (
                  <div key={`${duplicate.field}-${duplicate.value}`} className="flex items-center justify-between rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm">
                    <span className="font-bold text-amber-900">{duplicate.field}: {duplicate.value}</span>
                    <Badge tone="yellow">{duplicate.count} контакта</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-app-faint">Проверка сформирована: {new Date(report.generatedAt).toLocaleString('ru-RU')}</p>
    </div>
  );
}
