import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/layout/page-header';
import { QuestionPackDetailWorkspace } from '@/components/settings/question-pack-detail-workspace';
import { requireAdmin } from '@/lib/permissions';
import { getQuestionPackById } from '@/lib/question-packs';

function Notice({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const error = typeof searchParams.error === 'string' ? searchParams.error : '';
  const saved = typeof searchParams.saved === 'string' ? searchParams.saved : '';
  const deleted = typeof searchParams.deleted === 'string' ? searchParams.deleted : '';

  if (!error && !saved && !deleted) return null;

  const isError = Boolean(error);
  const message = isError
    ? 'Не удалось сохранить изменения. Проверь обязательные поля или подключение Supabase.'
    : deleted
      ? 'Вопрос удален из набора.'
      : 'Изменения сохранены.';

  return (
    <div className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm ${isError ? 'border-red-100 bg-red-50 text-red-700' : 'border-emerald-100 bg-emerald-50 text-emerald-700'}`}>
      {isError ? <AlertCircle className="mt-0.5 h-4 w-4" /> : <CheckCircle2 className="mt-0.5 h-4 w-4" />}
      <span>{message}</span>
    </div>
  );
}

export default async function QuestionPackDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const { id } = await params;
  const sp = await searchParams;
  const pack = await getQuestionPackById(id);

  if (!pack) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title={pack.shortTitle}
        subtitle="Редактируй название, аудиторию, статус и вопросы набора. После сохранения обновленный набор сразу появится в карточках контактов."
        actionLabel="Все готовые вопросы"
        actionHref="/settings/question-packs"
      />

      <Notice searchParams={sp} />

      <QuestionPackDetailWorkspace initialPack={pack} />
    </div>
  );
}
