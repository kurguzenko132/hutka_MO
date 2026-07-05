import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { databaseTableLabels, databaseTables } from '@/lib/database-tables';

export type QualityStatus = 'ok' | 'warning' | 'error';

export type QualityCheck = {
  label: string;
  description: string;
  status: QualityStatus;
  action?: string;
};

export type QualityReport = {
  generatedAt: string;
  isSupabaseConfigured: boolean;
  counts: Array<{ label: string; value: number }>;
  checks: QualityCheck[];
  duplicateGroups: Array<{ field: string; value: string; count: number }>;
};

async function safeCount(supabase: Awaited<ReturnType<typeof createClient>>, table: string) {
  const { count, error } = await supabase.from(table).select('id', { count: 'exact', head: true });
  if (error) return null;
  return count ?? 0;
}

function normalize(value?: unknown) {
  return String(value ?? '').trim().toLowerCase();
}

function findDuplicates(rows: Array<Record<string, unknown>>, field: string) {
  const map = new Map<string, number>();
  rows.forEach((row) => {
    const value = normalize(row[field]);
    if (!value) return;
    map.set(value, (map.get(value) ?? 0) + 1);
  });

  return Array.from(map.entries())
    .filter(([, count]) => count > 1)
    .map(([value, count]) => ({ field, value, count }));
}

export async function getQualityReport(): Promise<QualityReport> {
  const generatedAt = new Date().toISOString();
  const configured = isSupabaseConfigured();

  const base: QualityReport = {
    generatedAt,
    isSupabaseConfigured: configured,
    counts: [],
    duplicateGroups: [],
    checks: [
      {
        label: 'Supabase env',
        description: configured ? 'Переменные Supabase настроены.' : 'NEXT_PUBLIC_SUPABASE_URL или NEXT_PUBLIC_SUPABASE_ANON_KEY не заданы либо невалидны.',
        status: configured ? 'ok' : 'error',
        action: configured ? undefined : 'Укажи настоящий Supabase URL вида https://<project-ref>.supabase.co и anon key в Vercel и .env.local.'
      },
      {
        label: 'App URL',
        description: process.env.NEXT_PUBLIC_APP_URL ? 'NEXT_PUBLIC_APP_URL настроен.' : 'NEXT_PUBLIC_APP_URL не задан.',
        status: process.env.NEXT_PUBLIC_APP_URL ? 'ok' : 'warning',
        action: process.env.NEXT_PUBLIC_APP_URL ? undefined : 'Укажи production URL, чтобы персональные ссылки на анкеты были корректными.'
      }
    ]
  };

  if (!configured) return base;

  const supabase = await createClient();
  for (const table of databaseTables) {
    const count = await safeCount(supabase, table);
    base.counts.push({ label: databaseTableLabels[table], value: count ?? 0 });
    base.checks.push({
      label: `Таблица ${table}`,
      description: count === null ? 'Таблица недоступна или RLS не позволяет чтение.' : `Доступна, записей: ${count}.`,
      status: count === null ? 'error' : 'ok',
      action: count === null ? 'Проверь schema.sql и политики RLS.' : undefined
    });
  }

  const { data: leadRows, error: leadsError } = await supabase
    .from('leads')
    .select('id, email, phone, instagram, telegram')
    .limit(2000);

  if (leadsError) {
    base.checks.push({
      label: 'Проверка дублей',
      description: 'Не удалось прочитать контакты для проверки дублей.',
      status: 'warning',
      action: 'Проверь доступ к таблице leads.'
    });
  } else {
    const rows = (leadRows ?? []) as Array<Record<string, unknown>>;
    base.duplicateGroups = ['email', 'phone', 'instagram', 'telegram'].flatMap((field) => findDuplicates(rows, field)).slice(0, 20);
    base.checks.push({
      label: 'Дубли контактов',
      description: base.duplicateGroups.length === 0 ? 'Явных дублей по email/телефону/Instagram/Telegram не найдено.' : `Найдено групп дублей: ${base.duplicateGroups.length}.`,
      status: base.duplicateGroups.length === 0 ? 'ok' : 'warning',
      action: base.duplicateGroups.length === 0 ? undefined : 'Проверь похожие контакты и объединяй их вручную перед массовыми действиями.'
    });
  }

  return base;
}
