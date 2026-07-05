import type { ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { AlertCircle, CheckCircle2, DatabaseZap, FileQuestion, MessageSquareText, Settings2, Trash2, UserRound, AlertTriangle, Send } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { getSettingsData, type DirectoryItem, type UserDirectoryItem } from '@/lib/settings';
import {
  createSourceAction,
  createStageAction,
  createTagAction,
  deleteSourceAction,
  deleteStageAction,
  deleteTagAction,
  mergeDuplicateSourcesAction,
  updateAppSettingsAction,
  updateSourceAction,
  updateStageAction,
  updateTagAction,
  updateProfileRoleAction
} from '@/actions/settings.actions';
import { requireAdmin } from '@/lib/permissions';
import { roleDescriptions, roleLabels, roleTone, type UserRole } from '@/lib/roles';
import { getInitials } from '@/lib/utils';

const colors: Array<{ label: string; value: BadgeTone }> = [
  { label: 'Фиолетовый', value: 'purple' },
  { label: 'Розовый', value: 'pink' },
  { label: 'Зеленый', value: 'green' },
  { label: 'Желтый', value: 'yellow' },
  { label: 'Красный', value: 'red' },
  { label: 'Синий', value: 'blue' },
  { label: 'Серый', value: 'gray' }
];

const sourceTypes = [
  { label: 'Соцсеть', value: 'social' },
  { label: 'Реклама', value: 'ads' },
  { label: 'Партнер', value: 'partner' },
  { label: 'Рекомендация', value: 'referral' },
  { label: 'Офлайн', value: 'offline' },
  { label: 'Ручной ввод', value: 'manual' }
];

const stageTypes = [
  { label: 'Мастера', value: 'master' },
  { label: 'Салоны', value: 'salon' },
  { label: 'Клиенты', value: 'client' },
  { label: 'Партнеры', value: 'partner' }
];

function fieldLabel(text: string) {
  return <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-app-muted">{text}</label>;
}

function typeLabel(value?: string) {
  const dictionary: Record<string, string> = {
    social: 'Соцсеть',
    ads: 'Реклама',
    partner: 'Партнер',
    referral: 'Рекомендация',
    offline: 'Офлайн',
    manual: 'Ручной ввод',
    master: 'Мастера',
    salon: 'Салоны',
    client: 'Клиенты'
  };

  return dictionary[value ?? ''] ?? value ?? '—';
}

function colorTone(value?: string): BadgeTone {
  const allowed = colors.map((color) => color.value);
  return allowed.includes(value as BadgeTone) ? (value as BadgeTone) : 'purple';
}

function Notice({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const error = typeof searchParams.error === 'string' ? searchParams.error : '';
  const saved = typeof searchParams.saved === 'string' ? searchParams.saved : '';
  const deleted = typeof searchParams.deleted === 'string' ? searchParams.deleted : '';
  const demo = typeof searchParams.demo === 'string' ? searchParams.demo : '';
  const count = typeof searchParams.count === 'string' ? searchParams.count : '';

  if (!error && !saved && !deleted && !demo) return null;

  const isError = Boolean(error);
  const errorMessages: Record<string, string> = {
    'source-duplicate': 'Такой источник уже есть. Названия вроде Instagram, instagram и Инстаграм считаются одним источником.',
    'source-in-use': `Нельзя удалить источник, потому что он используется в ${count || 'нескольких'} контактах.`,
    'stage-in-use': `Нельзя удалить стадию, потому что она используется в ${count || 'нескольких'} контактах.`,
    'tag-in-use': `Нельзя удалить тег, потому что он используется в ${count || 'нескольких'} контактах.`,
    'source-merge-failed': 'Не удалось объединить дубликаты источников. Проверь права и ограничения базы.'
  };

  const message = isError
    ? errorMessages[error] ?? 'Не удалось выполнить действие. Возможно, справочник уже используется в контактах или есть ограничение базы.'
    : demo
      ? 'Supabase еще не настроен, поэтому настройки показаны в демо-режиме.'
      : deleted
        ? 'Элемент справочника удален.'
        : saved === 'source-merge'
          ? `Дубликаты источников объединены${count ? `: ${count}` : ''}.`
        : 'Настройки сохранены.';

  return (
    <div className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm ${isError ? 'border-red-100 bg-red-50 text-red-700' : 'border-emerald-100 bg-emerald-50 text-emerald-700'}`}>
      {isError ? <AlertCircle className="mt-0.5 h-4 w-4" /> : <CheckCircle2 className="mt-0.5 h-4 w-4" />}
      <span>{message}</span>
    </div>
  );
}

function AppSettingsCard({ app }: { app: Awaited<ReturnType<typeof getSettingsData>>['app'] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Базовые настройки</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={updateAppSettingsAction} className="grid gap-4 md:grid-cols-2">
          <div>
            {fieldLabel('Название продукта')}
            <Input name="product_name" defaultValue={app.productName} placeholder="Hutka" />
          </div>
          <div>
            {fieldLabel('Рабочее пространство')}
            <Input name="workspace_name" defaultValue={app.workspaceName} placeholder="Beauty CRM Launch" />
          </div>
          <div>
            {fieldLabel('Город по умолчанию')}
            <Input name="default_city" defaultValue={app.defaultCity} placeholder="Минск" />
          </div>
          <div>
            {fieldLabel('День недельного отчета')}
            <Select name="weekly_report_day" defaultValue={app.weeklyReportDay}>
              {['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'].map((day) => (
                <option key={day} value={day}>{day}</option>
              ))}
            </Select>
          </div>
          <div className="md:col-span-2">
            <Button type="submit">Сохранить базовые настройки</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function CreateSourceCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Добавить источник</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={createSourceAction} className="grid gap-4 md:grid-cols-[1fr_180px_auto] md:items-end">
          <div>
            {fieldLabel('Название')}
            <Input name="name" placeholder="Например, Instagram Reels" required />
          </div>
          <div>
            {fieldLabel('Тип')}
            <Select name="type" defaultValue="manual">
              {sourceTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </Select>
          </div>
          <Button type="submit">Добавить</Button>
        </form>
      </CardContent>
    </Card>
  );
}

function CreateStageCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Добавить стадию</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={createStageAction} className="grid gap-4 lg:grid-cols-[1fr_150px_120px_150px_auto] lg:items-end">
          <div>
            {fieldLabel('Название')}
            <Input name="name" placeholder="Например, Презентация" required />
          </div>
          <div>
            {fieldLabel('Воронка')}
            <Select name="type" defaultValue="master">
              {stageTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </Select>
          </div>
          <div>
            {fieldLabel('Порядок')}
            <Input name="order_index" type="number" min="1" defaultValue="99" />
          </div>
          <div>
            {fieldLabel('Цвет')}
            <Select name="color" defaultValue="purple">
              {colors.map((color) => <option key={color.value} value={color.value}>{color.label}</option>)}
            </Select>
          </div>
          <Button type="submit">Добавить</Button>
        </form>
      </CardContent>
    </Card>
  );
}

function CreateTagCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Добавить тег</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={createTagAction} className="grid gap-4 md:grid-cols-[1fr_180px_auto] md:items-end">
          <div>
            {fieldLabel('Название')}
            <Input name="name" placeholder="Например, Нужно дожать" required />
          </div>
          <div>
            {fieldLabel('Цвет')}
            <Select name="color" defaultValue="purple">
              {colors.map((color) => <option key={color.value} value={color.value}>{color.label}</option>)}
            </Select>
          </div>
          <Button type="submit">Добавить</Button>
        </form>
      </CardContent>
    </Card>
  );
}

function SourceRow({ item }: { item: DirectoryItem }) {
  return (
    <div className="grid gap-3 rounded-2xl border border-app-line bg-white p-4 lg:grid-cols-[1fr_auto] lg:items-end">
      <form action={updateSourceAction} className="grid gap-3 lg:grid-cols-[1fr_160px_100px_130px] lg:items-end">
        <input type="hidden" name="id" value={item.id} />
        <div>
          {fieldLabel('Источник')}
          <Input name="name" defaultValue={item.name} />
        </div>
        <div>
          {fieldLabel('Тип')}
          <Select name="type" defaultValue={item.type ?? 'manual'}>
            {sourceTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
          </Select>
        </div>
        <div>
          {fieldLabel('Использований')}
          <div className="flex h-10 items-center rounded-xl bg-app-soft px-3 text-sm font-semibold text-app-text">{item.usageCount ?? 0}</div>
        </div>
        <Button type="submit" variant="secondary">Сохранить</Button>
      </form>
      <form action={deleteSourceAction} className="lg:justify-self-end">
        <input type="hidden" name="id" value={item.id} />
        <Button type="submit" variant="ghost" className="text-red-600 hover:bg-red-50 hover:text-red-700">
          <Trash2 className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}

function StageRow({ item }: { item: DirectoryItem }) {
  return (
    <div className="grid gap-3 rounded-2xl border border-app-line bg-white p-4 xl:grid-cols-[1fr_auto] xl:items-end">
      <form action={updateStageAction} className="grid gap-3 xl:grid-cols-[1fr_135px_100px_135px_100px_130px] xl:items-end">
        <input type="hidden" name="id" value={item.id} />
        <div>
          {fieldLabel('Стадия')}
          <Input name="name" defaultValue={item.name} />
        </div>
        <div>
          {fieldLabel('Воронка')}
          <Select name="type" defaultValue={item.type ?? 'master'}>
            {stageTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
          </Select>
        </div>
        <div>
          {fieldLabel('Порядок')}
          <Input name="order_index" type="number" defaultValue={item.orderIndex ?? 99} />
        </div>
        <div>
          {fieldLabel('Цвет')}
          <Select name="color" defaultValue={item.color ?? 'purple'}>
            {colors.map((color) => <option key={color.value} value={color.value}>{color.label}</option>)}
          </Select>
        </div>
        <div>
          {fieldLabel('Контактов')}
          <div className="flex h-10 items-center rounded-xl bg-app-soft px-3 text-sm font-semibold text-app-text">{item.usageCount ?? 0}</div>
        </div>
        <Button type="submit" variant="secondary">Сохранить</Button>
      </form>
      <form action={deleteStageAction} className="xl:justify-self-end">
        <input type="hidden" name="id" value={item.id} />
        <Button type="submit" variant="ghost" className="text-red-600 hover:bg-red-50 hover:text-red-700">
          <Trash2 className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}

function TagRow({ item }: { item: DirectoryItem }) {
  return (
    <div className="grid gap-3 rounded-2xl border border-app-line bg-white p-4 lg:grid-cols-[1fr_auto] lg:items-end">
      <form action={updateTagAction} className="grid gap-3 lg:grid-cols-[1fr_160px_110px_130px] lg:items-end">
        <input type="hidden" name="id" value={item.id} />
        <div>
          {fieldLabel('Тег')}
          <Input name="name" defaultValue={item.name} />
        </div>
        <div>
          {fieldLabel('Цвет')}
          <Select name="color" defaultValue={item.color ?? 'purple'}>
            {colors.map((color) => <option key={color.value} value={color.value}>{color.label}</option>)}
          </Select>
        </div>
        <div>
          {fieldLabel('Контактов')}
          <div className="flex h-10 items-center rounded-xl bg-app-soft px-3 text-sm font-semibold text-app-text">{item.usageCount ?? 0}</div>
        </div>
        <Button type="submit" variant="secondary">Сохранить</Button>
      </form>
      <form action={deleteTagAction} className="lg:justify-self-end">
        <input type="hidden" name="id" value={item.id} />
        <Button type="submit" variant="ghost" className="text-red-600 hover:bg-red-50 hover:text-red-700">
          <Trash2 className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}


function UsersSection({ users }: { users: UserDirectoryItem[] }) {
  const roles: UserRole[] = ['admin', 'marketer', 'viewer'];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><UserRound className="h-4 w-4" /> Пользователи и роли</CardTitle>
        <p className="text-sm text-app-muted">
          Управляй доступом команды. Admin меняет настройки и роли, marketer работает с запуском, viewer только смотрит данные.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 lg:grid-cols-3">
          {roles.map((role) => (
            <div key={role} className="rounded-2xl border border-app-line bg-gradient-to-br from-white to-purple-50 p-4">
              <Badge tone={roleTone(role)}>{roleLabels[role]}</Badge>
              <p className="mt-3 text-xs leading-5 text-app-muted">{roleDescriptions[role]}</p>
            </div>
          ))}
        </div>

        <div className="space-y-3 pt-2">
          {users.length ? users.map((user) => (
            <div key={user.id} className="grid gap-3 rounded-2xl border border-app-line bg-white p-4 lg:grid-cols-[1fr_180px_auto] lg:items-end">
              <div className="flex items-center gap-3">
                {user.avatarUrl ? (
                  <Image src={user.avatarUrl} alt="" width={44} height={44} unoptimized className="h-11 w-11 rounded-2xl object-cover" />
                ) : (
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-400 to-purple-600 text-sm font-black text-white">
                    {getInitials(user.fullName, 'U')}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-app-text">{user.fullName}</p>
                  <p className="mt-1 truncate text-xs font-semibold text-app-purple">{user.jobTitle || roleLabels[user.role]}</p>
                  <p className="mt-1 truncate text-xs text-app-muted">{user.email}</p>
                  {user.createdAt && <p className="mt-1 text-[11px] text-app-faint">Создан: {new Date(user.createdAt).toLocaleDateString('ru-RU')}</p>}
                </div>
              </div>
              <form action={updateProfileRoleAction} className="contents">
                <input type="hidden" name="profile_id" value={user.id} />
                <div>
                  {fieldLabel('Роль')}
                  <Select name="role" defaultValue={user.role}>
                    {roles.map((role) => <option key={role} value={role}>{roleLabels[role]}</option>)}
                  </Select>
                </div>
                <Button type="submit" variant="secondary">Сохранить роль</Button>
              </form>
            </div>
          )) : <p className="text-sm text-app-muted">Пользователи пока не найдены.</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function DirectorySection({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <p className="text-sm text-app-muted">{description}</p>
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  );
}

export default async function SettingsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const params = await searchParams;
  const settings = await getSettingsData();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Настройки"
        subtitle="Управляй справочниками Hutka: источниками, стадиями воронки, тегами и базовыми параметрами системы."
      />

      <Notice searchParams={params} />

      {settings.isDemo && (
        <div className="flex items-start gap-3 rounded-2xl border border-purple-100 bg-purple-50 px-4 py-3 text-sm text-purple-700">
          <Settings2 className="mt-0.5 h-4 w-4" />
          <div>
            <p className="font-bold">Демо-режим справочников</p>
            <p className="mt-1 text-purple-600">Подключи Supabase и выполни обновленный schema.sql, чтобы сохранять изменения.</p>
          </div>
        </div>
      )}

      <AppSettingsCard app={settings.app} />

      <Card className="border-purple-100 bg-gradient-to-br from-white to-purple-50">
        <CardContent className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <FileQuestion className="h-5 w-5 text-app-purple" />
              <h2 className="text-lg font-black text-app-text">Готовые вопросы</h2>
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-app-muted">
              Управляй готовыми наборами вопросов для мастеров, салонов и клиентов. Их можно одним кликом отправлять из карточки контакта.
            </p>
          </div>
          <Button asChild>
            <Link href="/settings/question-packs">Открыть вопросы</Link>
          </Button>
        </CardContent>
      </Card>

      <Card className="border-pink-100 bg-gradient-to-br from-white to-pink-50">
        <CardContent className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <MessageSquareText className="h-5 w-5 text-app-pink" />
              <h2 className="text-lg font-black text-app-text">Шаблоны сообщений</h2>
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-app-muted">
              Управляй готовыми текстами для первого сообщения, отправки анкеты, действия по контакту, приглашения в тестирование и сбора обратной связи.
            </p>
          </div>
          <Button asChild>
            <Link href="/settings/message-templates">Открыть шаблоны</Link>
          </Button>
        </CardContent>
      </Card>


      <Card className="border-purple-100 bg-gradient-to-br from-white to-purple-50">
        <CardContent className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <DatabaseZap className="h-5 w-5 text-app-purple" />
              <h2 className="text-lg font-black text-app-text">Логи действий</h2>
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-app-muted">
              Журнал показывает, кто создавал, изменял и удалял контакты, задачи, кампании, источники и другие рабочие данные.
            </p>
          </div>
          <Button asChild variant="secondary">
            <Link href="/settings/activity-log">Открыть логи</Link>
          </Button>
        </CardContent>
      </Card>



      <Card className="border-blue-100 bg-gradient-to-br from-white to-blue-50/60">
        <CardContent className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Send className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-black text-app-text">Telegram-уведомления</h2>
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-app-muted">
              Подключи Telegram-бота, проверь получателей и отправь тестовое сообщение команде. Chat ID каждого маркетолога настраивается в его профиле.
            </p>
          </div>
          <Button asChild variant="secondary">
            <Link href="/settings/telegram">Открыть Telegram</Link>
          </Button>
        </CardContent>
      </Card>

      <Card className="border-red-100 bg-gradient-to-br from-white to-red-50/40">
        <CardContent className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-app-red" />
              <h2 className="text-lg font-black text-app-text">Причины отказа</h2>
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-app-muted">
              Настрой причины, которые выбираются при переводе контакта в отказ. Они попадут в карточки, отчеты и аналитику воронки.
            </p>
          </div>
          <Button asChild variant="secondary">
            <Link href="/settings/refusal-reasons">Открыть причины</Link>
          </Button>
        </CardContent>
      </Card>



      <Card className="border-red-100 bg-gradient-to-br from-white to-red-50/40">
        <CardContent className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <DatabaseZap className="h-5 w-5 text-app-red" />
              <h2 className="text-lg font-black text-app-text">Очистка базы</h2>
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-app-muted">
              Удали демо-контакты, задачи, анкеты, кампании, выводы и другие тестовые данные перед реальным запуском. Профили пользователей не удаляются.
            </p>
          </div>
          <Button asChild variant="secondary">
            <Link href="/settings/data-cleanup">Открыть очистку</Link>
          </Button>
        </CardContent>
      </Card>

            <UsersSection users={settings.users} />

      <div className="grid gap-6 xl:grid-cols-3">
        <CreateSourceCard />
        <CreateStageCard />
        <CreateTagCard />
      </div>

      <DirectorySection
        title="Источники"
        description="Каналы, из которых приходят контакты: Instagram, Telegram, рекомендации, реклама, партнеры."
      >
        <form action={mergeDuplicateSourcesAction} className="mb-3 flex justify-end">
          <Button type="submit" variant="secondary">Объединить дубликаты</Button>
        </form>
        {settings.sources.length ? settings.sources.map((item) => <SourceRow key={item.id} item={item} />) : <p className="text-sm text-app-muted">Источники пока не добавлены.</p>}
      </DirectorySection>

      <DirectorySection
        title="Стадии воронки"
        description="Эти стадии используются в карточке контакта, таблице людей, dashboard и разделе воронок."
      >
        <div className="mb-2 flex flex-wrap gap-2">
          {settings.stages.map((stage) => (
            <Badge key={`badge-${stage.id}`} tone={colorTone(stage.color)}>{stage.orderIndex}. {stage.name} · {typeLabel(stage.type)}</Badge>
          ))}
        </div>
        {settings.stages.length ? settings.stages.map((item) => <StageRow key={item.id} item={item} />) : <p className="text-sm text-app-muted">Стадии пока не добавлены.</p>}
      </DirectorySection>

      <DirectorySection
        title="Теги"
        description="Теги помогают быстро выделять боли, сегменты, возражения и интерес к тестированию."
      >
        <div className="mb-2 flex flex-wrap gap-2">
          {settings.tags.map((tag) => <Badge key={`tag-badge-${tag.id}`} tone={colorTone(tag.color)}>{tag.name}</Badge>)}
        </div>
        {settings.tags.length ? settings.tags.map((item) => <TagRow key={item.id} item={item} />) : <p className="text-sm text-app-muted">Теги пока не добавлены.</p>}
      </DirectorySection>
    </div>
  );
}
