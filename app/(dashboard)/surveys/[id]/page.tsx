import Link from 'next/link';
import { ArrowLeft, ChevronLeft, ChevronRight, Send } from 'lucide-react';
import { notFound } from 'next/navigation';
import { FormSection } from '@/components/forms/form-section';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getCurrentUserContext } from '@/lib/permissions';
import { can } from '@/lib/roles';
import {
  AddSurveyQuestionForm,
  SurveyQuestionList,
  SurveyQuestionsProvider
} from '@/components/surveys/add-survey-question-form';
import {
  SurveyMetadataHeader,
  SurveyMetadataProvider,
  SurveyMetadataSummary,
  SurveyMetadataWorkspace,
  SurveyDeleteWorkspace
} from '@/components/surveys/survey-metadata-workspace';
import { getPublicSurveyUrl, getSurveyById } from '@/lib/surveys';

export default async function SurveyDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ page?: string }>;
}) {
  const [{ id }, query, currentUser] = await Promise.all([params, searchParams, getCurrentUserContext()]);
  const requestedPage = Math.max(Number.parseInt(query?.page ?? '1', 10) || 1, 1);
  const currentRole = currentUser?.role ?? 'viewer';
  const canManageSurveys = can(currentRole, 'manageSurveys');
  const survey = await getSurveyById(id, requestedPage);
  if (!survey) notFound();

  const publicUrl = getPublicSurveyUrl(survey.slug);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Button asChild variant="secondary">
        <Link href="/surveys"><ArrowLeft className="h-4 w-4" />Назад</Link>
      </Button>

      <SurveyMetadataProvider initialSurvey={{ id: survey.id, title: survey.title, type: survey.type, description: survey.description, status: survey.status }}>
        <SurveyMetadataHeader />
        <SurveyQuestionsProvider surveyId={survey.id} initialQuestions={survey.questions}>
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            <SurveyMetadataSummary publicUrl={publicUrl} slug={survey.slug} answersCount={survey.answersCount} />

            <SurveyQuestionList canManageSurveys={canManageSurveys} />

          <FormSection title="Ответы">
            <div className="space-y-4">
              {survey.responses.length === 0 && (
                <p className="rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-app-muted">Пока ответов нет. Отправь публичную ссылку мастерам или салонам.</p>
              )}
              {survey.responses.map((response) => (
                <div key={response.id} className="rounded-2xl border border-app-line bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-black text-app-text">{response.respondentName || 'Анонимный ответ'}</p>
                      <p className="text-sm text-app-muted">{response.respondentContact || 'Контакт не указан'} · {response.createdAt}</p>
                    </div>
                    <Badge tone="green">{response.answers.length} ответов</Badge>
                  </div>
                  <div className="mt-4 space-y-3">
                    {response.answers.map((item) => (
                      <div key={`${response.id}-${item.question}`} className="rounded-2xl bg-slate-50 p-3">
                        <p className="text-xs font-bold uppercase tracking-[0.12em] text-app-muted">{item.question}</p>
                        <p className="mt-2 text-sm font-semibold leading-6 text-app-text">{item.answer}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {survey.responsePage.total > 0 && (
                <div className="flex flex-col gap-3 border-t border-app-line pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm font-semibold text-app-muted">
                    Показано {(survey.responsePage.currentPage - 1) * survey.responsePage.pageSize + 1}–
                    {Math.min(survey.responsePage.currentPage * survey.responsePage.pageSize, survey.responsePage.total)} из {survey.responsePage.total}
                  </p>
                  <div className="flex items-center gap-2">
                    {survey.responsePage.currentPage > 1 ? (
                      <Button asChild size="sm" variant="secondary">
                        <Link prefetch={false} href={`/surveys/${survey.id}?page=${survey.responsePage.currentPage - 1}`}>
                          <ChevronLeft className="h-4 w-4" />
                          Предыдущая
                        </Link>
                      </Button>
                    ) : (
                      <Button type="button" size="sm" variant="secondary" disabled>
                        <ChevronLeft className="h-4 w-4" />
                        Предыдущая
                      </Button>
                    )}
                    <span className="px-2 text-sm font-bold text-app-text">
                      {survey.responsePage.currentPage} / {survey.responsePage.pageCount}
                    </span>
                    {survey.responsePage.currentPage < survey.responsePage.pageCount ? (
                      <Button asChild size="sm" variant="secondary">
                        <Link prefetch={false} href={`/surveys/${survey.id}?page=${survey.responsePage.currentPage + 1}`}>
                          Следующая
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    ) : (
                      <Button type="button" size="sm" variant="secondary" disabled>
                        Следующая
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </FormSection>
          </div>

          <aside className="space-y-6">
            {canManageSurveys && <SurveyMetadataWorkspace />}
            {canManageSurveys && <AddSurveyQuestionForm surveyId={survey.id} />}

          <Card>
            <CardContent>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-purple-50 text-app-purple"><Send className="h-5 w-5" /></div>
              <h3 className="mt-4 text-lg font-black text-app-text">Как использовать</h3>
              <p className="mt-2 text-sm leading-6 text-app-muted">Скопируй публичную ссылку и отправь мастеру. После отправки формы ответы появятся на этой странице.</p>
            </CardContent>
          </Card>

          {canManageSurveys && <SurveyDeleteWorkspace />}
          </aside>
        </div>
        </SurveyQuestionsProvider>
      </SurveyMetadataProvider>
    </div>
  );
}
