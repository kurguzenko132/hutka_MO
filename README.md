# Hutka

Внутреннее веб-приложение маркетолога для запуска beauty-платформы: база лидов, воронки, задачи, опросники, инсайты и отчеты.

## Стек

- Next.js App Router
- TypeScript
- Tailwind CSS
- Supabase
- Vercel
- pnpm
- Node.js 22+

## Что уже сделано в этой версии

- Базовая структура Next.js-проекта
- Дизайн-система Hutka: цвета, карточки, бейджи, кнопки, общий layout
- Sidebar и Topbar
- Dashboard с KPI, воронкой, каналами, нишами и инсайтами
- Раздел «Люди» с таблицей лидов
- Карточка лида
- Воронки
- Задачи
- Опросники
- Кампании
- Инсайты
- География
- Отчеты
- Гипотезы
- Настройки
- Supabase Auth и роли `admin`, `marketer`, `viewer`
- Supabase schema и CRUD для рабочих разделов

Если Supabase не настроен, приложение показывает demo-режим. Если Supabase настроен, но запросы к базе падают, production-страницы показывают пустые реальные состояния, а не подмешивают demo-данные.

## Запуск локально

```bash
nvm use
pnpm install
pnpm dev
```

Открыть:

```text
http://localhost:3000
```

## Переменные окружения

Скопировать `.env.example` в `.env.local`:

```bash
cp .env.example .env.local
```

Заполнить:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<supabase-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<supabase-service-role-key-server-only>
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

`NEXT_PUBLIC_SUPABASE_URL` должен быть настоящим `http://` или `https://` URL. Placeholder вроде `your_supabase_url` считается невалидной конфигурацией и приложение отправит защищенные страницы на `/login?error=config`, вместо падения в 500.

## Supabase

1. Создать новый проект в Supabase.
2. Открыть SQL Editor.
3. Выполнить файл:

```text
supabase/schema.sql
```

Для локального просмотра без Supabase можно оставить переменные пустыми и смотреть demo-режим. Для авторизации, CRUD, публичных опросов и реальных отчетов нужны валидные Supabase env. `SUPABASE_SERVICE_ROLE_KEY` обязателен на сервере: публичные формы `/s/[slug]` и `/q/[token]` читают и сохраняют данные через Next.js server actions, чтобы не открывать таблицы через anon API.

## Vercel

1. Создать репозиторий на GitHub.
2. Загрузить проект.
3. В Vercel нажать Add New Project.
4. Выбрать GitHub-репозиторий.
5. Framework Preset: Next.js.
6. Install Command: оставить пустым, чтобы Vercel использовал pnpm из `packageManager` и lockfile.
7. Build Command: `pnpm build`.
8. Output Directory: оставить пустым, чтобы Vercel сам использовал Next.js framework output.
9. Добавить переменные окружения из `.env.local`.
10. Нажать Deploy.
11. Runtime должен быть Node.js 22+; это закреплено в `package.json` и `.nvmrc`.

## Главные страницы

```text
/dashboard
/people
/people/anna-smirnova
/funnels
/surveys
/campaigns
/tasks
/insights
/geography
/reports
/hypotheses
/settings
/login
```

## Проверки перед деплоем

```bash
pnpm check
pnpm smoke:local
```

После деплоя открыть `/api/health`: `supabase-public-env`, `service-role` и `node-runtime` должны быть `ok`, а `blockers` должен быть пустым.

Для быстрой проверки деплоя:

```bash
BASE_URL=https://hutka-mo.vercel.app pnpm smoke:url
```
