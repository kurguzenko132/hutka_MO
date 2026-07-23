import { requirePermission } from '@/lib/permissions';
import { createClient } from '@/lib/supabase/server';

function csvCell(value: unknown) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function answerText(value: unknown) {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.map(String).join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function answerRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requirePermission('manageSurveys', '/surveys?error=forbidden');
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: survey }, { data: questions }, { data: sessions }] = await Promise.all([
    supabase.from('surveys').select('id,title').eq('id', id).maybeSingle(),
    supabase.from('survey_questions').select('key,question_text,order_index').eq('survey_id', id).order('order_index'),
    supabase
      .from('survey_response_sessions')
      .select('id,lead_id,created_at,completed_at,answers')
      .eq('survey_id', id)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(5000)
  ]);

  if (!survey) return new Response('Анкета не найдена', { status: 404 });

  const leadIds = Array.from(new Set((sessions ?? []).map((item) => item.lead_id).filter((leadId): leadId is string => Boolean(leadId))));
  const { data: leads } = leadIds.length
    ? await supabase.from('leads').select('id,name,city,email,phone,telegram,instagram').in('id', leadIds)
    : { data: [] };
  const leadsById = new Map((leads ?? []).map((lead) => [String(lead.id), lead]));
  const questionColumns = (questions ?? []).map((question) => ({
    key: String(question.key ?? question.question_text),
    title: String(question.question_text ?? 'Вопрос')
  }));

  const header = ['Дата ответа', 'Контакт', 'Город', 'Email', 'Телефон', 'Telegram', 'Instagram', ...questionColumns.map((question) => question.title)];
  const rows = (sessions ?? []).map((session) => {
    const lead = session.lead_id ? leadsById.get(String(session.lead_id)) : undefined;
    const answers = answerRecord(session.answers);
    return [
      session.completed_at ?? session.created_at,
      lead?.name ?? '',
      lead?.city ?? '',
      lead?.email ?? '',
      lead?.phone ?? '',
      lead?.telegram ?? '',
      lead?.instagram ?? '',
      ...questionColumns.map((question) => answerText(answers[question.key]))
    ];
  });

  const csv = [header, ...rows].map((row) => row.map(csvCell).join(';')).join('\n');
  const safeTitle = String(survey.title ?? 'survey').replace(/[^a-z0-9а-яё_-]+/gi, '-').replace(/^-+|-+$/g, '') || 'survey';

  return new Response(`\uFEFF${csv}`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="hutka-${safeTitle}-responses.csv"`
    }
  });
}
