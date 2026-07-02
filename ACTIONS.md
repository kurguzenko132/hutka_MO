# Что нужно сделать после получения архива Hutka

## 1. Распаковать проект

```bash
unzip hutka-mvp.zip
cd hutka
```

## 2. Установить pnpm, если его нет

```bash
npm install -g pnpm
```

## 3. Установить зависимости

```bash
pnpm install
```

## 4. Создать локальный env-файл

```bash
cp .env.example .env.local
```

Пока Supabase можно не подключать, но для будущего заполнить:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## 5. Запустить локально

```bash
pnpm dev
```

Открыть:

```text
http://localhost:3000
```

## 6. Проверить основные страницы

```text
/dashboard
/people
/people/anna-smirnova
/funnels
/tasks
/surveys
/campaigns
/insights
/geography
/reports
/hypotheses
/settings
/login
```

## 7. Создать репозиторий на GitHub

Создай пустой репозиторий, например:

```text
hutka
```

## 8. Первый git push

```bash
git init
git add .
git commit -m "Initial Hutka MVP dashboard"
git branch -M main
git remote add origin <URL_ТВОЕГО_РЕПОЗИТОРИЯ>
git push -u origin main
```

## 9. Подключить к Vercel

1. Зайти в Vercel.
2. Add New Project.
3. Import Git Repository.
4. Выбрать репозиторий Hutka.
5. Framework Preset: Next.js.
6. Install Command: `pnpm install`.
7. Build Command: `pnpm build`.
8. Output Directory: `.next`.
9. Добавить env-переменные.
10. Deploy.

## 10. Команды для следующих правок

```bash
git add .
git commit -m "Update Hutka UI and base modules"
git push
```

## 11. Следующий этап разработки

После первого деплоя нужно подключить реальные данные:

1. Supabase Auth.
2. CRUD для лидов.
3. CRUD для задач.
4. Историю касаний.
5. Создание опросников.
6. Подключение dashboard к SQL views.
