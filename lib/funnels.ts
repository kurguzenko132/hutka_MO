import { isSupabaseConfigured } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';
import { leads as mockLeads, type Priority } from '@/lib/data';
import type { BadgeTone } from '@/components/ui/badge';
import { canonicalFunnelStages, isInterestedStage, isTestingStage, normalizeStageName, stageTone } from '@/lib/stages';

export type FunnelLead = {
  id: string;
  name: string;
  type: string;
  niche: string;
  city: string;
  source: string;
  refusalReason?: string;
  priority: Priority;
  score: number;
  nextStep: string;
  tags: string[];
};

export type FunnelChartItem = {
  name: string;
  value: number;
  width: string;
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
  repliedContacts: number;
  hotContacts: number;
  readyContacts: number;
  refusedContacts: number;
  activeParticipants: number;
  refusalReasons: FunnelChartItem[];
};

const fallbackStages = canonicalFunnelStages.map((stage) => ({
  id: `stage-${stage.id}`,
  name: stage.name,
  color: stage.color,
  orderIndex: stage.orderIndex
}));

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

function chartItems(entries: Array<[string, number]>): FunnelChartItem[] {
  const sorted = entries.filter(([, value]) => value > 0).sort((a, b) => b[1] - a[1]);
  const max = sorted[0]?.[1] ?? 1;
  return sorted.map(([name, value]) => ({
    name,
    value,
    width: `${Math.max(8, Math.round((value / max) * 100))}%`
  }));
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
    refusalReason: relatedName(row.refusal_reasons) ?? (row.refusal_reason ? String(row.refusal_reason) : undefined),
    priority: scoreToPriority(score),
    score,
    nextStep: String(row.next_step ?? 'Связаться'),
    tags
  };
}

function buildFallbackBoard(): FunnelBoard {
  const columns = fallbackStages.map((stage) => {
    const stageLeads = mockLeads
      .filter((lead) => normalizeStageName(lead.stage) === stage.name)
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
      hotContacts: stageLeads.filter((lead) => lead.score >= 75 || isInterestedStage(stage.name)).length,
      readyContacts: stageLeads.filter(() => isTestingStage(stage.name)).length,
      leads: stageLeads
    };
  });

  return {
    columns,
    totalContacts: mockLeads.length,
    repliedContacts: mockLeads.filter((lead) => ['Ответил', 'Заинтересован', 'Тестирует'].includes(normalizeStageName(lead.stage))).length,
    hotContacts: mockLeads.filter((lead) => lead.score >= 75 || isInterestedStage(lead.stage)).length,
    readyContacts: mockLeads.filter((lead) => isTestingStage(lead.stage)).length,
    refusedContacts: mockLeads.filter((lead) => normalizeStageName(lead.stage) === 'Отказ').length,
    activeParticipants: mockLeads.filter((lead) => !lead.nextStep || lead.nextStep === 'Связаться').length,
    refusalReasons: []
  };
}

function buildEmptyBoard(columns: FunnelColumn[] = []): FunnelBoard {
  return {
    columns,
    totalContacts: 0,
    repliedContacts: 0,
    hotContacts: 0,
    readyContacts: 0,
    refusedContacts: 0,
    activeParticipants: 0,
    refusalReasons: []
  };
}

export async function getFunnelBoard(campaignId?: string): Promise<FunnelBoard> {
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
    const name = normalizeStageName(String(row.name ?? ''));
    if (uniqueStages.has(name)) continue;
    const canonical = canonicalFunnelStages.find((stage) => stage.name === name);
    uniqueStages.set(name, {
      id: String(row.id),
      name,
      color: canonical?.color ?? toneFromColor(row.color ? String(row.color) : null),
      orderIndex: canonical?.orderIndex ?? Number(row.order_index ?? 99),
      contacts: 0,
      hotContacts: 0,
      readyContacts: 0,
      leads: []
    });
  }

  for (const stage of canonicalFunnelStages) {
    if (!uniqueStages.has(stage.name)) {
      uniqueStages.set(stage.name, {
        id: stage.name,
        name: stage.name,
        color: stage.color,
        orderIndex: stage.orderIndex,
        contacts: 0,
        hotContacts: 0,
        readyContacts: 0,
        leads: []
      });
    }
  }

  let campaignLeadIds: string[] | undefined;
  if (campaignId) {
    const { data: links, error: linksError } = await supabase
      .from('campaign_leads')
      .select('lead_id')
      .eq('campaign_id', campaignId);
    if (linksError || !links?.length) {
      return buildEmptyBoard(Array.from(uniqueStages.values()).sort((a, b) => a.orderIndex - b.orderIndex));
    }
    campaignLeadIds = links.map((link) => String(link.lead_id)).filter(Boolean);
  }

  let leadQuery = supabase
    .from('leads')
    .select('id,name,type,niche,city,priority_score,next_step,stage_id,refusal_reason,sources(name),funnel_stages(name),refusal_reasons(name),lead_tags(tags(name))')
    .order('updated_at', { ascending: false });

  if (campaignLeadIds) {
    leadQuery = leadQuery.in('id', campaignLeadIds);
  }

  const { data: leadRows, error: leadsError } = await leadQuery;

  if (leadsError || !leadRows) {
    return buildEmptyBoard(Array.from(uniqueStages.values()).sort((a, b) => a.orderIndex - b.orderIndex));
  }

  for (const row of leadRows) {
    const stageName = normalizeStageName(relatedName((row as Record<string, unknown>).funnel_stages));
    if (!uniqueStages.has(stageName)) {
      uniqueStages.set(stageName, {
        id: `missing-${stageName}`,
        name: stageName,
        color: stageTone(stageName),
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
    if (lead.score >= 75 || isInterestedStage(stageName)) column.hotContacts += 1;
    if (isTestingStage(stageName)) column.readyContacts += 1;
  }

  const columns = Array.from(uniqueStages.values()).sort((a, b) => a.orderIndex - b.orderIndex);
  const allLeads = columns.flatMap((column) => column.leads);
  const refusalReasonCounts = allLeads
    .filter((lead) => lead.refusalReason)
    .reduce((acc, lead) => {
      const reason = lead.refusalReason || 'Причина не указана';
      acc.set(reason, (acc.get(reason) ?? 0) + 1);
      return acc;
    }, new Map<string, number>());

  return {
    columns,
    totalContacts: allLeads.length,
    repliedContacts: columns
      .filter((column) => ['Ответил', 'Заинтересован', 'Тестирует'].includes(column.name))
      .reduce((sum, column) => sum + column.contacts, 0),
    hotContacts: columns.reduce((sum, column) => sum + column.hotContacts, 0),
    readyContacts: columns.reduce((sum, column) => sum + column.readyContacts, 0),
    refusedContacts: columns.find((column) => column.name === 'Отказ')?.contacts ?? 0,
    activeParticipants: allLeads.filter((lead) => !lead.nextStep || lead.nextStep === 'Связаться').length,
    refusalReasons: chartItems(Array.from(refusalReasonCounts.entries()))
  };
}
