'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { after } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { createServiceClient, isSupabaseServiceConfigured } from '@/lib/supabase/service';
import { requirePermission } from '@/lib/permissions';
import { recordActivityLog, writeActivityLog } from '@/lib/activity-log';
import {
  answerLength,
  getLimitedText,
  getLimitedValues,
  hasPublicFormHoneypot,
  publicFormLimits
} from '@/lib/public-form-validation';
import type { SurveyQuestion } from '@/lib/surveys';

function getText(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

function normalizeSlug(value: string) {
  const translit: Record<string, string> = {
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya'
  };

  const source = value.toLowerCase().trim();
  const latin = source
    .split('')
    .map((char) => translit[char] ?? char)
    .join('');

  return latin
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || `survey-${Date.now()}`;
}

const allowedQuestionTypes = new Set([
  'short_text',
  'long_text',
  'single_choice',
  'multiple_choice',
  'yes_no',
  'rating',
  'number'
]);

const choiceQuestionTypes = new Set(['single_choice', 'multiple_choice']);

function normalizeQuestionType(value: string) {
  return allowedQuestionTypes.has(value) ? value : 'short_text';
}

function parseOptions(value: string) {
  return value
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getOptionsForQuestion(type: string, rawOptions: string) {
  if (choiceQuestionTypes.has(type)) {
    const options = parseOptions(rawOptions);
    return options.length > 0 ? options : ['Вариант 1', 'Вариант 2'];
  }

  if (type === 'yes_no') return ['Да', 'Нет'];

  return [];
}


async function ensureUniqueSlug(supabase: Awaited<ReturnType<typeof createClient>>, baseSlug: string) {
  let slug = baseSlug;
  let counter = 2;

  while (true) {
    const { data } = await supabase.from('surveys').select('id').eq('slug', slug).maybeSingle();
    if (!data?.id) return slug;
    slug = `${baseSlug}-${counter}`;
    counter += 1;
  }
}

function getQuestionPayloads(formData: FormData) {
  const result: Array<{
    question_text: string;
    question_type: string;
    options: string[];
    required: boolean;
    order_index: number;
  }> = [];

  const questionIndexes = Array.from(formData.keys())
    .map((key) => key.match(/^question_text_(\d+)$/)?.[1])
    .filter((value): value is string => Boolean(value))
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);

  for (const index of questionIndexes) {
    const text = getText(formData, `question_text_${index}`);
    if (!text) continue;

    const questionType = normalizeQuestionType(getText(formData, `question_type_${index}`));

    result.push({
      question_text: text,
      question_type: questionType,
      options: getOptionsForQuestion(questionType, getText(formData, `question_options_${index}`)),
      required: getText(formData, `question_required_${index}`) === 'on',
      order_index: result.length + 1
    });
  }

  return result;
}

export async function createSurveyAction(formData: FormData) {
  const user = await requirePermission('manageSurveys', '/surveys?error=forbidden');
  const title = getText(formData, 'title');
  if (!title) redirect('/surveys/new?error=missing-title');

  if (!isSupabaseConfigured()) {
    redirect('/surveys?created=demo');
  }

  const supabase = await createClient();
  const baseSlug = normalizeSlug(getText(formData, 'slug') || title);
  const slug = await ensureUniqueSlug(supabase, baseSlug);
  const status = getText(formData, 'status') === 'active' ? 'active' : 'draft';

  const { data: survey, error } = await supabase
    .from('surveys')
    .insert({
      title,
      type: getText(formData, 'type') || 'Мастера',
      description: getText(formData, 'description') || null,
      status,
      slug
    })
    .select('id')
    .single();

  if (error || !survey) redirect('/surveys/new?error=save-failed');

  const questions = getQuestionPayloads(formData).map((question) => ({ ...question, survey_id: survey.id }));
  if (questions.length > 0) {
    const { error: questionsError } = await supabase.from('survey_questions').insert(questions);
    if (questionsError) redirect(`/surveys/${survey.id}?error=questions-save-failed`);
  }

  await recordActivityLog({
    userId: user.profileId,
    action: 'создал анкету',
    entityType: 'survey',
    entityId: String(survey.id),
    entityTitle: title,
    details: { questions: questions.length, status }
  });

  revalidatePath('/surveys');
  redirect(`/surveys/${survey.id}`);
}

export type SurveyQuestionMutationInput = {
  surveyId: string;
  text: string;
  type: string;
  options: string[];
  required: boolean;
  orderIndex?: number;
};

export type SurveyQuestionMutationResult = {
  ok: boolean;
  error?: string;
  question?: SurveyQuestion;
};

async function addSurveyQuestionCore(
  input: SurveyQuestionMutationInput,
  userId?: string | null,
  shouldRevalidate = false
): Promise<SurveyQuestionMutationResult> {
  const surveyId = input.surveyId.trim();
  const text = input.text.trim();
  if (!surveyId) return { ok: false, error: 'missing-survey' };
  if (!text) return { ok: false, error: 'missing-question' };

  const questionType = normalizeQuestionType(input.type.trim());
  const options = getOptionsForQuestion(questionType, input.options.join('\n'));
  if (!isSupabaseConfigured()) {
    return {
      ok: true,
      question: {
        id: `demo-question-${Date.now()}`,
        text,
        type: questionType,
        options,
        required: input.required,
        orderIndex: Number.isFinite(input.orderIndex) ? Number(input.orderIndex) : 1
      }
    };
  }

  const supabase = await createClient();
  const requestedOrder = Number.isFinite(input.orderIndex) && Number(input.orderIndex) > 0
    ? Math.floor(Number(input.orderIndex))
    : null;
  const countResult = requestedOrder
    ? null
    : await supabase
      .from('survey_questions')
      .select('id', { count: 'exact', head: true })
      .eq('survey_id', surveyId);

  const orderIndex = requestedOrder ?? ((countResult?.count ?? 0) + 1);
  const { data, error } = await supabase
    .from('survey_questions')
    .insert({
      survey_id: surveyId,
      question_text: text,
      question_type: questionType,
      options,
      required: input.required,
      order_index: orderIndex
    })
    .select('id,question_text,question_type,options,required,order_index')
    .single();

  if (error || !data) {
    return { ok: false, error: error?.code === '23503' ? 'survey-not-found' : 'question-save-failed' };
  }

  after(async () => {
    try {
      await writeActivityLog({
        userId,
        action: 'создал вопрос анкеты',
        entityType: 'survey_question',
        entityId: String(data.id),
        entityTitle: text,
        details: { survey_id: surveyId, question_type: questionType }
      });
    } catch {
      // Основной вопрос уже сохранен; служебный лог не должен задерживать интерфейс.
    }
  });

  if (shouldRevalidate) {
    revalidatePath('/surveys');
    revalidatePath(`/surveys/${surveyId}`);
  }

  return {
    ok: true,
    question: {
      id: String(data.id),
      text: String(data.question_text ?? text),
      type: String(data.question_type ?? questionType),
      options: Array.isArray(data.options) ? data.options.map(String) : options,
      required: Boolean(data.required),
      orderIndex: Number(data.order_index ?? orderIndex)
    }
  };
}

export async function addSurveyQuestionMutationAction(
  input: SurveyQuestionMutationInput
): Promise<SurveyQuestionMutationResult> {
  const user = await requirePermission('manageSurveys', '/surveys?error=forbidden');
  return addSurveyQuestionCore(input, user.profileId);
}

export async function addSurveyQuestionAction(formData: FormData) {
  const user = await requirePermission('manageSurveys', '/surveys?error=forbidden');
  const surveyId = getText(formData, 'survey_id');
  const result = await addSurveyQuestionCore({
    surveyId,
    text: getText(formData, 'question_text'),
    type: getText(formData, 'question_type'),
    options: parseOptions(getText(formData, 'question_options')),
    required: getText(formData, 'required') === 'on'
  }, user.profileId, true);

  if (!result.ok) {
    if (result.error === 'missing-survey') redirect('/surveys');
    if (result.error === 'survey-not-found') redirect('/surveys?error=survey-not-found');
    redirect(`/surveys/${surveyId}?error=${result.error ?? 'question-save-failed'}`);
  }
  redirect(`/surveys/${surveyId}`);
}

export async function submitSurveyResponseAction(formData: FormData) {
  const surveyId = getText(formData, 'survey_id');
  const slug = getText(formData, 'slug');
  if (!surveyId || !slug) redirect('/login');

  if (hasPublicFormHoneypot(formData)) {
    redirect(`/s/${slug}?submitted=1`);
  }

  if (!isSupabaseConfigured()) {
    redirect(`/s/${slug}?submitted=demo`);
  }

  if (!isSupabaseServiceConfigured()) {
    redirect(`/s/${slug}?error=config`);
  }

  const supabase = createServiceClient();
  const { data: survey, error: surveyError } = await supabase
    .from('surveys')
    .select('id,slug,status')
    .eq('id', surveyId)
    .eq('slug', slug)
    .eq('status', 'active')
    .maybeSingle();

  if (surveyError || !survey) {
    redirect(`/s/${slug}?error=not-active`);
  }

  const { data: questions, error: questionsError } = await supabase
    .from('survey_questions')
    .select('id,question_type,required')
    .eq('survey_id', surveyId)
    .order('order_index', { ascending: true });

  if (questionsError || !questions?.length) {
    redirect(`/s/${slug}?error=questions-not-found`);
  }

  const responseGroupId = crypto.randomUUID();
  const respondentName = getLimitedText(formData, 'respondent_name', publicFormLimits.respondentName);
  const respondentContact = getLimitedText(formData, 'respondent_contact', publicFormLimits.respondentContact);

  if (respondentName === null || respondentContact === null) {
    redirect(`/s/${slug}?error=too-long`);
  }

  let totalAnswerLength = 0;

  const rows = questions
    .map((question) => {
      const questionId = String(question.id);
      const allValues = getLimitedValues(formData, `answer_${questionId}`);
      if (!allValues) redirect(`/s/${slug}?error=too-long`);

      const answer = question.question_type === 'multiple_choice' ? allValues : allValues[0] ?? '';
      const empty = Array.isArray(answer) ? answer.length === 0 : answer === '';

      if (question.required && empty) {
        redirect(`/s/${slug}?error=required`);
      }

      totalAnswerLength += answerLength(answer);
      if (totalAnswerLength > publicFormLimits.totalAnswerLength) {
        redirect(`/s/${slug}?error=too-long`);
      }

      return {
        survey_id: surveyId,
        question_id: questionId,
        response_group_id: responseGroupId,
        lead_id: null,
        respondent_name: respondentName || null,
        respondent_contact: respondentContact || null,
        answer
      };
    })
    .filter((row) => row.answer !== '' && !(Array.isArray(row.answer) && row.answer.length === 0));

  if (rows.length > 0) {
    const { error } = await supabase.from('survey_answers').insert(rows);
    if (error) redirect(`/s/${slug}?error=save-failed`);
  }

  after(async () => {
    try {
      await supabase.from('activity_logs').insert({
        user_id: null,
        action: 'получил ответ на анкету',
        entity_type: 'survey',
        entity_id: surveyId,
        entity_title: slug,
        details: {
          response_group_id: responseGroupId,
          answers: rows.length,
          respondent_name: respondentName || null,
          respondent_contact: respondentContact || null
        }
      });
    } catch {
      // Ответ уже сохранен; служебный лог не должен задерживать или ломать публичную форму.
    }
  });

  revalidatePath('/surveys');
  revalidatePath(`/s/${slug}`);
  redirect(`/s/${slug}?submitted=1`);
}

export async function deleteSurveyAction(formData: FormData) {
  const surveyId = getText(formData, 'survey_id');
  const confirmation = getText(formData, 'confirmation');
  const result = await deleteSurveyMutation(surveyId, confirmation);
  if (!result.ok) {
    if (result.error === 'missing-survey' || result.error === 'survey-not-found') redirect('/surveys?error=survey-not-found');
    redirect(`/surveys/${surveyId}?error=${result.error ?? 'delete-failed'}`);
  }
  revalidatePath('/surveys');
  revalidatePath('/dashboard');
  revalidatePath('/reports');
  redirect('/surveys?deleted=survey');
}

export type SurveyMetadataMutationInput = {
  id: string;
  title: string;
  type: string;
  description?: string;
  status: string;
};

export type SurveyMetadataMutationResult = {
  ok: boolean;
  error?: 'demo' | 'missing-survey' | 'title-required' | 'update-failed' | 'delete-failed' | 'survey-not-found' | 'confirmation-required';
  item?: {
    title: string;
    type: string;
    description?: string;
    status: 'draft' | 'active' | 'archived';
  };
};

export async function updateSurveyMetadataMutation(input: SurveyMetadataMutationInput): Promise<SurveyMetadataMutationResult> {
  const user = await requirePermission('manageSurveys', '/surveys?error=forbidden');
  const surveyId = input.id.trim();
  const title = input.title.trim();
  if (!surveyId) return { ok: false, error: 'missing-survey' };
  if (!title) return { ok: false, error: 'title-required' };
  if (!isSupabaseConfigured()) return { ok: false, error: 'demo' };

  const status = ['draft', 'active', 'archived'].includes(input.status)
    ? input.status as 'draft' | 'active' | 'archived'
    : 'draft';
  const type = input.type.trim() || 'Общий';
  const description = input.description?.trim() || '';
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('surveys')
    .update({
      title,
      type,
      description: description || null,
      status
    })
    .eq('id', surveyId)
    .select('id,title,type,description,status')
    .maybeSingle();

  if (error) return { ok: false, error: 'update-failed' };
  if (!data?.id) return { ok: false, error: 'survey-not-found' };

  await recordActivityLog({
    userId: user.profileId,
    action: 'изменил анкету',
    entityType: 'survey',
    entityId: surveyId,
    entityTitle: title,
    details: { status, type }
  });
  return {
    ok: true,
    item: {
      title: String(data.title ?? title),
      type: String(data.type ?? type),
      description: data.description ? String(data.description) : undefined,
      status: String(data.status ?? status) as 'draft' | 'active' | 'archived'
    }
  };
}

export async function deleteSurveyMutation(surveyIdValue: string, confirmation: string): Promise<SurveyMetadataMutationResult> {
  const user = await requirePermission('manageSurveys', '/surveys?error=forbidden');
  const surveyId = surveyIdValue.trim();
  if (!surveyId) return { ok: false, error: 'missing-survey' };
  if (confirmation !== 'УДАЛИТЬ') return { ok: false, error: 'confirmation-required' };
  if (!isSupabaseConfigured()) return { ok: false, error: 'demo' };

  const supabase = await createClient();
  const { data: survey, error } = await supabase
    .from('surveys')
    .delete()
    .eq('id', surveyId)
    .select('id,title')
    .maybeSingle();
  if (error) return { ok: false, error: 'delete-failed' };
  if (!survey?.id) return { ok: false, error: 'survey-not-found' };

  await recordActivityLog({
    userId: user.profileId,
    action: 'удалил анкету',
    entityType: 'survey',
    entityId: surveyId,
    entityTitle: String(survey.title ?? 'Анкета')
  });

  return { ok: true };
}

async function deleteSurveyQuestionCore(
  surveyIdValue: string,
  questionIdValue: string,
  userId?: string | null,
  shouldRevalidate = false
): Promise<SurveyQuestionMutationResult> {
  const surveyId = surveyIdValue.trim();
  const questionId = questionIdValue.trim();
  if (!surveyId || !questionId) return { ok: false, error: 'missing-question' };
  if (!isSupabaseConfigured()) return { ok: true };

  const supabase = await createClient();
  const { data: question, error } = await supabase
    .from('survey_questions')
    .delete()
    .eq('id', questionId)
    .eq('survey_id', surveyId)
    .select('id,question_text')
    .maybeSingle();

  if (error) return { ok: false, error: 'question-delete-failed' };
  if (!question?.id) return { ok: false, error: 'question-not-found' };

  after(async () => {
    try {
      await writeActivityLog({
        userId,
        action: 'удалил вопрос анкеты',
        entityType: 'survey_question',
        entityId: questionId,
        entityTitle: String(question.question_text ?? 'Вопрос анкеты'),
        details: { survey_id: surveyId }
      });
    } catch {
      // Основной вопрос уже удален; служебный лог не должен задерживать интерфейс.
    }
  });

  if (shouldRevalidate) {
    revalidatePath('/surveys');
    revalidatePath(`/surveys/${surveyId}`);
  }
  return { ok: true };
}

export async function deleteSurveyQuestionMutationAction(input: {
  surveyId: string;
  questionId: string;
}): Promise<SurveyQuestionMutationResult> {
  const user = await requirePermission('manageSurveys', '/surveys?error=forbidden');
  return deleteSurveyQuestionCore(input.surveyId, input.questionId, user.profileId);
}

export async function deleteSurveyQuestionAction(formData: FormData) {
  const user = await requirePermission('manageSurveys', '/surveys?error=forbidden');
  const surveyId = getText(formData, 'survey_id');
  const result = await deleteSurveyQuestionCore(
    surveyId,
    getText(formData, 'question_id'),
    user.profileId,
    true
  );

  if (!result.ok) {
    if (result.error === 'missing-question') redirect('/surveys?error=missing-question');
    redirect(`/surveys/${surveyId}?error=${result.error ?? 'question-delete-failed'}`);
  }
  redirect(`/surveys/${surveyId}?deleted=question`);
}
