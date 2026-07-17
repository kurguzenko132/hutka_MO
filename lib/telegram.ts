import { createClient as createSupabaseServiceClient } from '@supabase/supabase-js';
import { after } from 'next/server';
import { getSupabaseServiceConfig, isSupabaseConfigured, isSupabaseServiceConfigured } from '@/lib/supabase/config';
import { getAppBaseUrl } from '@/lib/app-url';

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
  serviceConfigured: boolean;
  botConfigured: boolean;
  appUrlConfigured: boolean;
  appUrl: string;
  recipients: TelegramRecipient[];
};

type TelegramMessagePayload = {
  chatId: string;
  text: string;
  disableWebPagePreview?: boolean;
};

type WorkspaceTelegramPayload = {
  eventType?: string;
  title: string;
  text: string;
  href?: string;
  extraLines?: string[];
};

export type WorkspaceTelegramResult = {
  sent: number;
  failed: number;
  skipped: boolean;
  reason?: 'bot-not-configured' | 'service-not-configured' | 'no-recipients';
  errors: string[];
};

function getBotToken() {
  return process.env.TELEGRAM_BOT_TOKEN?.trim() ?? '';
}

function getAppUrl() {
  return getAppBaseUrl();
}

function canUseServiceClient() {
  return isSupabaseServiceConfigured();
}

function createServiceClient() {
  const config = getSupabaseServiceConfig();

  if (!config) {
    throw new Error('Supabase service role env variables are not configured');
  }

  return createSupabaseServiceClient(config.url, config.serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

function normalizeText(value: string) {
  return value.replace(/\n{3,}/g, '\n\n').trim();
}

async function writeTelegramDeliveryLog(input: {
  eventType: string;
  status: 'sent' | 'skipped' | 'failed';
  chatId?: string;
  message?: string;
  error?: string | null;
}) {
  if (!canUseServiceClient()) return;

  try {
    const supabase = createServiceClient();
    await supabase.from('telegram_delivery_logs').insert({
      event_type: input.eventType,
      status: input.status,
      chat_id: input.chatId || null,
      message: input.message ? input.message.slice(0, 4000) : null,
      error: input.error || null
    });
  } catch {
    // Delivery logs are diagnostic only; notification delivery should not fail because logging failed.
  }
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

  const normalizedText = normalizeText(text);
  if (!normalizedText) {
    return { ok: false, error: 'Telegram message text is empty' };
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(6000),
      body: JSON.stringify({
        chat_id: targetChatId,
        text: normalizedText,
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
    .neq('telegram_chat_id', '')
    .eq('telegram_notifications_enabled', true)
    .order('full_name', { ascending: true });

  if (error || !data) return [];

  const seenChatIds = new Set<string>();

  return data
    .map((item) => ({
      id: String(item.id),
      email: typeof item.email === 'string' ? item.email : '',
      fullName: typeof item.full_name === 'string' && item.full_name.trim() ? item.full_name : 'Маркетолог',
      jobTitle: typeof item.job_title === 'string' && item.job_title.trim() ? item.job_title : 'Маркетолог',
      chatId: typeof item.telegram_chat_id === 'string' ? item.telegram_chat_id.trim() : '',
      enabled: Boolean(item.telegram_notifications_enabled)
    }))
    .filter((item) => {
      if (!item.chatId || seenChatIds.has(item.chatId)) return false;
      seenChatIds.add(item.chatId);
      return true;
    });
}

export async function getTelegramIntegrationStatus(): Promise<TelegramIntegrationStatus> {
  const appUrl = getAppUrl();
  return {
    supabaseConfigured: isSupabaseConfigured(),
    serviceConfigured: isSupabaseServiceConfigured(),
    botConfigured: isTelegramConfigured(),
    appUrlConfigured: Boolean(appUrl),
    appUrl,
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
  const eventType = payload.eventType ?? 'workspace';

  if (!isTelegramConfigured()) {
    await writeTelegramDeliveryLog({
      eventType,
      status: 'skipped',
      message: payload.text,
      error: 'TELEGRAM_BOT_TOKEN is not configured'
    });
    return { sent: 0, failed: 0, skipped: true, reason: 'bot-not-configured', errors: ['TELEGRAM_BOT_TOKEN is not configured'] } satisfies WorkspaceTelegramResult;
  }

  if (!isSupabaseServiceConfigured()) {
    await writeTelegramDeliveryLog({
      eventType,
      status: 'skipped',
      message: payload.text,
      error: 'SUPABASE_SERVICE_ROLE_KEY is not configured'
    });
    return { sent: 0, failed: 0, skipped: true, reason: 'service-not-configured', errors: ['SUPABASE_SERVICE_ROLE_KEY is not configured'] } satisfies WorkspaceTelegramResult;
  }

  const recipients = await getTelegramRecipients();
  if (recipients.length === 0) {
    await writeTelegramDeliveryLog({
      eventType,
      status: 'skipped',
      message: payload.text,
      error: 'No Telegram recipients'
    });
    return { sent: 0, failed: 0, skipped: true, reason: 'no-recipients', errors: ['No Telegram recipients'] } satisfies WorkspaceTelegramResult;
  }

  const text = buildWorkspaceTelegramText(payload);
  const results = await Promise.all(
    recipients.map(async (recipient) => {
      const result = await sendTelegramMessage({ chatId: recipient.chatId, text });
      await writeTelegramDeliveryLog({
        eventType,
        status: result.ok ? 'sent' : 'failed',
        chatId: recipient.chatId,
        message: text,
        error: result.error
      });
      return result;
    })
  );

  return {
    sent: results.filter((result) => result.ok).length,
    failed: results.filter((result) => !result.ok).length,
    skipped: false,
    errors: results.map((result) => result.error).filter((error): error is string => Boolean(error))
  } satisfies WorkspaceTelegramResult;
}

export function queueWorkspaceTelegramNotification(payload: WorkspaceTelegramPayload | (() => Promise<WorkspaceTelegramPayload>)) {
  after(async () => {
    try {
      const resolvedPayload = typeof payload === 'function' ? await payload() : payload;
      await sendWorkspaceTelegramNotification(resolvedPayload);
    } catch {
      // Delivery is best-effort and must not delay or fail the user's action.
    }
  });
}

export async function maybeNotifyQuestionnaireResponse(input: {
  questionnaireTitle: string;
  leadId?: string | null;
  leadName?: string | null;
  respondentName?: string | null;
  respondentContact?: string | null;
}) {
  return sendWorkspaceTelegramNotification({
    eventType: 'questionnaire_response',
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
