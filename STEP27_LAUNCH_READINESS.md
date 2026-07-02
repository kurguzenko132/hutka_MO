# Step 27 — Launch readiness, backup and team docs

Этот шаг готовит Hutka к первому реальному использованию командой.

## Что добавлено

- Новый admin-раздел `/launch`.
- Чеклист запуска команды.
- Быстрая проверка рабочих таблиц Supabase.
- Сводка количества данных по ключевым модулям.
- JSON-экспорт рабочей базы через `/backup/export`.
- Документация для команды в `docs/` и `public/docs/`.
- Demo seed-файл `supabase/seed-demo.sql`.
- Пункт меню **Запуск** для администратора.

## Новые маршруты

```text
/launch
/backup/export
/docs/LAUNCH_CHECKLIST.md
/docs/TEAM_GUIDE.md
/docs/BACKUP_AND_RECOVERY.md
```

`/launch` и `/backup/export` доступны только пользователю с ролью `admin`.

## Что заменить

Главные файлы:

```text
lib/launch.ts
lib/auth.ts
lib/data.ts
components/layout/sidebar.tsx
components/layout/mobile-nav.tsx
app/(dashboard)/launch/page.tsx
app/(dashboard)/backup/export/route.ts
docs/LAUNCH_CHECKLIST.md
docs/TEAM_GUIDE.md
docs/BACKUP_AND_RECOVERY.md
public/docs/LAUNCH_CHECKLIST.md
public/docs/TEAM_GUIDE.md
public/docs/BACKUP_AND_RECOVERY.md
supabase/seed-demo.sql
STEP27_LAUNCH_READINESS.md
```

## Supabase

В этом шаге не обязательно выполнять `supabase/schema.sql`, если ты уже применял шаг 26.

Опционально можно выполнить demo seed:

```text
Supabase → SQL Editor → supabase/seed-demo.sql
```

Seed добавит тестового мастера, салон, задачу, опрос, кампанию, инсайт и гипотезу.

## Команды

```bash
pnpm install
pnpm build
```

Если сборка прошла:

```bash
git add .
git commit -m "Add launch readiness docs and backup export"
git push
```

## Что проверить после деплоя

1. Войти под `admin`.
2. Открыть `/launch`.
3. Проверить чеклист запуска.
4. Нажать «Скачать бэкап JSON».
5. Открыть документы из блока документации.
6. Проверить, что пользователь `marketer` не видит пункт **Запуск**.
7. Проверить, что `/backup/export` без admin-доступа не отдает данные.

## Как использовать перед стартом команды

1. Выполнить актуальный `supabase/schema.sql`.
2. Создать admin-пользователя.
3. Настроить пользователей и роли.
4. Настроить источники, стадии и теги.
5. Создать первый опрос и первую кампанию.
6. Добавить 3–5 реальных контактов.
7. Проверить dashboard, people, tasks, surveys, reports.
8. Открыть `/launch` и скачать первый backup.
9. После этого начинать массовый импорт или реальную работу.
