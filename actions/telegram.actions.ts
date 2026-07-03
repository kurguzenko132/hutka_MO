'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { requireAdmin, requireUser } from '@/lib/permissions';
import { getTelegramRecipients, sendTelegramMessage, sendWorkspaceTelegramNotification } from '@/lib/telegram';

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
  const { data: profile } = await supabase
    .from('profiles')
    .select('id,full_name,telegram_chat_id')
    .eq('user_id', user.id)
    .maybeSingle();

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

  await supabase
    .from('profiles')
    .update({ telegram_last_test_at: new Date().toISOString(), telegram_notifications_enabled: true })
    .eq('user_id', user.id);

  revalidateTelegram();
  redirect('/profile?telegram=sent');
}

export async function sendTelegramBroadcastTestAction(formData: FormData) {
  await requireAdmin('/settings?error=admin-only');
  const message = getText(formData, 'message') || 'Тестовое сообщение из Hutka. Telegram-уведомления для команды работают.';
  const recipients = await getTelegramRecipients();

  if (recipients.length === 0) redirect('/settings/telegram?error=no-recipients');

  const result = await sendWorkspaceTelegramNotification({
    title: 'тест команды',
    text: message,
    href: '/dashboard'
  });

  revalidateTelegram();
  redirect(`/settings/telegram?test=1&sent=${result.sent}&failed=${result.failed}`);
}

export async function sendTelegramTestToAllRecipientsAction() {
  await requireAdmin('/settings?error=admin-only');
  const recipients = await getTelegramRecipients();

  if (recipients.length === 0) redirect('/settings/telegram?error=no-recipients');

  const result = await sendWorkspaceTelegramNotification({
    title: 'быстрый тест',
    text: 'Telegram-интеграция Hutka работает. Команда будет получать важные уведомления по анкетам, follow-up и запуску.',
    href: '/dashboard'
  });

  revalidateTelegram();
  redirect(`/settings/telegram?test=1&sent=${result.sent}&failed=${result.failed}`);
}
