# STEP 39 build fix

Исправлена ошибка сборки Vercel на странице `/followups`.

Причина: компонент `EmptyState` принимает prop `action`, но на странице `/followups` были переданы устаревшие props `actionLabel` и `actionHref`.

Исправление:

```tsx
<EmptyState
  title="Follow-up-рекомендаций нет"
  text="Сейчас все контакты под контролем: нет просроченных follow-up, горячих контактов без задачи и анкет без ответа."
  action={
    <Button asChild variant="secondary">
      <Link href="/people">Открыть контакты</Link>
    </Button>
  }
/>
```

Supabase обновлять не нужно.
