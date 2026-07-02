# STEP 25 — Quality & Stability для Hutka MVP

Этот шаг добавляет слой качества перед реальным использованием приложения: обработку ошибок, loading-состояния, заметные уведомления о результате действий, защиту от дублей контактов и страницу проверки состояния проекта.

## Что добавлено

### 1. Системные loading/error-состояния

Добавлены файлы:

```text
app/(dashboard)/loading.tsx
app/(dashboard)/error.tsx
app/error.tsx
components/ui/loading-state.tsx
components/ui/error-state.tsx
```

Теперь при загрузке внутренних разделов пользователь видит аккуратный loading-экран, а при runtime-ошибке — понятный экран с кнопкой повторить действие.

### 2. Единые уведомления о действиях

Добавлен компонент:

```text
components/ui/action-notice.tsx
```

Он показывает понятные сообщения по query-параметрам:

```text
?error=duplicate-contact
?error=forbidden
?bulk=stage&count=5
?updated=stage
?attached=campaign
```

На этом шаге уведомления подключены к:

```text
/people
/tasks
```

### 3. Пустые состояния

Добавлен универсальный компонент:

```text
components/ui/empty-state.tsx
```

Его можно дальше использовать во всех разделах, где список пустой: кампании, опросы, инсайты, гипотезы, отчеты.

### 4. Защита от дублей при создании и редактировании контакта

В `actions/leads.actions.ts` добавлена проверка дублей по:

```text
email
телефон
Instagram
Telegram
```

Если похожий контакт найден, Hutka не создает дубль, а возвращает пользователя в `/people` с уведомлением и ссылкой на найденный контакт.

### 5. Раздел качества MVP

Добавлена страница:

```text
/quality
```

Доступна только `admin`.

Показывает:

```text
Supabase env status
NEXT_PUBLIC_APP_URL status
доступность основных таблиц
количество записей по модулям
потенциальные дубли контактов
общую сводку OK / предупреждения / ошибки
```

### 6. Индексы для стабильности и скорости

В `supabase/schema.sql` добавлены индексы:

```sql
leads_email_lower_idx
leads_instagram_lower_idx
leads_telegram_lower_idx
leads_phone_idx
leads_updated_at_idx
lead_interactions_created_at_idx
```

Это улучшает поиск дублей, фильтры и загрузку истории.

## Что заменить

Основные файлы:

```text
components/ui/action-notice.tsx
components/ui/empty-state.tsx
components/ui/loading-state.tsx
components/ui/error-state.tsx
app/(dashboard)/loading.tsx
app/(dashboard)/error.tsx
app/error.tsx
app/(dashboard)/quality/page.tsx
app/(dashboard)/people/page.tsx
app/(dashboard)/tasks/page.tsx
actions/leads.actions.ts
lib/quality.ts
lib/data.ts
lib/auth.ts
components/layout/sidebar.tsx
supabase/schema.sql
```

## Обновление Supabase

Выполни обновленный файл:

```text
supabase/schema.sql
```

Или вручную добавь только блок Step 25 из конца файла.

## Команды

```bash
pnpm install
pnpm build
```

Если сборка прошла:

```bash
git add .
git commit -m "Add MVP quality stability and duplicate protection"
git push
```

## Что проверить после деплоя

1. Открой `/quality` под admin.
2. Проверь, что видны проверки окружения и таблиц.
3. Создай контакт с email/телефоном, который уже есть в базе.
4. Убедись, что Hutka показывает ошибку дубля и не создает второй контакт.
5. Открой `/people` после массового действия — должно появиться понятное уведомление.
6. Открой `/tasks` после смены статуса задачи — уведомления должны отображаться корректно.
7. Проверь, что viewer/marketer не видят раздел `/quality` в меню.

## Следующий этап

После этого можно делать финальную UX-полировку: единые пустые состояния во всех разделах, адаптив мобильной версии, улучшение форм и подготовку к первому реальному использованию.
