import { isSupabaseConfigured } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';

export type ImportLog = {
  id: string;
  fileName: string;
  totalRows: number;
  importedRows: number;
  skippedRows: number;
  failedRows: number;
  status: string;
  createdAt: string;
  errors: string[];
};

export const importTemplateHeaders = [
  'name',
  'type',
  'niche',
  'city',
  'instagram',
  'telegram',
  'phone',
  'email',
  'source',
  'stage',
  'priority',
  'tags',
  'next_step',
  'next_contact_date',
  'notes'
];

export const importTemplateRows = [
  [
    'Анна Смирнова',
    'Мастер',
    'Маникюр',
    'Минск',
    '@anna_nails',
    '@anna_nails',
    '+375291112233',
    'anna@example.com',
    'Instagram',
    'Найден',
    'Высокий',
    'Нужны клиенты, Нет CRM',
    'Отправить опрос',
    '2026-07-10',
    'Работает сама, есть пустые окна'
  ],
  [
    'Beauty Line',
    'Салон',
    'Брови и ресницы',
    'Брест',
    '@beauty_line',
    '',
    '+375292223344',
    '',
    'Telegram',
    'Написал',
    'Средний',
    'Салон, Вернуться позже',
    'Повторно написать',
    '2026-07-12',
    'Нужно выйти на владельца'
  ]
];

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function mapImportLog(row: Record<string, unknown>): ImportLog {
  const errorDetails = Array.isArray(row.error_details) ? row.error_details : [];

  return {
    id: String(row.id),
    fileName: String(row.file_name ?? 'CSV импорт'),
    totalRows: Number(row.total_rows ?? 0),
    importedRows: Number(row.imported_rows ?? 0),
    skippedRows: Number(row.skipped_rows ?? 0),
    failedRows: Number(row.failed_rows ?? 0),
    status: String(row.status ?? 'finished'),
    createdAt: formatDate(String(row.created_at ?? '')),
    errors: errorDetails.map((item) => String(item)).slice(0, 8)
  };
}

const demoImportLogs: ImportLog[] = [
  {
    id: 'demo-import-1',
    fileName: 'instagram_masters_minsk.csv',
    totalRows: 42,
    importedRows: 38,
    skippedRows: 3,
    failedRows: 1,
    status: 'finished',
    createdAt: '02.07.2026, 14:30',
    errors: ['Строка 17: пропущено имя контакта']
  },
  {
    id: 'demo-import-2',
    fileName: 'salons_brest.csv',
    totalRows: 18,
    importedRows: 18,
    skippedRows: 0,
    failedRows: 0,
    status: 'finished',
    createdAt: '01.07.2026, 18:10',
    errors: []
  }
];

export async function getImportLogs(): Promise<ImportLog[]> {
  if (!isSupabaseConfigured()) return demoImportLogs;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('import_logs')
    .select('id, file_name, total_rows, imported_rows, skipped_rows, failed_rows, status, error_details, created_at')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error || !data) return [];
  return data.map((row) => mapImportLog(row as Record<string, unknown>));
}

export function buildImportTemplateCsv() {
  const lines = [importTemplateHeaders, ...importTemplateRows];
  return lines
    .map((row) =>
      row
        .map((cell) => {
          const value = String(cell ?? '');
          return /[",;\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
        })
        .join(',')
    )
    .join('\n');
}
