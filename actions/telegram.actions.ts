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

export async function sendOwnTelegramTestAction() {
  const user = await requireUser('/profile');

  if (!isSupabaseConfigured()) redirect('/profile?demo=1');

  const supabase = await createClient();
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id,full_name,telegram_chat_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (profileError || !profile?.id) redirect('/profile?telegram=profile-not-found');

  const chatId = typeof profile?.telegram_chat_id === 'string' ? profile.telegram_chat_id.trim() : '';
  if (!chatId) redirect('/profile?telegram=chat-required');

  const result = await sendTelegramMessage({
    chatId,
    text: [
      'Hutka · тест личных уведомлений',
      '',
      `Пользователь: ${profile?.full_name ?? user.fullName}`,
      'Если ты видишь это сообщение, личные Telegram-уведомления работают.'
    ].join('\n')
  });

  if (!result.ok) redirect('/profile?telegram=failed');

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ telegram_last_test_at: new Date().toISOString(), telegram_notifications_enabled: true })
    .eq('user_id', user.id);

  if (updateError) redirect('/profile?telegram=profile-update-failed');

  revalidateTelegram();
  redirect('/profile?telegram=sent');
}

export async function sendTelegramBroadcastTestAction(formData: FormData) {
  await requireAdmin('/settings?error=admin-only');
  const message = getText(formData, 'message') || 'Тестовое сообщение из Hutka. Telegram-уведомления для команды работают.';

  const result = await sendWorkspaceTelegramNotification({
    eventType: 'manual_test',
    title: 'тест команды',
    text: message,
    href: '/dashboard'
  });

  revalidateTelegram();
  if (result.skipped) redirect(`/settings/telegram?error=${result.reason ?? 'send-skipped'}`);
  redirect(`/settings/telegram?test=1&sent=${result.sent}&failed=${result.failed}`);
}

export async function sendTelegramTestToAllRecipientsAction() {
  await requireAdmin('/settings?error=admin-only');

  const result = await sendWorkspaceTelegramNotification({
    eventType: 'manual_quick_test',
    title: 'быстрый тест',
    text: 'Telegram-интеграция Hutka работает. Команда будет получать важные уведомления по анкетам, действиям и запуску.',
    href: '/dashboard'
  });

  revalidateTelegram();
  if (result.skipped) redirect(`/settings/telegram?error=${result.reason ?? 'send-skipped'}`);
  redirect(`/settings/telegram?test=1&sent=${result.sent}&failed=${result.failed}`);
}
