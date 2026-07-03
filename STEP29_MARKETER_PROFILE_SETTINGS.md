# Step 29 — настройки профиля маркетолога

## Что добавлено

- Новый раздел `/profile`.
- Каждый пользователь может менять личное отображение профиля:
  - имя в интерфейсе;
  - должность в интерфейсе;
  - ссылку на аватар;
  - телефон;
  - Telegram;
  - короткое описание роли в проекте.
- Нижний блок в sidebar теперь кликабельный и ведет в `/profile`.
- В нижнем блоке sidebar отображается не системная роль, а поле `job_title`.
- В topbar появился компактный профиль с аватаром/инициалами.
- В мобильном меню появился профиль пользователя.
- Системная роль `admin/marketer/viewer` осталась отдельной: ее меняет только admin в `/settings`.
- В Supabase добавлены поля профиля и RLS-политика для редактирования собственного профиля.

## Что заменить

Главные файлы:

```text
lib/profile.ts
lib/permissions.ts
lib/utils.ts
lib/auth.ts
actions/profile.actions.ts
app/(dashboard)/profile/page.tsx
app/(dashboard)/layout.tsx
components/layout/app-shell.tsx
components/layout/sidebar.tsx
components/layout/topbar.tsx
components/layout/mobile-nav.tsx
app/(dashboard)/settings/page.tsx
lib/settings.ts
lib/production.ts
supabase/schema.sql
package.json
STEP29_MARKETER_PROFILE_SETTINGS.md
```

## Обновить Supabase

Открой Supabase → SQL Editor и выполни обновленный `supabase/schema.sql`.

Добавляются поля в `profiles`:

```sql
job_title text
phone text
telegram text
bio text
updated_at timestamptz
```

Также добавляется policy:

```text
Users can update own profile
```

и trigger, который не дает обычному пользователю менять системные поля `role`, `email`, `user_id`.

## Команды

```bash
pnpm install
pnpm build
```

Если сборка прошла:

```bash
git add .
git commit -m "Add marketer profile settings"
git push
```

## Проверка после деплоя

1. Войди в Hutka.
2. Нажми на нижний блок пользователя в sidebar.
3. Открой `/profile`.
4. Измени имя и должность, например:
   - имя: `Даниил Кургузенко`;
   - должность: `Growth-маркетолог`.
5. Сохрани профиль.
6. Проверь, что внизу sidebar обновились имя и должность.
7. Проверь topbar и мобильное меню.
8. Зайди в `/settings` под admin и проверь, что системная роль остается отдельной.

## Важно

`job_title` — это отображаемая должность в интерфейсе.

`role` — это системная роль доступа.

Маркетолог может менять `job_title`, но не может сам повысить себя до admin.
