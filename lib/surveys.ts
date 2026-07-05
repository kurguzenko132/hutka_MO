import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { createServiceClient, isSupabaseServiceConfigured } from '@/lib/supabase/service';

export type SurveyStatus = 'draft' | 'active' | 'archived';

export type SurveyListItem = {
  id: string;
  title: string;
  type: string;
  description?: string;
  status: SurveyStatus;
  slug: string;
  answersCount: number;
  questionsCount: number;
  createdAt: string;
};

export type SurveyOption = {
  id: string;
  name: string;
  slug: string;
  status: SurveyStatus;
  publicUrl: string;
};

export type SurveyQuestion = {
  id: string;
  text: string;
  type: string;
  options: string[];
  required: boolean;
  orderIndex: number;
};

export type SurveyResponseGroup = {
  id: string;
  respondentName?: string;
  respondentContact?: string;
  createdAt: string;
  answers: Array<{
    question: string;
    answer: string;
  }>;
};

export type SurveyDetail = SurveyListItem & {
  questions: SurveyQuestion[];
  responses: SurveyResponseGroup[];
};

const demoSurveys: SurveyListItem[] = [
  {
    id: 'demo-masters',
    title: 'Анкета для мастеров',
    type: 'Мастера',
    description: 'Проверяем боли, текущую запись и готовность к тестированию.',
    status: 'active',
    slug: 'masters-research',
    answersCount: 84,
    questionsCount: 6,
    createdAt: '02.07.2026'
  },
  {
    id: 'demo-salons',
    title: 'Анкета для салонов',
    type: 'Салоны',
    description: 'Понимаем роли, расписание, CRM и барьеры перехода.',
    status: 'active',
    slug: 'salons-research',
    answersCount: 19,
    questionsCount: 7,
    createdAt: '02.07.2026'
  },
  {
    id: 'demo-clients',
    title: 'Анкета клиентов',
    type: 'Клиенты',
    description: 'Проверяем интерес к поиску мастера на карте.',
    status: 'draft',
    slug: 'clients-map',
    answersCount: 42,
    questionsCount: 5,
    createdAt: '02.07.2026'
  }
];

const demoQuestions: SurveyQuestion[] = [
  { id: 'q1', text: 'Как вы сейчас ведете запись?', type: 'long_text', options: [], required: true, orderIndex: 1 },
  { id: 'q2', text: 'Какая главная проблема сейчас?', type: 'long_text', options: [], required: true, orderIndex: 2 },
  { id: 'q3', text: 'Готовы ли протестировать карту мастеров?', type: 'yes_no', options: ['Да', 'Нет'], required: true, orderIndex: 3 },
  { id: 'q4', text: 'Что должно быть в приложении, чтобы вы реально им пользовались?', type: 'long_text', options: [], required: false, orderIndex: 4 }
];

export function statusLabel(status: SurveyStatus) {
  const map: Record<SurveyStatus, string> = {
    draft: 'Черновик',
    active: 'Активен',
    archived: 'Архив'
  };
  return map[status];
}

export function questionTypeLabel(type: string) {
  const map: Record<string, string> = {
    short_text: 'Короткий ответ',
    long_text: 'Длинный ответ',
    single_choice: 'Один вариант',
    multiple_choice: 'Несколько вариантов',
    number: 'Число',
    yes_no: 'Да / нет',
    rating: 'Оценка'
  };
  return map[type] ?? type;
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('ru-RU');
}

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function parseOptions(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((item) => String(item)).filter(Boolean);
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      return parseOptions(parsed);
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

function mapSurvey(row: Record<string, unknown>): SurveyListItem {
  const status = String(row.status ?? 'draft') as SurveyStatus;
  const questions = typeof row.questions_count === 'number' ? row.questions_count : Number(row.questions_count ?? 0);
  const answers = typeof row.answers_count === 'number' ? row.answers_count : Number(row.answers_count ?? 0);

  return {
    id: String(row.id),
    title: String(row.title ?? 'Без названия'),
    type: String(row.type ?? 'Общий'),
    description: row.description ? String(row.description) : undefined,
    status: ['draft', 'active', 'archived'].includes(status) ? status : 'draft',
    slug: String(row.slug ?? row.id),
    answersCount: Number.isFinite(answers) ? answers : 0,
    questionsCount: Number.isFinite(questions) ? questions : 0,
    createdAt: formatDate(row.created_at ? String(row.created_at) : null)
  };
}

function mapQuestion(row: Record<string, unknown>): SurveyQuestion {
  return {
    id: String(row.id),
    text: String(row.question_text ?? 'Вопрос'),
    type: String(row.question_type ?? 'short_text'),
    options: parseOptions(row.options),
    required: Boolean(row.required),
    orderIndex: typeof row.order_index === 'number' ? row.order_index : Number(row.order_index ?? 0)
  };
}

export function getPublicSurveyUrl(slug: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '');
  return appUrl ? `${appUrl}/s/${slug}` : `/s/${slug}`;
}

export async function getSurveys(): Promise<SurveyListItem[]> {
  if (!isSupabaseConfigured()) return demoSurveys;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('surveys')
    .select('id,title,type,description,status,slug,created_at,survey_questions(id),survey_answers(id)')
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  return data.map((row) => {
    const record = row as Record<string, unknown>;
    const questions = Array.isArray(record.survey_questions) ? record.survey_questions.length : 0;
    const answers = Array.isArray(record.survey_answers) ? record.survey_answers.length : 0;
    return mapSurvey({ ...record, questions_count: questions, answers_count: answers });
  });
}


export async function getSurveyOptions(): Promise<SurveyOption[]> {
  const surveys = await getSurveys();
  return surveys.map((survey) => ({
    id: survey.id,
    name: survey.title,
    slug: survey.slug,
    status: survey.status,
    publicUrl: getPublicSurveyUrl(survey.slug)
  }));
}

export async function getSurveyById(id: string): Promise<SurveyDetail | null> {
  if (!isSupabaseConfigured()) {
    const survey = demoSurveys.find((item) => item.id === id) ?? demoSurveys[0];
    return {
      ...survey,
      questions: demoQuestions,
      responses: [
        {
          id: 'demo-response-1',
          respondentName: 'Анна Смирнова',
          respondentContact: '@anna_nails',
          createdAt: '02.07.2026, 14:20',
          answers: [
            { question: 'Как вы сейчас ведете запись?', answer: 'В Instagram Direct и заметках' },
            { question: 'Какая главная проблема сейчас?', answer: 'Не хватает стабильного потока клиентов' }
          ]
        }
      ]
    };
  }

  const supabase = await createClient();
  const { data: surveyRow, error: surveyError } = await supabase
    .from('surveys')
    .select('id,title,type,description,status,slug,created_at')
    .eq('id', id)
    .maybeSingle();

  if (surveyError || !surveyRow) return null;

  const { data: questionRows } = await supabase
    .from('survey_questions')
    .select('id,question_text,question_type,options,required,order_index')
    .eq('survey_id', id)
    .order('order_index', { ascending: true });

  const { data: answerRows } = await supabase
    .from('survey_answers')
    .select('id,response_group_id,respondent_name,respondent_contact,answer,created_at,survey_questions(question_text)')
    .eq('survey_id', id)
    .order('created_at', { ascending: false });

  const questions = (questionRows ?? []).map((row) => mapQuestion(row as Record<string, unknown>));
  const groups = new Map<string, SurveyResponseGroup>();

  (answerRows ?? []).forEach((row) => {
    const record = row as Record<string, unknown>;
    const groupId = String(record.response_group_id ?? record.id);
    const questionObject = record.survey_questions as { question_text?: unknown } | { question_text?: unknown }[] | undefined;
    const questionText = Array.isArray(questionObject)
      ? String(questionObject[0]?.question_text ?? 'Вопрос')
      : String(questionObject?.question_text ?? 'Вопрос');

    if (!groups.has(groupId)) {
      groups.set(groupId, {
        id: groupId,
        respondentName: record.respondent_name ? String(record.respondent_name) : undefined,
        respondentContact: record.respondent_contact ? String(record.respondent_contact) : undefined,
        createdAt: formatDateTime(record.created_at ? String(record.created_at) : null),
        answers: []
      });
    }

    groups.get(groupId)?.answers.push({
      question: questionText,
      answer: answerToText(record.answer)
    });
  });

  const survey = mapSurvey({
    ...(surveyRow as Record<string, unknown>),
    questions_count: questions.length,
    answers_count: answerRows?.length ?? 0
  });

  return {
    ...survey,
    questions,
    responses: Array.from(groups.values())
  };
}

export async function getSurveyBySlug(slug: string): Promise<SurveyDetail | null> {
  if (!isSupabaseConfigured()) {
    const survey = demoSurveys.find((item) => item.slug === slug) ?? demoSurveys[0];
    return { ...survey, status: 'active', questions: demoQuestions, responses: [] };
  }

  if (!isSupabaseServiceConfigured()) return null;

  const supabase = createServiceClient();
  const { data: surveyRow, error } = await supabase
    .from('surveys')
    .select('id,title,type,description,status,slug,created_at')
    .eq('slug', slug)
    .eq('status', 'active')
    .maybeSingle();

  if (error || !surveyRow) return null;

  const { data: questionRows, error: questionsError } = await supabase
    .from('survey_questions')
    .select('id,question_text,question_type,options,required,order_index')
    .eq('survey_id', surveyRow.id)
    .order('order_index', { ascending: true });

  if (questionsError || !questionRows) return null;

  const questions = questionRows.map((row) => mapQuestion(row as Record<string, unknown>));
  const survey = mapSurvey({
    ...(surveyRow as Record<string, unknown>),
    questions_count: questions.length,
    answers_count: 0
  });

  return {
    ...survey,
    questions,
    responses: []
  };
}
