import { NextResponse } from 'next/server';
import { getFollowUpRecommendations } from '@/lib/followups';
import { sendWorkspaceTelegramNotification } from '@/lib/telegram';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const secret = url.searchParams.get('secret') || request.headers.get('x-hutka-secret') || '';
  const expected = process.env.TELEGRAM_DIGEST_SECRET || '';

  if (!expected || secret !== expected) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const followups = await getFollowUpRecommendations();
  const focus = followups.recommendations[0];

  const result = await sendWorkspaceTelegramNotification({
    title: 'ежедневный дайджест',
    text: [
      `Follow-up рекомендаций: ${followups.summary.total}`,
      `Срочных: ${followups.summary.urgent}`,
      `Просроченных: ${followups.summary.overdue}`,
      `Анкет без ответа: ${followups.summary.questionnaires}`,
      focus ? `Главный фокус: ${focus.leadName} — ${focus.title}` : 'Критичных follow-up сейчас нет.'
    ].join('\n'),
    href: '/followups'
  });

  return NextResponse.json(result, { status: result.failed > 0 ? 400 : 200 });
}
