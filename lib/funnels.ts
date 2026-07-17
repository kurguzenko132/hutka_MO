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

export type FunnelStagePage = {
  leads: FunnelLead[];
  total: number;
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
  const rawScore = Number(row.priority_score ?? 0);
  const score = Number.isFinite(rawScore) ? rawScore : 0;
  const directTags = Array.isArray(row.tags)
    ? row.tags.map((tag) => String(tag)).filter(Boolean)
    : [];
  const rawTags = Array.isArray(row.lead_tags) ? row.lead_tags : [];
  const tags = directTags.length > 0
    ? directTags
    : rawTags
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
    source: row.source_name ? String(row.source_name) : relatedName(row.sources) ?? 'Не указан',
    refusalReason: row.refusal_reason_name
      ? String(row.refusal_reason_name)
      : relatedName(row.refusal_reasons) ?? (row.refusal_reason ? String(row.refusal_reason) : undefined),
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

function buildStageColumns(stageRows: Array<{
  id: string;
  name?: string | null;
  order_index?: number | null;
  color?: string | null;
}>) {
  const uniqueStages = new Map<string, FunnelColumn>();
  for (const row of stageRows) {
    const name = normalizeStageName(String(row.name ?? ''));
    if (uniqueStages.has(name)) continue;
    const canonical = canonicalFunnelStages.find((stage) => stage.name === name);
    uniqueStages.set(name, {
      id: String(row.id),
      name,
      color: canonical?.color ?? toneFromColor(row.color),
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

  return uniqueStages;
}

function safeNumber(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function payloadRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function parseFunnelBoardPayload(
  value: unknown,
  stageRows: Array<{ id: string; name?: string | null; order_index?: number | null; color?: string | null }>
): FunnelBoard | null {
  const payload = payloadRecord(value);
  if (!payload) return null;

  const columnsByName = buildStageColumns(stageRows);
  const rawCounts = Array.isArray(payload.stage_counts) ? payload.stage_counts : [];
  for (const rawCount of rawCounts) {
    const count = payloadRecord(rawCount);
    if (!count) continue;
    const stageName = normalizeStageName(String(count.stage_name ?? ''));
    const column = columnsByName.get(stageName);
    if (!column) continue;
    column.contacts = safeNumber(count.contacts);
    column.hotContacts = safeNumber(count.hot_contacts);
    column.readyContacts = safeNumber(count.ready_contacts);
  }

  const rawItems = Array.isArray(payload.items) ? payload.items : [];
  for (const rawItem of rawItems) {
    const item = payloadRecord(rawItem);
    if (!item) continue;
    const stageName = normalizeStageName(String(item.stage_name ?? ''));
    const column = columnsByName.get(stageName);
    if (!column) continue;
    column.leads.push(toFunnelLead(item));
  }

  const summary = payloadRecord(payload.summary) ?? {};
  const refusalReasons = (Array.isArray(payload.refusal_reasons) ? payload.refusal_reasons : [])
    .map((rawReason): [string, number] | null => {
      const reason = payloadRecord(rawReason);
      if (!reason) return null;
      return [String(reason.name ?? 'Причина не указана'), safeNumber(reason.value)];
    })
    .filter((item): item is [string, number] => Boolean(item));

  return {
    columns: Array.from(columnsByName.values()).sort((a, b) => a.orderIndex - b.orderIndex),
    totalContacts: safeNumber(summary.total),
    repliedContacts: safeNumber(summary.replied),
    hotContacts: safeNumber(summary.hot),
    readyContacts: safeNumber(summary.ready),
    refusedContacts: safeNumber(summary.refused),
    activeParticipants: safeNumber(summary.need_action),
    refusalReasons: chartItems(refusalReasons)
  };
}

export async function getFunnelBoard(campaignId?: string): Promise<FunnelBoard> {
  if (!isSupabaseConfigured()) {
    return buildFallbackBoard();
  }

  const supabase = await createClient();
  const [stagesResult, boardResult] = await Promise.all([
    supabase
      .from('funnel_stages')
      .select('id,name,type,order_index,color')
      .order('order_index', { ascending: true }),
    supabase.rpc('get_funnel_board_page', {
      p_campaign_id: campaignId || null,
      p_limit_per_stage: 40
    })
  ]);

  if (stagesResult.error || !stagesResult.data) return buildEmptyBoard();

  if (!boardResult.error) {
    const board = parseFunnelBoardPayload(boardResult.data, stagesResult.data);
    if (board) return board;
  }

  let campaignLeadIds: string[] | undefined;
  if (campaignId) {
    const { data: links, error: linksError } = await supabase
      .from('campaign_leads')
      .select('lead_id')
      .eq('campaign_id', campaignId);
    if (linksError || !links?.length) {
      const uniqueStages = buildStageColumns(stagesResult.data);
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
  const uniqueStages = buildStageColumns(stagesResult.data);

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

export async function getFunnelStagePage(
  stageName: string,
  campaignId: string | undefined,
  requestedOffset = 0,
  requestedLimit = 40
): Promise<FunnelStagePage> {
  const offset = Math.max(Math.floor(requestedOffset) || 0, 0);
  const limit = Math.min(Math.max(Math.floor(requestedLimit) || 40, 1), 100);

  if (!isSupabaseConfigured()) {
    const column = buildFallbackBoard().columns.find((item) => item.name === normalizeStageName(stageName));
    const leads = column?.leads ?? [];
    return { leads: leads.slice(offset, offset + limit), total: leads.length };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('get_funnel_stage_page', {
      p_stage_name: stageName,
      p_campaign_id: campaignId || null,
      p_offset: offset,
      p_limit: limit
    });
    const payload = error ? null : payloadRecord(data);
    if (!payload) return { leads: [], total: 0 };

    const rawItems = Array.isArray(payload.items) ? payload.items : [];
    return {
      leads: rawItems
        .map((item) => payloadRecord(item))
        .filter((item): item is Record<string, unknown> => Boolean(item))
        .map((item) => toFunnelLead(item)),
      total: Math.max(0, safeNumber(payload.total))
    };
  } catch {
    return { leads: [], total: 0 };
  }
}
