'use client';

import { AlertCircle, CheckCircle2, LoaderCircle, Send } from 'lucide-react';
import { type FormEvent, type ReactNode, useRef, useState, useTransition } from 'react';
import {
  sendTelegramBroadcastTestMutation,
  sendTelegramQuickTestMutation,
  type TelegramBroadcastMutationResult
} from '@/actions/telegram.actions';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

function resultText(result: TelegramBroadcastMutationResult) {
  if (result.error === 'bot-not-configured') return 'Telegram bot token не настроен в окружении.';
  if (result.error === 'service-not-configured') return 'Не настроен SUPABASE_SERVICE_ROLE_KEY, поэтому сервер не может получить список адресатов.';
  if (result.error === 'no-recipients') return 'Нет получателей с заполненным Chat ID и включенными уведомлениями.';
  if (result.error === 'partial-failure') {
    const detail = result.details?.[0] ? ` Первая ошибка: ${result.details[0]}` : '';
    return `Отправлено: ${result.sent}, ошибок: ${result.failed}.${detail}`;
  }
  return `Тест завершен. Отправлено: ${result.sent}, ошибок: ${result.failed}.`;
}

function MutationButton({ pending, children, ...props }: React.ComponentProps<typeof Button> & { pending: boolean; children: ReactNode }) {
  return (
    <Button {...props} type="submit" disabled={props.disabled || pending} aria-busy={pending || undefined}>
      {pending ? <LoaderCircle className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" /> : null}
      {children}
    </Button>
  );
}

export function TelegramTestWorkspace() {
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [result, setResult] = useState<TelegramBroadcastMutationResult | null>(null);
  const pendingRef = useRef(false);
  const [, startTransition] = useTransition();

  function run(key: string, task: () => Promise<TelegramBroadcastMutationResult>) {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPendingKey(key);
    setResult(null);
    startTransition(async () => {
      try {
        setResult(await task());
      } finally {
        pendingRef.current = false;
        setPendingKey(null);
      }
    });
  }

  function sendText(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = String(new FormData(event.currentTarget).get('message') ?? '');
    run('custom', () => sendTelegramBroadcastTestMutation(message));
  }

  function sendQuick(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    run('quick', sendTelegramQuickTestMutation);
  }

  return (
    <div className="space-y-4">
      {result ? (
        <div role="status" aria-live="polite" className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${result.ok ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-red-100 bg-red-50 text-red-700'}`}>
          {result.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
          <span>{resultText(result)}</span>
        </div>
      ) : null}

      <form onSubmit={sendText} className="space-y-4">
        <Textarea name="message" defaultValue="Тестовое сообщение из Hutka. Telegram-уведомления для команды работают." />
        <MutationButton pending={pendingKey === 'custom'} disabled={Boolean(pendingKey && pendingKey !== 'custom')}>
          <Send className="h-4 w-4" />Отправить текст команде
        </MutationButton>
      </form>
      <form onSubmit={sendQuick}>
        <MutationButton variant="secondary" pending={pendingKey === 'quick'} disabled={Boolean(pendingKey && pendingKey !== 'quick')}>Быстрый тест всем</MutationButton>
      </form>
    </div>
  );
}
