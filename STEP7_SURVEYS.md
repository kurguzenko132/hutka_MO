# Hutka — шаг 7: реальные опросники

## Что добавлено

1. Реальное создание опросов через Supabase.
2. Создание вопросов при создании опроса.
3. Страница опроса внутри Hutka:
   - вопросы;
   - публичная ссылка;
   - ответы респондентов;
   - добавление нового вопроса.
4. Публичная страница прохождения опроса:
   - `/s/[slug]`.
5. Сохранение ответов в `survey_answers`.
6. Расширение Supabase-схемы:
   - `surveys.slug`;
   - `survey_answers.response_group_id`;
   - `survey_answers.respondent_name`;
   - `survey_answers.respondent_contact`.
7. Public RLS policies для прохождения активных опросов без входа в Hutka.

## Что заменить

Главные новые/измененные файлы:

```text
lib/surveys.ts
actions/surveys.actions.ts
app/(dashboard)/surveys/page.tsx
app/(dashboard)/surveys/new/page.tsx
app/(dashboard)/surveys/[id]/page.tsx
app/s/[slug]/page.tsx
supabase/schema.sql
STEP7_SURVEYS.md
```

## Что выполнить в Supabase

В Supabase открой SQL Editor и выполни обновленный файл:

```text
supabase/schema.sql
```

Если схема уже создавалась раньше, можно выполнить весь файл повторно. В нем есть `alter table ... add column if not exists` для новых полей.

## Проверка локально

```bash
pnpm install
pnpm build
pnpm dev
```

Проверить страницы:

```text
/surveys
/surveys/new
/surveys/[id]
/s/[slug]
```

## Git-команды

```bash
git add .
git commit -m "Add real surveys and public response forms"
git push
```

## Что проверить после деплоя

1. Войти в Hutka.
2. Открыть `/surveys`.
3. Создать опрос.
4. Открыть созданный опрос.
5. Открыть публичную форму `/s/[slug]`.
6. Отправить ответ.
7. Вернуться в Hutka и проверить, что ответ появился в карточке опроса.

## Важно

Публичная форма работает только для опросов со статусом `active`.

Черновики доступны внутри Hutka, но публично не открываются.

## Следующий этап

Следующий логичный шаг — сделать кампании реальными:

- создание кампании в Supabase;
- список кампаний из базы;
- карточка кампании;
- привязка контактов к кампании;
- расчет конверсии по кампании.
