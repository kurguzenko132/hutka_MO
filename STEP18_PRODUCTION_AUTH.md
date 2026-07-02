# STEP 18 — Production Auth & Protected Routes

В этом шаге Hutka переведена из демо-режима входа в нормальную production-авторизацию через Supabase Auth.

## Что изменилось

- Добавлен `middleware.ts` в корне проекта.
- Добавлен `lib/supabase/middleware.ts` для обновления Supabase-сессии через cookies.
- Внутренние разделы теперь защищены:
  - `/dashboard`
  - `/people`
  - `/funnels`
  - `/surveys`
  - `/campaigns`
  - `/tasks`
  - `/insights`
  - `/geography`
  - `/reports`
  - `/hypotheses`
  - `/settings`
- Без входа пользователь автоматически отправляется на `/login`.
- После входа пользователь возвращается туда, куда пытался попасть.
- Если пользователь уже вошел, `/` и `/login` перекидывают в `/dashboard`.
- Публичные опросы `/s/[slug]` остаются открытыми для прохождения без входа.
- В topbar теперь показывается email вошедшего пользователя.
- Если Supabase env-переменные не настроены, внутренние страницы больше не открываются в демо-режиме, а показывается ошибка настройки авторизации.
- В `supabase/schema.sql` добавлен trigger для автоматического создания `profiles` при создании пользователя в Supabase Auth.

## Важные env-переменные

В Vercel должны быть заполнены:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_APP_URL=https://твой-домен.vercel.app
```

`SUPABASE_SERVICE_ROLE_KEY` для этого шага не обязателен, но можно оставить на будущее только в server-only окружении.

## Что сделать в Supabase

Открой:

```text
Supabase → SQL Editor
```

И выполни обновленный файл:

```text
supabase/schema.sql
```

После этого создай пользователя:

```text
Authentication → Users → Add user
```

Укажи email и пароль. Этими данными можно войти в Hutka.

## Проверка

1. Открой `/dashboard` в приватном окне браузера.
2. Должен быть редирект на `/login`.
3. Войди через email/password из Supabase Auth.
4. После входа должен открыться `/dashboard`.
5. Нажми «Выйти».
6. После выхода повторный переход в `/people` должен снова отправлять на `/login`.
7. Проверь публичный опрос `/s/[slug]` — он должен открываться без входа.

## Команды

```bash
pnpm install
pnpm build
```

Если сборка прошла:

```bash
git add .
git commit -m "Add production auth and protected routes"
git push
```
