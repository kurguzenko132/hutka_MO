import { ClipboardList } from 'lucide-react';
import { notFound } from 'next/navigation';
import individualMasterTemplate from '@/data/surveys/individual-master-survey-v1.json';
import { PublicSurveyBuilder } from '@/components/surveys/public-survey-builder';
import { normalizeSurveyDefinition } from '@/lib/survey-builder';
import { getPublicSurveyBuilder } from '@/lib/surveys';

export default async function PublicSurveyPage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ contactId?: string }>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const survey = await getPublicSurveyBuilder(slug);
  if (!survey) notFound();
  const leadId = /^[0-9a-f-]{36}$/i.test(query?.contactId ?? '') ? query?.contactId : undefined;

  return (
    <main className="min-h-screen bg-app-bg px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <header className="mb-7 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center bg-purple-50 text-app-purple"><ClipboardList className="h-6 w-6" /></div>
          <p className="mt-4 text-xs font-black uppercase tracking-[0.18em] text-app-purple">Hutka</p>
          <h1 className="mt-2 text-3xl font-black text-app-text sm:text-4xl">{survey.definition.survey.startScreen?.title || survey.title}</h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-app-muted">{survey.definition.survey.startScreen?.description || survey.definition.survey.description}</p>
        </header>
        <PublicSurveyBuilder surveyId={survey.id} slug={survey.slug} definition={survey.definition ?? normalizeSurveyDefinition(individualMasterTemplate)!} leadId={leadId} />
      </div>
    </main>
  );
}
