'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { requireAdmin, requireUser } from '@/lib/permissions';
import { sendTelegramMessage, sendWorkspaceTelegramNotification } from '@/lib/telegram';

function getText(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

function revalidateTelegram() {
  revalidatePath('/profile');
  revalidatePath('/settings/telegram');
  revalidatePath('/dashboard');
  revalidatePath('/notifications');
}

export type OwnTelegramTestMutationResult = {
  ok: boolean;
  error?: 'demo' | 'profile-not-found' | 'chat-required' | 'send-failed' | 'profile-update-failed';
  details?: string;
  lastTestAt?: string;
};

export type TelegramBroadcastMutationResult = {
  ok: boolean;
  error?: 'bot-not-configured' | 'service-not-configured' | 'no-recipients' | 'partial-failure';
  sent: number;
  failed: number;
  details?: string[];
};

export async function sendOwnTelegramTestAction() {
  const result = await sendOwnTelegramTestMutation();
  if (!result.ok) {
    if (result.error === 'demo') redirect('/profile?demo=1');
    const legacyError = result.error === 'send-failed' ? 'failed' : result.error;
    redirect(`/profile?telegram=${legacyError ?? 'failed'}`);
  }
  revalidateTelegram();
  redirect('/profile?telegram=sent');
}

export async function sendOwnTelegramTestMutation(): Promise<OwnTelegramTestMutationResult> {
  const user = await requireUser('/profile');

  if (!isSupabaseConfigured()) return { ok: false, error: 'demo' };

  const supabase = await createClient();
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id,full_name,telegram_chat_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (profileError || !profile?.id) return { ok: false, error: 'profile-not-found' };

  const chatId = typeof profile?.telegram_chat_id === 'string' ? profile.telegram_chat_id.trim() : '';
  if (!chatId) return { ok: false, error: 'chat-required' };

  const result = await sendTelegramMessage({
    chatId,
    text: [
      'Hutka · тест личных уведомлений',
      '',
      `Пользователь: ${profile?.full_name ?? user.fullName}`,
      'Если ты видишь это сообщение, личные Telegram-уведомления работают.'
    ].join('\n')
  });

  if (!result.ok) return { ok: false, error: 'send-failed', details: result.error ?? undefined };

  const lastTestAt = new Date().toISOString();
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ telegram_last_test_at: lastTestAt, telegram_notifications_enabled: true })
    .eq('user_id', user.id);

  if (updateError) return { ok: false, error: 'profile-update-failed' };
  return { ok: true, lastTestAt };
}

export async function sendTelegramBroadcastTestAction(formData: FormData) {
  const result = await sendTelegramBroadcastTestMutation(getText(formData, 'message'));
  revalidateTelegram();
  if (!result.ok && result.error !== 'partial-failure') redirect(`/settings/telegram?error=${result.error ?? 'send-skipped'}`);
  redirect(`/settings/telegram?test=1&sent=${result.sent}&failed=${result.failed}`);
}

export async function sendTelegramTestToAllRecipientsAction() {
  const result = await sendTelegramQuickTestMutation();
  revalidateTelegram();
  if (!result.ok && result.error !== 'partial-failure') redirect(`/settings/telegram?error=${result.error ?? 'send-skipped'}`);
  redirect(`/settings/telegram?test=1&sent=${result.sent}&failed=${result.failed}`);
}

async function runBroadcast(input: { eventType: string; title: string; text: string }): Promise<TelegramBroadcastMutationResult> {
  const result = await sendWorkspaceTelegramNotification({
    eventType: input.eventType,
    title: input.title,
    text: input.text,
    href: '/dashboard'
  });
  if (result.skipped) {
    return {
      ok: false,
      error: result.reason,
      sent: result.sent,
      failed: result.failed,
      details: result.errors
    };
  }
  return {
    ok: result.failed === 0,
    error: result.failed ? 'partial-failure' : undefined,
    sent: result.sent,
    failed: result.failed,
    details: result.errors
  };
}

export async function sendTelegramBroadcastTestMutation(message: string): Promise<TelegramBroadcastMutationResult> {
  await requireAdmin('/settings?error=admin-only');
  return runBroadcast({
    eventType: 'manual_test',
    title: 'тест команды',
    text: message.trim() || 'Тестовое сообщение из Hutka. Telegram-уведомления для команды работают.'
  });
}

export async function sendTelegramQuickTestMutation(): Promise<TelegramBroadcastMutationResult> {
  await requireAdmin('/settings?error=admin-only');
  return runBroadcast({
    eventType: 'manual_quick_test',
    title: 'быстрый тест',
    text: 'Telegram-интеграция Hutka работает. Команда будет получать важные уведомления по анкетам, действиям и запуску.'
  });
}
