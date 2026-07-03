import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';

export type LeadQuestionnaireStatus = 'draft' | 'active' | 'closed';

export type LeadQuestionnaireQuestion = {
  id: string;
  text: string;
  type: string;
  options: string[];
  required: boolean;
  orderIndex: number;
};

export type LeadQuestionnaireAnswerGroup = {
  id: string;
  respondentName?: string;
  respondentContact?: string;
  createdAt: string;
  answers: Array<{
    question: string;
    answer: string;
  }>;
};

export type LeadQuestionnaireListItem = {
  id: string;
  leadId: string;
  leadName?: string;
  title: string;
  description?: string;
  status: LeadQuestionnaireStatus;
  token: string;
  publicUrl: string;
  questionsCount: number;
  responsesCount: number;
  createdAt: string;
};

export type LeadQuestionnaireDetail = LeadQuestionnaireListItem & {
  questions: LeadQuestionnaireQuestion[];
  responses: LeadQuestionnaireAnswerGroup[];
};

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function parseOptions(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((item) => String(item)).filter(Boolean);
  if (typeof value === 'string') {
    try {
      return parseOptions(JSON.parse(value) as unknown);
    } catch {
      return value.split(',').map((item) => item.trim()).filter(Boolean);
    }
  }
  return [];
}

function answerToText(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (Array.isArray(value)) return value.map((item) => String(item)).join(', ') || '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function publicUrl(token: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '');
  return appUrl ? `${appUrl}/q/${token}` : `/q/${token}`;
}

function relatedLeadName(value: unknown): string | undefined {
  if (!value) return undefined;
  if (Array.isArray(value)) return relatedLeadName(value[0]);
  if (typeof value === 'object' && 'name' in value) {
    const name = (value as { name?: unknown }).name;
    return typeof name === 'string' ? name : undefined;
  }
  return undefined;
}

function mapQuestion(row: Record<string, unknown>): LeadQuestionnaireQuestion {
  return {
    id: String(row.id),
    text: String(row.question_text ?? 'Вопрос'),
    type: String(row.question_type ?? 'short_text'),
    options: parseOptions(row.options),
    required: Boolean(row.required),
    orderIndex: typeof row.order_index === 'number' ? row.order_index : Number(row.order_index ?? 0)
  };
}

function statusFrom(value: unknown): LeadQuestionnaireStatus {
  const status = String(value ?? 'active') as LeadQuestionnaireStatus;
  return ['draft', 'active', 'closed'].includes(status) ? status : 'active';
}

function countRelation(value: unknown) {
  return Array.isArray(value) ? value.length : 0;
}

function mapListItem(row: Record<string, unknown>): LeadQuestionnaireListItem {
  const token = String(row.token ?? row.id);
  const questionsCount = typeof row.questions_count === 'number' ? row.questions_count : countRelation(row.lead_questionnaire_questions);
  const responsesCount = typeof row.responses_count === 'number' ? row.responses_count : countRelation(row.lead_questionnaire_answers);

  return {
    id: String(row.id),
    leadId: String(row.lead_id ?? ''),
    leadName: relatedLeadName(row.leads),
    title: String(row.title ?? 'Персональная анкета'),
    description: row.description ? String(row.description) : undefined,
    status: statusFrom(row.status),
    token,
    publicUrl: publicUrl(token),
    questionsCount,
    responsesCount,
    createdAt: formatDateTime(row.created_at ? String(row.created_at) : null)
  };
}

export function questionnaireStatusLabel(status: LeadQuestionnaireStatus) {
  const map: Record<LeadQuestionnaireStatus, string> = {
    draft: 'Черновик',
    active: 'Активна',
    closed: 'Закрыта'
  };
  return map[status];
}

export function leadQuestionTypeLabel(type: string) {
  const map: Record<string, string> = {
    short_text: 'Короткий ответ',
    long_text: 'Развернутый ответ',
    single_choice: 'Один вариант',
    multiple_choice: 'Несколько вариантов',
    yes_no: 'Да / нет',
    number: 'Число',
    rating: 'Оценка'
  };
  return map[type] ?? type;
}

export async function getLeadQuestionnaires(leadId: string): Promise<LeadQuestionnaireListItem[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('lead_questionnaires')
    .select('id,lead_id,title,description,status,token,created_at,lead_questionnaire_questions(id),lead_questionnaire_answers(id)')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return data.map((row) => mapListItem(row as Record<string, unknown>));
}

export async function getLeadQuestionnaireById(id: string): Promise<LeadQuestionnaireDetail | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const { data: formRow, error } = await supabase
    .from('lead_questionnaires')
    .select('id,lead_id,title,description,status,token,created_at,leads(name)')
    .eq('id', id)
    .maybeSingle();

  if (error || !formRow) return null;

  const [{ data: questionRows }, { data: answerRows }] = await Promise.all([
    supabase
      .from('lead_questionnaire_questions')
      .select('id,question_text,question_type,options,required,order_index')
      .eq('questionnaire_id', id)
      .order('order_index', { ascending: true }),
    supabase
      .from('lead_questionnaire_answers')
      .select('id,response_group_id,respondent_name,respondent_contact,answer,created_at,lead_questionnaire_questions(question_text)')
      .eq('questionnaire_id', id)
      .order('created_at', { ascending: false })
  ]);

  const questions = (questionRows ?? []).map((row) => mapQuestion(row as Record<string, unknown>));
  const groups = new Map<string, LeadQuestionnaireAnswerGroup>();

  for (const raw of answerRows ?? []) {
    const row = raw as Record<string, unknown>;
    const groupId = String(row.response_group_id ?? row.created_at ?? row.id);
    const questionRow = row.lead_questionnaire_questions;
    const question = relatedQuestionText(questionRow) ?? 'Вопрос';
    const current = groups.get(groupId) ?? {
      id: groupId,
      respondentName: row.respondent_name ? String(row.respondent_name) : undefined,
      respondentContact: row.respondent_contact ? String(row.respondent_contact) : undefined,
      createdAt: formatDateTime(row.created_at ? String(row.created_at) : null),
      answers: []
    };
    current.answers.push({ question, answer: answerToText(row.answer) });
    groups.set(groupId, current);
  }

  const responses = Array.from(groups.values());
  const base = mapListItem(formRow as Record<string, unknown>);
  return {
    ...base,
    questionsCount: questions.length,
    responsesCount: responses.length,
    questions,
    responses
  };
}

function relatedQuestionText(value: unknown): string | undefined {
  if (!value) return undefined;
  if (Array.isArray(value)) return relatedQuestionText(value[0]);
  if (typeof value === 'object' && 'question_text' in value) {
    const text = (value as { question_text?: unknown }).question_text;
    return typeof text === 'string' ? text : undefined;
  }
  return undefined;
}

export async function getLeadQuestionnaireByToken(token: string): Promise<LeadQuestionnaireDetail | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const { data: formRow, error } = await supabase
    .from('lead_questionnaires')
    .select('id,lead_id,title,description,status,token,created_at')
    .eq('token', token)
    .eq('status', 'active')
    .maybeSingle();

  if (error || !formRow) return null;

  const { data: questionRows } = await supabase
    .from('lead_questionnaire_questions')
    .select('id,question_text,question_type,options,required,order_index')
    .eq('questionnaire_id', formRow.id)
    .order('order_index', { ascending: true });

  const questions = (questionRows ?? []).map((row) => mapQuestion(row as Record<string, unknown>));
  const base = mapListItem(formRow as Record<string, unknown>);
  return {
    ...base,
    questionsCount: questions.length,
    questions,
    responses: []
  };
}

export type LeadQuestionnaireResponseGroup = LeadQuestionnaireAnswerGroup & {
  questionnaireTitle: string;
  questionnaireId: string;
  questionnaireUrl: string;
};

export async function getLeadQuestionnaireResponses(leadId: string): Promise<LeadQuestionnaireResponseGroup[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('lead_questionnaire_answers')
    .select('id,response_group_id,respondent_name,respondent_contact,answer,created_at,lead_questionnaires(id,title,token),lead_questionnaire_questions(question_text)')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  const groups = new Map<string, LeadQuestionnaireResponseGroup>();
  for (const item of data) {
    const row = item as Record<string, unknown>;
    const questionnaire = relatedQuestionnaire(row.lead_questionnaires);
    const questionnaireId = questionnaire?.id ?? 'unknown';
    const token = questionnaire?.token ?? '';
    const groupId = String(row.response_group_id ?? row.created_at ?? row.id);
    const key = `${questionnaireId}:${groupId}`;
    const current = groups.get(key) ?? {
      id: key,
      questionnaireTitle: questionnaire?.title ?? 'Персональная анкета',
      questionnaireId,
      questionnaireUrl: token ? publicUrl(token) : '',
      respondentName: row.respondent_name ? String(row.respondent_name) : undefined,
      respondentContact: row.respondent_contact ? String(row.respondent_contact) : undefined,
      createdAt: formatDateTime(row.created_at ? String(row.created_at) : null),
      answers: []
    };
    current.answers.push({
      question: relatedQuestionText(row.lead_questionnaire_questions) ?? 'Вопрос',
      answer: answerToText(row.answer)
    });
    groups.set(key, current);
  }

  return Array.from(groups.values());
}

function relatedQuestionnaire(value: unknown): { id: string; title: string; token: string } | undefined {
  if (!value) return undefined;
  if (Array.isArray(value)) return relatedQuestionnaire(value[0]);
  if (typeof value === 'object') {
    const row = value as { id?: unknown; title?: unknown; token?: unknown };
    return {
      id: String(row.id ?? ''),
      title: String(row.title ?? 'Персональная анкета'),
      token: String(row.token ?? '')
    };
  }
  return undefined;
}
