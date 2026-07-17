'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requirePermission } from '@/lib/permissions';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';
import { leadTypeToDb, priorityToScore } from '@/lib/leads';
import type { LeadType, Priority } from '@/lib/data';

type CsvRow = Record<string, string>;

type ImportStats = {
  total: number;
  imported: number;
  skipped: number;
  failed: number;
  errors: string[];
};

const headerAliases: Record<string, string> = {
  name: 'name',
  имя: 'name',
  название: 'name',
  контакт: 'name',
  fio: 'name',
  тип: 'type',
  type: 'type',
  ниша: 'niche',
  направление: 'niche',
  niche: 'niche',
  город: 'city',
  city: 'city',
  instagram: 'instagram',
  инстаграм: 'instagram',
  инста: 'instagram',
  telegram: 'telegram',
  телеграм: 'telegram',
  phone: 'phone',
  телефон: 'phone',
  email: 'email',
  почта: 'email',
  source: 'source',
  источник: 'source',
  stage: 'stage',
  стадия: 'stage',
  priority: 'priority',
  приоритет: 'priority',
  tags: 'tags',
  теги: 'tags',
  notes: 'notes',
  заметка: 'notes',
  заметки: 'notes',
  next_step: 'next_step',
  'следующий шаг': 'next_step',
  next_contact_date: 'next_contact_date',
  'следующий контакт': 'next_contact_date'
};

function getText(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replaceAll('\ufeff', '').replaceAll('_', ' ');
}

function normalizeType(value: string): LeadType {
  const raw = value.trim().toLowerCase();
  if (['салон', 'salon'].includes(raw)) return 'Салон';
  if (['клиент', 'client'].includes(raw)) return 'Клиент';
  if (['партнер', 'partner', 'партнёр'].includes(raw)) return 'Партнер';
  return 'Мастер';
}

function normalizePriority(value: string): Priority {
  const raw = value.trim().toLowerCase();
  if (['high', 'высокий', 'срочно', 'urgent'].includes(raw)) return 'Высокий';
  if (['low', 'низкий'].includes(raw)) return 'Низкий';
  return 'Средний';
}

function countSeparatorsOutsideQuotes(value: string, separator: string) {
  let count = 0;
  let quoted = false;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    const next = value[index + 1];

    if (char === '"' && quoted && next === '"') {
      index += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === separator && !quoted) count += 1;
  }

  return count;
}

function firstCsvRecord(value: string) {
  let quoted = false;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    const next = value[index + 1];

    if (char === '"' && quoted && next === '"') {
      index += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if ((char === '\n' || char === '\r') && !quoted) {
      return value.slice(0, index);
    }
  }

  return value;
}

function detectSeparator(value: string) {
  const header = firstCsvRecord(value);
  return countSeparatorsOutsideQuotes(header, ';') > countSeparatorsOutsideQuotes(header, ',') ? ';' : ',';
}

function parseCsvRecords(value: string, separator: string) {
  const records: string[][] = [];
  let record: string[] = [];
  let current = '';
  let quoted = false;

  function pushCell() {
    record.push(current.trim());
    current = '';
  }

  function pushRecord() {
    pushCell();
    if (record.some((cell) => cell.trim())) records.push(record);
    record = [];
  }

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    const next = value[index + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === separator && !quoted) {
      pushCell();
      continue;
    }

    if ((char === '\n' || char === '\r') && !quoted) {
      pushRecord();
      if (char === '\r' && next === '\n') index += 1;
      continue;
    }

    current += char;
  }

  if (current || record.length > 0) pushRecord();
  return records;
}

function parseCsv(text: string): CsvRow[] {
  const clean = text.replace(/^\ufeff/, '');
  if (!clean) return [];

  const separator = detectSeparator(clean);
  const records = parseCsvRecords(clean, separator);
  const rawHeaders = records[0] ?? [];
  const headers = rawHeaders.map((header) => headerAliases[normalizeHeader(header)] ?? normalizeHeader(header).replaceAll(' ', '_'));

  return records.slice(1).map((cells) => {
    return headers.reduce<CsvRow>((acc, header, index) => {
      acc[header] = cells[index]?.trim() ?? '';
      return acc;
    }, {});
  });
}

async function ensureSourceId(supabase: Awaited<ReturnType<typeof createClient>>, name: string) {
  const sourceName = name || 'Импорт CSV';
  const existing = await supabase.from('sources').select('id').eq('name', sourceName).maybeSingle();
  if (existing.data?.id) return existing.data.id as string;

  const created = await supabase.from('sources').insert({ name: sourceName, type: 'import' }).select('id').single();
  if (created.error) throw created.error;
  return created.data.id as string;
}

async function ensureStageId(supabase: Awaited<ReturnType<typeof createClient>>, name: string) {
  const stageName = name || 'Найден';
  const existing = await supabase.from('funnel_stages').select('id').eq('name', stageName).maybeSingle();
  if (existing.data?.id) return existing.data.id as string;

  const created = await supabase
    .from('funnel_stages')
    .insert({ name: stageName, type: 'master', order_index: 99, color: 'purple' })
    .select('id')
    .single();
  if (created.error) throw created.error;
  return created.data.id as string;
}

async function ensureTagId(supabase: Awaited<ReturnType<typeof createClient>>, name: string) {
  const tagName = name.trim();
  const existing = await supabase.from('tags').select('id').eq('name', tagName).maybeSingle();
  if (existing.data?.id) return existing.data.id as string;

  const created = await supabase.from('tags').insert({ name: tagName, color: 'purple' }).select('id').single();
  if (created.error) throw created.error;
  return created.data.id as string;
}

function tagsFromRow(row: CsvRow) {
  return Array.from(new Set(
    String(row.tags ?? '')
      .split(/[;,]/)
      .map((tag) => tag.trim())
      .filter(Boolean)
  ));
}

const duplicateColumns = ['instagram', 'telegram', 'email', 'phone'] as const;
type DuplicateColumn = typeof duplicateColumns[number];
type DuplicateSets = Record<DuplicateColumn, Set<string>>;

function duplicateValue(row: CsvRow, column: DuplicateColumn) {
  return String(row[column] ?? '').trim();
}

function emptyDuplicateSets(): DuplicateSets {
  return {
    instagram: new Set(),
    telegram: new Set(),
    email: new Set(),
    phone: new Set()
  };
}

function chunkValues(values: string[], size: number) {
  const chunks: string[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

async function loadExistingDuplicateValues(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rows: CsvRow[]
): Promise<DuplicateSets> {
  const result = emptyDuplicateSets();

  await Promise.all(duplicateColumns.map(async (column) => {
    const values = Array.from(new Set(rows.map((row) => duplicateValue(row, column)).filter(Boolean)));

    for (const chunk of chunkValues(values, 100)) {
      const query = await supabase.from('leads').select(column).in(column, chunk);
      if (query.error) throw query.error;

      for (const lead of query.data ?? []) {
        const value = String((lead as Partial<Record<DuplicateColumn, unknown>>)[column] ?? '').trim();
        if (value) result[column].add(value);
      }
    }
  }));

  return result;
}

async function processInBatches<T>(items: T[], batchSize: number, worker: (item: T) => Promise<void>) {
  for (let index = 0; index < items.length; index += batchSize) {
    await Promise.all(items.slice(index, index + batchSize).map(worker));
  }
}

export async function importContactsCsvAction(formData: FormData) {
  const user = await requirePermission('manageContacts', '/people?error=forbidden');

  if (!isSupabaseConfigured()) {
    redirect('/people/import?demo=1');
  }

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    redirect('/people/import?error=missing-file');
  }

  const skipDuplicates = getText(formData, 'skip_duplicates') === 'on';
  const defaultSource = getText(formData, 'default_source') || 'Импорт CSV';
  const defaultStage = getText(formData, 'default_stage') || 'Найден';
  const defaultType = getText(formData, 'default_type') || 'Мастер';

  const text = await file.text();
  const rows = parseCsv(text).slice(0, 1000);
  const stats: ImportStats = { total: rows.length, imported: 0, skipped: 0, failed: 0, errors: [] };
  const supabase = await createClient();
  const duplicateSets = skipDuplicates ? await loadExistingDuplicateValues(supabase, rows) : emptyDuplicateSets();
  const candidates: Array<{ index: number; row: CsvRow; name: string }> = [];

  for (const [index, row] of rows.entries()) {
    const line = index + 2;
    const name = row.name?.trim();

    if (!name) {
      stats.failed += 1;
      stats.errors.push(`Строка ${line}: нет имени/названия контакта`);
      continue;
    }

    if (skipDuplicates) {
      const isDuplicate = duplicateColumns.some((column) => {
        const value = duplicateValue(row, column);
        return value ? duplicateSets[column].has(value) : false;
      });

      if (isDuplicate) {
        stats.skipped += 1;
        continue;
      }

      duplicateColumns.forEach((column) => {
        const value = duplicateValue(row, column);
        if (value) duplicateSets[column].add(value);
      });
    }

    candidates.push({ index, row, name });
  }

  const sourceIdCache = new Map<string, Promise<string>>();
  const stageIdCache = new Map<string, Promise<string>>();
  const tagIdCache = new Map<string, Promise<string>>();

  function cachedSourceId(name: string) {
    const key = name || defaultSource;
    const cached = sourceIdCache.get(key);
    if (cached) return cached;
    const request = ensureSourceId(supabase, key);
    sourceIdCache.set(key, request);
    return request;
  }

  function cachedStageId(name: string) {
    const key = name || defaultStage;
    const cached = stageIdCache.get(key);
    if (cached) return cached;
    const request = ensureStageId(supabase, key);
    stageIdCache.set(key, request);
    return request;
  }

  function cachedTagId(name: string) {
    const cached = tagIdCache.get(name);
    if (cached) return cached;
    const request = ensureTagId(supabase, name);
    tagIdCache.set(name, request);
    return request;
  }

  await processInBatches(candidates, 8, async ({ index, row, name }) => {
    const line = index + 2;

    try {
      const type = normalizeType(row.type || defaultType);
      const priority = normalizePriority(row.priority || 'Средний');
      const [sourceId, stageId] = await Promise.all([
        cachedSourceId(row.source || defaultSource),
        cachedStageId(row.stage || defaultStage)
      ]);

      const { data: lead, error } = await supabase
        .from('leads')
        .insert({
          name,
          type: leadTypeToDb[type] ?? 'master',
          niche: row.niche || null,
          city: row.city || null,
          phone: row.phone || null,
          telegram: row.telegram || null,
          instagram: row.instagram || null,
          email: row.email || null,
          source_id: sourceId,
          stage_id: stageId,
          priority_score: priorityToScore(priority),
          notes: row.notes || null,
          next_step: row.next_step || null,
          next_contact_date: row.next_contact_date || null,
          assigned_to: user.profileId
        })
        .select('id')
        .single();

      if (error || !lead) throw error ?? new Error('Контакт не создан');

      const tags = tagsFromRow(row);
      const tagIds = await Promise.all(tags.map(cachedTagId));
      if (tagIds.length > 0) {
        const { error: tagError } = await supabase.from('lead_tags').insert(
          tagIds.map((tagId) => ({ lead_id: lead.id, tag_id: tagId }))
        );
        if (tagError) throw tagError;
      }

      await supabase.from('lead_interactions').insert({
        lead_id: lead.id,
        type: 'note',
        channel: row.source || defaultSource,
        text: `Контакт импортирован из файла ${file.name}`,
        result: 'imported',
        created_by: user.profileId
      });

      stats.imported += 1;
    } catch (error) {
      stats.failed += 1;
      stats.errors.push(`Строка ${line}: ${error instanceof Error ? error.message : 'ошибка импорта'}`);
    }
  });

  const { error: logError } = await supabase.from('import_logs').insert({
    file_name: file.name,
    total_rows: stats.total,
    imported_rows: stats.imported,
    skipped_rows: stats.skipped,
    failed_rows: stats.failed,
    status: stats.failed > 0 ? 'finished_with_errors' : 'finished',
    error_details: stats.errors.slice(0, 30),
    created_by: user.profileId
  });

  if (logError) redirect('/people/import?error=import-log-failed');

  revalidatePath('/people');
  revalidatePath('/people/import');
  revalidatePath('/dashboard');
  revalidatePath('/reports');
  redirect(`/people/import?imported=${stats.imported}&skipped=${stats.skipped}&failed=${stats.failed}`);
}
