import { AlertCircle, CheckCircle2, PlusCircle, Save, Trash2 } from 'lucide-react';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { requireAdmin } from '@/lib/permissions';
import {
  getQuestionPackById,
  questionPackAudienceOptions,
  questionPackStatusOptions,
  questionTypeLabel,
  questionTypeOptions
} from '@/lib/question-packs';
import {
  addQuestionToPackAction,
  deleteQuestionPackAction,
  deleteQuestionPackQuestionAction,
  updateQuestionPackAction,
  updateQuestionPackQuestionAction
} from '@/actions/question-packs.actions';

function Notice({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const error = typeof searchParams.error === 'string' ? searchParams.error : '';
  const saved = typeof searchParams.saved === 'string' ? searchParams.saved : '';
  const deleted = typeof searchParams.deleted === 'string' ? searchParams.deleted : '';

  if (!error && !saved && !deleted) return null;

  const isError = Boolean(error);
  const message = isError
    ? 'Не удалось сохранить изменения. Проверь обязательные поля или подключение Supabase.'
    : deleted
      ? 'Вопрос удален из пака.'
      : 'Изменения сохранены.';

  return (
    <div className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm ${isError ? 'border-red-100 bg-red-50 text-red-700' : 'border-emerald-100 bg-emerald-50 text-emerald-700'}`}>
      {isError ? <AlertCircle className="mt-0.5 h-4 w-4" /> : <CheckCircle2 className="mt-0.5 h-4 w-4" />}
      <span>{message}</span>
    </div>
  );
}

function optionsToText(options?: string[]) {
  return (options ?? []).join('\n');
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
        subtitle="Редактируй название, аудиторию, статус и вопросы пака. После сохранения обновленный пак сразу появится в карточках контактов."
        actionLabel="Все паки"
        actionHref="/settings/question-packs"
      />

      <Notice searchParams={sp} />

      <Card>
        <CardHeader>
          <CardTitle>Настройки пака</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={updateQuestionPackAction} className="grid gap-4 lg:grid-cols-2">
            <input type="hidden" name="id" value={pack.id} />
            <div>
              <label className="mb-2 block text-sm font-bold text-app-text">Полное название</label>
              <Input name="title" defaultValue={pack.title} required />
            </div>
            <div>
              <label className="mb-2 block text-sm font-bold text-app-text">Короткое название</label>
              <Input name="short_title" defaultValue={pack.shortTitle} />
            </div>
            <div>
              <label className="mb-2 block text-sm font-bold text-app-text">Для кого</label>
              <Select name="audience" defaultValue={pack.audience}>
                {questionPackAudienceOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </Select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-bold text-app-text">Статус</label>
              <Select name="status" defaultValue={pack.status ?? 'active'}>
                {questionPackStatusOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </Select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-bold text-app-text">Бейдж</label>
              <Input name="badge" defaultValue={pack.badge} />
            </div>
            <div className="lg:col-span-2">
              <label className="mb-2 block text-sm font-bold text-app-text">Описание</label>
              <Textarea name="description" defaultValue={pack.description} />
            </div>
            <div className="flex flex-wrap gap-2 lg:col-span-2">
              <Button type="submit"><Save className="h-4 w-4" />Сохранить пак</Button>
            </div>
          </form>

          <form action={deleteQuestionPackAction} className="mt-4 border-t border-app-line pt-4">
            <input type="hidden" name="id" value={pack.id} />
            <Button type="submit" variant="danger"><Trash2 className="h-4 w-4" />Удалить пак</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><PlusCircle className="h-4 w-4 text-app-purple" />Добавить вопрос</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={addQuestionToPackAction} className="grid gap-4 lg:grid-cols-[90px_1fr_190px] lg:items-end">
            <input type="hidden" name="pack_id" value={pack.id} />
            <div>
              <label className="mb-2 block text-sm font-bold text-app-text">Порядок</label>
              <Input name="order_index" type="number" min="1" defaultValue={String(pack.questions.length + 1)} />
            </div>
            <div>
              <label className="mb-2 block text-sm font-bold text-app-text">Вопрос</label>
              <Input name="question_text" placeholder="Например: как сейчас клиенты записываются?" required />
            </div>
            <div>
              <label className="mb-2 block text-sm font-bold text-app-text">Тип</label>
              <Select name="question_type" defaultValue="short_text">
                {questionTypeOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </Select>
            </div>
            <div className="lg:col-span-3">
              <label className="mb-2 block text-sm font-bold text-app-text">Варианты ответа</label>
              <Textarea name="options" placeholder="Для вопросов с вариантами. Каждый вариант с новой строки." />
            </div>
            <label className="flex items-center gap-2 text-sm font-semibold text-app-muted lg:col-span-3">
              <input type="checkbox" name="required" className="h-4 w-4" />
              Обязательный вопрос
            </label>
            <div className="lg:col-span-3">
              <Button type="submit">Добавить вопрос</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-black text-app-text">Вопросы пака</h2>
          <Badge tone="gray">{pack.questions.length} вопросов</Badge>
        </div>

        {pack.questions.length ? pack.questions
          .slice()
          .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
          .map((question, index) => (
            <Card key={question.id ?? `${question.text}-${index}`}>
              <CardContent className="space-y-4">
                <form action={updateQuestionPackQuestionAction} className="grid gap-4 lg:grid-cols-[90px_1fr_190px] lg:items-end">
                  <input type="hidden" name="pack_id" value={pack.id} />
                  <input type="hidden" name="question_id" value={question.id ?? ''} />
                  <div>
                    <label className="mb-2 block text-sm font-bold text-app-text">Порядок</label>
                    <Input name="order_index" type="number" min="1" defaultValue={String(question.orderIndex ?? index + 1)} />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-bold text-app-text">Вопрос</label>
                    <Input name="question_text" defaultValue={question.text} required />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-bold text-app-text">Тип</label>
                    <Select name="question_type" defaultValue={question.type}>
                      {questionTypeOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                    </Select>
                  </div>
                  <div className="lg:col-span-3">
                    <label className="mb-2 block text-sm font-bold text-app-text">Варианты ответа</label>
                    <Textarea name="options" defaultValue={optionsToText(question.options)} placeholder="Для вариантов выбора. Каждый вариант с новой строки." />
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3 lg:col-span-3">
                    <label className="flex items-center gap-2 text-sm font-semibold text-app-muted">
                      <input type="checkbox" name="required" defaultChecked={Boolean(question.required)} className="h-4 w-4" />
                      Обязательный вопрос
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <Badge tone="purple">{questionTypeLabel(question.type)}</Badge>
                      <Button type="submit" variant="secondary" size="sm">Сохранить вопрос</Button>
                    </div>
                  </div>
                </form>
                {question.id && (
                  <form action={deleteQuestionPackQuestionAction}>
                    <input type="hidden" name="pack_id" value={pack.id} />
                    <input type="hidden" name="question_id" value={question.id} />
                    <Button type="submit" variant="ghost" className="text-red-600 hover:bg-red-50 hover:text-red-700"><Trash2 className="h-4 w-4" />Удалить вопрос</Button>
                  </form>
                )}
              </CardContent>
            </Card>
          )) : (
            <Card>
              <CardContent className="py-10 text-center text-sm text-app-muted">В этом паке пока нет вопросов. Добавь первый вопрос выше.</CardContent>
            </Card>
          )}
      </div>
    </div>
  );
}
