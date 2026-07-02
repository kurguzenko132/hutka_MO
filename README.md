# Hutka

Внутреннее веб-приложение маркетолога для запуска beauty-платформы: база лидов, воронки, задачи, опросники, инсайты и отчеты.

## Стек

- Next.js App Router
- TypeScript
- Tailwind CSS
- Supabase
- Vercel
- pnpm

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
- Login-страница-заглушка
- Supabase schema для будущей базы данных

На текущем этапе данные в интерфейсе моковые. Следующий этап — подключение Supabase CRUD для лидов, задач, опросов и воронок.

## Запуск локально

```bash
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
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_server_only
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Supabase

1. Создать новый проект в Supabase.
2. Открыть SQL Editor.
3. Выполнить файл:

```text
supabase/schema.sql
```

Для первой демо-версии можно пока не подключать CRUD и смотреть интерфейс на моковых данных.

## Vercel

1. Создать репозиторий на GitHub.
2. Загрузить проект.
3. В Vercel нажать Add New Project.
4. Выбрать GitHub-репозиторий.
5. Framework Preset: Next.js.
6. Install Command: `pnpm install`.
7. Build Command: `pnpm build`.
8. Output Directory: `.next`.
9. Добавить переменные окружения из `.env.local`.
10. Нажать Deploy.

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

## Следующий этап разработки

1. Подключить Supabase Auth.
2. Подключить реальные таблицы `leads`, `tasks`, `lead_interactions`.
3. Сделать создание/редактирование лида.
4. Сделать изменение стадии воронки.
5. Сделать создание задач.
6. Сделать сохранение ответов опросов.
7. Подключить Dashboard к SQL views.
