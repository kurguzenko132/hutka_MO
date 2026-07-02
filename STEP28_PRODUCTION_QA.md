# Step 28 — Production QA и финальная проверка MVP

## Что добавлено

- Admin-раздел `/qa` для финальной проверки production-готовности.
- Публичный health endpoint `/api/health`.
- Публичный version endpoint `/api/version`.
- Чеклист smoke-test в `docs/PRODUCTION_SMOKE_TEST.md`.
- Публичная копия документа в `/docs/PRODUCTION_SMOKE_TEST.md`.
- Проверки env-переменных, Vercel runtime, Next.js-версии и framework-конфига.
- Список ключевых маршрутов, которые нужно проверить после деплоя.

## Что проверить

1. Под admin открыть `/qa`.
2. Открыть `/api/health`.
3. Открыть `/api/version`.
4. Открыть `/docs/PRODUCTION_SMOKE_TEST.md`.
5. Пройти smoke-test из документа.
6. Проверить, что `/qa` не доступен пользователям без admin-прав.

## Команды

```bash
pnpm install
pnpm typecheck
pnpm build
git add .
git commit -m "Add production QA and smoke test checks"
git push
```
