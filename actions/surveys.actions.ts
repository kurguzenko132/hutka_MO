'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { requirePermission } from '@/lib/permissions';

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

function getQuestionPayloads(formData: FormData) {
  const result: Array<{
    question_text: string;
    question_type: string;
    options: string[];
    required: boolean;
    order_index: number;
  }> = [];

  for (let index = 1; index <= 8; index += 1) {
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
  await requirePermission('manageSurveys', '/surveys?error=forbidden');
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

  if (!isSupabaseConfigured()) {
    redirect(`/s/${slug}?submitted=demo`);
  }

  const supabase = await createClient();
  const responseGroupId = crypto.randomUUID();
  const leadId = getText(formData, 'lead_id') || null;
  const respondentName = getText(formData, 'respondent_name') || null;
  const respondentContact = getText(formData, 'respondent_contact') || null;
  const questionIds = formData.getAll('question_id').map((value) => String(value));

  const rows = questionIds
    .map((questionId) => {
      const allValues = formData.getAll(`answer_${questionId}`).map((value) => String(value).trim()).filter(Boolean);
      const answer = allValues.length > 1 ? allValues : allValues[0] ?? '';
      return {
        survey_id: surveyId,
        question_id: questionId,
        response_group_id: responseGroupId,
        lead_id: leadId,
        respondent_name: respondentName,
        respondent_contact: respondentContact,
        answer
      };
    })
    .filter((row) => row.answer !== '' && !(Array.isArray(row.answer) && row.answer.length === 0));

  if (rows.length > 0) {
    const { error } = await supabase.from('survey_answers').insert(rows);
    if (error) redirect(`/s/${slug}?error=save-failed`);
  }

  revalidatePath('/surveys');
  if (leadId) revalidatePath(`/people/${leadId}`);
  revalidatePath(`/s/${slug}`);
  redirect(`/s/${slug}?submitted=1`);
}
