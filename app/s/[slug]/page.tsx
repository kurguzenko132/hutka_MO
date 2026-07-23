import { ClipboardList } from 'lucide-react';
import { notFound } from 'next/navigation';
import individualMasterTemplate from '@/data/surveys/individual-master-survey-v1.json';
import { PublicSurveyBuilder } from '@/components/surveys/public-survey-builder';
import { normalizeSurveyDefinition } from '@/lib/survey-builder';
import { getPublicSurveyBuilder, getPublicSurveyInvite } from '@/lib/surveys';

export default async function PublicSurveyPage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ invite?: string }>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const survey = await getPublicSurveyBuilder(slug);
  if (!survey) notFound();
  const invite = query?.invite ? await getPublicSurveyInvite(survey.id, query.invite) : undefined;
  if (query?.invite && !invite) notFound();

  return (
    <main className="min-h-screen bg-app-bg px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <header className="mb-7 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center bg-purple-50 text-app-purple"><ClipboardList className="h-6 w-6" /></div>
          <p className="mt-4 text-xs font-black uppercase tracking-[0.18em] text-app-purple">Hutka</p>
          <h1 className="mt-2 text-3xl font-black text-app-text sm:text-4xl">{survey.definition.survey.startScreen?.title || survey.title}</h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-app-muted">{survey.definition.survey.startScreen?.description || survey.definition.survey.description}</p>
        </header>
        {invite?.status === 'completed' ? (
          <div className="border border-emerald-100 bg-white p-7 text-center">
            <ClipboardList className="mx-auto h-10 w-10 text-emerald-600" />
            <h2 className="mt-4 text-2xl font-black text-app-text">Ответ уже получен</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-app-muted">Спасибо, анкета для этого контакта уже заполнена.</p>
          </div>
        ) : invite?.status === 'revoked' ? (
          <div className="border border-red-100 bg-white p-7 text-center">
            <h2 className="text-2xl font-black text-app-text">Ссылка больше не действует</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-app-muted">Попросите отправить новую ссылку на вопросы.</p>
          </div>
        ) : (
          <PublicSurveyBuilder surveyId={survey.id} slug={survey.slug} definition={survey.definition ?? normalizeSurveyDefinition(individualMasterTemplate)!} inviteToken={invite?.token} />
        )}
      </div>
    </main>
  );
}
