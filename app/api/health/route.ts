import { NextResponse } from 'next/server';
import { getProductionReadiness } from '@/lib/production';
import { isSupabaseConfigured } from '@/lib/supabase/config';

export const dynamic = 'force-dynamic';

export async function GET() {
  const readiness = getProductionReadiness();
  const healthy = readiness.errors === 0 && readiness.blockers.length === 0;

  return NextResponse.json({
    ok: healthy,
    status: healthy ? 'healthy' : 'needs_attention',
    app: readiness.appName,
    version: readiness.appVersion,
    next: readiness.nextVersion,
    generatedAt: readiness.generatedAt,
    readinessScore: readiness.score,
    supabaseConfigured: isSupabaseConfigured(),
    blockers: readiness.blockers.map((check) => ({
      id: check.id,
      status: check.status,
      title: check.title
    })),
    checks: readiness.checks.map((check) => ({
      id: check.id,
      status: check.status,
      title: check.title
    }))
  });
}
