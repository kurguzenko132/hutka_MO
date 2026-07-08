import { isSupabaseConfigured } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';
import { canonicalFunnelStages, normalizeContactTagName, normalizeStageName, orderStageNames } from '@/lib/stages';
import { normalizeSourceName, sourceKey } from '@/lib/source-normalization';

export type LeadFormOptions = {
  sources: string[];
  stages: string[];
  tags: string[];
};

const fallbackOptions: LeadFormOptions = {
  sources: ['Instagram', 'Telegram', 'Рекомендация', 'Beauty-школа'],
  stages: canonicalFunnelStages.map((stage) => stage.name),
  tags: ['Нужны клиенты', 'Нет CRM', 'Пустые окна', 'Заинтересован', 'Тестирует']
};

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ru'));
}

function uniqueSources(values: string[]) {
  const byKey = new Map<string, string>();

  for (const value of values) {
    const normalized = normalizeSourceName(value);
    const key = sourceKey(normalized);
    if (!key || byKey.has(key)) continue;
    byKey.set(key, normalized);
  }

  return Array.from(byKey.values()).sort((a, b) => a.localeCompare(b, 'ru'));
}

export async function getLeadFormOptions(): Promise<LeadFormOptions> {
  if (!isSupabaseConfigured()) return fallbackOptions;

  try {
    const supabase = await createClient();
    const [sourcesResult, stagesResult, tagsResult] = await Promise.all([
      supabase.from('sources').select('name').order('name', { ascending: true }).limit(150),
      supabase.from('funnel_stages').select('name,order_index').order('order_index', { ascending: true }).limit(50),
      supabase.from('tags').select('name').order('name', { ascending: true }).limit(150)
    ]);

    const sources = sourcesResult.error
      ? fallbackOptions.sources
      : uniqueSources((sourcesResult.data ?? []).map((row) => String(row.name ?? '')));

    const rawStageNames = stagesResult.error
      ? fallbackOptions.stages
      : (stagesResult.data ?? []).map((row) => normalizeStageName(String(row.name ?? '')));
    const stages = orderStageNames(uniqueSorted(rawStageNames));

    const tags = tagsResult.error
      ? fallbackOptions.tags
      : uniqueSorted((tagsResult.data ?? []).map((row) => normalizeContactTagName(String(row.name ?? ''))));

    return {
      sources: sources.length ? sources : fallbackOptions.sources,
      stages: stages.length ? stages : fallbackOptions.stages,
      tags: tags.length ? tags : fallbackOptions.tags
    };
  } catch {
    return fallbackOptions;
  }
}
