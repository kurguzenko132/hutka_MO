import Link from 'next/link';
import { ClipboardList, ExternalLink } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getPublicSurveyUrl, getSurveys, statusLabel } from '@/lib/surveys';
import { getCurrentUserContext } from '@/lib/permissions';
import { can } from '@/lib/roles';

function statusTone(status: string) {
  if (status === 'active') return 'green';
  if (status === 'draft') return 'yellow';
  return 'gray';
}

export default async function SurveysPage() {
  const user = await getCurrentUserContext();
  const role = user?.role ?? 'viewer';
  const surveys = await getSurveys();

  return (
    <div className="space-y-6">
      <PageHeader title="Опросники" subtitle="Формы для проверки болей, интереса и готовности к тестированию" actionLabel={can(role, 'manageSurveys') ? 'Создать опрос' : undefined} actionHref={can(role, 'manageSurveys') ? '/surveys/new' : undefined} />

      <div className="grid gap-4 lg:grid-cols-2">
        {surveys.map((survey) => (
          <Card key={survey.id} className="card-hover">
            <CardContent className="space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-black text-app-text">{survey.title}</h3>
                    <Badge tone={statusTone(survey.status)}>{statusLabel(survey.status)}</Badge>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-app-muted">
                    {survey.description || 'Описание не указано'}
                  </p>
                </div>
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-purple-50 text-app-purple">
                  <ClipboardList className="h-5 w-5" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 rounded-2xl bg-slate-50 p-3 text-center">
                <div>
                  <p className="text-lg font-black text-app-text">{survey.questionsCount}</p>
                  <p className="text-xs font-semibold text-app-muted">вопросов</p>
                </div>
                <div>
                  <p className="text-lg font-black text-app-text">{survey.answersCount}</p>
                  <p className="text-xs font-semibold text-app-muted">ответов</p>
                </div>
                <div>
                  <p className="text-lg font-black text-app-text">{survey.type}</p>
                  <p className="text-xs font-semibold text-app-muted">сегмент</p>
                </div>
              </div>

              <div className="rounded-2xl border border-app-line bg-white p-3">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-app-muted">Публичная ссылка</p>
                <p className="mt-2 break-all text-sm font-semibold text-app-text">{getPublicSurveyUrl(survey.slug)}</p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button asChild className="flex-1">
                  <Link href={`/surveys/${survey.id}`}>Открыть</Link>
                </Button>
                <Button asChild variant="secondary" className="flex-1">
                  <Link href={`/s/${survey.slug}`} target="_blank">
                    <ExternalLink className="h-4 w-4" />
                    Форма
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
