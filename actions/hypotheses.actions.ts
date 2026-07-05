'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { hypothesisConfidenceToDb, hypothesisStatusToDb } from '@/lib/hypotheses';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { requirePermission } from '@/lib/permissions';

function getText(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

function getMany(formData: FormData, key: string) {
  return formData.getAll(key).map((value) => String(value)).filter(Boolean);
}

async function hypothesisExists(supabase: Awaited<ReturnType<typeof createClient>>, hypothesisId: string) {
  const { data, error } = await supabase.from('hypotheses').select('id').eq('id', hypothesisId).maybeSingle();
  return !error && Boolean(data?.id);
}

export async function createHypothesisAction(formData: FormData) {
  await requirePermission('manageHypotheses', '/hypotheses?error=forbidden');
  const title = getText(formData, 'title');
  if (!title) redirect('/hypotheses/new?error=missing-title');

  if (!isSupabaseConfigured()) {
    redirect('/hypotheses?created=demo');
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('hypotheses')
    .insert({
      title,
      description: getText(formData, 'description') || null,
      category: getText(formData, 'category') || 'Проверка',
      status: hypothesisStatusToDb[getText(formData, 'status')] ?? 'new',
      confidence: hypothesisConfidenceToDb[getText(formData, 'confidence')] ?? 'medium',
      test_method: getText(formData, 'test_method') || null,
      success_metric: getText(formData, 'success_metric') || null,
      evidence_for: getText(formData, 'evidence_for') || null,
      evidence_against: getText(formData, 'evidence_against') || null,
      result: getText(formData, 'result') || null,
      next_action: getText(formData, 'next_action') || null
    })
    .select('id')
    .single();

  if (error || !data) redirect('/hypotheses/new?error=save-failed');

  const hypothesisId = String(data.id);
  const leadIds = getMany(formData, 'lead_ids');
  const insightIds = getMany(formData, 'insight_ids');
  const campaignIds = getMany(formData, 'campaign_ids');
  const surveyIds = getMany(formData, 'survey_ids');

  if (leadIds.length > 0) {
    const { error: leadsError } = await supabase.from('hypothesis_leads').insert(leadIds.map((leadId) => ({ hypothesis_id: hypothesisId, lead_id: leadId })));
    if (leadsError) redirect(`/hypotheses/${hypothesisId}?error=relations-save-failed`);
  }

  if (insightIds.length > 0) {
    const { error: insightsError } = await supabase.from('hypothesis_insights').insert(insightIds.map((insightId) => ({ hypothesis_id: hypothesisId, insight_id: insightId })));
    if (insightsError) redirect(`/hypotheses/${hypothesisId}?error=relations-save-failed`);
  }

  if (campaignIds.length > 0) {
    const { error: campaignsError } = await supabase.from('hypothesis_campaigns').insert(campaignIds.map((campaignId) => ({ hypothesis_id: hypothesisId, campaign_id: campaignId })));
    if (campaignsError) redirect(`/hypotheses/${hypothesisId}?error=relations-save-failed`);
  }

  if (surveyIds.length > 0) {
    const { error: surveysError } = await supabase.from('hypothesis_surveys').insert(surveyIds.map((surveyId) => ({ hypothesis_id: hypothesisId, survey_id: surveyId })));
    if (surveysError) redirect(`/hypotheses/${hypothesisId}?error=relations-save-failed`);
  }

  revalidatePath('/hypotheses');
  revalidatePath('/dashboard');
  redirect(`/hypotheses/${hypothesisId}`);
}

export async function updateHypothesisAction(formData: FormData) {
  await requirePermission('manageHypotheses', '/hypotheses?error=forbidden');
  const hypothesisId = getText(formData, 'hypothesis_id');
  if (!hypothesisId) redirect('/hypotheses');

  if (!isSupabaseConfigured()) {
    redirect(`/hypotheses/${hypothesisId}?updated=demo`);
  }

  const supabase = await createClient();
  if (!(await hypothesisExists(supabase, hypothesisId))) redirect('/hypotheses?error=hypothesis-not-found');

  const { error } = await supabase
    .from('hypotheses')
    .update({
      status: hypothesisStatusToDb[getText(formData, 'status')] ?? 'new',
      confidence: hypothesisConfidenceToDb[getText(formData, 'confidence')] ?? 'medium',
      evidence_for: getText(formData, 'evidence_for') || null,
      evidence_against: getText(formData, 'evidence_against') || null,
      result: getText(formData, 'result') || null,
      next_action: getText(formData, 'next_action') || null
    })
    .eq('id', hypothesisId);

  if (error) redirect(`/hypotheses/${hypothesisId}?error=update-failed`);

  revalidatePath('/hypotheses');
  revalidatePath(`/hypotheses/${hypothesisId}`);
  revalidatePath('/dashboard');
  redirect(`/hypotheses/${hypothesisId}`);
}

export async function deleteHypothesisAction(formData: FormData) {
  await requirePermission('manageHypotheses', '/hypotheses?error=forbidden');
  const hypothesisId = getText(formData, 'hypothesis_id');
  if (!hypothesisId) redirect('/hypotheses?error=missing-hypothesis');

  if (!isSupabaseConfigured()) {
    redirect('/hypotheses?deleted=demo');
  }

  const supabase = await createClient();
  if (!(await hypothesisExists(supabase, hypothesisId))) redirect('/hypotheses?error=hypothesis-not-found');

  const { error } = await supabase.from('hypotheses').delete().eq('id', hypothesisId);
  if (error) redirect(`/hypotheses/${hypothesisId}?error=delete-failed`);

  revalidatePath('/hypotheses');
  revalidatePath('/dashboard');
  revalidatePath('/reports');
  redirect('/hypotheses?deleted=hypothesis');
}
