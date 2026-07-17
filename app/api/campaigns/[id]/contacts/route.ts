import { NextRequest, NextResponse } from 'next/server';
import { getCampaignContactPage } from '@/lib/campaigns';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function integerParam(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.floor(parsed) : fallback;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!uuidPattern.test(id)) {
    return NextResponse.json({ error: 'invalid-campaign' }, { status: 400 });
  }

  const offset = Math.max(integerParam(request.nextUrl.searchParams.get('offset'), 0), 0);
  const limit = Math.min(Math.max(integerParam(request.nextUrl.searchParams.get('limit'), 40), 1), 100);

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ items: [], total: 0 }, { headers: { 'Cache-Control': 'no-store' } });
  }

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const page = await getCampaignContactPage(id, offset, limit);
  return NextResponse.json(
    { items: page.contacts, total: page.total },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
