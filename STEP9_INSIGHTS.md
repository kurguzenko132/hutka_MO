# STEP 9 — Реальные инсайты

## Что добавлено

На этом шаге раздел **Инсайты** перестал быть статичной демо-страницей.

Добавлено:

- создание инсайта через `/insights/new`;
- карточка инсайта `/insights/[id]`;
- сохранение инсайтов в Supabase;
- статусы инсайтов: `Новый`, `На проверке`, `Принят`, `В архиве`;
- уровни важности: `Низкая`, `Средняя`, `Высокая`, `Критично`;
- связь инсайта с контактами;
- связь инсайта с кампаниями;
- связь инсайта с опросниками;
- вывод главных инсайтов на dashboard;
- `view_insight_summary` в Supabase;
- link-таблицы `insight_leads`, `insight_campaigns`, `insight_surveys`.

## Что заменить

Главные файлы этого шага:

```text
lib/insights.ts
actions/insights.actions.ts
app/(dashboard)/insights/page.tsx
app/(dashboard)/insights/new/page.tsx
app/(dashboard)/insights/[id]/page.tsx
app/(dashboard)/dashboard/page.tsx
supabase/schema.sql
STEP9_INSIGHTS.md
```

## Обновить Supabase

Открой Supabase → SQL Editor и выполни обновленный файл:

```text
supabase/schema.sql
```

Добавятся поля и таблицы:

```sql
alter table public.insights add column if not exists status text default 'new';
alter table public.insights add column if not exists next_action text;
alter table public.insights add column if not exists updated_at timestamptz default now();

create table if not exists public.insight_leads (...);
create table if not exists public.insight_campaigns (...);
create table if not exists public.insight_surveys (...);
```

## Проверка

1. Открой `/insights`.
2. Нажми **Добавить инсайт**.
3. Заполни название, описание, доказательства и следующее действие.
4. Привяжи один контакт, кампанию или опросник.
5. Сохрани.
6. Открой карточку инсайта.
7. Проверь, что инсайт появился на dashboard в блоке **Главные инсайты недели**.

## Команды

```bash
pnpm build
git add .
git commit -m "Add real insights workflow"
git push
```

## Следующий этап

Следующий этап — сделать раздел **Гипотезы** реальным:

- создание гипотезы;
- проверка гипотезы;
- связь с инсайтами, кампаниями, опросами и контактами;
- статусы гипотез;
- превращение подтвержденной гипотезы в решение для продукта или маркетинга.
