import Link from 'next/link';
import { ArrowLeft, ExternalLink, Plus, Send, Trash2 } from 'lucide-react';
import { notFound } from 'next/navigation';
import { addSurveyQuestionAction, deleteSurveyAction, deleteSurveyQuestionAction } from '@/actions/surveys.actions';
import { Field, FormSection } from '@/components/forms/form-section';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { getCurrentUserContext } from '@/lib/permissions';
import { can } from '@/lib/roles';
import { getPublicSurveyUrl, getSurveyById, questionTypeLabel, statusLabel } from '@/lib/surveys';

function statusTone(status: string) {
  if (status === 'active') return 'green';
  if (status === 'draft') return 'yellow';
  return 'gray';
}

export default async function SurveyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, currentUser] = await Promise.all([params, getCurrentUserContext()]);
  const currentRole = currentUser?.role ?? 'viewer';
  const canManageSurveys = can(currentRole, 'manageSurveys');
  const survey = await getSurveyById(id);
  if (!survey) notFound();

  const publicUrl = getPublicSurveyUrl(survey.slug);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Button asChild variant="secondary">
        <Link href="/surveys"><ArrowLeft className="h-4 w-4" />Назад</Link>
      </Button>

      <PageHeader title={survey.title} subtitle={survey.description || 'Анкета без описания'} />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card>
            <CardContent className="space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={statusTone(survey.status)}>{statusLabel(survey.status)}</Badge>
                <Badge tone="purple">{survey.type}</Badge>
                <Badge tone="blue">{survey.questionsCount} вопросов</Badge>
                <Badge tone="green">{survey.answersCount} ответов</Badge>
              </div>
              <div className="rounded-2xl border border-app-line bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-app-muted">Публичная ссылка</p>
                <p className="mt-2 break-all text-sm font-semibold text-app-text">{publicUrl}</p>
                <Button asChild variant="secondary" className="mt-3">
                  <Link href={`/s/${survey.slug}`} target="_blank"><ExternalLink className="h-4 w-4" />Открыть форму</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <FormSection title="Вопросы анкеты">
            <div className="space-y-3">
              {survey.questions.length === 0 && (
                <p className="rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-app-muted">
                  {canManageSurveys ? 'Пока вопросов нет. Добавь первый вопрос справа.' : 'Пока вопросов нет.'}
                </p>
              )}
              {survey.questions.map((question, index) => (
                <div key={question.id} className="rounded-2xl border border-app-line bg-white p-4">
                  <div className="flex items-start gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-sm font-black text-app-purple">{index + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-black text-app-text">{question.text}</p>
                        {question.required && <Badge tone="red">Обязательный</Badge>}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <p className="text-sm text-app-muted">{questionTypeLabel(question.type)}</p>
                        {canManageSurveys && (
                          <form action={deleteSurveyQuestionAction}>
                            <input type="hidden" name="survey_id" value={survey.id} />
                            <input type="hidden" name="question_id" value={question.id} />
                            <Button type="submit" size="sm" variant="ghost" className="text-red-600 hover:bg-red-50 hover:text-red-700"><Trash2 className="h-3.5 w-3.5" />Удалить вопрос</Button>
                          </form>
                        )}
                      </div>
                      {question.options.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {question.options.map((option) => <Badge key={option} tone="gray">{option}</Badge>)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </FormSection>

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
            </div>
          </FormSection>
        </div>

        <aside className="space-y-6">
          {canManageSurveys && (
            <form action={addSurveyQuestionAction}>
              <input type="hidden" name="survey_id" value={survey.id} />
              <FormSection title="Добавить вопрос" subtitle="Новый вопрос сразу появится в публичной форме.">
                <div className="space-y-4">
                  <Field label="Текст вопроса">
                    <Input name="question_text" placeholder="Например: что мешает вам расти?" required />
                  </Field>
                  <Field label="Тип вопроса">
                    <Select name="question_type" defaultValue="long_text">
                      <option value="short_text">Короткий ответ</option>
                      <option value="long_text">Длинный ответ</option>
                      <option value="single_choice">Один вариант</option>
                      <option value="multiple_choice">Несколько вариантов</option>
                      <option value="yes_no">Да / нет</option>
                      <option value="rating">Оценка</option>
                    </Select>
                  </Field>
                  <Field label="Варианты" hint="Для выбора: через запятую или с новой строки.">
                    <Textarea name="question_options" placeholder="Да, Нет, Возможно" />
                  </Field>
                  <label className="flex items-center gap-2 rounded-2xl border border-app-line bg-white p-3 text-sm font-semibold text-app-text">
                    <input name="required" type="checkbox" className="h-4 w-4 rounded border-app-line" />
                    Обязательный вопрос
                  </label>
                  <Button type="submit" className="w-full"><Plus className="h-4 w-4" />Добавить вопрос</Button>
                </div>
              </FormSection>
            </form>
          )}

          <Card>
            <CardContent>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-purple-50 text-app-purple"><Send className="h-5 w-5" /></div>
              <h3 className="mt-4 text-lg font-black text-app-text">Как использовать</h3>
              <p className="mt-2 text-sm leading-6 text-app-muted">Скопируй публичную ссылку и отправь мастеру. После отправки формы ответы появятся на этой странице.</p>
            </CardContent>
          </Card>

          {canManageSurveys && (
            <form action={deleteSurveyAction}>
              <input type="hidden" name="survey_id" value={survey.id} />
              <FormSection title="Удалить анкету" subtitle="Удалится анкета, вопросы и ответы. Публичная ссылка перестанет работать.">
                <Input name="confirmation" placeholder="Напиши: УДАЛИТЬ" required />
                <Button type="submit" variant="danger" className="w-full"><Trash2 className="h-4 w-4" />Удалить анкету</Button>
              </FormSection>
            </form>
          )}
        </aside>
      </div>
    </div>
  );
}
