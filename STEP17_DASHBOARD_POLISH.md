# STEP 17 — Dashboard polish

На этом шаге главная страница Hutka стала рабочим центром маркетолога.

## Что изменилось

- `/dashboard` теперь собирает данные через `lib/dashboard.ts`.
- KPI подтягиваются из Supabase view `view_report_overview`, если Supabase настроен.
- Воронка подтягивается из `view_funnel_stage_summary`.
- Лучшие каналы подтягиваются из `view_report_source_distribution`.
- Лучшие ниши подтягиваются из `view_report_niche_distribution`.
- Задачи на сегодня подтягиваются из реального раздела задач.
- Горячие контакты подтягиваются из таблицы `leads` по `priority_score`.
- Последние активности подтягиваются из `lead_interactions`.
- Главные инсайты и гипотезы подтягиваются из уже подключенных модулей.
- Добавлен блок «Фокус на сегодня».
- Добавлен блок быстрых действий.
- Добавлены понятные пустые состояния.
- Если Supabase не настроен или данных пока нет, dashboard использует demo fallback.

## Новые файлы

```text
lib/dashboard.ts
components/dashboard/action-grid.tsx
components/dashboard/hot-contacts-card.tsx
components/dashboard/recent-activity-card.tsx
components/dashboard/today-work-card.tsx
STEP17_DASHBOARD_POLISH.md
```

## Измененные файлы

```text
app/(dashboard)/dashboard/page.tsx
components/dashboard/funnel-overview.tsx
components/dashboard/bar-list.tsx
```

## Supabase

В этом шаге не нужно обновлять `supabase/schema.sql`, потому что используются views и таблицы, которые уже были добавлены на прошлых этапах.

Используются:

```text
view_report_overview
view_funnel_stage_summary
view_report_source_distribution
view_report_niche_distribution
leads
lead_interactions
tasks
insights
hypotheses
```

## Проверка

После деплоя открой:

```text
/dashboard
```

Проверь:

1. KPI отображаются сверху.
2. Блок «Фокус на сегодня» показывает рекомендацию.
3. Быстрые действия ведут на создание контакта, задачи, опроса, кампании, инсайта и гипотезы.
4. Воронка показывает реальные стадии.
5. Задачи подтягиваются из `/tasks`.
6. Горячие контакты ведут в карточки контактов.
7. Последние активности появляются после добавления заметок/касаний в карточке контакта.
8. Каналы и ниши ведут на отчет.

## Команды

```bash
pnpm install
pnpm build
```

Если сборка прошла:

```bash
git add .
git commit -m "Polish dashboard with real launch workspace data"
git push
```

## Следующий этап

Следующий логичный этап — добавить `middleware`-защиту маршрутов и довести авторизацию до production-поведения:

- без входа нельзя попасть в `/dashboard` и другие внутренние разделы;
- после входа пользователь попадает в `/dashboard`;
- при выходе пользователь возвращается на `/login`;
- если Supabase не настроен, оставить безопасный demo fallback только для разработки.
