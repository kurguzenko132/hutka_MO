'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { requirePermission } from '@/lib/permissions';
import type { QuestionPackAudience, QuestionPackStatus, QuestionType } from '@/lib/question-packs';

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

function redirectToDemo() {
  redirect('/settings/question-packs?demo=1');
}

async function packExists(supabase: Awaited<ReturnType<typeof createClient>>, packId: string) {
  const { data, error } = await supabase.from('question_packs').select('id').eq('id', packId).maybeSingle();
  return !error && Boolean(data?.id);
}

async function packQuestionExists(supabase: Awaited<ReturnType<typeof createClient>>, packId: string, questionId: string) {
  const { data, error } = await supabase
    .from('question_pack_questions')
    .select('id')
    .eq('id', questionId)
    .eq('pack_id', packId)
    .maybeSingle();

  return !error && Boolean(data?.id);
}

export async function createQuestionPackAction(formData: FormData) {
  await requirePermission('manageSettings', '/dashboard?error=admin-only');

  const title = getText(formData, 'title');
  if (!title) redirect('/settings/question-packs?error=title-required');
  if (!isSupabaseConfigured()) redirectToDemo();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('question_packs')
    .insert({
      title,
      short_title: getText(formData, 'short_title') || title,
      description: getText(formData, 'description') || null,
      audience: normalizeAudience(getText(formData, 'audience')),
      badge: getText(formData, 'badge') || 'пак',
      status: normalizeStatus(getText(formData, 'status'))
    })
    .select('id')
    .single();

  if (error || !data) redirect('/settings/question-packs?error=create-failed');

  revalidateQuestionPacks(String(data.id));
  redirect(`/settings/question-packs/${data.id}?saved=created`);
}

export async function updateQuestionPackAction(formData: FormData) {
  await requirePermission('manageSettings', '/dashboard?error=admin-only');

  const id = getText(formData, 'id');
  const title = getText(formData, 'title');
  if (!id || !title) redirect('/settings/question-packs?error=pack-required');
  if (!isSupabaseConfigured()) redirectToDemo();

  const supabase = await createClient();
  if (!(await packExists(supabase, id))) redirect('/settings/question-packs?error=pack-not-found');

  const { error } = await supabase
    .from('question_packs')
    .update({
      title,
      short_title: getText(formData, 'short_title') || title,
      description: getText(formData, 'description') || null,
      audience: normalizeAudience(getText(formData, 'audience')),
      badge: getText(formData, 'badge') || 'пак',
      status: normalizeStatus(getText(formData, 'status')),
      updated_at: new Date().toISOString()
    })
    .eq('id', id);

  if (error) redirect(`/settings/question-packs/${id}?error=update-failed`);

  revalidateQuestionPacks(id);
  redirect(`/settings/question-packs/${id}?saved=pack`);
}

export async function deleteQuestionPackAction(formData: FormData) {
  await requirePermission('manageSettings', '/dashboard?error=admin-only');

  const id = getText(formData, 'id');
  if (!id) redirect('/settings/question-packs?error=pack-required');
  if (!isSupabaseConfigured()) redirectToDemo();

  const supabase = await createClient();
  if (!(await packExists(supabase, id))) redirect('/settings/question-packs?error=pack-not-found');

  const { error } = await supabase.from('question_packs').delete().eq('id', id);
  if (error) redirect(`/settings/question-packs/${id}?error=delete-failed`);

  revalidateQuestionPacks();
  redirect('/settings/question-packs?deleted=pack');
}

export async function addQuestionToPackAction(formData: FormData) {
  await requirePermission('manageSettings', '/dashboard?error=admin-only');

  const packId = getText(formData, 'pack_id');
  const text = getText(formData, 'question_text');
  if (!packId || !text) redirect('/settings/question-packs?error=question-required');
  if (!isSupabaseConfigured()) redirectToDemo();

  const supabase = await createClient();
  if (!(await packExists(supabase, packId))) redirect('/settings/question-packs?error=pack-not-found');

  const { count } = await supabase
    .from('question_pack_questions')
    .select('id', { count: 'exact', head: true })
    .eq('pack_id', packId);

  const { error } = await supabase.from('question_pack_questions').insert({
    pack_id: packId,
    question_text: text,
    question_type: normalizeQuestionType(getText(formData, 'question_type')),
    options: parseOptions(getText(formData, 'options')),
    required: getText(formData, 'required') === 'on',
    order_index: getInt(formData, 'order_index', (count ?? 0) + 1)
  });

  if (error) redirect(`/settings/question-packs/${packId}?error=question-create-failed`);

  revalidateQuestionPacks(packId);
  redirect(`/settings/question-packs/${packId}?saved=question`);
}

export async function updateQuestionPackQuestionAction(formData: FormData) {
  await requirePermission('manageSettings', '/dashboard?error=admin-only');

  const packId = getText(formData, 'pack_id');
  const questionId = getText(formData, 'question_id');
  const text = getText(formData, 'question_text');
  if (!packId || !questionId || !text) redirect('/settings/question-packs?error=question-required');
  if (!isSupabaseConfigured()) redirectToDemo();

  const supabase = await createClient();
  if (!(await packQuestionExists(supabase, packId, questionId))) {
    redirect(`/settings/question-packs/${packId}?error=question-not-found`);
  }

  const { error } = await supabase
    .from('question_pack_questions')
    .update({
      question_text: text,
      question_type: normalizeQuestionType(getText(formData, 'question_type')),
      options: parseOptions(getText(formData, 'options')),
      required: getText(formData, 'required') === 'on',
      order_index: getInt(formData, 'order_index', 0)
    })
    .eq('id', questionId)
    .eq('pack_id', packId);

  if (error) redirect(`/settings/question-packs/${packId}?error=question-update-failed`);

  revalidateQuestionPacks(packId);
  redirect(`/settings/question-packs/${packId}?saved=question`);
}

export async function deleteQuestionPackQuestionAction(formData: FormData) {
  await requirePermission('manageSettings', '/dashboard?error=admin-only');

  const packId = getText(formData, 'pack_id');
  const questionId = getText(formData, 'question_id');
  if (!packId || !questionId) redirect('/settings/question-packs?error=question-required');
  if (!isSupabaseConfigured()) redirectToDemo();

  const supabase = await createClient();
  if (!(await packQuestionExists(supabase, packId, questionId))) {
    redirect(`/settings/question-packs/${packId}?error=question-not-found`);
  }

  const { error } = await supabase
    .from('question_pack_questions')
    .delete()
    .eq('id', questionId)
    .eq('pack_id', packId);

  if (error) redirect(`/settings/question-packs/${packId}?error=question-delete-failed`);

  revalidateQuestionPacks(packId);
  redirect(`/settings/question-packs/${packId}?deleted=question`);
}
