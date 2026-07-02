import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/permissions';
import { createClient } from '@/lib/supabase/server';

const backupTables = [
  'app_settings',
  'profiles',
  'sources',
  'funnel_stages',
  'tags',
  'leads',
  'lead_tags',
  'lead_interactions',
  'tasks',
  'surveys',
  'survey_questions',
  'survey_answers',
  'campaigns',
  'campaign_leads',
  'insights',
  'insight_leads',
  'insight_campaigns',
  'insight_surveys',
  'hypotheses',
  'hypothesis_leads',
  'hypothesis_insights',
  'hypothesis_campaigns',
  'hypothesis_surveys',
  'import_logs',
  'notification_reads'
] as const;

export async function GET() {
  const user = await requireAdmin('/dashboard?error=admin-only');
  const supabase = await createClient();
  const exportedAt = new Date().toISOString();
  const data: Record<string, unknown> = {};
  const errors: Record<string, string> = {};

  for (const table of backupTables) {
    const { data: rows, error } = await supabase.from(table).select('*').limit(10000);
    if (error) {
      errors[table] = error.message;
      data[table] = [];
    } else {
      data[table] = rows ?? [];
    }
  }

  const payload = {
    meta: {
      product: 'Hutka',
      type: 'workspace-backup',
      exportedAt,
      exportedBy: user.email,
      version: 'step-27-launch-readiness',
      note: 'JSON backup for operational recovery and manual inspection. Restore should be performed carefully through Supabase SQL/API.'
    },
    errors,
    data
  };

  const fileDate = exportedAt.slice(0, 10);

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="hutka-backup-${fileDate}.json"`,
      'Cache-Control': 'no-store'
    }
  });
}
