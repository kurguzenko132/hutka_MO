import { isSupabaseConfigured } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';
import { leads as mockLeads, type Priority } from '@/lib/data';
import type { BadgeTone } from '@/components/ui/badge';

export type FunnelLead = {
  id: string;
  name: string;
  type: string;
  niche: string;
  city: string;
  source: string;
  priority: Priority;
  score: number;
  nextStep: string;
  tags: string[];
};

export type FunnelColumn = {
  id: string;
  name: string;
  color: BadgeTone;
  orderIndex: number;
  contacts: number;
  hotContacts: number;
  readyContacts: number;
  leads: FunnelLead[];
};

export type FunnelBoard = {
  columns: FunnelColumn[];
  totalContacts: number;
  hotContacts: number;
  readyContacts: number;
  activeParticipants: number;
};

const fallbackStages = [
  { id: 'stage-found', name: 'Найдено', color: 'gray' as BadgeTone, orderIndex: 1 },
  { id: 'stage-message', name: 'Написал', color: 'purple' as BadgeTone, orderIndex: 2 },
  { id: 'stage-replied', name: 'Ответил', color: 'blue' as BadgeTone, orderIndex: 3 },
  { id: 'stage-survey', name: 'Опрос', color: 'yellow' as BadgeTone, orderIndex: 4 },
  { id: 'stage-test', name: 'Тест', color: 'green' as BadgeTone, orderIndex: 5 },
  { id: 'stage-active', name: 'Активен', color: 'green' as BadgeTone, orderIndex: 6 },
  { id: 'stage-rejected', name: 'Отказ', color: 'red' as BadgeTone, orderIndex: 7 }
];

const readyStages = new Set(['Тест', 'Активен']);

function scoreToPriority(score: number): Priority {
  if (score >= 75) return 'Высокий';
  if (score >= 45) return 'Средний';
  return 'Низкий';
}

function toneFromColor(color?: string | null): BadgeTone {
  const normalized = (color ?? '').toLowerCase();
  if (['purple', 'pink', 'green', 'yellow', 'red', 'blue', 'gray'].includes(normalized)) {
    return normalized as BadgeTone;
  }
  return 'purple';
}

function relatedName(value: unknown): string | undefined {
  if (!value) return undefined;
  if (Array.isArray(value)) return relatedName(value[0]);
  if (typeof value === 'object' && 'name' in value) {
    const name = (value as { name?: unknown }).name;
    return typeof name === 'string' ? name : undefined;
  }
  return undefined;
}

function toFunnelLead(row: Record<string, unknown>): FunnelLead {
  const score = typeof row.priority_score === 'number' ? row.priority_score : 0;
  const rawTags = Array.isArray(row.lead_tags) ? row.lead_tags : [];
  const tags = rawTags
    .map((item) => {
      if (!item || typeof item !== 'object') return undefined;
      return relatedName((item as { tags?: unknown }).tags);
    })
    .filter((tag): tag is string => Boolean(tag));

  return {
    id: String(row.id),
    name: String(row.name ?? 'Без имени'),
    type: String(row.type ?? 'master'),
    niche: String(row.niche ?? 'Не указана'),
    city: String(row.city ?? 'Не указан'),
    source: relatedName(row.sources) ?? 'Не указан',
    priority: scoreToPriority(score),
    score,
    nextStep: String(row.next_step ?? 'Связаться'),
    tags
  };
}

function buildFallbackBoard(): FunnelBoard {
  const columns = fallbackStages.map((stage) => {
    const stageLeads = mockLeads
      .filter((lead) => lead.stage === stage.name || (stage.name === 'Найдено' && lead.stage === 'Найден'))
      .map((lead) => ({
        id: lead.id,
        name: lead.name,
        type: lead.type,
        niche: lead.niche,
        city: lead.city,
        source: lead.source,
        priority: lead.priority,
        score: lead.score,
        nextStep: lead.nextStep,
        tags: lead.tags
      }));

    return {
      ...stage,
      contacts: stageLeads.length,
      hotContacts: stageLeads.filter((lead) => lead.score >= 75).length,
      readyContacts: stageLeads.filter((lead) => lead.score >= 75 || readyStages.has(stage.name)).length,
      leads: stageLeads
    };
  });

  return {
    columns,
    totalContacts: mockLeads.length,
    hotContacts: mockLeads.filter((lead) => lead.score >= 75).length,
    readyContacts: mockLeads.filter((lead) => lead.score >= 75 || readyStages.has(lead.stage)).length,
    activeParticipants: mockLeads.filter((lead) => lead.stage === 'Активен').length
  };
}

function buildEmptyBoard(columns: FunnelColumn[] = []): FunnelBoard {
  return {
    columns,
    totalContacts: 0,
    hotContacts: 0,
    readyContacts: 0,
    activeParticipants: 0
  };
}

export async function getFunnelBoard(): Promise<FunnelBoard> {
  if (!isSupabaseConfigured()) {
    return buildFallbackBoard();
  }

  const supabase = await createClient();
  const { data: stageRows, error: stagesError } = await supabase
    .from('funnel_stages')
    .select('id,name,type,order_index,color')
    .order('order_index', { ascending: true });

  if (stagesError || !stageRows) return buildEmptyBoard();

  const uniqueStages = new Map<string, FunnelColumn>();
  for (const row of stageRows) {
    const name = String(row.name ?? 'Без стадии');
    if (uniqueStages.has(name)) continue;
    uniqueStages.set(name, {
      id: String(row.id),
      name,
      color: toneFromColor(row.color ? String(row.color) : null),
      orderIndex: Number(row.order_index ?? 99),
      contacts: 0,
      hotContacts: 0,
      readyContacts: 0,
      leads: []
    });
  }

  const { data: leadRows, error: leadsError } = await supabase
    .from('leads')
    .select('id,name,type,niche,city,priority_score,next_step,stage_id,sources(name),funnel_stages(name),lead_tags(tags(name))')
    .order('updated_at', { ascending: false });

  if (leadsError || !leadRows) {
    return buildEmptyBoard(Array.from(uniqueStages.values()).sort((a, b) => a.orderIndex - b.orderIndex));
  }

  for (const row of leadRows) {
    const stageName = relatedName((row as Record<string, unknown>).funnel_stages) ?? 'Найден';
    if (!uniqueStages.has(stageName)) {
      uniqueStages.set(stageName, {
        id: `missing-${stageName}`,
        name: stageName,
        color: 'gray',
        orderIndex: 999,
        contacts: 0,
        hotContacts: 0,
        readyContacts: 0,
        leads: []
      });
    }

    const lead = toFunnelLead(row as Record<string, unknown>);
    const column = uniqueStages.get(stageName);
    if (!column) continue;
    column.leads.push(lead);
    column.contacts += 1;
    if (lead.score >= 75) column.hotContacts += 1;
    if (lead.score >= 75 || readyStages.has(stageName)) column.readyContacts += 1;
  }

  const columns = Array.from(uniqueStages.values()).sort((a, b) => a.orderIndex - b.orderIndex);
  const allLeads = columns.flatMap((column) => column.leads);

  return {
    columns,
    totalContacts: allLeads.length,
    hotContacts: allLeads.filter((lead) => lead.score >= 75).length,
    readyContacts: columns.reduce((sum, column) => sum + column.readyContacts, 0),
    activeParticipants: columns.find((column) => column.name === 'Активен')?.contacts ?? 0
  };
}
