'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  insightImportanceLabel,
  insightImportanceToDb,
  insightStatusLabel,
  insightStatusToDb,
  type InsightImportance,
  type InsightStatus
} from '@/lib/insight-shared';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { requirePermission } from '@/lib/permissions';
import { recordActivityLog } from '@/lib/activity-log';

function getText(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

function getMany(formData: FormData, key: string) {
  return formData.getAll(key).map((value) => String(value)).filter(Boolean);
}

export type InsightUpdateMutationInput = {
  id: string;
  status: string;
  importance: string;
  evidence?: string;
  nextAction?: string;
};

export type InsightUpdateMutationResult = {
  ok: boolean;
  error?: 'demo' | 'missing-insight' | 'update-failed' | 'insight-not-found' | 'confirmation-required' | 'delete-failed';
  item?: {
    status: InsightStatus;
    statusLabel: string;
    importance: InsightImportance;
    importanceLabel: string;
    evidence?: string;
    nextAction?: string;
  };
};

export async function createInsightAction(formData: FormData) {
  const user = await requirePermission('manageInsights', '/insights?error=forbidden');
  const title = getText(formData, 'title');
  if (!title) redirect('/insights/new?error=missing-title');

  if (!isSupabaseConfigured()) {
    redirect('/insights?created=demo');
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('insights')
    .insert({
      title,
      description: getText(formData, 'description') || null,
      category: getText(formData, 'category') || 'Вывод',
      evidence: getText(formData, 'evidence') || null,
      importance: insightImportanceToDb[getText(formData, 'importance')] ?? 'medium',
      status: insightStatusToDb[getText(formData, 'status')] ?? 'new',
      next_action: getText(formData, 'next_action') || null
    })
    .select('id')
    .single();

  if (error || !data) redirect('/insights/new?error=save-failed');

  const insightId = String(data.id);
  const leadIds = getMany(formData, 'lead_ids');
  const campaignIds = getMany(formData, 'campaign_ids');
  const surveyIds = getMany(formData, 'survey_ids');

  const relationResults = await Promise.all([
    leadIds.length > 0
      ? supabase.from('insight_leads').insert(leadIds.map((leadId) => ({ insight_id: insightId, lead_id: leadId })))
      : Promise.resolve({ error: null }),
    campaignIds.length > 0
      ? supabase.from('insight_campaigns').insert(campaignIds.map((campaignId) => ({ insight_id: insightId, campaign_id: campaignId })))
      : Promise.resolve({ error: null }),
    surveyIds.length > 0
      ? supabase.from('insight_surveys').insert(surveyIds.map((surveyId) => ({ insight_id: insightId, survey_id: surveyId })))
      : Promise.resolve({ error: null })
  ]);

  if (relationResults.some((result) => result.error)) {
    redirect(`/insights/${insightId}?error=relations-save-failed`);
  }

  await recordActivityLog({
    userId: user.profileId,
    action: 'создал вывод',
    entityType: 'insight',
    entityId: insightId,
    entityTitle: title,
    details: { leads: leadIds.length, campaigns: campaignIds.length, surveys: surveyIds.length }
  });

  revalidatePath('/insights');
  revalidatePath('/dashboard');
  redirect(`/insights/${insightId}`);
}

export async function updateInsightAction(formData: FormData) {
  const insightId = getText(formData, 'insight_id');
  const result = await updateInsightMutation({
    id: insightId,
    status: getText(formData, 'status'),
    importance: getText(formData, 'importance'),
    evidence: getText(formData, 'evidence'),
    nextAction: getText(formData, 'next_action')
  });
  if (!result.ok) {
    if (result.error === 'missing-insight' || result.error === 'insight-not-found') redirect('/insights?error=insight-not-found');
    redirect(`/insights/${insightId}?error=${result.error ?? 'update-failed'}`);
  }
  revalidatePath('/insights');
  revalidatePath(`/insights/${insightId}`);
  revalidatePath('/dashboard');
  redirect(`/insights/${insightId}`);
}

export async function updateInsightMutation(input: InsightUpdateMutationInput): Promise<InsightUpdateMutationResult> {
  const user = await requirePermission('manageInsights', '/insights?error=forbidden');
  const insightId = input.id.trim();
  if (!insightId) return { ok: false, error: 'missing-insight' };
  if (!isSupabaseConfigured()) return { ok: false, error: 'demo' };

  const status = insightStatusToDb[input.status] ?? (Object.values(insightStatusToDb).includes(input.status as InsightStatus) ? input.status as InsightStatus : 'new');
  const importance = insightImportanceToDb[input.importance] ?? (Object.values(insightImportanceToDb).includes(input.importance as InsightImportance) ? input.importance as InsightImportance : 'medium');
  const evidence = input.evidence?.trim() || '';
  const nextAction = input.nextAction?.trim() || '';
  const supabase = await createClient();
  const { data: updatedInsight, error } = await supabase
    .from('insights')
    .update({
      status,
      importance,
      evidence: evidence || null,
      next_action: nextAction || null
    })
    .eq('id', insightId)
    .select('id,status,importance,evidence,next_action')
    .maybeSingle();

  if (error) return { ok: false, error: 'update-failed' };
  if (!updatedInsight?.id) return { ok: false, error: 'insight-not-found' };

  await recordActivityLog({
    userId: user.profileId,
    action: 'изменил вывод',
    entityType: 'insight',
    entityId: insightId,
    entityTitle: 'Вывод',
    details: { status }
  });
  return {
    ok: true,
    item: {
      status,
      statusLabel: insightStatusLabel(status),
      importance,
      importanceLabel: insightImportanceLabel(importance),
      evidence: updatedInsight.evidence ? String(updatedInsight.evidence) : undefined,
      nextAction: updatedInsight.next_action ? String(updatedInsight.next_action) : undefined
    }
  };
}

export async function deleteInsightAction(formData: FormData) {
  const insightId = getText(formData, 'insight_id');
  const confirmation = getText(formData, 'confirmation');
  const result = await deleteInsightMutation(insightId, confirmation);
  if (!result.ok) {
    if (result.error === 'missing-insight' || result.error === 'insight-not-found') redirect('/insights?error=insight-not-found');
    redirect(`/insights/${insightId}?error=${result.error ?? 'delete-failed'}`);
  }
  revalidatePath('/insights');
  revalidatePath('/dashboard');
  revalidatePath('/reports');
  redirect('/insights?deleted=insight');
}

export async function deleteInsightMutation(insightIdRaw: string, confirmation: string): Promise<InsightUpdateMutationResult> {
  const user = await requirePermission('manageInsights', '/insights?error=forbidden');
  const insightId = insightIdRaw.trim();
  if (!insightId) return { ok: false, error: 'missing-insight' };
  if (confirmation !== 'УДАЛИТЬ') return { ok: false, error: 'confirmation-required' };
  if (!isSupabaseConfigured()) return { ok: false, error: 'demo' };

  const supabase = await createClient();
  const { data: insight, error } = await supabase
    .from('insights')
    .delete()
    .eq('id', insightId)
    .select('id,title')
    .maybeSingle();
  if (error) return { ok: false, error: 'delete-failed' };
  if (!insight?.id) return { ok: false, error: 'insight-not-found' };

  await recordActivityLog({
    userId: user.profileId,
    action: 'удалил вывод',
    entityType: 'insight',
    entityId: insightId,
    entityTitle: String(insight.title ?? 'Вывод')
  });

  return { ok: true };
}
