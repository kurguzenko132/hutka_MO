# Step 13 — Real Funnels

В этом шаге раздел `/funnels` стал настоящей рабочей воронкой, а не моковой доской.

## Что добавлено

- `lib/funnels.ts` — получение колонок и контактов из Supabase.
- `actions/funnels.actions.ts` — server action для смены стадии контакта.
- `/funnels` — полноценная Kanban-страница с реальными колонками и карточками.
- Быстрая смена стадии контакта прямо из карточки.
- Быстрое перемещение в следующую стадию.
- Автоматическое создание записи в истории касаний при смене стадии.
- Автоматический пересчет dashboard, отчетов, географии и списка контактов через revalidatePath.
- Fallback на демо-данные, если Supabase не настроен.
- `view_funnel_stage_summary` в Supabase.

## Что заменить в проекте

```text
lib/funnels.ts
actions/funnels.actions.ts
app/(dashboard)/funnels/page.tsx
supabase/schema.sql
STEP13_FUNNELS.md
```

## Что выполнить в Supabase

Открой Supabase → SQL Editor и выполни обновленный файл:

```text
supabase/schema.sql
```

В этом шаге добавляются:

```text
funnel_stages_name_type_unique
leads_stage_id_idx
leads_updated_at_idx
view_funnel_stage_summary
```

Также SQL аккуратно убирает дубли стадий, которые могли появиться из-за повторного запуска старого seed-блока.

## Проверка

После деплоя открой:

```text
/funnels
```

Проверь сценарий:

1. Создай контакт в `/people/new`.
2. Открой `/funnels`.
3. Найди контакт в его стадии.
4. Перемести его в другую стадию через селект на карточке.
5. Открой карточку контакта — в истории должно появиться изменение стадии.
6. Проверь `/reports` и `/geography` — данные должны пересчитаться.

## Git-команды

```bash
pnpm install
pnpm build
git add .
git commit -m "Add real funnel board and stage movement"
git push
```
