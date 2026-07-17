'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { after } from 'next/server';
import { campaignStatusToDb, mapCampaignContact, type CampaignContact } from '@/lib/campaigns';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { requirePermission } from '@/lib/permissions';
import { recordActivityLog, writeActivityLog } from '@/lib/activity-log';
import { deferSideEffects } from '@/lib/deferred-side-effects';

function getText(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

export async function createCampaignAction(formData: FormData) {
  const user = await requirePermission('manageCampaigns', '/campaigns?error=forbidden');
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

  await recordActivityLog({
    userId: user.profileId,
    action: 'создал кампанию',
    entityType: 'campaign',
    entityId: String(data.id),
    entityTitle: name,
    details: { channel: getText(formData, 'channel') || null, status: campaignStatusToDb[getText(formData, 'status')] ?? 'draft' }
  });
  revalidatePath('/campaigns');
  revalidatePath('/funnels');
  revalidatePath('/dashboard');
  redirect(`/campaigns/${data.id}`);
}

export type CampaignContactMutationResult = {
  ok: boolean;
  error?: string;
  contact?: CampaignContact;
};

async function addLeadToCampaignCore(
  campaignId: string,
  leadId: string,
  userId?: string | null,
  shouldRevalidate = false
): Promise<CampaignContactMutationResult> {
  if (!campaignId) return { ok: false, error: 'missing-campaign' };
  if (!leadId) return { ok: false, error: 'missing-lead' };
  if (!isSupabaseConfigured()) return { ok: true };

  const supabase = await createClient();
  const [leadResult, relationResult] = await Promise.all([
    supabase
      .from('leads')
      .select('id,name,type,niche,city,priority_score,funnel_stages(name),sources(name)')
      .eq('id', leadId)
      .maybeSingle(),
    supabase
      .from('campaign_leads')
      .upsert({ campaign_id: campaignId, lead_id: leadId }, { onConflict: 'campaign_id,lead_id' })
  ]);

  if (leadResult.error || !leadResult.data?.id) return { ok: false, error: 'lead-not-found' };
  if (relationResult.error) {
    return { ok: false, error: relationResult.error.code === '23503' ? 'campaign-not-found' : 'lead-add-failed' };
  }

  deferSideEffects(
    async () => {
      await supabase.from('lead_interactions').insert({
        lead_id: leadId,
        type: 'note',
        channel: 'Hutka',
        text: 'Контакт добавлен в маркетинговую кампанию',
        result: 'campaign_attached'
      });
    },
    async () => writeActivityLog({
      userId,
      action: 'добавил контакт в кампанию',
      entityType: 'campaign',
      entityId: campaignId,
      entityTitle: 'Кампания',
      details: { lead_id: leadId }
    })
  );

  if (shouldRevalidate) {
    revalidatePath('/campaigns');
    revalidatePath(`/campaigns/${campaignId}`);
    revalidatePath(`/people/${leadId}`);
    revalidatePath('/funnels');
  }

  return {
    ok: true,
    contact: mapCampaignContact(leadResult.data as Record<string, unknown>)
  };
}

export async function addLeadToCampaignMutationAction(input: {
  campaignId: string;
  leadId: string;
}): Promise<CampaignContactMutationResult> {
  const user = await requirePermission('manageCampaigns', '/campaigns?error=forbidden');
  return addLeadToCampaignCore(input.campaignId.trim(), input.leadId.trim(), user.profileId);
}

export async function addLeadToCampaignAction(formData: FormData) {
  const user = await requirePermission('manageCampaigns', '/campaigns?error=forbidden');
  const campaignId = getText(formData, 'campaign_id');
  const result = await addLeadToCampaignCore(
    campaignId,
    getText(formData, 'lead_id'),
    user.profileId,
    true
  );

  if (!result.ok) {
    if (result.error === 'missing-campaign' || result.error === 'campaign-not-found') {
      redirect('/campaigns?error=campaign-not-found');
    }
    redirect(`/campaigns/${campaignId}?error=${result.error ?? 'lead-add-failed'}`);
  }
  redirect(`/campaigns/${campaignId}`);
}

async function removeLeadFromCampaignCore(
  campaignId: string,
  leadId: string,
  userId?: string | null,
  shouldRevalidate = false
): Promise<CampaignContactMutationResult> {
  if (!campaignId) return { ok: false, error: 'missing-campaign' };
  if (!leadId) return { ok: false, error: 'missing-lead' };
  if (!isSupabaseConfigured()) return { ok: true };

  const supabase = await createClient();
  const { error } = await supabase
    .from('campaign_leads')
    .delete()
    .eq('campaign_id', campaignId)
    .eq('lead_id', leadId);

  if (error) return { ok: false, error: 'lead-remove-failed' };

  deferSideEffects(
    async () => {
      await supabase.from('lead_interactions').insert({
        lead_id: leadId,
        type: 'note',
        channel: 'Hutka',
        text: 'Контакт убран из кампании',
        result: 'campaign_detached'
      });
    },
    async () => writeActivityLog({
      userId,
      action: 'убрал контакт из кампании',
      entityType: 'campaign',
      entityId: campaignId,
      entityTitle: 'Кампания',
      details: { lead_id: leadId }
    })
  );

  if (shouldRevalidate) {
    revalidatePath('/campaigns');
    revalidatePath(`/campaigns/${campaignId}`);
    revalidatePath(`/people/${leadId}`);
    revalidatePath('/funnels');
  }

  return { ok: true };
}

export async function removeLeadFromCampaignMutationAction(input: {
  campaignId: string;
  leadId: string;
}): Promise<CampaignContactMutationResult> {
  const user = await requirePermission('manageCampaigns', '/campaigns?error=forbidden');
  return removeLeadFromCampaignCore(input.campaignId.trim(), input.leadId.trim(), user.profileId);
}

export async function removeLeadFromCampaignAction(formData: FormData) {
  const user = await requirePermission('manageCampaigns', '/campaigns?error=forbidden');
  const campaignId = getText(formData, 'campaign_id');
  const result = await removeLeadFromCampaignCore(
    campaignId,
    getText(formData, 'lead_id'),
    user.profileId,
    true
  );

  if (!result.ok) {
    if (result.error === 'missing-campaign') redirect('/campaigns');
    redirect(`/campaigns/${campaignId}?error=${result.error ?? 'lead-remove-failed'}`);
  }
  redirect(`/campaigns/${campaignId}`);
}

export type CampaignResultMutationInput = {
  campaignId: string;
  status: string;
  resultNotes: string;
  endDate: string;
};

export type CampaignResultMutationResult = {
  ok: boolean;
  error?: string;
  status?: string;
};

async function updateCampaignResultCore(
  input: CampaignResultMutationInput,
  userId?: string | null,
  shouldRevalidate = false
): Promise<CampaignResultMutationResult> {
  const campaignId = input.campaignId.trim();
  if (!campaignId) return { ok: false, error: 'missing-campaign' };

  const status = campaignStatusToDb[input.status.trim()] ?? 'active';
  if (!isSupabaseConfigured()) return { ok: true, status };

  const supabase = await createClient();
  const { data: updatedCampaign, error } = await supabase
    .from('campaigns')
    .update({
      status,
      result_notes: input.resultNotes.trim() || null,
      end_date: input.endDate.trim() || null
    })
    .eq('id', campaignId)
    .select('id')
    .maybeSingle();

  if (error) return { ok: false, error: 'result-save-failed' };
  if (!updatedCampaign?.id) return { ok: false, error: 'campaign-not-found' };

  after(async () => {
    try {
      await writeActivityLog({
        userId,
        action: 'изменил кампанию',
        entityType: 'campaign',
        entityId: campaignId,
        entityTitle: 'Кампания',
        details: { status }
      });
    } catch {
      // Основное изменение уже сохранено; служебный лог не должен задерживать интерфейс.
    }
  });

  if (shouldRevalidate) {
    revalidatePath('/campaigns');
    revalidatePath(`/campaigns/${campaignId}`);
    revalidatePath('/funnels');
    revalidatePath('/dashboard');
  }

  return { ok: true, status };
}

export async function updateCampaignResultMutationAction(
  input: CampaignResultMutationInput
): Promise<CampaignResultMutationResult> {
  const user = await requirePermission('manageCampaigns', '/campaigns?error=forbidden');
  return updateCampaignResultCore(input, user.profileId);
}

export async function updateCampaignResultAction(formData: FormData) {
  const user = await requirePermission('manageCampaigns', '/campaigns?error=forbidden');
  const campaignId = getText(formData, 'campaign_id');
  const result = await updateCampaignResultCore({
    campaignId,
    status: getText(formData, 'status'),
    resultNotes: getText(formData, 'result_notes'),
    endDate: getText(formData, 'end_date')
  }, user.profileId, true);

  if (!result.ok) {
    if (result.error === 'missing-campaign') redirect('/campaigns');
    if (result.error === 'campaign-not-found') redirect('/campaigns?error=campaign-not-found');
    redirect(`/campaigns/${campaignId}?error=${result.error ?? 'result-save-failed'}`);
  }
  redirect(`/campaigns/${campaignId}`);
}

export async function deleteCampaignAction(formData: FormData) {
  const campaignId = getText(formData, 'campaign_id');
  const confirmation = getText(formData, 'confirmation');
  const result = await deleteCampaignMutation(campaignId, confirmation);
  if (!result.ok) {
    if (result.error === 'missing-campaign' || result.error === 'campaign-not-found') redirect('/campaigns?error=campaign-not-found');
    redirect(`/campaigns/${campaignId}?error=${result.error ?? 'delete-failed'}`);
  }
  revalidatePath('/campaigns');
  revalidatePath('/funnels');
  revalidatePath('/dashboard');
  revalidatePath('/reports');
  redirect('/campaigns?deleted=campaign');
}

export type CampaignMetadataMutationInput = {
  id: string;
  name: string;
  goal?: string;
  channel?: string;
  city?: string;
  niche?: string;
  budget?: number;
  offerText?: string;
  startDate?: string;
};

export type CampaignMetadataMutationResult = {
  ok: boolean;
  error?: 'demo' | 'missing-campaign' | 'name-required' | 'update-failed' | 'delete-failed' | 'campaign-not-found' | 'confirmation-required';
  item?: CampaignMetadataMutationInput;
};

export async function updateCampaignMetadataMutation(input: CampaignMetadataMutationInput): Promise<CampaignMetadataMutationResult> {
  const user = await requirePermission('manageCampaigns', '/campaigns?error=forbidden');
  const campaignId = input.id.trim();
  const name = input.name.trim();
  if (!campaignId) return { ok: false, error: 'missing-campaign' };
  if (!name) return { ok: false, error: 'name-required' };
  if (!isSupabaseConfigured()) return { ok: false, error: 'demo' };

  const goal = input.goal?.trim() || '';
  const channel = input.channel?.trim() || 'Не указан';
  const city = input.city?.trim() || '';
  const niche = input.niche?.trim() || '';
  const offerText = input.offerText?.trim() || '';
  const startDate = input.startDate?.trim() || '';
  const budget = Number.isFinite(input.budget) ? Math.max(0, Number(input.budget)) : 0;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('campaigns')
    .update({
      name,
      goal: goal || null,
      channel,
      city: city || null,
      niche: niche || null,
      budget,
      offer_text: offerText || null,
      start_date: startDate || null
    })
    .eq('id', campaignId)
    .select('id,name,goal,channel,city,niche,budget,offer_text,start_date')
    .maybeSingle();

  if (error) return { ok: false, error: 'update-failed' };
  if (!data?.id) return { ok: false, error: 'campaign-not-found' };
  await recordActivityLog({
    userId: user.profileId,
    action: 'изменил кампанию',
    entityType: 'campaign',
    entityId: campaignId,
    entityTitle: name,
    details: { channel, city: city || null, niche: niche || null }
  });
  return {
    ok: true,
    item: {
      id: campaignId,
      name: String(data.name ?? name),
      goal: data.goal ? String(data.goal) : undefined,
      channel: String(data.channel ?? channel),
      city: data.city ? String(data.city) : undefined,
      niche: data.niche ? String(data.niche) : undefined,
      budget: Number(data.budget ?? budget),
      offerText: data.offer_text ? String(data.offer_text) : undefined,
      startDate: data.start_date ? String(data.start_date) : undefined
    }
  };
}

export async function deleteCampaignMutation(campaignIdValue: string, confirmation: string): Promise<CampaignMetadataMutationResult> {
  const user = await requirePermission('manageCampaigns', '/campaigns?error=forbidden');
  const campaignId = campaignIdValue.trim();
  if (!campaignId) return { ok: false, error: 'missing-campaign' };
  if (confirmation !== 'УДАЛИТЬ') return { ok: false, error: 'confirmation-required' };
  if (!isSupabaseConfigured()) return { ok: false, error: 'demo' };

  const supabase = await createClient();
  const { data: campaign, error } = await supabase
    .from('campaigns')
    .delete()
    .eq('id', campaignId)
    .select('id,name')
    .maybeSingle();
  if (error) return { ok: false, error: 'delete-failed' };
  if (!campaign?.id) return { ok: false, error: 'campaign-not-found' };

  await recordActivityLog({
    userId: user.profileId,
    action: 'удалил кампанию',
    entityType: 'campaign',
    entityId: campaignId,
    entityTitle: String(campaign.name ?? 'Кампания')
  });
  return { ok: true };
}
