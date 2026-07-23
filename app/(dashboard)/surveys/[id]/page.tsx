import Link from 'next/link';
import { ArrowLeft, ChevronLeft, ChevronRight, Download, ExternalLink } from 'lucide-react';
import { notFound } from 'next/navigation';
import { FormSection } from '@/components/forms/form-section';
import { SurveyBuilderWorkspace } from '@/components/surveys/survey-builder-workspace';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getCurrentUserContext } from '@/lib/permissions';
import { can } from '@/lib/roles';
import { getPublicSurveyUrl, getSurveyById } from '@/lib/surveys';

export default async function SurveyDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ page?: string }>;
}) {
  const [{ id }, query, currentUser] = await Promise.all([params, searchParams, getCurrentUserContext()]);
  const page = Math.max(Number.parseInt(query?.page ?? '1', 10) || 1, 1);
  const survey = await getSurveyById(id, page);
  if (!survey) notFound();
  const canManage = can(currentUser?.role ?? 'viewer', 'manageSurveys');

  return (
    <div className="mx-auto max-w-[1440px] space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="secondary"><Link href="/surveys"><ArrowLeft className="h-4 w-4" />Назад</Link></Button>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="secondary"><Link href={`/surveys/${survey.id}/export`}><Download className="h-4 w-4" />Выгрузить ответы</Link></Button>
          <Button asChild variant="secondary"><Link href={getPublicSurveyUrl(survey.slug)} target="_blank"><ExternalLink className="h-4 w-4" />Открыть форму</Link></Button>
        </div>
      </div>

      {survey.builderDefinition ? <SurveyBuilderWorkspace surveyId={survey.id} initialDefinition={survey.builderDefinition} canManage={canManage} /> : <FormSection title="Конструктор пока недоступен"><p className="text-sm text-app-muted">Примените миграцию `step62-survey-builder.sql`, чтобы открыть эту анкету в новом редакторе.</p></FormSection>}

      <FormSection title="Ответы">
        <div className="space-y-4">
          {!survey.responses.length && <p className="text-sm font-semibold text-app-muted">Ответов пока нет.</p>}
          {survey.responses.map((response) => <div key={response.id} className="border border-app-line bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-black text-app-text">{response.respondentName || 'Ответ анкеты'}</p><p className="text-sm text-app-muted">{response.respondentContact || 'Контакт не указан'} · {response.createdAt}</p></div><Badge tone="green">{response.answers.length} ответов</Badge></div>
            <div className="mt-3 space-y-2">{response.answers.map((answer) => <div key={`${response.id}-${answer.question}`} className="bg-slate-50 p-3"><p className="text-xs font-bold uppercase tracking-[0.08em] text-app-muted">{answer.question}</p><p className="mt-1 text-sm text-app-text">{answer.answer}</p></div>)}</div>
          </div>)}
          {survey.responsePage.total > 0 && <div className="flex items-center justify-between border-t border-app-line pt-4 text-sm font-semibold text-app-muted"><span>{survey.responsePage.currentPage} / {survey.responsePage.pageCount}</span><div className="flex gap-2">{survey.responsePage.currentPage > 1 && <Button asChild size="sm" variant="secondary"><Link href={`/surveys/${survey.id}?page=${survey.responsePage.currentPage - 1}`}><ChevronLeft className="h-4 w-4" />Назад</Link></Button>}{survey.responsePage.currentPage < survey.responsePage.pageCount && <Button asChild size="sm" variant="secondary"><Link href={`/surveys/${survey.id}?page=${survey.responsePage.currentPage + 1}`}>Далее<ChevronRight className="h-4 w-4" /></Link></Button>}</div></div>}
        </div>
      </FormSection>
    </div>
  );
}
