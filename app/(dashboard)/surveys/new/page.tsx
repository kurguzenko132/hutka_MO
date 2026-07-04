import Link from 'next/link';
import { ArrowLeft, ClipboardList, Plus, Save } from 'lucide-react';
import { createSurveyAction } from '@/actions/surveys.actions';
import { Field, FormSection } from '@/components/forms/form-section';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { requirePermission } from '@/lib/permissions';

const errorMessages: Record<string, string> = {
  'missing-title': 'Укажи название опроса.',
  'save-failed': 'Не удалось сохранить опрос. Проверь Supabase и попробуй снова.',
  'questions-save-failed': 'Опрос создан, но вопросы не сохранились.'
};

const starterQuestions = [
  { text: 'Как вы сейчас ведете запись?', type: 'long_text', required: true, options: '' },
  { text: 'Какая главная проблема в привлечении клиентов?', type: 'long_text', required: true, options: '' },
  { text: 'Готовы ли протестировать карту мастеров?', type: 'yes_no', required: true, options: 'Да, Нет' },
  { text: 'Что должно быть в приложении, чтобы вы реально им пользовались?', type: 'long_text', required: false, options: '' },
  { text: '', type: 'short_text', required: false, options: '' },
  { text: '', type: 'short_text', required: false, options: '' }
];

export default async function NewSurveyPage({ searchParams }: { searchParams?: Promise<{ error?: string }> }) {
  await requirePermission('manageSurveys', '/surveys?error=forbidden');
  const params = await searchParams;
  const error = params?.error ? errorMessages[params.error] : undefined;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Button asChild variant="secondary">
        <Link href="/surveys"><ArrowLeft className="h-4 w-4" />Назад</Link>
      </Button>

      <PageHeader title="Создать опрос" subtitle="Форма для проверки болей, интереса и готовности к тестированию" />

      {error && <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <form action={createSurveyAction} className="space-y-6">
          <FormSection title="Настройки опроса">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Название">
                <Input name="title" placeholder="Опрос для мастеров" required />
              </Field>
              <Field label="Сегмент">
                <Select name="type" defaultValue="Мастера">
                  <option>Мастера</option>
                  <option>Салоны</option>
                  <option>Клиенты</option>
                  <option>Партнеры</option>
                  <option>После тестирования</option>
                </Select>
              </Field>
              <Field label="Статус">
                <Select name="status" defaultValue="active">
                  <option value="draft">Черновик</option>
                  <option value="active">Активен</option>
                </Select>
              </Field>
              <Field label="Slug ссылки" hint="Можно оставить пустым — Hutka создаст slug автоматически.">
                <Input name="slug" placeholder="masters-research" />
              </Field>
            </div>
            <div className="mt-4">
              <Field label="Описание для респондента">
                <Textarea name="description" placeholder="Коротко объясни, зачем проходить опрос и сколько это займет времени..." />
              </Field>
            </div>
          </FormSection>

          <FormSection title="Вопросы" subtitle="Заполни основные вопросы. Пустые строки не сохранятся.">
            <div className="space-y-3">
              {starterQuestions.map((question, index) => {
                const number = index + 1;
                return (
                  <div key={number} className="rounded-2xl border border-app-line bg-slate-50 p-4">
                    <div className="flex items-start gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-sm font-black text-app-purple shadow-sm">{number}</span>
                      <div className="flex-1 space-y-3">
                        <Input name={`question_text_${number}`} defaultValue={question.text} placeholder="Текст вопроса" />
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Select name={`question_type_${number}`} defaultValue={question.type}>
                            <option value="short_text">Короткий ответ</option>
                            <option value="long_text">Длинный ответ</option>
                            <option value="single_choice">Один вариант</option>
                            <option value="multiple_choice">Несколько вариантов</option>
                            <option value="yes_no">Да / нет</option>
                            <option value="rating">Оценка</option>
                          </Select>
                          <label className="flex h-10 items-center gap-2 rounded-xl border border-app-line bg-white px-3 text-sm font-semibold text-app-text">
                            <input name={`question_required_${number}`} type="checkbox" defaultChecked={question.required} className="h-4 w-4 rounded border-app-line" />
                            Обязательный
                          </label>
                        </div>
                        <Textarea name={`question_options_${number}`} defaultValue={question.options} placeholder="Варианты для выбора через запятую или с новой строки" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </FormSection>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button asChild variant="secondary"><Link href="/surveys">Отмена</Link></Button>
            <Button type="submit"><Save className="h-4 w-4" />Сохранить опрос</Button>
          </div>
        </form>

        <aside className="rounded-3xl border border-purple-100 bg-gradient-to-br from-purple-50 to-pink-50 p-5 h-fit">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-app-purple shadow-sm"><ClipboardList className="h-5 w-5" /></div>
          <h3 className="mt-4 text-lg font-black text-app-text">Что важно спросить</h3>
          <p className="mt-2 text-sm leading-6 text-app-muted">Опрос должен быстро показывать боль, текущий инструмент, готовность к тестированию и барьер перед использованием.</p>
          <div className="mt-4 rounded-2xl bg-white/70 p-4 text-sm font-semibold leading-6 text-app-muted">
            <Plus className="mr-2 inline h-4 w-4 text-app-purple" />
            В следующем этапе добавим редактирование и удаление вопросов.
          </div>
        </aside>
      </div>
    </div>
  );
}
