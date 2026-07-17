import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { ProfileWorkspace } from '@/components/profile/profile-workspace';
import { getOwnMarketingProfile } from '@/lib/profile';

function Notice({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const saved = typeof searchParams.saved === 'string' ? searchParams.saved : '';
  const error = typeof searchParams.error === 'string' ? searchParams.error : '';
  const demo = typeof searchParams.demo === 'string' ? searchParams.demo : '';
  const telegram = typeof searchParams.telegram === 'string' ? searchParams.telegram : '';

  if (!saved && !error && !demo && !telegram) return null;

  if (error) {
    const message = error === 'name-required'
      ? 'Укажи имя, которое будет отображаться в интерфейсе.'
      : error === 'profile-not-found'
        ? 'Профиль пользователя не найден. Проверь Supabase trigger создания профиля.'
        : 'Не удалось сохранить профиль. Проверь данные и попробуй еще раз.';

    return (
      <div className="flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
        <AlertCircle className="mt-0.5 h-4 w-4" />
        <span>{message}</span>
      </div>
    );
  }

  if (telegram === 'chat-required' || telegram === 'failed' || telegram === 'profile-not-found' || telegram === 'profile-update-failed') {
    const message = telegram === 'chat-required'
      ? 'Укажи Telegram chat ID и сохрани профиль перед тестом.'
      : telegram === 'profile-not-found'
        ? 'Профиль пользователя не найден. Проверь Supabase trigger создания профиля.'
        : telegram === 'profile-update-failed'
          ? 'Тест отправлен, но не удалось обновить профиль в Supabase.'
          : 'Не удалось отправить тестовое сообщение. Проверь TELEGRAM_BOT_TOKEN и chat ID.';

    return (
      <div className="flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
        <AlertCircle className="mt-0.5 h-4 w-4" />
        <span>{message}</span>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
      <CheckCircle2 className="mt-0.5 h-4 w-4" />
      <span>{telegram === 'sent' ? 'Тестовое Telegram-сообщение отправлено. Уведомления включены.' : demo ? 'Supabase не настроен, поэтому профиль открыт в демо-режиме.' : 'Профиль сохранен. Имя и должность обновятся в меню.'}</span>
    </div>
  );
}

export default async function ProfilePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const profile = await getOwnMarketingProfile();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Профиль"
        subtitle="Настройки личного профиля маркетолога: имя, должность, аватар и контакты. Эти данные отображаются в нижнем блоке бокового меню и верхней панели."
      />

      <Notice searchParams={params} />
      <ProfileWorkspace initialProfile={profile} />
    </div>
  );
}
