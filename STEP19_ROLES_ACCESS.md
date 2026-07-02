# Step 19 — Roles and access control

Этот шаг добавляет роли и базовое разграничение доступа внутри Hutka.

## Роли

### admin
Полный доступ:
- настройки приложения;
- справочники;
- пользователи и роли;
- контакты;
- задачи;
- воронки;
- опросники;
- кампании;
- инсайты;
- гипотезы;
- отчеты.

### marketer
Рабочий доступ:
- контакты;
- задачи;
- воронки;
- опросники;
- кампании;
- инсайты;
- гипотезы;
- просмотр аналитики и отчетов.

Нет доступа к настройкам, справочникам и ролям пользователей.

### viewer
Только просмотр:
- dashboard;
- контакты;
- воронки;
- опросники;
- кампании;
- задачи;
- инсайты;
- география;
- отчеты;
- гипотезы.

Не может создавать, редактировать и менять статусы.

## Что изменилось

Добавлены файлы:

```text
lib/roles.ts
lib/permissions.ts
STEP19_ROLES_ACCESS.md
```

Изменены:

```text
app/(dashboard)/layout.tsx
components/layout/app-shell.tsx
components/layout/sidebar.tsx
components/layout/topbar.tsx
components/dashboard/action-grid.tsx
app/(dashboard)/dashboard/page.tsx
app/(dashboard)/settings/page.tsx
actions/*.ts
supabase/schema.sql
```

## Как обновить Supabase

Открой:

```text
Supabase → SQL Editor
```

И выполни обновленный файл:

```text
supabase/schema.sql
```

В этом шаге добавляются:

```text
profiles.email
public.current_profile_role()
role-based RLS policies
обновленный trigger создания профиля
```

## Важно про первого пользователя

После выполнения нового `schema.sql` новые пользователи будут получать роли так:

- первый пользователь в системе — `admin`;
- следующие пользователи — `marketer`.

Если твой пользователь был создан раньше и остался `marketer`, сделай себя администратором вручную в SQL Editor:

```sql
update public.profiles
set role = 'admin'
where email = 'ТВОЙ_EMAIL';
```

Если поле `email` пока пустое, можно посмотреть пользователей:

```sql
select id, user_id, email, full_name, role from public.profiles;
```

И обновить по `user_id` или `id`.

## Проверка после деплоя

1. Войди как admin.
2. Открой `/settings`.
3. Проверь блок «Пользователи и роли».
4. Измени роль одного пользователя на `viewer`.
5. Войди под этим пользователем.
6. Убедись, что кнопки создания и редактирования исчезли.
7. Попробуй открыть `/people/new` — должен быть редирект на `/people?error=forbidden`.
8. Верни роль `marketer` или `admin`.

## Git-команды

```bash
pnpm install
pnpm build
git add .
git commit -m "Add roles and access control"
git push
```
