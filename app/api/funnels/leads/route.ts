import { NextRequest, NextResponse } from 'next/server';
import { getFunnelStagePage } from '@/lib/funnels';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function integerParam(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.floor(parsed) : fallback;
}

export async function GET(request: NextRequest) {
  const stage = (request.nextUrl.searchParams.get('stage') ?? '').trim().slice(0, 100);
  const campaignId = (request.nextUrl.searchParams.get('campaignId') ?? '').trim();
  const offset = Math.max(integerParam(request.nextUrl.searchParams.get('offset'), 0), 0);
  const limit = Math.min(Math.max(integerParam(request.nextUrl.searchParams.get('limit'), 40), 1), 100);

  if (!stage || (campaignId && !uuidPattern.test(campaignId))) {
    return NextResponse.json({ error: 'invalid-request' }, { status: 400 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ items: [], total: 0 }, { headers: { 'Cache-Control': 'no-store' } });
  }

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const page = await getFunnelStagePage(stage, campaignId || undefined, offset, limit);
  return NextResponse.json(
    { items: page.leads, total: page.total },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
