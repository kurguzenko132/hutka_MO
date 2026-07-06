'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { createServiceClient, isSupabaseServiceConfigured } from '@/lib/supabase/service';
import { requirePermission } from '@/lib/permissions';
import { recordActivityLog } from '@/lib/activity-log';
import {
  answerLength,
  getLimitedText,
  getLimitedValues,
  hasPublicFormHoneypot,
  publicFormLimits
} from '@/lib/public-form-validation';

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

function parseOptions(value: string) {
  return value
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
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

async function surveyExists(supabase: Awaited<ReturnType<typeof createClient>>, surveyId: string) {
  const { data, error } = await supabase.from('surveys').select('id').eq('id', surveyId).maybeSingle();
  return !error && Boolean(data?.id);
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

    result.push({
      question_text: text,
      question_type: getText(formData, `question_type_${index}`) || 'short_text',
      options: parseOptions(getText(formData, `question_options_${index}`)),
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

export async function addSurveyQuestionAction(formData: FormData) {
  await requirePermission('manageSurveys', '/surveys?error=forbidden');
  const surveyId = getText(formData, 'survey_id');
  const text = getText(formData, 'question_text');
  if (!surveyId) redirect('/surveys');
  if (!text) redirect(`/surveys/${surveyId}?error=missing-question`);

  if (!isSupabaseConfigured()) {
    redirect(`/surveys/${surveyId}?question=demo`);
  }

  const supabase = await createClient();
  if (!(await surveyExists(supabase, surveyId))) redirect('/surveys?error=survey-not-found');

  const { count } = await supabase
    .from('survey_questions')
    .select('id', { count: 'exact', head: true })
    .eq('survey_id', surveyId);

  const { error } = await supabase.from('survey_questions').insert({
    survey_id: surveyId,
    question_text: text,
    question_type: getText(formData, 'question_type') || 'short_text',
    options: parseOptions(getText(formData, 'question_options')),
    required: getText(formData, 'required') === 'on',
    order_index: (count ?? 0) + 1
  });

  if (error) redirect(`/surveys/${surveyId}?error=question-save-failed`);

  revalidatePath('/surveys');
  revalidatePath(`/surveys/${surveyId}`);
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

  revalidatePath('/surveys');
  revalidatePath(`/s/${slug}`);
  redirect(`/s/${slug}?submitted=1`);
}

export async function deleteSurveyAction(formData: FormData) {
  const user = await requirePermission('manageSurveys', '/surveys?error=forbidden');
  const surveyId = getText(formData, 'survey_id');
  const confirmation = getText(formData, 'confirmation');
  if (!surveyId) redirect('/surveys?error=missing-survey');
  if (confirmation !== 'УДАЛИТЬ') redirect(`/surveys/${surveyId}?error=confirmation-required`);

  if (!isSupabaseConfigured()) {
    redirect('/surveys?deleted=demo');
  }

  const supabase = await createClient();
  const { data: survey } = await supabase.from('surveys').select('id,title').eq('id', surveyId).maybeSingle();
  if (!survey?.id) redirect('/surveys?error=survey-not-found');

  const { error } = await supabase.from('surveys').delete().eq('id', surveyId);
  if (error) redirect(`/surveys/${surveyId}?error=delete-failed`);

  await recordActivityLog({
    userId: user.profileId,
    action: 'удалил анкету',
    entityType: 'survey',
    entityId: surveyId,
    entityTitle: String(survey.title ?? 'Анкета')
  });

  revalidatePath('/surveys');
  revalidatePath('/dashboard');
  revalidatePath('/reports');
  redirect('/surveys?deleted=survey');
}

export async function deleteSurveyQuestionAction(formData: FormData) {
  const user = await requirePermission('manageSurveys', '/surveys?error=forbidden');
  const surveyId = getText(formData, 'survey_id');
  const questionId = getText(formData, 'question_id');
  if (!surveyId || !questionId) redirect('/surveys?error=missing-question');

  if (!isSupabaseConfigured()) {
    redirect(`/surveys/${surveyId}?question=demo-delete`);
  }

  const supabase = await createClient();
  if (!(await surveyExists(supabase, surveyId))) redirect('/surveys?error=survey-not-found');

  const { data: question, error: questionError } = await supabase
    .from('survey_questions')
    .select('id,question_text')
    .eq('id', questionId)
    .eq('survey_id', surveyId)
    .maybeSingle();

  if (questionError || !question?.id) redirect(`/surveys/${surveyId}?error=question-not-found`);

  const { error } = await supabase.from('survey_questions').delete().eq('id', questionId).eq('survey_id', surveyId);
  if (error) redirect(`/surveys/${surveyId}?error=question-delete-failed`);

  await recordActivityLog({
    userId: user.profileId,
    action: 'удалил вопрос анкеты',
    entityType: 'survey_question',
    entityId: questionId,
    entityTitle: String(question.question_text ?? 'Вопрос анкеты'),
    details: { survey_id: surveyId }
  });

  revalidatePath('/surveys');
  revalidatePath(`/surveys/${surveyId}`);
  redirect(`/surveys/${surveyId}?deleted=question`);
}
