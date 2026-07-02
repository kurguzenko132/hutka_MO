# Step 23 — связи из карточки контакта

## Что добавлено

Карточка контакта теперь позволяет выполнять ключевые связки без перехода в другие разделы:

- добавить контакт в существующую кампанию;
- связать контакт с существующим инсайтом;
- связать контакт с существующей гипотезой;
- создать персональную ссылку на опрос для контакта;
- ответы по персональной ссылке сохраняются с `lead_id` и автоматически появляются в карточке контакта;
- каждое действие записывается в историю активности контакта.

## Файлы шага

```text
components/people/lead-profile.tsx
actions/leads.actions.ts
actions/surveys.actions.ts
lib/insights.ts
lib/hypotheses.ts
lib/surveys.ts
app/s/[slug]/page.tsx
supabase/schema.sql
STEP23_CONTACT_RELATIONS_HUB.md
```

## Обновление Supabase

Открой Supabase → SQL Editor и выполни обновленный файл:

```text
supabase/schema.sql
```

В этом шаге добавлен индекс:

```sql
create index if not exists survey_answers_lead_id_idx on public.survey_answers(lead_id);
```

## Проверка

1. Открой карточку контакта `/people/[id]`.
2. В блоке «Связи контакта» выбери кампанию и нажми «Привязать к кампании».
3. Привяжи инсайт и гипотезу.
4. Выбери опрос и нажми «Создать ссылку на опрос».
5. В истории контакта появится персональная ссылка вида `/s/[slug]?leadId=[id]`.
6. Открой эту ссылку, заполни опрос.
7. Вернись в карточку контакта — ответ должен появиться в блоке «Опросы контакта».

## Команды

```bash
pnpm install
pnpm build
git add .
git commit -m "Add contact relations hub"
git push
```
