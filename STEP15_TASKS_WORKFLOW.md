# STEP 15 — Улучшенный раздел задач

## Что добавлено

- Фильтры задач через URL-параметры:
  - поиск;
  - статус;
  - приоритет;
  - срок;
  - связанный контакт.
- Новая рабочая страница `/tasks`.
- Группировка задач:
  - Просрочено;
  - Сегодня;
  - На неделе;
  - Позже;
  - Без даты;
  - Готово;
  - Отменено.
- Быстрые действия прямо из списка:
  - взять в работу;
  - отметить выполненной;
  - вернуть в работу;
  - отменить.
- При смене статуса задачи создается запись в истории связанного контакта.
- Быстрый переход из задачи в карточку контакта.
- Fallback на демо-данные, если Supabase еще не настроен.
- Индексы Supabase для ускорения задач.

## Что заменить

Главные файлы:

```text
lib/tasks.ts
actions/tasks.actions.ts
components/tasks/task-filters.tsx
components/tasks/task-list.tsx
app/(dashboard)/tasks/page.tsx
supabase/schema.sql
STEP15_TASKS_WORKFLOW.md
```

## Обновление Supabase

Открой Supabase → SQL Editor и выполни обновленный файл:

```text
supabase/schema.sql
```

В этом шаге добавлены индексы:

```sql
create index if not exists tasks_status_idx on public.tasks(status);
create index if not exists tasks_priority_idx on public.tasks(priority);
create index if not exists tasks_due_date_idx on public.tasks(due_date);
create index if not exists tasks_lead_id_idx on public.tasks(lead_id);
```

## Проверка

Открой:

```text
/tasks
/tasks/new
```

Проверь сценарии:

1. Создать задачу, связанную с контактом.
2. Отфильтровать задачи по статусу.
3. Отфильтровать задачи по приоритету.
4. Отфильтровать задачи по сроку: просрочено, сегодня, на неделе.
5. Нажать «В работу».
6. Нажать «Готово».
7. Открыть карточку связанного контакта и проверить историю.

## Git-команды

```bash
pnpm install
pnpm build
git add .
git commit -m "Improve tasks filters and status workflow"
git push
```
