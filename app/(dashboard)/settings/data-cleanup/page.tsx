import Link from 'next/link';
import { AlertTriangle, ArrowLeft, DatabaseZap, Trash2 } from 'lucide-react';
import { resetWorkspaceDataAction } from '@/actions/data-cleanup.actions';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { SubmitButton } from '@/components/ui/submit-button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { requireAdmin } from '@/lib/permissions';

type SearchParams = {
  success?: string;
  error?: string;
  demo?: string;
};

function Notice({ params }: { params?: SearchParams }) {
  if (params?.success) {
    const full = params.success === 'full';
    return (
      <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
        База очищена: {full ? 'рабочие данные и справочники удалены' : 'рабочие данные удалены, справочники сохранены'}.
      </div>
    );
  }

  if (params?.demo) {
    return <div className="rounded-2xl border border-purple-100 bg-purple-50 p-4 text-sm font-semibold text-purple-700">Supabase не настроен, поэтому очистка показана в demo-режиме.</div>;
  }

  if (!params?.error) return null;

  const message = params.error === 'confirmation'
    ? 'Для очистки нужно точно ввести ОЧИСТИТЬ.'
    : 'Не удалось очистить базу. Проверь SQL-права и попробуй выполнить файл supabase/cleanup-workspace.sql вручную.';

  return <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700">{message}</div>;
}

export default async function DataCleanupPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  await requireAdmin();
  const params = await searchParams;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Button asChild variant="secondary">
        <Link href="/settings"><ArrowLeft className="h-4 w-4" />Назад в настройки</Link>
      </Button>

      <PageHeader
        title="Очистка базы"
        subtitle="Удаляй демо-данные и лишние рабочие записи перед реальным запуском. Профили пользователей и Supabase Auth не удаляются."
      />

      <Notice params={params} />

      <Card className="border-red-100 bg-gradient-to-br from-white to-red-50/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><DatabaseZap className="h-5 w-5 text-app-red" />Очистить данные Hutka</CardTitle>
          <p className="text-sm leading-6 text-app-muted">
            Это действие удаляет контакты, задачи, анкеты, ответы, вопросы для контактов, кампании, выводы, связи, уведомления, импорт-логи, сохраненные фильтры и Telegram-логи. Используй перед тем, как начинать заполнять настоящую базу.
          </p>
        </CardHeader>
        <CardContent>
          <form action={resetWorkspaceDataAction} className="space-y-4 rounded-3xl border border-red-100 bg-white p-5">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-app-text">Что очистить</span>
                <Select name="mode" defaultValue="work">
                  <option value="work">Только рабочие данные</option>
                  <option value="full">Рабочие данные + справочники и шаблоны</option>
                </Select>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-app-text">Подтверждение</span>
                <Input name="confirmation" placeholder="Напиши: ОЧИСТИТЬ" required />
              </label>
            </div>

            <div className="flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm leading-6 text-red-700">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>Действие нельзя отменить из интерфейса. Перед полной очисткой лучше сделать export через /backup/export или сохранить дамп Supabase.</p>
            </div>

            <SubmitButton variant="danger" className="w-full md:w-auto">
              <Trash2 className="h-4 w-4" />
              Очистить базу
            </SubmitButton>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5 text-sm leading-6 text-app-muted">
          Если кнопка не сработает из-за RLS или прав Supabase, выполни файл <span className="font-mono font-bold text-app-text">supabase/cleanup-workspace.sql</span> в SQL Editor.
        </CardContent>
      </Card>
    </div>
  );
}
