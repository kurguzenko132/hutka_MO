import Link from 'next/link';
import { AlertCircle, CheckCircle2, DatabaseZap, FileQuestion, MessageSquareText, Settings2, AlertTriangle, Send } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SettingsDirectoryWorkspace } from '@/components/settings/settings-directory-workspace';
import { SettingsGeneralWorkspace } from '@/components/settings/settings-general-workspace';
import { getSettingsData } from '@/lib/settings';
import { requireAdmin } from '@/lib/permissions';

function Notice({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const error = typeof searchParams.error === 'string' ? searchParams.error : '';
  const saved = typeof searchParams.saved === 'string' ? searchParams.saved : '';
  const deleted = typeof searchParams.deleted === 'string' ? searchParams.deleted : '';
  const demo = typeof searchParams.demo === 'string' ? searchParams.demo : '';
  const count = typeof searchParams.count === 'string' ? searchParams.count : '';

  if (!error && !saved && !deleted && !demo) return null;

  const isError = Boolean(error);
  const errorMessages: Record<string, string> = {
    'source-duplicate': 'Такой источник уже есть. Названия вроде Instagram, instagram и Инстаграм считаются одним источником.',
    'source-in-use': `Нельзя удалить источник, потому что он используется в ${count || 'нескольких'} контактах.`,
    'stage-in-use': `Нельзя удалить стадию, потому что она используется в ${count || 'нескольких'} контактах.`,
    'tag-in-use': `Нельзя удалить тег, потому что он используется в ${count || 'нескольких'} контактах.`,
    'source-merge-failed': 'Не удалось объединить дубликаты источников. Проверь права и ограничения базы.'
  };

  const message = isError
    ? errorMessages[error] ?? 'Не удалось выполнить действие. Возможно, справочник уже используется в контактах или есть ограничение базы.'
    : demo
      ? 'Supabase еще не настроен, поэтому настройки показаны в демо-режиме.'
      : deleted
        ? 'Элемент справочника удален.'
        : saved === 'source-merge'
          ? `Дубликаты источников объединены${count ? `: ${count}` : ''}.`
        : 'Настройки сохранены.';

  return (
    <div className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm ${isError ? 'border-red-100 bg-red-50 text-red-700' : 'border-emerald-100 bg-emerald-50 text-emerald-700'}`}>
      {isError ? <AlertCircle className="mt-0.5 h-4 w-4" /> : <CheckCircle2 className="mt-0.5 h-4 w-4" />}
      <span>{message}</span>
    </div>
  );
}

export default async function SettingsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const params = await searchParams;
  const settings = await getSettingsData();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Настройки"
        subtitle="Управляй справочниками Hutka: источниками, стадиями воронки, тегами и базовыми параметрами системы."
      />

      <Notice searchParams={params} />

      {settings.isDemo && (
        <div className="flex items-start gap-3 rounded-2xl border border-purple-100 bg-purple-50 px-4 py-3 text-sm text-purple-700">
          <Settings2 className="mt-0.5 h-4 w-4" />
          <div>
            <p className="font-bold">Демо-режим справочников</p>
            <p className="mt-1 text-purple-600">Подключи Supabase и выполни обновленный schema.sql, чтобы сохранять изменения.</p>
          </div>
        </div>
      )}

      <SettingsGeneralWorkspace app={settings.app} initialUsers={settings.users} />

      <Card className="border-purple-100 bg-gradient-to-br from-white to-purple-50">
        <CardContent className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <FileQuestion className="h-5 w-5 text-app-purple" />
              <h2 className="text-lg font-black text-app-text">Готовые вопросы</h2>
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-app-muted">
              Управляй готовыми наборами вопросов для мастеров, салонов и клиентов. Их можно одним кликом отправлять из карточки контакта.
            </p>
          </div>
          <Button asChild>
            <Link href="/settings/question-packs">Открыть вопросы</Link>
          </Button>
        </CardContent>
      </Card>

      <Card className="border-pink-100 bg-gradient-to-br from-white to-pink-50">
        <CardContent className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <MessageSquareText className="h-5 w-5 text-app-pink" />
              <h2 className="text-lg font-black text-app-text">Шаблоны сообщений</h2>
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-app-muted">
              Управляй готовыми текстами для первого сообщения, отправки анкеты, действия по контакту, приглашения в тестирование и сбора обратной связи.
            </p>
          </div>
          <Button asChild>
            <Link href="/settings/message-templates">Открыть шаблоны</Link>
          </Button>
        </CardContent>
      </Card>


      <Card className="border-purple-100 bg-gradient-to-br from-white to-purple-50">
        <CardContent className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <DatabaseZap className="h-5 w-5 text-app-purple" />
              <h2 className="text-lg font-black text-app-text">Логи действий</h2>
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-app-muted">
              Журнал показывает, кто создавал, изменял и удалял контакты, задачи, кампании, источники и другие рабочие данные.
            </p>
          </div>
          <Button asChild variant="secondary">
            <Link href="/settings/activity-log">Открыть логи</Link>
          </Button>
        </CardContent>
      </Card>



      <Card className="border-blue-100 bg-gradient-to-br from-white to-blue-50/60">
        <CardContent className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Send className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-black text-app-text">Telegram-уведомления</h2>
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-app-muted">
              Подключи Telegram-бота, проверь получателей и отправь тестовое сообщение команде. Chat ID каждого маркетолога настраивается в его профиле.
            </p>
          </div>
          <Button asChild variant="secondary">
            <Link href="/settings/telegram">Открыть Telegram</Link>
          </Button>
        </CardContent>
      </Card>

      <Card className="border-red-100 bg-gradient-to-br from-white to-red-50/40">
        <CardContent className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-app-red" />
              <h2 className="text-lg font-black text-app-text">Причины отказа</h2>
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-app-muted">
              Настрой причины, которые выбираются при переводе контакта в отказ. Они попадут в карточки, отчеты и аналитику воронки.
            </p>
          </div>
          <Button asChild variant="secondary">
            <Link href="/settings/refusal-reasons">Открыть причины</Link>
          </Button>
        </CardContent>
      </Card>



      <Card className="border-red-100 bg-gradient-to-br from-white to-red-50/40">
        <CardContent className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <DatabaseZap className="h-5 w-5 text-app-red" />
              <h2 className="text-lg font-black text-app-text">Очистка базы</h2>
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-app-muted">
              Удали демо-контакты, задачи, анкеты, кампании, выводы и другие тестовые данные перед реальным запуском. Профили пользователей не удаляются.
            </p>
          </div>
          <Button asChild variant="secondary">
            <Link href="/settings/data-cleanup">Открыть очистку</Link>
          </Button>
        </CardContent>
      </Card>

      <SettingsDirectoryWorkspace
        initialSources={settings.sources}
        initialStages={settings.stages}
        initialTags={settings.tags}
      />
    </div>
  );
}
