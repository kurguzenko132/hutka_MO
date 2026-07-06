import Link from 'next/link';
import { ArrowLeft, ClipboardList, Save } from 'lucide-react';
import { createSurveyAction } from '@/actions/surveys.actions';
import { Field, FormSection } from '@/components/forms/form-section';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { SurveyQuestionBuilder } from '@/components/surveys/survey-question-builder';
import { requirePermission } from '@/lib/permissions';

const errorMessages: Record<string, string> = {
  'missing-title': 'Укажи название анкеты.',
  'save-failed': 'Не удалось сохранить анкету. Проверь Supabase и попробуй снова.',
  'questions-save-failed': 'Анкета создана, но вопросы не сохранились.'
};

export default async function NewSurveyPage({ searchParams }: { searchParams?: Promise<{ error?: string }> }) {
  await requirePermission('manageSurveys', '/surveys?error=forbidden');
  const params = await searchParams;
  const error = params?.error ? errorMessages[params.error] : undefined;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Button asChild variant="secondary">
        <Link href="/surveys"><ArrowLeft className="h-4 w-4" />Назад</Link>
      </Button>

      <PageHeader title="Создать анкету" subtitle="Форма для проверки болей, интереса и готовности к тестированию" />

      {error && <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <form action={createSurveyAction} className="space-y-6">
          <FormSection title="Настройки анкеты">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Название">
                <Input name="title" placeholder="Анкета для мастеров" required />
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
                <Textarea name="description" placeholder="Коротко объясни, зачем проходить анкету и сколько это займет времени..." />
              </Field>
            </div>
          </FormSection>

          <FormSection title="Вопросы" subtitle="Добавляй столько вопросов, сколько нужно. Пустые строки не сохранятся.">
            <SurveyQuestionBuilder />
          </FormSection>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button asChild variant="secondary"><Link href="/surveys">Отмена</Link></Button>
            <Button type="submit"><Save className="h-4 w-4" />Сохранить анкету</Button>
          </div>
        </form>

        <aside className="rounded-3xl border border-purple-100 bg-gradient-to-br from-purple-50 to-pink-50 p-5 h-fit">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-app-purple shadow-sm"><ClipboardList className="h-5 w-5" /></div>
          <h3 className="mt-4 text-lg font-black text-app-text">Что важно спросить</h3>
          <p className="mt-2 text-sm leading-6 text-app-muted">Анкета должна быстро показывать боль, текущий инструмент, готовность к тестированию и барьер перед использованием.</p>
          <div className="mt-4 rounded-2xl bg-white/70 p-4 text-sm font-semibold leading-6 text-app-muted">
            Теперь при создании анкеты можно добавлять больше 6 вопросов и удалять лишние пустые поля.
          </div>
        </aside>
      </div>
    </div>
  );
}
