# Hutka — шаг 6: чистый вход и рабочая карточка контакта

## Что изменено

1. Со страницы входа удалена кнопка «Открыть демо».
2. Страница входа теперь содержит только логотип, email, пароль и кнопку «Войти».
3. Добавлена страница редактирования контакта: `/people/[id]/edit`.
4. В карточке контакта появилась кнопка «Редактировать».
5. В карточке контакта теперь можно добавлять касания: заметка, сообщение, звонок, встреча, отправка опроса.
6. В карточке контакта теперь можно создавать задачи, привязанные к конкретному человеку.
7. Страница `/tasks/new` теперь сохраняет задачу через server action.
8. Страница `/tasks` теперь может показывать реальные задачи из Supabase.
9. После создания/обновления контакта, касания или задачи вызывается revalidatePath, чтобы данные обновлялись без ручной чистки кеша.

## Новые файлы

- `actions/tasks.actions.ts`
- `app/(dashboard)/people/[id]/edit/page.tsx`
- `lib/tasks.ts`
- `STEP6_CONTACT_DETAIL_WORKFLOW.md`

## Измененные файлы

- `components/auth/login-screen.tsx`
- `app/(auth)/login/page.tsx`
- `actions/leads.actions.ts`
- `lib/leads.ts`
- `lib/data.ts`
- `components/people/lead-profile.tsx`
- `app/(dashboard)/people/new/page.tsx`
- `app/(dashboard)/tasks/new/page.tsx`
- `app/(dashboard)/tasks/page.tsx`

## Что проверить

1. `/` — чистый экран входа без демо-кнопки.
2. `/login` — то же самое.
3. `/people` — список контактов.
4. `/people/new` — создание контакта.
5. `/people/[id]` — карточка контакта.
6. `/people/[id]/edit` — редактирование контакта.
7. В карточке контакта можно добавить касание.
8. В карточке контакта можно добавить задачу.
9. `/tasks/new` — создание общей задачи.
10. `/tasks` — отображение задач по группам.

## Команды

```bash
pnpm install
pnpm build
```

Если сборка прошла:

```bash
git add .
git commit -m "Add contact editing interactions and real task creation"
git push
```

## Важно

Для сохранения данных в Supabase должны быть добавлены env-переменные:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=
```

И в Supabase должен быть выполнен SQL из файла:

```text
supabase/schema.sql
```
