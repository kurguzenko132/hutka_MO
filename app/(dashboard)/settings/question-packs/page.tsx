import { AlertCircle, CheckCircle2, Settings2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { QuestionPacksWorkspace } from '@/components/settings/question-packs-workspace';
import { requireAdmin } from '@/lib/permissions';
import { getQuestionPackList } from '@/lib/question-packs';

function Notice({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const error = typeof searchParams.error === 'string' ? searchParams.error : '';
  const saved = typeof searchParams.saved === 'string' ? searchParams.saved : '';
  const deleted = typeof searchParams.deleted === 'string' ? searchParams.deleted : '';
  const demo = typeof searchParams.demo === 'string' ? searchParams.demo : '';

  if (!error && !saved && !deleted && !demo) return null;

  const isError = Boolean(error);
  const message = isError
    ? 'Не удалось выполнить действие. Проверь поля или Supabase-таблицы question_packs.'
    : demo
      ? 'Supabase еще не настроен, поэтому готовые вопросы показаны в демо-режиме.'
      : deleted
        ? 'Готовые вопросы удалены.'
        : 'Готовые вопросы сохранены.';

  return (
    <div className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm ${isError ? 'border-red-100 bg-red-50 text-red-700' : 'border-emerald-100 bg-emerald-50 text-emerald-700'}`}>
      {isError ? <AlertCircle className="mt-0.5 h-4 w-4" /> : <CheckCircle2 className="mt-0.5 h-4 w-4" />}
      <span>{message}</span>
    </div>
  );
}

export default async function QuestionPacksPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const params = await searchParams;
  const packs = await getQuestionPackList(true);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Готовые вопросы"
        subtitle="Готовые наборы вопросов, которые можно быстро добавить в карточку мастера, салона, клиента или партнера."
        actionLabel="Назад в настройки"
        actionHref="/settings"
      />

      <Notice searchParams={params} />

      <div className="rounded-2xl border border-purple-100 bg-purple-50 px-4 py-3 text-sm text-purple-700">
        <div className="flex items-start gap-3">
          <Settings2 className="mt-0.5 h-4 w-4" />
          <p><b>Как работает:</b> создаешь набор один раз, потом в карточке контакта выбираешь его и Hutka создает персональную ссылку `/q/[token]` с этими вопросами.</p>
        </div>
      </div>

      <QuestionPacksWorkspace initialPacks={packs} />
    </div>
  );
}
