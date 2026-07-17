'use server';

import { randomBytes } from 'crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { after } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { createServiceClient, isSupabaseServiceConfigured } from '@/lib/supabase/service';
import { requirePermission } from '@/lib/permissions';
import { getQuestionPackById } from '@/lib/question-packs';
import { queueWorkspaceTelegramNotification } from '@/lib/telegram';
import { recordActivityLog } from '@/lib/activity-log';
import type { LeadQuestionnaireListItem } from '@/lib/lead-questionnaires';
import { buildAppUrl } from '@/lib/app-url';
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

function parseOptions(value: string) {
  return value
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getQuestionPayloads(formData: FormData) {
  const questions: Array<{
    question_text: string;
    question_type: string;
    options: string[];
    required: boolean;
    order_index: number;
  }> = [];

  for (let index = 1; index <= 10; index += 1) {
    const text = getText(formData, `lead_question_text_${index}`);
    if (!text) continue;

    questions.push({
      question_text: text,
      question_type: getText(formData, `lead_question_type_${index}`) || 'short_text',
      options: parseOptions(getText(formData, `lead_question_options_${index}`)),
      required: getText(formData, `lead_question_required_${index}`) === 'on',
      order_index: questions.length + 1
    });
  }

  return questions;
}

async function createUniqueToken(supabase: Awaited<ReturnType<typeof createClient>>) {
  for (let index = 0; index < 10; index += 1) {
    const token = randomBytes(9).toString('base64url');
    const { data } = await supabase.from('lead_questionnaires').select('id').eq('token', token).maybeSingle();
    if (!data?.id) return token;
  }
  return `${Date.now()}-${randomBytes(4).toString('hex')}`;
}

export type LeadQuestionnaireMutationQuestion = {
  text: string;
  type: string;
  options?: string[];
  required?: boolean;
};

export type LeadQuestionnaireMutationResult = {
  ok: boolean;
  error?: string;
  questionnaire?: LeadQuestionnaireListItem;
};

type CreateLeadQuestionnaireCoreInput = {
  leadId: string;
  title?: string;
  description?: string;
  questions: LeadQuestionnaireMutationQuestion[];
  sourceTitle?: string;
  source?: 'question_pack' | 'manual';
};

function questionnairePublicUrl(token: string) {
  return buildAppUrl(`/q/${token}`);
}

function questionnaireCreatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Только что';
  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

type AtomicQuestionnaireCreateResult =
  | { status: 'success'; questionnaire: LeadQuestionnaireListItem }
  | { status: 'business-error'; error: string }
  | { status: 'unavailable' }
  | { status: 'failed' };

function isMissingAtomicQuestionnaireCreate(error: { code?: string; message?: string; details?: string } | null) {
  if (!error) return false;
  if (error.code === 'PGRST202' || error.code === '42883') return true;
  const message = `${error.message ?? ''} ${error.details ?? ''}`.toLowerCase();
  return message.includes('create_lead_questionnaire_with_questions') && (
    message.includes('could not find')
    || message.includes('does not exist')
    || message.includes('schema cache')
  );
}

async function createLeadQuestionnaireRpc(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: {
    leadId: string;
    title?: string;
    description?: string;
    questions: Array<{ text: string; type: string; options: string[]; required: boolean }>;
    source?: 'question_pack' | 'manual';
    sourceTitle?: string;
    actorProfileId: string | null;
  }
): Promise<AtomicQuestionnaireCreateResult> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const token = randomBytes(9).toString('base64url');
    const publicUrl = questionnairePublicUrl(token);
    const { data, error } = await supabase.rpc('create_lead_questionnaire_with_questions', {
      p_lead_id: input.leadId,
      p_title: input.title?.trim() || null,
      p_description: input.description?.trim() || null,
      p_token: token,
      p_public_url: publicUrl,
      p_source: input.source ?? 'manual',
      p_source_title: input.sourceTitle?.trim() || null,
      p_questions: input.questions,
      p_actor_profile_id: input.actorProfileId
    });

    if (error) {
      if (isMissingAtomicQuestionnaireCreate(error)) return { status: 'unavailable' };
      if (error.code === '23505' && attempt === 0) continue;
      return { status: 'failed' };
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return { status: 'failed' };
    }

    const result = data as Record<string, unknown>;
    if (result.ok === false && typeof result.error === 'string') {
      return { status: 'business-error', error: result.error };
    }
    if (
      result.ok !== true
      || typeof result.questionnaire_id !== 'string'
      || typeof result.lead_id !== 'string'
      || typeof result.title !== 'string'
      || typeof result.token !== 'string'
    ) {
      return { status: 'failed' };
    }

    return {
      status: 'success',
      questionnaire: {
        id: result.questionnaire_id,
        leadId: result.lead_id,
        leadName: typeof result.lead_name === 'string' ? result.lead_name : 'Контакт',
        title: result.title,
        description: typeof result.description === 'string' ? result.description : undefined,
        status: 'active',
        token: result.token,
        publicUrl,
        questionsCount: Number(result.questions_count ?? input.questions.length),
        responsesCount: 0,
        createdAt: questionnaireCreatedAt(String(result.created_at ?? new Date().toISOString()))
      }
    };
  }

  return { status: 'failed' };
}

async function createLeadQuestionnaireCore(
  input: CreateLeadQuestionnaireCoreInput,
  userId?: string | null,
  shouldRevalidate = false
): Promise<LeadQuestionnaireMutationResult> {
  const leadId = input.leadId.trim();
  const questions = input.questions
    .map((question) => ({
      text: question.text.trim(),
      type: question.type.trim() || 'short_text',
      options: (question.options ?? []).map((option) => option.trim()).filter(Boolean),
      required: Boolean(question.required)
    }))
    .filter((question) => question.text);

  if (!leadId) return { ok: false, error: 'missing-contact' };
  if (questions.length === 0) return { ok: false, error: 'questions-required' };

  if (!isSupabaseConfigured()) {
    const token = `demo-${Date.now()}`;
    const title = input.title?.trim() || 'Вопросы для контакта';
    return {
      ok: true,
      questionnaire: {
        id: token,
        leadId,
        title,
        description: input.description?.trim() || undefined,
        status: 'active',
        token,
        publicUrl: questionnairePublicUrl(token),
        questionsCount: questions.length,
        responsesCount: 0,
        createdAt: 'Только что'
      }
    };
  }

  const supabase = await createClient();
  const atomicResult = await createLeadQuestionnaireRpc(supabase, {
    leadId,
    title: input.title,
    description: input.description,
    questions,
    source: input.source,
    sourceTitle: input.sourceTitle,
    actorProfileId: userId ?? null
  });
  if (atomicResult.status === 'success') {
    if (shouldRevalidate) {
      revalidatePath(`/people/${leadId}`);
      revalidatePath('/notifications');
    }
    return { ok: true, questionnaire: atomicResult.questionnaire };
  }
  if (atomicResult.status === 'business-error') {
    return { ok: false, error: atomicResult.error };
  }
  if (atomicResult.status === 'failed') {
    return { ok: false, error: 'questionnaire-save-failed' };
  }

  const { data: lead, error: leadError } = await supabase.from('leads').select('id,name').eq('id', leadId).maybeSingle();
  if (leadError || !lead?.id) return { ok: false, error: 'contact-not-found' };

  const title = input.title?.trim() || `Вопросы для ${lead.name ?? 'контакта'}`;
  const description = input.description?.trim() || null;
  const token = await createUniqueToken(supabase);

  const { data: questionnaire, error } = await supabase
    .from('lead_questionnaires')
    .insert({
      lead_id: lead.id,
      title,
      description,
      status: 'active',
      token
    })
    .select('id,lead_id,title,description,status,token,created_at')
    .single();

  if (error || !questionnaire) return { ok: false, error: 'questionnaire-save-failed' };

  const { error: questionsError } = await supabase.from('lead_questionnaire_questions').insert(
    questions.map((question, index) => ({
      questionnaire_id: questionnaire.id,
      question_text: question.text,
      question_type: question.type,
      options: question.options,
      required: question.required,
      order_index: index + 1
    }))
  );

  if (questionsError) {
    await supabase.from('lead_questionnaires').delete().eq('id', questionnaire.id);
    return { ok: false, error: 'questionnaire-questions-save-failed' };
  }

  const link = questionnairePublicUrl(String(questionnaire.token));
  const interactionText = input.source === 'question_pack'
    ? `Созданы вопросы для контакта из готового набора «${input.sourceTitle ?? title}»: ${link}`
    : `Созданы вопросы для контакта «${title}»: ${link}`;

  await Promise.all([
    supabase.from('lead_interactions').insert({
      lead_id: lead.id,
      type: 'survey_sent',
      channel: 'Hutka',
      text: interactionText,
      result: input.source === 'question_pack' ? 'lead_questionnaire_pack_created' : 'lead_questionnaire_created',
      created_by: userId || null
    }),
    recordActivityLog({
      userId,
      action: 'создал анкету',
      entityType: 'lead_questionnaire',
      entityId: String(questionnaire.id),
      entityTitle: title,
      details: {
        lead_id: String(lead.id),
        source: input.source ?? 'manual',
        questions: questions.length
      }
    })
  ]);

  if (shouldRevalidate) {
    revalidatePath(`/people/${lead.id}`);
    revalidatePath('/notifications');
  }

  return {
    ok: true,
    questionnaire: {
      id: String(questionnaire.id),
      leadId: String(questionnaire.lead_id),
      leadName: String(lead.name ?? 'Контакт'),
      title: String(questionnaire.title),
      description: questionnaire.description ? String(questionnaire.description) : undefined,
      status: 'active',
      token: String(questionnaire.token),
      publicUrl: link,
      questionsCount: questions.length,
      responsesCount: 0,
      createdAt: questionnaireCreatedAt(String(questionnaire.created_at))
    }
  };
}

async function createLeadQuestionnaireFromPackCore(
  input: { leadId: string; packId: string; title?: string; description?: string },
  userId?: string | null,
  shouldRevalidate = false
): Promise<LeadQuestionnaireMutationResult> {
  const leadId = input.leadId.trim();
  const packId = input.packId.trim();
  if (!leadId) return { ok: false, error: 'missing-contact' };
  if (!packId) return { ok: false, error: 'question-pack-not-found' };

  const pack = await getQuestionPackById(packId);
  if (!pack) return { ok: false, error: 'question-pack-not-found' };
  if (pack.questions.length === 0) return { ok: false, error: 'question-pack-empty' };

  return createLeadQuestionnaireCore({
    leadId,
    title: input.title?.trim() || pack.shortTitle,
    description: input.description?.trim() || pack.description,
    source: 'question_pack',
    sourceTitle: pack.title,
    questions: pack.questions.map((question) => ({
      text: question.text,
      type: question.type,
      options: question.options,
      required: question.required
    }))
  }, userId, shouldRevalidate);
}

export async function createLeadQuestionnaireFromPackMutationAction(input: {
  leadId: string;
  packId: string;
}): Promise<LeadQuestionnaireMutationResult> {
  const user = await requirePermission('manageContacts', '/people?error=forbidden');
  return createLeadQuestionnaireFromPackCore(input, user.profileId);
}

export async function createLeadQuestionnaireMutationAction(input: {
  leadId: string;
  title?: string;
  description?: string;
  questions: LeadQuestionnaireMutationQuestion[];
}): Promise<LeadQuestionnaireMutationResult> {
  const user = await requirePermission('manageContacts', '/people?error=forbidden');
  return createLeadQuestionnaireCore({
    ...input,
    source: 'manual'
  }, user.profileId);
}

export async function createLeadQuestionnaireFromPackAction(formData: FormData) {
  const user = await requirePermission('manageContacts', '/people?error=forbidden');
  const leadId = getText(formData, 'lead_id');
  const result = await createLeadQuestionnaireFromPackCore({
    leadId,
    packId: getText(formData, 'pack_id'),
    title: getText(formData, 'title'),
    description: getText(formData, 'description')
  }, user.profileId, true);

  if (!result.ok) {
    if (result.error === 'missing-contact') redirect('/people?error=missing-contact');
    if (result.error === 'contact-not-found') redirect('/people?error=contact-not-found');
    redirect(`/people/${leadId}?error=${result.error ?? 'questionnaire-pack-save-failed'}`);
  }
  redirect(`/people/${leadId}?questionnaire=pack-created`);
}

export async function createLeadQuestionnaireAction(formData: FormData) {
  const user = await requirePermission('manageContacts', '/people?error=forbidden');
  const leadId = getText(formData, 'lead_id');
  const result = await createLeadQuestionnaireCore({
    leadId,
    title: getText(formData, 'title'),
    description: getText(formData, 'description'),
    source: 'manual',
    questions: getQuestionPayloads(formData).map((question) => ({
      text: question.question_text,
      type: question.question_type,
      options: question.options,
      required: question.required
    }))
  }, user.profileId, true);

  if (!result.ok) {
    if (result.error === 'missing-contact') redirect('/people?error=missing-contact');
    if (result.error === 'contact-not-found') redirect('/people?error=contact-not-found');
    redirect(`/people/${leadId}?error=${result.error ?? 'questionnaire-save-failed'}`);
  }
  redirect(`/people/${leadId}?questionnaire=created`);
}

export async function submitLeadQuestionnaireAction(formData: FormData) {
  const questionnaireId = getText(formData, 'questionnaire_id');
  const token = getText(formData, 'token');
  if (!questionnaireId || !token) redirect('/?error=bad-questionnaire');

  if (hasPublicFormHoneypot(formData)) {
    redirect(`/q/${token}?submitted=1`);
  }

  if (!isSupabaseConfigured()) {
    redirect(`/q/${token}?submitted=1`);
  }

  if (!isSupabaseServiceConfigured()) {
    redirect(`/q/${token}?error=config`);
  }

  const supabase = createServiceClient();
  const { data: questionnaire, error: questionnaireError } = await supabase
    .from('lead_questionnaires')
    .select('id,lead_id,title,status')
    .eq('id', questionnaireId)
    .eq('token', token)
    .eq('status', 'active')
    .maybeSingle();

  if (questionnaireError || !questionnaire) {
    redirect(`/q/${token}?error=not-active`);
  }

  const { data: questions, error: questionsError } = await supabase
    .from('lead_questionnaire_questions')
    .select('id,question_text,question_type,required')
    .eq('questionnaire_id', questionnaireId)
    .order('order_index', { ascending: true });

  if (questionsError || !questions?.length) redirect(`/q/${token}?error=questions-not-found`);

  const responseGroupId = crypto.randomUUID();
  const respondentName = getLimitedText(formData, 'respondent_name', publicFormLimits.respondentName);
  const respondentContact = getLimitedText(formData, 'respondent_contact', publicFormLimits.respondentContact);

  if (respondentName === null || respondentContact === null) {
    redirect(`/q/${token}?error=too-long`);
  }

  const resolvedLeadId = questionnaire.lead_id ? String(questionnaire.lead_id) : null;
  const answerRows = [];
  let totalAnswerLength = 0;

  for (const question of questions) {
    const key = `answer_${question.id}`;
    const allValues = getLimitedValues(formData, key);
    if (!allValues) redirect(`/q/${token}?error=too-long`);

    const answer = question.question_type === 'multiple_choice' ? allValues : allValues[0] ?? '';
    const empty = Array.isArray(answer) ? answer.length === 0 : answer === '';

    if (question.required && empty) {
      redirect(`/q/${token}?error=required`);
    }

    totalAnswerLength += answerLength(answer);
    if (totalAnswerLength > publicFormLimits.totalAnswerLength) {
      redirect(`/q/${token}?error=too-long`);
    }

    if (empty) continue;

    answerRows.push({
      questionnaire_id: questionnaireId,
      question_id: question.id,
      lead_id: resolvedLeadId,
      response_group_id: responseGroupId,
      respondent_name: respondentName || null,
      respondent_contact: respondentContact || null,
      answer
    });
  }

  if (answerRows.length > 0) {
    const { error } = await supabase.from('lead_questionnaire_answers').insert(answerRows);
    if (error) redirect(`/q/${token}?error=save-failed`);
  }

  after(async () => {
    try {
      await Promise.all([
        supabase.from('activity_logs').insert({
          user_id: null,
          action: 'получил ответ на анкету',
          entity_type: 'lead_questionnaire',
          entity_id: questionnaireId,
          entity_title: questionnaire.title ?? 'Вопросы для контакта',
          details: {
            lead_id: resolvedLeadId,
            response_group_id: responseGroupId,
            answers: answerRows.length,
            respondent_name: respondentName || null,
            respondent_contact: respondentContact || null
          }
        }),
        resolvedLeadId
          ? supabase.from('lead_interactions').insert({
              lead_id: resolvedLeadId,
              type: 'survey_completed',
              channel: 'Персональная ссылка',
              text: `Получены ответы на вопросы для контакта «${questionnaire.title ?? 'Вопросы'}»`,
              result: 'lead_questionnaire_completed'
            })
          : Promise.resolve()
      ]);
    } catch {
      // Ответ уже сохранен; история и служебный лог выполняются в фоне.
    }
  });

  if (resolvedLeadId) {
    queueWorkspaceTelegramNotification(async () => {
      const { data: leadRow } = await supabase
        .from('leads')
        .select('name,niche,city')
        .eq('id', resolvedLeadId)
        .maybeSingle();

      return {
        eventType: 'lead_questionnaire_response',
        title: 'новый ответ на анкету',
        text: `${leadRow?.name ?? 'Контакт'} ответил(а) на вопросы для контакта «${questionnaire.title ?? 'Вопросы'}».`,
        href: `/people/${resolvedLeadId}`,
        extraLines: [
          respondentName ? `Имя в форме: ${respondentName}` : '',
          respondentContact ? `Контакт в форме: ${respondentContact}` : '',
          leadRow?.niche ? `Ниша: ${leadRow.niche}` : '',
          leadRow?.city ? `Город: ${leadRow.city}` : ''
        ].filter((line): line is string => Boolean(line))
      };
    });
  }

  if (resolvedLeadId) revalidatePath(`/people/${resolvedLeadId}`);
  revalidatePath('/notifications');
  redirect(`/q/${token}?submitted=1`);
}

async function deleteLeadQuestionnaireCore(
  input: { questionnaireId: string; leadId?: string; confirmation: string },
  userId?: string | null,
  shouldRevalidate = false
): Promise<LeadQuestionnaireMutationResult> {
  const questionnaireId = input.questionnaireId.trim();
  const fallbackLeadId = input.leadId?.trim() ?? '';
  if (!questionnaireId) return { ok: false, error: 'missing-questionnaire' };
  if (input.confirmation.trim() !== 'УДАЛИТЬ') return { ok: false, error: 'confirmation-required' };
  if (!isSupabaseConfigured()) return { ok: true };

  const supabase = await createClient();
  const { data: questionnaire, error } = await supabase
    .from('lead_questionnaires')
    .delete()
    .eq('id', questionnaireId)
    .select('id,lead_id,title')
    .maybeSingle();

  if (error) return { ok: false, error: 'questionnaire-delete-failed' };
  if (!questionnaire?.id || !questionnaire.lead_id) return { ok: false, error: 'questionnaire-not-found' };

  const leadId = String(questionnaire.lead_id);
  await Promise.all([
    supabase.from('lead_interactions').insert({
      lead_id: leadId,
      type: 'note',
      channel: 'Hutka',
      text: 'Вопросы для контакта удалены',
      result: 'lead_questionnaire_deleted',
      created_by: userId || null
    }),
    recordActivityLog({
      userId,
      action: 'удалил анкету',
      entityType: 'lead_questionnaire',
      entityId: questionnaireId,
      entityTitle: String(questionnaire.title ?? 'Вопросы для контакта'),
      details: { lead_id: leadId }
    })
  ]);

  if (shouldRevalidate) {
    revalidatePath(`/people/${leadId || fallbackLeadId}`);
    revalidatePath('/notifications');
  }
  return { ok: true };
}

export async function deleteLeadQuestionnaireMutationAction(input: {
  questionnaireId: string;
  leadId?: string;
  confirmation: string;
}): Promise<LeadQuestionnaireMutationResult> {
  const user = await requirePermission('manageContacts', '/people?error=forbidden');
  return deleteLeadQuestionnaireCore(input, user.profileId);
}

export async function deleteLeadQuestionnaireAction(formData: FormData) {
  const user = await requirePermission('manageContacts', '/people?error=forbidden');
  const questionnaireId = getText(formData, 'questionnaire_id');
  const fallbackLeadId = getText(formData, 'lead_id');
  const result = await deleteLeadQuestionnaireCore({
    questionnaireId,
    leadId: fallbackLeadId,
    confirmation: getText(formData, 'confirmation')
  }, user.profileId, true);

  if (!result.ok) {
    if (result.error === 'missing-questionnaire') redirect('/people?error=missing-questionnaire');
    if (result.error === 'questionnaire-not-found') redirect('/people?error=questionnaire-not-found');
    redirect(fallbackLeadId
      ? `/people/${fallbackLeadId}?error=${result.error ?? 'questionnaire-delete-failed'}`
      : '/people?error=questionnaire-delete-failed');
  }
  redirect(`/people/${fallbackLeadId}?deleted=questionnaire`);
}
