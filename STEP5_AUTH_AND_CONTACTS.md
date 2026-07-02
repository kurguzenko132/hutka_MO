# Hutka — шаг 5: чистый вход, Supabase Auth и сохранение контактов

## Что изменилось

1. Экран `/` теперь является чистым экраном входа без промо-текста, цифр, подсказок и MVP-блока.
2. `/login` открывает тот же экран входа.
3. Добавлены server actions для Supabase Auth:
   - `signInAction`
   - `signOutAction`
4. Dashboard-зона теперь защищается авторизацией, если в env настроен Supabase.
5. Если Supabase env еще не настроены, приложение продолжает работать в демо-режиме.
6. Раздел «Люди» теперь умеет читать контакты из Supabase, если база подключена.
7. Страница `/people/new` теперь отправляет форму в server action и сохраняет контакт в Supabase.
8. Если Supabase не настроен, форма возвращает в демо-раздел «Люди», чтобы интерфейс не падал.

## Что нужно сделать в Supabase

1. Открыть Supabase Project.
2. Перейти в SQL Editor.
3. Выполнить файл:

```text
supabase/schema.sql
```

4. Создать пользователя для входа:

```text
Authentication → Users → Add user
```

5. Добавить email и пароль.

## Env в Vercel

Добавить в Vercel:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=https://твой-домен.vercel.app
```

Для текущего кода реально нужны первые две переменные. `SUPABASE_SERVICE_ROLE_KEY` оставлен на будущее, но не используется на клиенте.

## Проверка

После деплоя:

1. Открыть `/`.
2. Ввести email/пароль пользователя из Supabase.
3. Перейти в dashboard.
4. Открыть `/people/new`.
5. Создать контакт.
6. Проверить, что контакт появился в Supabase table `leads`.
7. Проверить, что `/people` показывает контакт из базы.

## Важно

Если env Supabase не добавлены, кнопка «Открыть демо» продолжит вести в dashboard с моковыми данными.
Если env добавлены, dashboard будет требовать реальный вход.
