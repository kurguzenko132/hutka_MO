import Link from 'next/link';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { MessageTemplatesWorkspace } from '@/components/settings/message-templates-workspace';
import { requireAdmin } from '@/lib/permissions';
import { getMessageTemplates } from '@/lib/message-templates';

function Notice({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const error = typeof searchParams.error === 'string' ? searchParams.error : '';
  const saved = typeof searchParams.saved === 'string' ? searchParams.saved : '';
  const deleted = typeof searchParams.deleted === 'string' ? searchParams.deleted : '';
  const demo = typeof searchParams.demo === 'string' ? searchParams.demo : '';

  if (!error && !saved && !deleted && !demo) return null;

  const isError = Boolean(error);
  const message = isError
    ? 'Не удалось выполнить действие. Проверь обязательные поля и подключение Supabase.'
    : demo
      ? 'Supabase еще не настроен, поэтому шаблоны показаны в демо-режиме.'
      : deleted
        ? 'Шаблон удален.'
        : 'Шаблон сохранен.';

  return (
    <div className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm ${isError ? 'border-red-100 bg-red-50 text-red-700' : 'border-emerald-100 bg-emerald-50 text-emerald-700'}`}>
      {isError ? <AlertCircle className="mt-0.5 h-4 w-4" /> : <CheckCircle2 className="mt-0.5 h-4 w-4" />}
      <span>{message}</span>
    </div>
  );
}

export default async function MessageTemplatesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const params = await searchParams;
  const templates = await getMessageTemplates('all', true);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Шаблоны сообщений"
        subtitle="Создавай готовые тексты для первого касания, отправки анкеты, действия по контакту, тестирования и отказов. Потом их можно копировать прямо из карточки контакта."
        actions={<Button asChild variant="secondary"><Link href="/settings">Назад в настройки</Link></Button>}
      />

      <Notice searchParams={params} />

      <MessageTemplatesWorkspace initialTemplates={templates} />
    </div>
  );
}
