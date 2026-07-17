import Link from 'next/link';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { RefusalReasonsWorkspace } from '@/components/settings/refusal-reasons-workspace';
import { requireAdmin } from '@/lib/permissions';
import { getRefusalReasons } from '@/lib/refusals';

function Notice({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const error = typeof searchParams.error === 'string' ? searchParams.error : '';
  const saved = typeof searchParams.saved === 'string' ? searchParams.saved : '';
  const deleted = typeof searchParams.deleted === 'string' ? searchParams.deleted : '';
  const demo = typeof searchParams.demo === 'string' ? searchParams.demo : '';
  const count = typeof searchParams.count === 'string' ? searchParams.count : '';

  if (!error && !saved && !deleted && !demo) return null;

  const isError = Boolean(error);
  const message = isError
    ? error === 'reason-not-found'
      ? 'Причина отказа не найдена. Возможно, она уже удалена.'
      : error === 'in-use'
        ? `Нельзя удалить причину отказа, потому что она используется в ${count || 'нескольких'} контактах.`
      : 'Не удалось выполнить действие. Возможно, причина уже используется в контактах или Supabase не обновлен.'
    : demo
      ? 'Supabase еще не настроен, поэтому причины отказа показаны в demo-режиме.'
      : deleted
        ? 'Причина отказа удалена.'
        : 'Причина отказа сохранена.';

  return (
    <div className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm ${isError ? 'border-red-100 bg-red-50 text-red-700' : 'border-emerald-100 bg-emerald-50 text-emerald-700'}`}>
      {isError ? <AlertCircle className="mt-0.5 h-4 w-4" /> : <CheckCircle2 className="mt-0.5 h-4 w-4" />}
      <span>{message}</span>
    </div>
  );
}

export default async function RefusalReasonsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const params = await searchParams;
  const reasons = await getRefusalReasons(true);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Причины отказа"
        subtitle="Настрой причины, которые маркетолог выбирает при переводе контакта в отказ. Они попадут в карточку, отчеты и аналитику запусков."
        actions={<Button asChild variant="secondary"><Link href="/settings">Назад в настройки</Link></Button>}
      />

      <Notice searchParams={params} />

      <RefusalReasonsWorkspace initialReasons={reasons} />
    </div>
  );
}
