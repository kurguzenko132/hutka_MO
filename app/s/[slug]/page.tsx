import Link from 'next/link';
import { CheckCircle2, ClipboardList, Send } from 'lucide-react';
import { notFound } from 'next/navigation';
import { submitSurveyResponseAction } from '@/actions/surveys.actions';
import { Button } from '@/components/ui/button';
import { SubmitButton } from '@/components/ui/submit-button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { getSurveyBySlug, questionTypeLabel, type SurveyQuestion } from '@/lib/surveys';
import { publicFormHoneypotName, publicFormLimits } from '@/lib/public-form-validation';

function QuestionField({ question }: { question: SurveyQuestion }) {
  const name = `answer_${question.id}`;

  if (question.type === 'long_text') {
    return <Textarea name={name} placeholder="Напишите ответ..." required={question.required} maxLength={publicFormLimits.answerValue} />;
  }

  if (question.type === 'number') {
    return <Input name={name} type="number" placeholder="Введите число" required={question.required} />;
  }

  if (question.type === 'yes_no') {
    return (
      <div className="grid gap-2 sm:grid-cols-2">
        {['Да', 'Нет'].map((option) => (
          <label key={option} className="flex cursor-pointer items-center gap-2 rounded-2xl border border-app-line bg-white p-3 text-sm font-semibold text-app-text transition hover:border-purple-200 hover:bg-purple-50">
            <input name={name} value={option} type="radio" required={question.required} className="h-4 w-4" />
            {option}
          </label>
        ))}
      </div>
    );
  }

  if (question.type === 'rating') {
    return (
      <Select name={name} defaultValue="" required={question.required}>
        <option value="" disabled>Выберите оценку</option>
        <option value="1">1 — совсем не подходит</option>
        <option value="2">2</option>
        <option value="3">3</option>
        <option value="4">4</option>
        <option value="5">5 — очень подходит</option>
      </Select>
    );
  }

  if (question.type === 'single_choice') {
    const options = question.options.length > 0 ? question.options : ['Да', 'Нет'];
    return (
      <div className="space-y-2">
        {options.map((option) => (
          <label key={option} className="flex cursor-pointer items-center gap-2 rounded-2xl border border-app-line bg-white p-3 text-sm font-semibold text-app-text transition hover:border-purple-200 hover:bg-purple-50">
            <input name={name} value={option} type="radio" required={question.required} className="h-4 w-4" />
            {option}
          </label>
        ))}
      </div>
    );
  }

  if (question.type === 'multiple_choice') {
    const options = question.options.length > 0 ? question.options : ['Вариант 1', 'Вариант 2'];
    return (
      <div className="space-y-2">
        {options.map((option) => (
          <label key={option} className="flex cursor-pointer items-center gap-2 rounded-2xl border border-app-line bg-white p-3 text-sm font-semibold text-app-text transition hover:border-purple-200 hover:bg-purple-50">
            <input name={name} value={option} type="checkbox" className="h-4 w-4" />
            {option}
          </label>
        ))}
      </div>
    );
  }

  return <Input name={name} placeholder="Введите ответ" required={question.required} maxLength={publicFormLimits.answerValue} />;
}

export default async function PublicSurveyPage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ submitted?: string; error?: string }>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const survey = await getSurveyBySlug(slug);
  if (!survey) notFound();

  const submitted = Boolean(query?.submitted);
  const errorMessages: Record<string, string> = {
    'save-failed': 'Не удалось сохранить ответ. Попробуйте еще раз.',
    required: 'Ответьте на обязательные вопросы и отправьте форму еще раз.',
    'not-active': 'Эта анкета сейчас недоступна для ответов.',
    'questions-not-found': 'В этой анкете пока нет активных вопросов.',
    config: 'Форма временно недоступна: не настроен серверный ключ Supabase.',
    'too-long': 'Слишком длинный ответ. Сократите текст и попробуйте еще раз.'
  };
  const errorMessage = query?.error ? errorMessages[query.error] ?? 'Не удалось сохранить ответ. Попробуйте еще раз.' : '';

  return (
    <main className="min-h-screen bg-app-bg px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-app-purple to-app-pink text-white shadow-xl shadow-purple-900/15">
            <ClipboardList className="h-7 w-7" />
          </div>
          <p className="mt-4 text-sm font-black uppercase tracking-[0.28em] text-app-purple">Hutka</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-app-text sm:text-4xl">{survey.title}</h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-app-muted">
            {survey.description || 'Ответьте на несколько вопросов. Это поможет сделать продукт полезнее для мастеров, салонов и клиентов.'}
          </p>
        </div>

        {submitted ? (
          <Card className="border-green-100 bg-white/90 shadow-2xl shadow-green-900/10">
            <CardContent className="text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-green-50 text-green-600">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h2 className="mt-5 text-2xl font-black text-app-text">Спасибо, ответ сохранен</h2>
              <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-app-muted">Мы изучим ответы и используем их для улучшения Hutka и будущей beauty-карты.</p>
              <Button asChild className="mt-6" variant="secondary"><Link href={`/s/${survey.slug}`}>Отправить еще один ответ</Link></Button>
            </CardContent>
          </Card>
        ) : (
          <form action={submitSurveyResponseAction} className="space-y-5">
            <input type="hidden" name="survey_id" value={survey.id} />
            <input type="hidden" name="slug" value={survey.slug} />
            <div className="hidden" aria-hidden="true">
              <label>
                Website
                <input name={publicFormHoneypotName} tabIndex={-1} autoComplete="off" />
              </label>
            </div>

            {errorMessage && <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700">{errorMessage}</div>}

            <Card>
              <CardContent className="space-y-4">
                <h2 className="text-lg font-black text-app-text">Контакты</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-app-text">Имя</span>
                    <Input name="respondent_name" placeholder="Ваше имя" maxLength={publicFormLimits.respondentName} />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-app-text">Контакт</span>
                    <Input name="respondent_contact" placeholder="Telegram, Instagram или телефон" maxLength={publicFormLimits.respondentContact} />
                  </label>
                </div>
              </CardContent>
            </Card>

            {survey.questions.map((question, index) => (
              <Card key={question.id}>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-app-muted">Вопрос {index + 1} · {questionTypeLabel(question.type)}</p>
                    <h2 className="mt-2 text-lg font-black text-app-text">{question.text}{question.required && <span className="text-app-red"> *</span>}</h2>
                  </div>
                  <QuestionField question={question} />
                </CardContent>
              </Card>
            ))}

            {survey.questions.length === 0 && (
              <Card>
                <CardContent>
                  <p className="text-sm font-semibold text-app-muted">В этой анкете пока нет вопросов.</p>
                </CardContent>
              </Card>
            )}

            <SubmitButton size="lg" className="w-full" disabled={survey.questions.length === 0}>
              <Send className="h-4 w-4" />
              Отправить ответы
            </SubmitButton>
          </form>
        )}
      </div>
    </main>
  );
}
