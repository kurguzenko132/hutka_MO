# Step 39 build fix 2

Исправлены совместимость компонентов `PageHeader` и `EmptyState` с уже существующими страницами.

## Причина ошибки

Некоторые страницы использовали старый prop `actions` у `PageHeader`, а компонент принимал только `actionLabel/actionHref`. Из-за этого Vercel падал на TypeScript-проверке.

## Что исправлено

- `components/layout/page-header.tsx` теперь поддерживает:
  - `actionLabel/actionHref`
  - `action`
  - `actions`
- `components/ui/empty-state.tsx` теперь поддерживает:
  - пустое состояние без обязательных props
  - `action`
  - `actionLabel/actionHref`

Supabase обновлять не нужно.
