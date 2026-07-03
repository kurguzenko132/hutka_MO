'use server';

import { randomBytes } from 'crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { requirePermission } from '@/lib/permissions';
import { getQuestionPackById } from '@/lib/question-packs';
import { sendWorkspaceTelegramNotification } from '@/lib/telegram';

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
  await requirePermission('manageContacts', '/people?error=forbidden');

  const leadId = getText(formData, 'lead_id');
  const packId = getText(formData, 'pack_id');
  if (!leadId) redirect('/people?error=missing-contact');

  const pack = await getQuestionPackById(packId);
  if (!pack) redirect(`/people/${leadId}?error=question-pack-not-found`);

  if (!isSupabaseConfigured()) {
    redirect(`/people/${leadId}?questionnaire=demo-pack`);
  }

  const supabase = await createClient();
  const { data: lead } = await supabase.from('leads').select('name').eq('id', leadId).maybeSingle();
  const title = getText(formData, 'title') || `${pack.shortTitle} · ${lead?.name ?? 'контакт'}`;
  const description = getText(formData, 'description') || pack.description;
  const token = await createUniqueToken(supabase);

  const { data: questionnaire, error } = await supabase
    .from('lead_questionnaires')
    .insert({
      lead_id: leadId,
      title,
      description,
      status: 'active',
      token
    })
    .select('id, token')
    .single();

  if (error || !questionnaire) {
    redirect(`/people/${leadId}?error=questionnaire-pack-save-failed`);
  }

  await supabase.from('lead_questionnaire_questions').insert(
    pack.questions.map((question, index) => ({
      questionnaire_id: questionnaire.id,
      question_text: question.text,
      question_type: question.type,
      options: question.options ?? [],
      required: Boolean(question.required),
      order_index: index + 1
    }))
  );

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '');
  const link = `${appUrl ?? ''}/q/${questionnaire.token}`;

  await supabase.from('lead_interactions').insert({
    lead_id: leadId,
    type: 'survey_sent',
    channel: 'Hutka',
    text: `Создана персональная анкета из пака «${pack.title}»: ${link}`,
    result: 'lead_questionnaire_pack_created'
  });

  revalidatePath(`/people/${leadId}`);
  revalidatePath('/notifications');
  redirect(`/people/${leadId}?questionnaire=pack-created`);
}

export async function createLeadQuestionnaireAction(formData: FormData) {
  await requirePermission('manageContacts', '/people?error=forbidden');
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
  const { data: lead } = await supabase.from('leads').select('name').eq('id', leadId).maybeSingle();
  const title = getText(formData, 'title') || `Вопросы для ${lead?.name ?? 'контакта'}`;
  const description = getText(formData, 'description') || null;
  const token = await createUniqueToken(supabase);

  const { data: questionnaire, error } = await supabase
    .from('lead_questionnaires')
    .insert({
      lead_id: leadId,
      title,
      description,
      status: 'active',
      token
    })
    .select('id, token')
    .single();

  if (error || !questionnaire) {
    redirect(`/people/${leadId}?error=questionnaire-save-failed`);
  }

  await supabase.from('lead_questionnaire_questions').insert(
    questions.map((question) => ({
      questionnaire_id: questionnaire.id,
      ...question
    }))
  );

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '');
  const link = `${appUrl ?? ''}/q/${questionnaire.token}`;

  await supabase.from('lead_interactions').insert({
    lead_id: leadId,
    type: 'survey_sent',
    channel: 'Hutka',
    text: `Создана персональная анкета «${title}»: ${link}`,
    result: 'lead_questionnaire_created'
  });

  revalidatePath(`/people/${leadId}`);
  revalidatePath('/notifications');
  redirect(`/people/${leadId}?questionnaire=created`);
}

export async function submitLeadQuestionnaireAction(formData: FormData) {
  const questionnaireId = getText(formData, 'questionnaire_id');
  const leadId = getText(formData, 'lead_id');
  const token = getText(formData, 'token');
  if (!questionnaireId || !token) redirect('/?error=bad-questionnaire');

  if (!isSupabaseConfigured()) {
    redirect(`/q/${token}?submitted=1`);
  }

  const supabase = await createClient();
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
  const respondentName = getText(formData, 'respondent_name') || null;
  const respondentContact = getText(formData, 'respondent_contact') || null;
  const answerRows = [];

  for (const question of questions) {
    const key = `answer_${question.id}`;
    const allValues = formData.getAll(key).map((value) => String(value).trim()).filter(Boolean);
    const answer = question.question_type === 'multiple_choice' ? allValues : allValues[0] ?? '';

    if (question.required && (!answer || (Array.isArray(answer) && answer.length === 0))) {
      redirect(`/q/${token}?error=required`);
    }

    answerRows.push({
      questionnaire_id: questionnaireId,
      question_id: question.id,
      lead_id: leadId || questionnaire.lead_id,
      response_group_id: responseGroupId,
      respondent_name: respondentName,
      respondent_contact: respondentContact,
      answer
    });
  }

  const { error } = await supabase.from('lead_questionnaire_answers').insert(answerRows);
  if (error) redirect(`/q/${token}?error=save-failed`);

  const resolvedLeadId = leadId || questionnaire.lead_id;

  await supabase.from('lead_interactions').insert({
    lead_id: resolvedLeadId,
    type: 'survey_completed',
    channel: 'Персональная ссылка',
    text: `Получены ответы на персональную анкету «${questionnaire.title ?? 'Вопросы'}»`,
    result: 'lead_questionnaire_completed'
  });

  if (resolvedLeadId) {
    const { data: leadRow } = await supabase
      .from('leads')
      .select('name,niche,city')
      .eq('id', resolvedLeadId)
      .maybeSingle();

    await sendWorkspaceTelegramNotification({
      title: 'новый ответ на анкету',
      text: `${leadRow?.name ?? 'Контакт'} ответил(а) на персональную анкету «${questionnaire.title ?? 'Вопросы'}».`,
      href: `/people/${resolvedLeadId}`,
      extraLines: [
        respondentName ? `Имя в форме: ${respondentName}` : '',
        respondentContact ? `Контакт в форме: ${respondentContact}` : '',
        leadRow?.niche ? `Ниша: ${leadRow.niche}` : '',
        leadRow?.city ? `Город: ${leadRow.city}` : ''
      ].filter((line): line is string => Boolean(line))
    });
  }

  revalidatePath(`/people/${resolvedLeadId}`);
  revalidatePath('/notifications');
  redirect(`/q/${token}?submitted=1`);
}

export async function deleteLeadQuestionnaireAction(formData: FormData) {
  await requirePermission('manageContacts', '/people?error=forbidden');
  const questionnaireId = getText(formData, 'questionnaire_id');
  const leadId = getText(formData, 'lead_id');
  if (!questionnaireId || !leadId) redirect('/people?error=missing-questionnaire');

  if (!isSupabaseConfigured()) {
    redirect(`/people/${leadId}?questionnaire=demo-delete`);
  }

  const supabase = await createClient();
  const { error } = await supabase.from('lead_questionnaires').delete().eq('id', questionnaireId);
  if (error) redirect(`/people/${leadId}?error=questionnaire-delete-failed`);

  await supabase.from('lead_interactions').insert({
    lead_id: leadId,
    type: 'note',
    channel: 'Hutka',
    text: 'Персональная анкета удалена',
    result: 'lead_questionnaire_deleted'
  });

  revalidatePath(`/people/${leadId}`);
  revalidatePath('/notifications');
  redirect(`/people/${leadId}?deleted=questionnaire`);
}
