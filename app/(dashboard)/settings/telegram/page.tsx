import Link from 'next/link';
import { AlertCircle, CheckCircle2, ExternalLink, Send, Settings2, Users } from 'lucide-react';
import { sendTelegramBroadcastTestAction, sendTelegramTestToAllRecipientsAction } from '@/actions/telegram.actions';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { requireAdmin } from '@/lib/permissions';
import { getTelegramIntegrationStatus } from '@/lib/telegram';

function Notice({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const error = typeof searchParams.error === 'string' ? searchParams.error : '';
  const test = typeof searchParams.test === 'string' ? searchParams.test : '';
  const sent = typeof searchParams.sent === 'string' ? searchParams.sent : '0';
  const failed = typeof searchParams.failed === 'string' ? searchParams.failed : '0';

  if (error === 'no-recipients') {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
        <AlertCircle className="mt-0.5 h-4 w-4" />
        <span>Нет получателей: у пользователей должен быть заполнен Telegram chat ID и включены уведомления в профиле.</span>
      </div>
    );
  }

  if (test) {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
        <CheckCircle2 className="mt-0.5 h-4 w-4" />
        <span>Тест завершен. Отправлено: {sent}, ошибок: {failed}.</span>
      </div>
    );
  }

  return null;
}

export default async function TelegramSettingsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin('/settings?error=admin-only');
  const params = await searchParams;
  const status = await getTelegramIntegrationStatus();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Telegram-уведомления"
        subtitle="Настрой уведомления для команды: ответы на анкеты, follow-up и важные события будут приходить в Telegram."
        actionLabel="Назад в настройки"
        actionHref="/settings"
      />

      <Notice searchParams={params} />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-bold uppercase tracking-wide text-app-muted">Bot token</p>
            <div className="mt-3 flex items-center gap-2">
              <Badge tone={status.botConfigured ? 'green' : 'red'}>{status.botConfigured ? 'Настроен' : 'Не настроен'}</Badge>
            </div>
            <p className="mt-3 text-sm leading-6 text-app-muted">Переменная Vercel: <span className="font-mono text-app-text">TELEGRAM_BOT_TOKEN</span></p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-bold uppercase tracking-wide text-app-muted">App URL</p>
            <div className="mt-3 flex items-center gap-2">
              <Badge tone={status.appUrlConfigured ? 'green' : 'yellow'}>{status.appUrlConfigured ? 'Настроен' : 'Не указан'}</Badge>
            </div>
            <p className="mt-3 text-sm leading-6 text-app-muted">Нужен, чтобы в уведомлениях были ссылки на карточки и разделы.</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-bold uppercase tracking-wide text-app-muted">Получатели</p>
            <p className="mt-2 text-3xl font-black text-app-text">{status.recipients.length}</p>
            <p className="mt-1 text-sm text-app-muted">пользователей с включенными уведомлениями</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Send className="h-4 w-4" /> Тестовое сообщение</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form action={sendTelegramBroadcastTestAction} className="space-y-4">
              <Textarea name="message" defaultValue="Тестовое сообщение из Hutka. Telegram-уведомления для команды работают." />
              <Button type="submit">
                <Send className="h-4 w-4" />
                Отправить текст команде
              </Button>
            </form>
            <form action={sendTelegramTestToAllRecipientsAction}>
              <Button type="submit" variant="secondary">Быстрый тест всем</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Settings2 className="h-4 w-4" /> Как подключить</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-app-muted">
            <p>1. Создай бота через <span className="font-bold text-app-text">@BotFather</span>.</p>
            <p>2. Добавь в Vercel переменную <span className="font-mono text-app-text">TELEGRAM_BOT_TOKEN</span>.</p>
            <p>3. Каждый маркетолог пишет любое сообщение боту.</p>
            <p>4. Открой <span className="font-mono text-app-text">https://api.telegram.org/botTOKEN/getUpdates</span> и скопируй <span className="font-mono text-app-text">chat.id</span>.</p>
            <p>5. Вставь chat ID в <Link href="/profile" className="font-bold text-app-purple hover:underline">Профиль</Link> и включи уведомления.</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Users className="h-4 w-4" /> Получатели</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {status.recipients.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-app-line p-5 text-sm text-app-muted">
              Получателей пока нет. Заполни Telegram chat ID в профиле пользователя и включи уведомления.
            </div>
          ) : (
            status.recipients.map((recipient) => (
              <div key={recipient.id} className="flex flex-col justify-between gap-3 rounded-2xl border border-app-line bg-white p-4 sm:flex-row sm:items-center">
                <div className="min-w-0">
                  <p className="font-black text-app-text">{recipient.fullName}</p>
                  <p className="mt-1 text-sm text-app-muted">{recipient.jobTitle} · {recipient.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone="green">Включено</Badge>
                  <span className="max-w-[160px] truncate font-mono text-xs text-app-muted">{recipient.chatId}</span>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="border-blue-100 bg-gradient-to-br from-white to-blue-50/60">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-black text-app-text">Документация Telegram Bot API</p>
            <p className="mt-1 text-sm text-app-muted">Используется метод sendMessage. Token хранится только в серверных env-переменных.</p>
          </div>
          <Button asChild variant="secondary">
            <a href="https://core.telegram.org/bots/api#sendmessage" target="_blank" rel="noreferrer">
              Открыть API <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
