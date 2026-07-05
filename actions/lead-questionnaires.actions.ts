'use server';

import { randomBytes } from 'crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { createServiceClient, isSupabaseServiceConfigured } from '@/lib/supabase/service';
import { requirePermission } from '@/lib/permissions';
import { getQuestionPackById } from '@/lib/question-packs';
import { sendWorkspaceTelegramNotification } from '@/lib/telegram';
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


export async function createLeadQuestionnaireFromPackAction(formData: FormData) {
  const user = await requirePermission('manageContacts', '/people?error=forbidden');

  const leadId = getText(formData, 'lead_id');
  const packId = getText(formData, 'pack_id');
  if (!leadId) redirect('/people?error=missing-contact');

  if (!isSupabaseConfigured()) {
    redirect(`/people/${leadId}?questionnaire=demo-pack`);
  }

  const supabase = await createClient();
  const { data: lead, error: leadError } = await supabase.from('leads').select('id,name').eq('id', leadId).maybeSingle();
  if (leadError || !lead?.id) redirect('/people?error=contact-not-found');

  const pack = await getQuestionPackById(packId);
  if (!pack) redirect(`/people/${lead.id}?error=question-pack-not-found`);
  if (pack.questions.length === 0) redirect(`/people/${lead.id}?error=question-pack-empty`);

  const title = getText(formData, 'title') || `${pack.shortTitle} · ${lead?.name ?? 'контакт'}`;
  const description = getText(formData, 'description') || pack.description;
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
    .select('id, token')
    .single();

  if (error || !questionnaire) {
    redirect(`/people/${lead.id}?error=questionnaire-pack-save-failed`);
  }

  const { error: questionsError } = await supabase.from('lead_questionnaire_questions').insert(
    pack.questions.map((question, index) => ({
      questionnaire_id: questionnaire.id,
      question_text: question.text,
      question_type: question.type,
      options: question.options ?? [],
      required: Boolean(question.required),
      order_index: index + 1
    }))
  );

  if (questionsError) {
    await supabase.from('lead_questionnaires').delete().eq('id', questionnaire.id);
    redirect(`/people/${lead.id}?error=questionnaire-questions-save-failed`);
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '');
  const link = `${appUrl ?? ''}/q/${questionnaire.token}`;

  await supabase.from('lead_interactions').insert({
    lead_id: lead.id,
    type: 'survey_sent',
    channel: 'Hutka',
    text: `Созданы вопросы для контакта из готового набора «${pack.title}»: ${link}`,
    result: 'lead_questionnaire_pack_created'
  });

  await recordActivityLog({
    userId: user.profileId,
    action: 'создал анкету',
    entityType: 'lead_questionnaire',
    entityId: String(questionnaire.id),
    entityTitle: title,
    details: { lead_id: String(lead.id), source: 'question_pack', questions: pack.questions.length }
  });

  revalidatePath(`/people/${lead.id}`);
  revalidatePath('/notifications');
  redirect(`/people/${lead.id}?questionnaire=pack-created`);
}

export async function createLeadQuestionnaireAction(formData: FormData) {
  const user = await requirePermission('manageContacts', '/people?error=forbidden');
  const leadId = getText(formData, 'lead_id');
  if (!leadId) redirect('/people?error=missing-contact');

  if (!isSupabaseConfigured()) {
    redirect(`/people/${leadId}?questionnaire=demo`);
  }

  const questions = getQuestionPayloads(formData);
  if (questions.length === 0) {
    redirect(`/people/${leadId}?error=questions-required`);
  }

  const supabase = await createClient();
  const { data: lead, error: leadError } = await supabase.from('leads').select('id,name').eq('id', leadId).maybeSingle();
  if (leadError || !lead?.id) redirect('/people?error=contact-not-found');

  const title = getText(formData, 'title') || `Вопросы для ${lead?.name ?? 'контакта'}`;
  const description = getText(formData, 'description') || null;
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
    .select('id, token')
    .single();

  if (error || !questionnaire) {
    redirect(`/people/${lead.id}?error=questionnaire-save-failed`);
  }

  const { error: questionsError } = await supabase.from('lead_questionnaire_questions').insert(
    questions.map((question) => ({
      questionnaire_id: questionnaire.id,
      ...question
    }))
  );

  if (questionsError) {
    await supabase.from('lead_questionnaires').delete().eq('id', questionnaire.id);
    redirect(`/people/${lead.id}?error=questionnaire-questions-save-failed`);
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '');
  const link = `${appUrl ?? ''}/q/${questionnaire.token}`;

  await supabase.from('lead_interactions').insert({
    lead_id: lead.id,
    type: 'survey_sent',
    channel: 'Hutka',
    text: `Созданы вопросы для контакта «${title}»: ${link}`,
    result: 'lead_questionnaire_created'
  });

  await recordActivityLog({
    userId: user.profileId,
    action: 'создал анкету',
    entityType: 'lead_questionnaire',
    entityId: String(questionnaire.id),
    entityTitle: title,
    details: { lead_id: String(lead.id), questions: questions.length }
  });

  revalidatePath(`/people/${lead.id}`);
  revalidatePath('/notifications');
  redirect(`/people/${lead.id}?questionnaire=created`);
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

  await supabase.from('activity_logs').insert({
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
  });

  if (resolvedLeadId) {
    await supabase.from('lead_interactions').insert({
      lead_id: resolvedLeadId,
      type: 'survey_completed',
      channel: 'Персональная ссылка',
      text: `Получены ответы на вопросы для контакта «${questionnaire.title ?? 'Вопросы'}»`,
      result: 'lead_questionnaire_completed'
    });
  }

  if (resolvedLeadId) {
    const { data: leadRow } = await supabase
      .from('leads')
      .select('name,niche,city')
      .eq('id', resolvedLeadId)
      .maybeSingle();

    await sendWorkspaceTelegramNotification({
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
    });
  }

  if (resolvedLeadId) revalidatePath(`/people/${resolvedLeadId}`);
  revalidatePath('/notifications');
  redirect(`/q/${token}?submitted=1`);
}

export async function deleteLeadQuestionnaireAction(formData: FormData) {
  const user = await requirePermission('manageContacts', '/people?error=forbidden');
  const questionnaireId = getText(formData, 'questionnaire_id');
  const fallbackLeadId = getText(formData, 'lead_id');
  const confirmation = getText(formData, 'confirmation');
  if (!questionnaireId) redirect('/people?error=missing-questionnaire');
  if (confirmation !== 'УДАЛИТЬ') {
    redirect(fallbackLeadId ? `/people/${fallbackLeadId}?error=confirmation-required` : '/people?error=confirmation-required');
  }

  if (!isSupabaseConfigured()) {
    if (!fallbackLeadId) redirect('/people?error=missing-questionnaire');
    redirect(`/people/${fallbackLeadId}?questionnaire=demo-delete`);
  }

  const supabase = await createClient();
  const { data: questionnaire, error: questionnaireError } = await supabase
    .from('lead_questionnaires')
    .select('id,lead_id,title')
    .eq('id', questionnaireId)
    .maybeSingle();

  if (questionnaireError || !questionnaire?.id || !questionnaire.lead_id) {
    redirect('/people?error=questionnaire-not-found');
  }

  const leadId = String(questionnaire.lead_id);
  const { error } = await supabase
    .from('lead_questionnaires')
    .delete()
    .eq('id', questionnaireId)
    .eq('lead_id', leadId);

  if (error) redirect(`/people/${leadId}?error=questionnaire-delete-failed`);

  await supabase.from('lead_interactions').insert({
    lead_id: leadId,
    type: 'note',
    channel: 'Hutka',
    text: 'Вопросы для контакта удалены',
    result: 'lead_questionnaire_deleted'
  });

  await recordActivityLog({
    userId: user.profileId,
    action: 'удалил анкету',
    entityType: 'lead_questionnaire',
    entityId: questionnaireId,
    entityTitle: String(questionnaire.title ?? 'Вопросы для контакта'),
    details: { lead_id: leadId }
  });

  revalidatePath(`/people/${leadId}`);
  revalidatePath('/notifications');
  redirect(`/people/${leadId}?deleted=questionnaire`);
}
