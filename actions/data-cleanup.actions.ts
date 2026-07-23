'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createServiceClient, isSupabaseServiceConfigured } from '@/lib/supabase/service';
import { requireAdmin } from '@/lib/permissions';
import { directoryDataTables, workDataTables } from '@/lib/database-tables';

const cleanupKeyByTable: Record<string, string> = {
  telegram_delivery_logs: 'id',
  notification_reads: 'id',
  saved_lead_views: 'id',
  import_logs: 'id',
  lead_questionnaire_answers: 'id',
  lead_questionnaire_questions: 'id',
  lead_questionnaires: 'id',
  survey_answers: 'id',
  survey_questions: 'id',
  survey_lead_invites: 'id',
  hypothesis_leads: 'hypothesis_id',
  hypothesis_insights: 'hypothesis_id',
  hypothesis_campaigns: 'hypothesis_id',
  hypothesis_surveys: 'hypothesis_id',
  insight_leads: 'insight_id',
  insight_campaigns: 'insight_id',
  insight_surveys: 'insight_id',
  campaign_leads: 'campaign_id',
  lead_tags: 'lead_id',
  lead_interactions: 'id',
  task_assignees: 'task_id',
  tasks: 'id',
  hypotheses: 'id',
  insights: 'id',
  campaigns: 'id',
  surveys: 'id',
  leads: 'id',
  question_pack_questions: 'id',
  question_packs: 'id',
  message_templates: 'id',
  refusal_reasons: 'id',
  tags: 'id',
  sources: 'id',
  funnel_stages: 'id'
};

function getText(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

function isMissingCleanupRpc(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  return error.code === '42883'
    || error.code === 'PGRST202'
    || String(error.message ?? '').includes('reset_workspace_data');
}

function isMissingTable(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  return error.code === '42P01'
    || error.code === 'PGRST205'
    || String(error.message ?? '').includes('Could not find the table');
}

async function clearTables(supabase: ReturnType<typeof createServiceClient>, tables: string[]) {
  for (const table of tables) {
    const key = cleanupKeyByTable[table];
    if (!key) throw new Error(`Cleanup key is not configured for ${table}`);

    const { error } = await supabase.from(table).delete().not(key, 'is', null);
    if (isMissingTable(error)) continue;
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}

export async function resetWorkspaceDataAction(formData: FormData) {
  const user = await requireAdmin('/settings?error=forbidden');
  const mode = getText(formData, 'mode') || 'work';
  const confirmation = getText(formData, 'confirmation');

  if (confirmation !== 'ОЧИСТИТЬ') {
    redirect('/settings/data-cleanup?error=confirmation');
  }

  if (!isSupabaseServiceConfigured()) {
    redirect('/settings/data-cleanup?demo=1');
  }

  const supabase = createServiceClient();
  const normalizedMode = mode === 'full' ? 'full' : 'work';

  try {
    const rpcResult = await supabase.rpc('reset_workspace_data', {
      p_mode: normalizedMode,
      p_user_id: user.profileId
    });

    if (rpcResult.error && isMissingCleanupRpc(rpcResult.error)) {
      await clearTables(supabase, [...workDataTables]);

      if (normalizedMode === 'full') {
        await clearTables(supabase, [...directoryDataTables]);
      }

      const { error: logError } = await supabase.from('activity_logs').insert({
        user_id: user.profileId,
        action: 'очистил базу',
        entity_type: 'settings',
        entity_title: 'Очистка базы',
        details: { mode: normalizedMode, fallback: true }
      });
      if (logError) throw new Error(`activity_logs: ${logError.message}`);
    } else if (rpcResult.error) {
      throw new Error(rpcResult.error.message);
    }
  } catch (error) {
    console.error(error);
    redirect('/settings/data-cleanup?error=cleanup-failed');
  }

  [
    '/dashboard', '/people', '/funnels', '/tasks', '/surveys', '/campaigns', '/insights',
    '/hypotheses', '/reports', '/geography', '/followups', '/notifications', '/settings'
  ].forEach((path) => revalidatePath(path));

  redirect(`/settings/data-cleanup?success=${normalizedMode}`);
}
