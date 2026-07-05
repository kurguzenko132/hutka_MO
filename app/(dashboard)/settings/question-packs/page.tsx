import Link from 'next/link';
import { AlertCircle, CheckCircle2, FileQuestion, PlusCircle, Settings2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { requireAdmin } from '@/lib/permissions';
import {
  getQuestionPackList,
  questionPackAudienceLabel,
  questionPackAudienceOptions,
  questionPackStatusLabel,
  questionPackStatusOptions
} from '@/lib/question-packs';
import { createQuestionPackAction } from '@/actions/question-packs.actions';

function Notice({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const error = typeof searchParams.error === 'string' ? searchParams.error : '';
  const saved = typeof searchParams.saved === 'string' ? searchParams.saved : '';
  const deleted = typeof searchParams.deleted === 'string' ? searchParams.deleted : '';
  const demo = typeof searchParams.demo === 'string' ? searchParams.demo : '';

  if (!error && !saved && !deleted && !demo) return null;

  const isError = Boolean(error);
  const message = isError
    ? 'Не удалось выполнить действие. Проверь поля или Supabase-таблицы question_packs.'
    : demo
      ? 'Supabase еще не настроен, поэтому готовые вопросы показаны в демо-режиме.'
      : deleted
        ? 'Готовые вопросы удалены.'
        : 'Готовые вопросы сохранены.';

  return (
    <div className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm ${isError ? 'border-red-100 bg-red-50 text-red-700' : 'border-emerald-100 bg-emerald-50 text-emerald-700'}`}>
      {isError ? <AlertCircle className="mt-0.5 h-4 w-4" /> : <CheckCircle2 className="mt-0.5 h-4 w-4" />}
      <span>{message}</span>
    </div>
  );
}

function CreatePackCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><PlusCircle className="h-4 w-4 text-app-purple" />Создать готовые вопросы</CardTitle>
        <p className="text-sm text-app-muted">Создай шаблон, который потом можно будет одним кликом отправлять мастеру, салону или клиенту из карточки контакта.</p>
      </CardHeader>
      <CardContent>
        <form action={createQuestionPackAction} className="grid gap-4 lg:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-bold text-app-text">Полное название</label>
            <Input name="title" placeholder="Например: Диагностика мастера" required />
          </div>
          <div>
            <label className="mb-2 block text-sm font-bold text-app-text">Короткое название</label>
            <Input name="short_title" placeholder="Мастер: диагностика" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-bold text-app-text">Для кого</label>
            <Select name="audience" defaultValue="master">
              {questionPackAudienceOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </Select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-bold text-app-text">Статус</label>
            <Select name="status" defaultValue="active">
              {questionPackStatusOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </Select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-bold text-app-text">Бейдж</label>
            <Input name="badge" placeholder="старт / карта / отказ" defaultValue="набор" />
          </div>
          <div className="lg:col-span-2">
            <label className="mb-2 block text-sm font-bold text-app-text">Описание</label>
            <Textarea name="description" placeholder="Коротко объясни, когда использовать этот набор." />
          </div>
          <div className="lg:col-span-2">
            <Button type="submit">Создать набор</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export default async function QuestionPacksPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const params = await searchParams;
  const packs = await getQuestionPackList(true);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Готовые вопросы"
        subtitle="Готовые наборы вопросов, которые можно быстро добавить в карточку мастера, салона, клиента или партнера."
        actionLabel="Назад в настройки"
        actionHref="/settings"
      />

      <Notice searchParams={params} />

      <div className="rounded-2xl border border-purple-100 bg-purple-50 px-4 py-3 text-sm text-purple-700">
        <div className="flex items-start gap-3">
          <Settings2 className="mt-0.5 h-4 w-4" />
          <p><b>Как работает:</b> создаешь набор один раз, потом в карточке контакта выбираешь его и Hutka создает персональную ссылку `/q/[token]` с этими вопросами.</p>
        </div>
      </div>

      <CreatePackCard />

      <div className="grid gap-4 xl:grid-cols-2">
        {packs.length ? packs.map((pack) => (
          <Card key={pack.id}>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="min-w-0 break-words text-lg font-black text-app-text">{pack.shortTitle}</h2>
                    <Badge tone="purple">{pack.badge}</Badge>
                    <Badge tone={pack.status === 'active' ? 'green' : pack.status === 'archived' ? 'gray' : 'yellow'}>{questionPackStatusLabel(pack.status ?? 'active')}</Badge>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-app-muted">{pack.description || 'Без описания'}</p>
                </div>
                <Button asChild size="sm">
                  <Link href={`/settings/question-packs/${pack.id}`}>Редактировать</Link>
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge tone="blue">{questionPackAudienceLabel(pack.audience)}</Badge>
                <Badge tone="gray">{pack.questionsCount} вопросов</Badge>
              </div>
            </CardContent>
          </Card>
        )) : (
          <Card className="xl:col-span-2">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <FileQuestion className="h-10 w-10 text-app-faint" />
              <h2 className="mt-4 text-lg font-black text-app-text">Готовые вопросы еще не созданы</h2>
              <p className="mt-2 max-w-xl text-sm text-app-muted">Создай первый набор вопросов, чтобы быстро отправлять мастерам и салонам готовые анкеты.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
