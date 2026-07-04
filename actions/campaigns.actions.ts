'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { campaignStatusToDb } from '@/lib/campaigns';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { requirePermission } from '@/lib/permissions';

function getText(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

async function campaignExists(supabase: Awaited<ReturnType<typeof createClient>>, campaignId: string) {
  const { data, error } = await supabase.from('campaigns').select('id').eq('id', campaignId).maybeSingle();
  return !error && Boolean(data?.id);
}

async function leadExists(supabase: Awaited<ReturnType<typeof createClient>>, leadId: string) {
  const { data, error } = await supabase.from('leads').select('id').eq('id', leadId).maybeSingle();
  return !error && Boolean(data?.id);
}

export async function createCampaignAction(formData: FormData) {
  await requirePermission('manageCampaigns', '/campaigns?error=forbidden');
  const name = getText(formData, 'name');
  if (!name) redirect('/campaigns/new?error=missing-name');

  if (!isSupabaseConfigured()) {
    redirect('/campaigns?created=demo');
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('campaigns')
    .insert({
      name,
      goal: getText(formData, 'goal') || null,
      channel: getText(formData, 'channel') || null,
      city: getText(formData, 'city') || null,
      niche: getText(formData, 'niche') || null,
      budget: Number(getText(formData, 'budget') || 0),
      offer_text: getText(formData, 'offer_text') || null,
      status: campaignStatusToDb[getText(formData, 'status')] ?? 'draft',
      start_date: getText(formData, 'start_date') || null,
      end_date: getText(formData, 'end_date') || null,
      result_notes: getText(formData, 'result_notes') || null
    })
    .select('id')
    .single();

  if (error || !data) redirect('/campaigns/new?error=save-failed');

  revalidatePath('/campaigns');
  revalidatePath('/dashboard');
  redirect(`/campaigns/${data.id}`);
}

export async function addLeadToCampaignAction(formData: FormData) {
  await requirePermission('manageCampaigns', '/campaigns?error=forbidden');
  const campaignId = getText(formData, 'campaign_id');
  const leadId = getText(formData, 'lead_id');
  if (!campaignId) redirect('/campaigns');
  if (!leadId) redirect(`/campaigns/${campaignId}?error=missing-lead`);

  if (!isSupabaseConfigured()) {
    redirect(`/campaigns/${campaignId}?lead=demo`);
  }

  const supabase = await createClient();
  const [hasCampaign, hasLead] = await Promise.all([
    campaignExists(supabase, campaignId),
    leadExists(supabase, leadId)
  ]);

  if (!hasCampaign) redirect('/campaigns?error=campaign-not-found');
  if (!hasLead) redirect(`/campaigns/${campaignId}?error=lead-not-found`);

  const { error } = await supabase
    .from('campaign_leads')
    .upsert({ campaign_id: campaignId, lead_id: leadId }, { onConflict: 'campaign_id,lead_id' });

  if (error) redirect(`/campaigns/${campaignId}?error=lead-add-failed`);

  await supabase.from('lead_interactions').insert({
    lead_id: leadId,
    type: 'note',
    channel: 'Hutka',
    text: 'Контакт добавлен в маркетинговую кампанию',
    result: 'campaign_attached'
  });

  revalidatePath('/campaigns');
  revalidatePath(`/campaigns/${campaignId}`);
  revalidatePath(`/people/${leadId}`);
  redirect(`/campaigns/${campaignId}`);
}

export async function updateCampaignResultAction(formData: FormData) {
  await requirePermission('manageCampaigns', '/campaigns?error=forbidden');
  const campaignId = getText(formData, 'campaign_id');
  if (!campaignId) redirect('/campaigns');

  if (!isSupabaseConfigured()) {
    redirect(`/campaigns/${campaignId}?result=demo`);
  }

  const supabase = await createClient();
  if (!(await campaignExists(supabase, campaignId))) redirect('/campaigns?error=campaign-not-found');

  const { error } = await supabase
    .from('campaigns')
    .update({
      status: campaignStatusToDb[getText(formData, 'status')] ?? 'active',
      result_notes: getText(formData, 'result_notes') || null,
      end_date: getText(formData, 'end_date') || null
    })
    .eq('id', campaignId);

  if (error) redirect(`/campaigns/${campaignId}?error=result-save-failed`);

  revalidatePath('/campaigns');
  revalidatePath(`/campaigns/${campaignId}`);
  revalidatePath('/dashboard');
  redirect(`/campaigns/${campaignId}`);
}

export async function deleteCampaignAction(formData: FormData) {
  await requirePermission('manageCampaigns', '/campaigns?error=forbidden');
  const campaignId = getText(formData, 'campaign_id');
  if (!campaignId) redirect('/campaigns?error=missing-campaign');

  if (!isSupabaseConfigured()) {
    redirect('/campaigns?deleted=demo');
  }

  const supabase = await createClient();
  if (!(await campaignExists(supabase, campaignId))) redirect('/campaigns?error=campaign-not-found');

  const { error } = await supabase.from('campaigns').delete().eq('id', campaignId);
  if (error) redirect(`/campaigns/${campaignId}?error=delete-failed`);

  revalidatePath('/campaigns');
  revalidatePath('/dashboard');
  revalidatePath('/reports');
  redirect('/campaigns?deleted=campaign');
}
