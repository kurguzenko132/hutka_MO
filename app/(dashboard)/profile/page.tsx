import Link from 'next/link';
import Image from 'next/image';
import { AlertCircle, CheckCircle2, Mail, Send, ShieldCheck, UserRound } from 'lucide-react';
import { updateOwnProfileAction } from '@/actions/profile.actions';
import { sendOwnTelegramTestAction } from '@/actions/telegram.actions';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field, FormSection } from '@/components/forms/form-section';
import { getOwnMarketingProfile } from '@/lib/profile';
import { getInitials } from '@/lib/utils';
import { roleDescriptions, roleLabels, roleTone } from '@/lib/roles';

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
  const initials = getInitials(profile.fullName);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Профиль"
        subtitle="Настройки личного профиля маркетолога: имя, должность, аватар и контакты. Эти данные отображаются в нижнем блоке бокового меню и верхней панели."
      />

      <Notice searchParams={params} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <FormSection
          title="Личные данные"
          subtitle="Системная роль влияет на доступы и меняется администратором. Здесь можно менять только отображение профиля."
        >
          <form action={updateOwnProfileAction} className="grid gap-5 md:grid-cols-2">
            <Field label="Имя в интерфейсе" hint="Например: Даниил Кургузенко">
              <Input name="full_name" defaultValue={profile.fullName} placeholder="Имя и фамилия" required />
            </Field>

            <Field label="Должность в интерфейсе" hint="Показывается снизу в sidebar вместо системной роли">
              <Input name="job_title" defaultValue={profile.jobTitle} placeholder="Например, Growth-маркетолог" />
            </Field>

            <Field label="Ссылка на аватар" hint="Можно вставить прямую ссылку на изображение. Если пусто — будут показаны инициалы.">
              <Input name="avatar_url" defaultValue={profile.avatarUrl} placeholder="https://..." />
            </Field>

            <Field label="Телефон">
              <Input name="phone" defaultValue={profile.phone} placeholder="+375 ..." />
            </Field>

            <Field label="Telegram">
              <Input name="telegram" defaultValue={profile.telegram} placeholder="@username" />
            </Field>

            <Field label="Telegram chat ID" hint="Нужен для уведомлений бота. Его можно получить через getUpdates после сообщения боту.">
              <Input name="telegram_chat_id" defaultValue={profile.telegramChatId} placeholder="123456789" />
            </Field>

            <label className="flex items-start gap-3 rounded-2xl border border-app-line bg-white p-4 text-sm md:col-span-2">
              <input name="telegram_notifications_enabled" type="checkbox" defaultChecked={profile.telegramNotificationsEnabled} className="mt-1 h-4 w-4 rounded border-app-line text-app-purple" />
              <span>
                <span className="block font-bold text-app-text">Получать Telegram-уведомления</span>
                <span className="mt-1 block text-app-muted">Новые ответы на анкеты, важные действия и системные события будут приходить в Telegram, если bot token настроен в Vercel.</span>
              </span>
            </label>

            <Field label="Email аккаунта" hint="Email берется из Supabase Auth и отдельно не редактируется в профиле.">
              <Input value={profile.email} readOnly className="bg-slate-50 text-app-muted" />
            </Field>

            <div className="md:col-span-2">
              <Field label="Коротко о роли в проекте" hint="Например: отвечаю за привлечение мастеров, кампании и анкеты.">
                <Textarea name="bio" defaultValue={profile.bio} placeholder="Что ты делаешь в Hutka и за какие процессы отвечаешь" />
              </Field>
            </div>

            <div className="flex flex-col gap-3 md:col-span-2 sm:flex-row">
              <Button type="submit">Сохранить профиль</Button>
              <Button asChild variant="secondary">
                <Link href="/dashboard">Вернуться на главную</Link>
              </Button>
            </div>
          </form>
        </FormSection>

        <div className="space-y-6">
          <Card className="overflow-hidden">
            <div className="h-24 bg-gradient-to-br from-purple-500 via-pink-400 to-amber-200" />
            <CardContent className="-mt-12 space-y-5">
              <div className="flex items-end gap-4">
                {profile.avatarUrl ? (
                  <Image src={profile.avatarUrl} alt={profile.fullName} width={96} height={96} unoptimized className="h-24 w-24 rounded-3xl border-4 border-white object-cover shadow-card" />
                ) : (
                  <div className="flex h-24 w-24 items-center justify-center rounded-3xl border-4 border-white bg-gradient-to-br from-pink-400 to-purple-600 text-2xl font-black text-white shadow-card">
                    {initials}
                  </div>
                )}
                <div className="pb-1">
                  <Badge tone={roleTone(profile.role)}>{roleLabels[profile.role]}</Badge>
                </div>
              </div>

              <div>
                <h2 className="text-2xl font-black text-app-text">{profile.fullName}</h2>
                <p className="mt-1 text-sm font-semibold text-app-purple">{profile.jobTitle}</p>
              </div>

              {profile.bio ? <p className="rounded-2xl bg-app-soft p-4 text-sm leading-6 text-app-muted">{profile.bio}</p> : null}

              <div className="space-y-2 text-sm text-app-muted">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  <span className="truncate">{profile.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" />
                  <span>{roleDescriptions[profile.role]}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Как это будет выглядеть в меню</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-2xl border border-app-line bg-gradient-to-br from-white to-purple-50 p-3">
                <div className="flex items-center gap-3">
                  {profile.avatarUrl ? (
                    <Image src={profile.avatarUrl} alt="" width={40} height={40} unoptimized className="h-10 w-10 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-pink-400 to-purple-600 text-sm font-bold text-white">
                      {initials}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-app-text">{profile.fullName}</p>
                    <p className="truncate text-xs text-app-muted">{profile.jobTitle || roleLabels[profile.role]}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><UserRound className="h-4 w-4" /> Доступы</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-app-muted">
              <p>Системная роль: <span className="font-bold text-app-text">{roleLabels[profile.role]}</span></p>
              <p>Если нужно изменить доступы пользователя, администратор делает это в разделе <Link href="/settings" className="font-bold text-app-purple hover:underline">Настройки</Link>.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Send className="h-4 w-4" /> Telegram-уведомления</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-app-muted">
              <p>Статус: <span className="font-bold text-app-text">{profile.telegramNotificationsEnabled ? 'включены' : 'выключены'}</span></p>
              <p>Chat ID: <span className="font-mono text-app-text">{profile.telegramChatId || 'не указан'}</span></p>
              {profile.telegramLastTestAt ? <p>Последний тест: {new Date(profile.telegramLastTestAt).toLocaleString('ru-RU')}</p> : null}
              <form action={sendOwnTelegramTestAction}>
                <Button type="submit" variant="secondary" className="w-full">
                  <Send className="h-4 w-4" />
                  Отправить тест в Telegram
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
