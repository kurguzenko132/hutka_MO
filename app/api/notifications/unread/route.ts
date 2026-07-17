import { NextResponse } from 'next/server';
import { getUnreadNotificationCount } from '@/lib/notifications';
import { getCurrentUserContext } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUserContext();
  if (!user) {
    return NextResponse.json({ unread: 0 }, { status: 401 });
  }

  const unread = await getUnreadNotificationCount();
  return NextResponse.json({ unread }, {
    headers: { 'Cache-Control': 'private, no-store, max-age=0' }
  });
}
