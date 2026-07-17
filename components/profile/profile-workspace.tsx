'use client';

import Link from 'next/link';
import Image from 'next/image';
import { AlertCircle, CheckCircle2, LoaderCircle, Mail, Send, ShieldCheck, UserRound } from 'lucide-react';
import { type FormEvent, type ReactNode, useRef, useState, useTransition } from 'react';
import { updateOwnProfileMutation } from '@/actions/profile.actions';
import { sendOwnTelegramTestMutation } from '@/actions/telegram.actions';
import { Field, FormSection } from '@/components/forms/form-section';
import { publishProfilePresentation } from '@/components/layout/profile-presentation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { MarketingProfile } from '@/lib/profile-shared';
import { roleDescriptions, roleLabels, roleTone } from '@/lib/roles';
import { getInitials } from '@/lib/utils';

type Notice = { tone: 'success' | 'error'; text: string };

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

function cleanTelegram(value: string) {
  if (!value) return '';
  return value.startsWith('@') ? value : `@${value.replace(/^https?:\/\/t\.me\//, '')}`;
}

function errorText(error?: string, details?: string) {
  if (error === 'demo') return 'Supabase не настроен, изменение не сохранено.';
  if (error === 'name-required') return 'Укажи имя, которое будет отображаться в интерфейсе.';
  if (error === 'profile-not-found') return 'Профиль пользователя не найден.';
  if (error === 'chat-required') return 'Укажи Telegram chat ID и сохрани профиль перед тестом.';
  if (error === 'profile-update-failed') return 'Сообщение отправлено, но статус теста не удалось сохранить.';
  if (error === 'send-failed') return details ? `Telegram отклонил отправку: ${details}` : 'Telegram не принял тестовое сообщение.';
  return 'Не удалось сохранить изменение. Попробуй еще раз.';
}

function MutationButton({ pending, children, ...props }: React.ComponentProps<typeof Button> & { pending: boolean; children: ReactNode }) {
  return (
    <Button {...props} type="submit" disabled={props.disabled || pending} aria-busy={pending || undefined}>
      {pending ? <LoaderCircle className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" /> : null}
      {children}
    </Button>
  );
}

export function ProfileWorkspace({ initialProfile }: { initialProfile: MarketingProfile }) {
  const [profile, setProfile] = useState(initialProfile);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const pendingRef = useRef<string | null>(null);
  const [, startTransition] = useTransition();
  const initials = getInitials(profile.fullName);

  function runMutation(key: string, task: () => Promise<void>) {
    if (pendingRef.current) return false;
    pendingRef.current = key;
    setPendingKey(key);
    startTransition(async () => {
      try {
        await task();
      } finally {
        pendingRef.current = null;
        setPendingKey(null);
      }
    });
    return true;
  }

  function publish(next: MarketingProfile) {
    publishProfilePresentation({
      fullName: next.fullName,
      jobTitle: next.jobTitle,
      avatarUrl: next.avatarUrl
    });
  }

  function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingRef.current) return;
    const formData = new FormData(event.currentTarget);
    const fullName = value(formData, 'full_name');
    if (!fullName) return;

    const previous = profile;
    const telegramChatId = value(formData, 'telegram_chat_id');
    const optimistic: MarketingProfile = {
      ...profile,
      fullName,
      jobTitle: value(formData, 'job_title') || 'Маркетолог',
      avatarUrl: value(formData, 'avatar_url'),
      phone: value(formData, 'phone'),
      telegram: cleanTelegram(value(formData, 'telegram')),
      telegramChatId,
      telegramNotificationsEnabled: Boolean(telegramChatId && formData.get('telegram_notifications_enabled') === 'on'),
      bio: value(formData, 'bio'),
      updatedAt: `optimistic-${Date.now()}`
    };
    setProfile(optimistic);
    publish(optimistic);
    setNotice(null);

    runMutation('save', async () => {
      const result = await updateOwnProfileMutation(optimistic);
      if (!result.ok || !result.item) {
        setProfile(previous);
        publish(previous);
        setNotice({ tone: 'error', text: errorText(result.error) });
        return;
      }
      setProfile(result.item);
      publish(result.item);
      setNotice({ tone: 'success', text: 'Профиль сохранен. Данные в меню уже обновлены.' });
    });
  }

  function testTelegram(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingRef.current) return;
    setNotice(null);
    runMutation('telegram', async () => {
      const result = await sendOwnTelegramTestMutation();
      if (!result.ok) {
        setNotice({ tone: 'error', text: errorText(result.error, result.details) });
        return;
      }
      const next = {
        ...profile,
        telegramNotificationsEnabled: true,
        telegramLastTestAt: result.lastTestAt ?? new Date().toISOString()
      };
      setProfile(next);
      setNotice({ tone: 'success', text: 'Тестовое сообщение отправлено. Telegram-уведомления включены.' });
    });
  }

  return (
    <div className="space-y-6">
      {notice ? (
        <div role="status" aria-live="polite" className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${notice.tone === 'error' ? 'border-red-100 bg-red-50 text-red-700' : 'border-emerald-100 bg-emerald-50 text-emerald-700'}`}>
          {notice.tone === 'error' ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
          <span>{notice.text}</span>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <FormSection title="Личные данные" subtitle="Системная роль влияет на доступы и меняется администратором. Здесь можно менять только отображение профиля.">
          <form key={profile.updatedAt || profile.id} onSubmit={saveProfile} className="grid gap-5 md:grid-cols-2">
            <Field label="Имя в интерфейсе" hint="Например: Даниил Кургузенко">
              <Input name="full_name" defaultValue={profile.fullName} placeholder="Имя и фамилия" required />
            </Field>
            <Field label="Должность в интерфейсе" hint="Показывается снизу в sidebar вместо системной роли">
              <Input name="job_title" defaultValue={profile.jobTitle} placeholder="Например, Growth-маркетолог" />
            </Field>
            <Field label="Ссылка на аватар" hint="Можно вставить прямую ссылку на изображение. Если пусто, будут показаны инициалы.">
              <Input name="avatar_url" defaultValue={profile.avatarUrl} placeholder="https://..." />
            </Field>
            <Field label="Телефон"><Input name="phone" defaultValue={profile.phone} placeholder="+375 ..." /></Field>
            <Field label="Telegram"><Input name="telegram" defaultValue={profile.telegram} placeholder="@username" /></Field>
            <Field label="Telegram chat ID" hint="Нужен для уведомлений бота. Его можно получить через getUpdates после сообщения боту.">
              <Input name="telegram_chat_id" defaultValue={profile.telegramChatId} placeholder="123456789" />
            </Field>
            <label className="flex items-start gap-3 rounded-xl border border-app-line bg-white p-4 text-sm md:col-span-2">
              <input name="telegram_notifications_enabled" type="checkbox" defaultChecked={profile.telegramNotificationsEnabled} className="mt-1 h-4 w-4 rounded border-app-line text-app-purple" />
              <span>
                <span className="block font-bold text-app-text">Получать Telegram-уведомления</span>
                <span className="mt-1 block text-app-muted">Новые ответы на анкеты, важные действия и системные события будут приходить в Telegram.</span>
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
              <MutationButton pending={pendingKey === 'save'} disabled={Boolean(pendingKey && pendingKey !== 'save')}>Сохранить профиль</MutationButton>
              <Button asChild variant="secondary"><Link prefetch={false} href="/dashboard">Вернуться на главную</Link></Button>
            </div>
          </form>
        </FormSection>

        <div className="space-y-6">
          <Card className="overflow-hidden">
            <div className="h-24 bg-gradient-to-br from-purple-500 via-pink-400 to-amber-200" />
            <CardContent className="-mt-12 space-y-5">
              <div className="flex items-end gap-4">
                {profile.avatarUrl ? (
                  <Image src={profile.avatarUrl} alt={profile.fullName} width={96} height={96} className="h-24 w-24 rounded-3xl border-4 border-white object-cover shadow-card" />
                ) : (
                  <div className="flex h-24 w-24 items-center justify-center rounded-3xl border-4 border-white bg-gradient-to-br from-pink-400 to-purple-600 text-2xl font-black text-white shadow-card">{initials}</div>
                )}
                <div className="pb-1"><Badge tone={roleTone(profile.role)}>{roleLabels[profile.role]}</Badge></div>
              </div>
              <div><h2 className="text-2xl font-black text-app-text">{profile.fullName}</h2><p className="mt-1 text-sm font-semibold text-app-purple">{profile.jobTitle}</p></div>
              {profile.bio ? <p className="rounded-xl bg-app-soft p-4 text-sm leading-6 text-app-muted">{profile.bio}</p> : null}
              <div className="space-y-2 text-sm text-app-muted">
                <div className="flex items-center gap-2"><Mail className="h-4 w-4" /><span className="truncate">{profile.email}</span></div>
                <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" /><span>{roleDescriptions[profile.role]}</span></div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><UserRound className="h-4 w-4" />Доступы</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm text-app-muted">
              <p>Системная роль: <span className="font-bold text-app-text">{roleLabels[profile.role]}</span></p>
              <p>Доступы изменяет администратор в разделе <Link prefetch={false} href="/settings" className="font-bold text-app-purple hover:underline">Настройки</Link>.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Send className="h-4 w-4" />Telegram-уведомления</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-sm text-app-muted">
              <p>Статус: <span className="font-bold text-app-text">{profile.telegramNotificationsEnabled ? 'включены' : 'выключены'}</span></p>
              <p>Chat ID: <span className="font-mono text-app-text">{profile.telegramChatId || 'не указан'}</span></p>
              {profile.telegramLastTestAt ? <p>Последний тест: {new Date(profile.telegramLastTestAt).toLocaleString('ru-RU')}</p> : null}
              <form onSubmit={testTelegram}>
                <MutationButton variant="secondary" className="w-full" pending={pendingKey === 'telegram'} disabled={Boolean(pendingKey && pendingKey !== 'telegram')}>
                  <Send className="h-4 w-4" />Отправить тест в Telegram
                </MutationButton>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
