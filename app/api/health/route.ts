import { NextResponse } from 'next/server';
import { getProductionReadiness } from '@/lib/production';
import { isSupabaseConfigured } from '@/lib/supabase/config';

export const dynamic = 'force-dynamic';

export async function GET() {
  const readiness = getProductionReadiness();

  return NextResponse.json({
    ok: readiness.errors === 0,
    status: readiness.errors === 0 ? 'healthy' : 'needs_attention',
    app: readiness.appName,
    version: readiness.appVersion,
    next: readiness.nextVersion,
    generatedAt: readiness.generatedAt,
    readinessScore: readiness.score,
    supabaseConfigured: isSupabaseConfigured(),
    checks: readiness.checks.map((check) => ({
      id: check.id,
      status: check.status,
      title: check.title
    }))
  });
}
