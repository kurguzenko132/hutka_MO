'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { insightImportanceToDb, insightStatusToDb } from '@/lib/insights';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { requirePermission } from '@/lib/permissions';

function getText(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

function getMany(formData: FormData, key: string) {
  return formData.getAll(key).map((value) => String(value)).filter(Boolean);
}

export async function createInsightAction(formData: FormData) {
  await requirePermission('manageInsights', '/insights?error=forbidden');
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
      category: getText(formData, 'category') || 'Инсайт',
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

  if (leadIds.length > 0) {
    await supabase.from('insight_leads').insert(leadIds.map((leadId) => ({ insight_id: insightId, lead_id: leadId })));
  }

  if (campaignIds.length > 0) {
    await supabase.from('insight_campaigns').insert(campaignIds.map((campaignId) => ({ insight_id: insightId, campaign_id: campaignId })));
  }

  if (surveyIds.length > 0) {
    await supabase.from('insight_surveys').insert(surveyIds.map((surveyId) => ({ insight_id: insightId, survey_id: surveyId })));
  }

  revalidatePath('/insights');
  revalidatePath('/dashboard');
  redirect(`/insights/${insightId}`);
}

export async function updateInsightAction(formData: FormData) {
  await requirePermission('manageInsights', '/insights?error=forbidden');
  const insightId = getText(formData, 'insight_id');
  if (!insightId) redirect('/insights');

  if (!isSupabaseConfigured()) {
    redirect(`/insights/${insightId}?updated=demo`);
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('insights')
    .update({
      status: insightStatusToDb[getText(formData, 'status')] ?? 'new',
      importance: insightImportanceToDb[getText(formData, 'importance')] ?? 'medium',
      evidence: getText(formData, 'evidence') || null,
      next_action: getText(formData, 'next_action') || null
    })
    .eq('id', insightId);

  if (error) redirect(`/insights/${insightId}?error=update-failed`);

  revalidatePath('/insights');
  revalidatePath(`/insights/${insightId}`);
  revalidatePath('/dashboard');
  redirect(`/insights/${insightId}`);
}

export async function deleteInsightAction(formData: FormData) {
  await requirePermission('manageInsights', '/insights?error=forbidden');
  const insightId = getText(formData, 'insight_id');
  if (!insightId) redirect('/insights?error=missing-insight');

  if (!isSupabaseConfigured()) {
    redirect('/insights?deleted=demo');
  }

  const supabase = await createClient();
  const { error } = await supabase.from('insights').delete().eq('id', insightId);
  if (error) redirect(`/insights/${insightId}?error=delete-failed`);

  revalidatePath('/insights');
  revalidatePath('/dashboard');
  revalidatePath('/reports');
  redirect('/insights?deleted=insight');
}
