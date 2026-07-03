'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createServiceClient, isSupabaseServiceConfigured } from '@/lib/supabase/service';
import { requireAdmin } from '@/lib/permissions';

function getText(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

async function clearTables(supabase: ReturnType<typeof createServiceClient>, tables: string[]) {
  for (const table of tables) {
    const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}

const workTables = [
  'notification_reads',
  'saved_lead_views',
  'import_logs',
  'tasks',
  'hypotheses',
  'insights',
  'campaigns',
  'surveys',
  'leads'
];

const directoryTables = [
  'question_packs',
  'message_templates',
  'refusal_reasons',
  'tags',
  'sources',
  'funnel_stages'
];

export async function resetWorkspaceDataAction(formData: FormData) {
  await requireAdmin('/settings?error=forbidden');
  const mode = getText(formData, 'mode') || 'work';
  const confirmation = getText(formData, 'confirmation');

  if (confirmation !== 'ОЧИСТИТЬ') {
    redirect('/settings/data-cleanup?error=confirmation');
  }

  if (!isSupabaseServiceConfigured()) {
    redirect('/settings/data-cleanup?demo=1');
  }

  const supabase = createServiceClient();

  try {
    await clearTables(supabase, workTables);

    if (mode === 'full') {
      await clearTables(supabase, directoryTables);
    }
  } catch (error) {
    console.error(error);
    redirect('/settings/data-cleanup?error=cleanup-failed');
  }

  [
    '/dashboard', '/people', '/funnels', '/tasks', '/surveys', '/campaigns', '/insights',
    '/hypotheses', '/reports', '/geography', '/followups', '/notifications', '/settings'
  ].forEach((path) => revalidatePath(path));

  redirect(`/settings/data-cleanup?success=${mode}`);
}
