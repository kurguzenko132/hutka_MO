'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { requirePermission } from '@/lib/permissions';
import type { QuestionPackAudience, QuestionPackListItem, QuestionPackQuestion, QuestionPackStatus, QuestionType } from '@/lib/question-pack-shared';
import { recordActivityLog } from '@/lib/activity-log';

function getText(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

function getInt(formData: FormData, key: string, fallback = 0) {
  const value = Number.parseInt(getText(formData, key), 10);
  return Number.isFinite(value) ? value : fallback;
}

function parseOptions(value: string) {
  return value
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeAudience(value: string): QuestionPackAudience {
  return ['master', 'salon', 'client', 'partner', 'any'].includes(value) ? (value as QuestionPackAudience) : 'any';
}

function normalizeStatus(value: string): QuestionPackStatus {
  return ['active', 'draft', 'archived'].includes(value) ? (value as QuestionPackStatus) : 'active';
}

function normalizeQuestionType(value: string): QuestionType {
  return ['short_text', 'long_text', 'single_choice', 'multiple_choice', 'yes_no', 'number', 'rating'].includes(value) ? (value as QuestionType) : 'short_text';
}

function revalidateQuestionPacks(packId?: string) {
  revalidatePath('/settings');
  revalidatePath('/settings/question-packs');
  if (packId) revalidatePath(`/settings/question-packs/${packId}`);
  revalidatePath('/people');
  revalidatePath('/dashboard');
}

export type QuestionPackMutationInput = {
  id?: string;
  title: string;
  shortTitle?: string;
  description?: string;
  audience?: string;
  badge?: string;
  status?: string;
};

export type QuestionPackMutationResult = {
  ok: boolean;
  error?: string;
  item?: QuestionPackListItem;
};

export type PackQuestionMutationInput = {
  packId: string;
  questionId?: string;
  text: string;
  type?: string;
  options?: string[] | string;
  required?: boolean;
  orderIndex?: number;
};

export type PackQuestionMutationResult = {
  ok: boolean;
  error?: string;
  item?: QuestionPackQuestion;
};

function mapPack(row: Record<string, unknown>, questionsCount = 0): QuestionPackListItem {
  return {
    id: String(row.id),
    title: String(row.title ?? 'Готовые вопросы'),
    shortTitle: String(row.short_title ?? row.title ?? 'Набор'),
    description: String(row.description ?? ''),
    audience: normalizeAudience(String(row.audience ?? 'any')),
    badge: String(row.badge ?? 'набор'),
    status: normalizeStatus(String(row.status ?? 'active')),
    questionsCount,
    createdAt: row.created_at ? String(row.created_at) : undefined,
    updatedAt: row.updated_at ? String(row.updated_at) : undefined
  };
}

function mapQuestion(row: Record<string, unknown>): QuestionPackQuestion {
  return {
    id: String(row.id),
    text: String(row.question_text ?? 'Вопрос'),
    type: normalizeQuestionType(String(row.question_type ?? 'short_text')),
    options: Array.isArray(row.options) ? row.options.map(String) : parseOptions(String(row.options ?? '')),
    required: Boolean(row.required),
    orderIndex: Number(row.order_index ?? 0)
  };
}

function normalizedOptions(value: string[] | string | undefined) {
  return Array.isArray(value)
    ? value.map((item) => item.trim()).filter(Boolean)
    : parseOptions(value ?? '');
}

export async function createQuestionPackAction(formData: FormData) {
  const result = await createQuestionPackMutation({
    title: getText(formData, 'title'),
    shortTitle: getText(formData, 'short_title'),
    description: getText(formData, 'description'),
    audience: getText(formData, 'audience'),
    badge: getText(formData, 'badge'),
    status: getText(formData, 'status')
  });
  if (!result.ok || !result.item) redirect(`/settings/question-packs?error=${encodeURIComponent(result.error || 'create-failed')}`);
  revalidateQuestionPacks(result.item.id);
  redirect(`/settings/question-packs/${result.item.id}?saved=created`);
}

export async function createQuestionPackMutation(
  input: QuestionPackMutationInput
): Promise<QuestionPackMutationResult> {
  const user = await requirePermission('manageSettings', '/dashboard?error=admin-only');
  const title = input.title.trim();
  if (!title) return { ok: false, error: 'title-required' };
  if (!isSupabaseConfigured()) return { ok: false, error: 'demo' };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('question_packs')
    .insert({
      title,
      short_title: input.shortTitle?.trim() || title,
      description: input.description?.trim() || null,
      audience: normalizeAudience(input.audience ?? ''),
      badge: input.badge?.trim() || 'набор',
      status: normalizeStatus(input.status ?? '')
    })
    .select('id,title,short_title,description,audience,badge,status,created_at,updated_at')
    .single();

  if (error || !data) return { ok: false, error: 'create-failed' };

  await recordActivityLog({
    userId: user.profileId,
    action: 'создал готовые вопросы',
    entityType: 'question_pack',
    entityId: String(data.id),
    entityTitle: title
  });
  return { ok: true, item: mapPack(data as Record<string, unknown>) };
}

export async function updateQuestionPackAction(formData: FormData) {
  const id = getText(formData, 'id');
  const result = await updateQuestionPackMutation({
    id,
    title: getText(formData, 'title'),
    shortTitle: getText(formData, 'short_title'),
    description: getText(formData, 'description'),
    audience: getText(formData, 'audience'),
    badge: getText(formData, 'badge'),
    status: getText(formData, 'status')
  });
  if (!result.ok) redirect(`/settings/question-packs/${id}?error=${encodeURIComponent(result.error || 'update-failed')}`);
  revalidateQuestionPacks(id);
  redirect(`/settings/question-packs/${id}?saved=pack`);
}

export async function updateQuestionPackMutation(
  input: QuestionPackMutationInput
): Promise<QuestionPackMutationResult> {
  const user = await requirePermission('manageSettings', '/dashboard?error=admin-only');
  const id = input.id?.trim() ?? '';
  const title = input.title.trim();
  if (!id || !title) return { ok: false, error: 'pack-required' };
  if (!isSupabaseConfigured()) return { ok: false, error: 'demo' };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('question_packs')
    .update({
      title,
      short_title: input.shortTitle?.trim() || title,
      description: input.description?.trim() || null,
      audience: normalizeAudience(input.audience ?? ''),
      badge: input.badge?.trim() || 'набор',
      status: normalizeStatus(input.status ?? ''),
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select('id,title,short_title,description,audience,badge,status,created_at,updated_at')
    .maybeSingle();

  if (error) return { ok: false, error: 'update-failed' };
  if (!data?.id) return { ok: false, error: 'pack-not-found' };
  await recordActivityLog({
    userId: user.profileId,
    action: 'изменил готовые вопросы',
    entityType: 'question_pack',
    entityId: id,
    entityTitle: title
  });
  return { ok: true, item: mapPack(data as Record<string, unknown>) };
}

export async function deleteQuestionPackAction(formData: FormData) {
  const id = getText(formData, 'id');
  const result = await deleteQuestionPackMutation(id);
  if (!result.ok) redirect(`/settings/question-packs/${id}?error=${encodeURIComponent(result.error || 'delete-failed')}`);
  revalidateQuestionPacks();
  redirect('/settings/question-packs?deleted=pack');
}

export async function deleteQuestionPackMutation(
  rawId: string
): Promise<QuestionPackMutationResult> {
  const user = await requirePermission('manageSettings', '/dashboard?error=admin-only');
  const id = rawId.trim();
  if (!id) return { ok: false, error: 'pack-required' };
  if (!isSupabaseConfigured()) return { ok: false, error: 'demo' };

  const supabase = await createClient();
  const { data: pack, error } = await supabase
    .from('question_packs')
    .delete()
    .eq('id', id)
    .select('id,title')
    .maybeSingle();
  if (error) return { ok: false, error: 'delete-failed' };
  if (!pack?.id) return { ok: false, error: 'pack-not-found' };

  await recordActivityLog({
    userId: user.profileId,
    action: 'удалил готовые вопросы',
    entityType: 'question_pack',
    entityId: id,
    entityTitle: String(pack.title ?? 'Готовые вопросы')
  });
  return { ok: true };
}

export async function addQuestionToPackAction(formData: FormData) {
  const packId = getText(formData, 'pack_id');
  const result = await addQuestionToPackMutation({
    packId,
    text: getText(formData, 'question_text'),
    type: getText(formData, 'question_type'),
    options: getText(formData, 'options'),
    required: getText(formData, 'required') === 'on',
    orderIndex: getInt(formData, 'order_index', 0)
  });
  if (!result.ok) redirect(`/settings/question-packs/${packId}?error=${encodeURIComponent(result.error || 'question-create-failed')}`);
  revalidateQuestionPacks(packId);
  redirect(`/settings/question-packs/${packId}?saved=question`);
}

export async function addQuestionToPackMutation(
  input: PackQuestionMutationInput
): Promise<PackQuestionMutationResult> {
  const user = await requirePermission('manageSettings', '/dashboard?error=admin-only');
  const packId = input.packId.trim();
  const questionText = input.text.trim();
  if (!packId || !questionText) return { ok: false, error: 'question-required' };
  if (!isSupabaseConfigured()) return { ok: false, error: 'demo' };

  const supabase = await createClient();
  let orderIndex = Number.isFinite(input.orderIndex) ? input.orderIndex ?? 0 : 0;
  if (orderIndex <= 0) {
    const { count, error: countError } = await supabase
      .from('question_pack_questions')
      .select('id', { count: 'exact', head: true })
      .eq('pack_id', packId);
    if (countError) return { ok: false, error: 'question-create-failed' };
    orderIndex = (count ?? 0) + 1;
  }

  const { data, error } = await supabase.from('question_pack_questions').insert({
    pack_id: packId,
    question_text: questionText,
    question_type: normalizeQuestionType(input.type ?? ''),
    options: normalizedOptions(input.options),
    required: Boolean(input.required),
    order_index: orderIndex
  }).select('id,question_text,question_type,options,required,order_index').single();

  if (error || !data?.id) return { ok: false, error: error?.code === '23503' ? 'pack-not-found' : 'question-create-failed' };
  await recordActivityLog({
    userId: user.profileId,
    action: 'создал вопрос в готовых вопросах',
    entityType: 'question_pack_question',
    entityId: String(data.id),
    entityTitle: questionText,
    details: { pack_id: packId }
  });
  return { ok: true, item: mapQuestion(data as Record<string, unknown>) };
}

export async function updateQuestionPackQuestionAction(formData: FormData) {
  const packId = getText(formData, 'pack_id');
  const questionId = getText(formData, 'question_id');
  const result = await updateQuestionPackQuestionMutation({
    packId,
    questionId,
    text: getText(formData, 'question_text'),
    type: getText(formData, 'question_type'),
    options: getText(formData, 'options'),
    required: getText(formData, 'required') === 'on',
    orderIndex: getInt(formData, 'order_index', 0)
  });
  if (!result.ok) redirect(`/settings/question-packs/${packId}?error=${encodeURIComponent(result.error || 'question-update-failed')}`);
  revalidateQuestionPacks(packId);
  redirect(`/settings/question-packs/${packId}?saved=question`);
}

export async function updateQuestionPackQuestionMutation(
  input: PackQuestionMutationInput
): Promise<PackQuestionMutationResult> {
  const user = await requirePermission('manageSettings', '/dashboard?error=admin-only');
  const packId = input.packId.trim();
  const questionId = input.questionId?.trim() ?? '';
  const questionText = input.text.trim();
  if (!packId || !questionId || !questionText) return { ok: false, error: 'question-required' };
  if (!isSupabaseConfigured()) return { ok: false, error: 'demo' };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('question_pack_questions')
    .update({
      question_text: questionText,
      question_type: normalizeQuestionType(input.type ?? ''),
      options: normalizedOptions(input.options),
      required: Boolean(input.required),
      order_index: Number.isFinite(input.orderIndex) ? input.orderIndex ?? 0 : 0
    })
    .eq('id', questionId)
    .eq('pack_id', packId)
    .select('id,question_text,question_type,options,required,order_index')
    .maybeSingle();

  if (error) return { ok: false, error: 'question-update-failed' };
  if (!data?.id) return { ok: false, error: 'question-not-found' };
  await recordActivityLog({
    userId: user.profileId,
    action: 'изменил вопрос в готовых вопросах',
    entityType: 'question_pack_question',
    entityId: questionId,
    entityTitle: questionText,
    details: { pack_id: packId }
  });
  return { ok: true, item: mapQuestion(data as Record<string, unknown>) };
}

export async function deleteQuestionPackQuestionAction(formData: FormData) {
  const packId = getText(formData, 'pack_id');
  const result = await deleteQuestionPackQuestionMutation({
    packId,
    questionId: getText(formData, 'question_id')
  });
  if (!result.ok) redirect(`/settings/question-packs/${packId}?error=${encodeURIComponent(result.error || 'question-delete-failed')}`);
  revalidateQuestionPacks(packId);
  redirect(`/settings/question-packs/${packId}?deleted=question`);
}

export async function deleteQuestionPackQuestionMutation(
  input: { packId: string; questionId: string }
): Promise<PackQuestionMutationResult> {
  const user = await requirePermission('manageSettings', '/dashboard?error=admin-only');
  const packId = input.packId.trim();
  const questionId = input.questionId.trim();
  if (!packId || !questionId) return { ok: false, error: 'question-required' };
  if (!isSupabaseConfigured()) return { ok: false, error: 'demo' };

  const supabase = await createClient();
  const { data: question, error } = await supabase
    .from('question_pack_questions')
    .delete()
    .eq('id', questionId)
    .eq('pack_id', packId)
    .select('id,question_text')
    .maybeSingle();

  if (error) return { ok: false, error: 'question-delete-failed' };
  if (!question?.id) return { ok: false, error: 'question-not-found' };

  await recordActivityLog({
    userId: user.profileId,
    action: 'удалил вопрос в готовых вопросах',
    entityType: 'question_pack_question',
    entityId: questionId,
    entityTitle: String(question.question_text ?? 'Вопрос'),
    details: { pack_id: packId }
  });
  return { ok: true };
}
