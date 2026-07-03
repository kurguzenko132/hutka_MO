import { createClient as createSupabaseServiceClient } from '@supabase/supabase-js';
import { isSupabaseConfigured } from '@/lib/supabase/config';

export type TelegramRecipient = {
  id: string;
  email: string;
  fullName: string;
  jobTitle: string;
  chatId: string;
  enabled: boolean;
};

export type TelegramIntegrationStatus = {
  supabaseConfigured: boolean;
  botConfigured: boolean;
  appUrlConfigured: boolean;
  recipients: TelegramRecipient[];
};

type TelegramMessagePayload = {
  chatId: string;
  text: string;
  disableWebPagePreview?: boolean;
};

type WorkspaceTelegramPayload = {
  title: string;
  text: string;
  href?: string;
  extraLines?: string[];
};

function getBotToken() {
  return process.env.TELEGRAM_BOT_TOKEN?.trim() ?? '';
}

function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ?? '';
}

function canUseServiceClient() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error('Supabase service role env variables are not configured');
  }

  return createSupabaseServiceClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

function normalizeText(value: string) {
  return value.replace(/\n{3,}/g, '\n\n').trim();
}

export function isTelegramConfigured() {
  return Boolean(getBotToken());
}

export async function sendTelegramMessage({ chatId, text, disableWebPagePreview = true }: TelegramMessagePayload) {
  const token = getBotToken();
  const targetChatId = chatId.trim();

  if (!token) {
    return { ok: false, error: 'TELEGRAM_BOT_TOKEN is not configured' };
  }

  if (!targetChatId) {
    return { ok: false, error: 'Telegram chat ID is empty' };
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: targetChatId,
        text: normalizeText(text),
        disable_web_page_preview: disableWebPagePreview
      })
    });

    const result = await response.json().catch(() => null) as { ok?: boolean; description?: string } | null;

    if (!response.ok || result?.ok === false) {
      return { ok: false, error: result?.description ?? `Telegram request failed: ${response.status}` };
    }

    return { ok: true, error: null };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Telegram request failed' };
  }
}

export async function getTelegramRecipients(): Promise<TelegramRecipient[]> {
  if (!isSupabaseConfigured() || !canUseServiceClient()) return [];

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('id,email,full_name,job_title,telegram_chat_id,telegram_notifications_enabled')
    .not('telegram_chat_id', 'is', null)
    .eq('telegram_notifications_enabled', true)
    .order('full_name', { ascending: true });

  if (error || !data) return [];

  return data
    .map((item) => ({
      id: String(item.id),
      email: typeof item.email === 'string' ? item.email : '',
      fullName: typeof item.full_name === 'string' && item.full_name.trim() ? item.full_name : 'Маркетолог',
      jobTitle: typeof item.job_title === 'string' && item.job_title.trim() ? item.job_title : 'Маркетолог',
      chatId: typeof item.telegram_chat_id === 'string' ? item.telegram_chat_id : '',
      enabled: Boolean(item.telegram_notifications_enabled)
    }))
    .filter((item) => item.chatId);
}

export async function getTelegramIntegrationStatus(): Promise<TelegramIntegrationStatus> {
  return {
    supabaseConfigured: isSupabaseConfigured(),
    botConfigured: isTelegramConfigured(),
    appUrlConfigured: Boolean(getAppUrl()),
    recipients: await getTelegramRecipients()
  };
}

export function buildWorkspaceTelegramText(payload: WorkspaceTelegramPayload) {
  const appUrl = getAppUrl();
  const lines = [
    `Hutka · ${payload.title}`,
    '',
    payload.text,
    ...(payload.extraLines?.length ? ['', ...payload.extraLines] : [])
  ];

  if (payload.href && appUrl) {
    lines.push('', `${appUrl}${payload.href.startsWith('/') ? payload.href : `/${payload.href}`}`);
  }

  return lines.join('\n');
}

export async function sendWorkspaceTelegramNotification(payload: WorkspaceTelegramPayload) {
  if (!isTelegramConfigured()) return { sent: 0, failed: 0, skipped: true };

  const recipients = await getTelegramRecipients();
  if (recipients.length === 0) return { sent: 0, failed: 0, skipped: true };

  const text = buildWorkspaceTelegramText(payload);
  let sent = 0;
  let failed = 0;

  await Promise.all(
    recipients.map(async (recipient) => {
      const result = await sendTelegramMessage({ chatId: recipient.chatId, text });
      if (result.ok) sent += 1;
      else failed += 1;
    })
  );

  return { sent, failed, skipped: false };
}

export async function maybeNotifyQuestionnaireResponse(input: {
  questionnaireTitle: string;
  leadId?: string | null;
  leadName?: string | null;
  respondentName?: string | null;
  respondentContact?: string | null;
}) {
  return sendWorkspaceTelegramNotification({
    title: 'новый ответ на анкету',
    text: [
      `Анкета: ${input.questionnaireTitle}`,
      input.leadName ? `Контакт: ${input.leadName}` : null,
      input.respondentName ? `Ответил: ${input.respondentName}` : null,
      input.respondentContact ? `Связь: ${input.respondentContact}` : null
    ].filter(Boolean).join('\n'),
    href: input.leadId ? `/people/${input.leadId}` : '/notifications'
  });
}
