import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ items: [] }, { headers: { 'Cache-Control': 'no-store' } });
  }

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const queryText = (request.nextUrl.searchParams.get('q') ?? '').trim().slice(0, 100);
  const campaignId = (request.nextUrl.searchParams.get('excludeCampaignId') ?? '').trim();
  let query = supabase
    .from('leads')
    .select('id,name')
    .order('name', { ascending: true })
    .limit(200);

  if (queryText) {
    query = query.ilike('name', `%${queryText}%`);
  }

  const { data, error } = await query;
  if (error || !data) {
    return NextResponse.json({ items: [] }, { headers: { 'Cache-Control': 'no-store' } });
  }

  let excluded = new Set<string>();
  if (campaignId && data.length > 0) {
    const { data: links } = await supabase
      .from('campaign_leads')
      .select('lead_id')
      .eq('campaign_id', campaignId)
      .in('lead_id', data.map((lead) => String(lead.id)));
    excluded = new Set((links ?? []).map((link) => String(link.lead_id)));
  }

  const items = data
    .filter((lead) => !excluded.has(String(lead.id)))
    .slice(0, 30)
    .map((lead) => ({ id: String(lead.id), name: String(lead.name) }));

  return NextResponse.json({ items }, { headers: { 'Cache-Control': 'no-store' } });
}
