'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { requirePermission } from '@/lib/permissions';
import type { MessageTemplateAudience, MessageTemplateCategory, MessageTemplateChannel, MessageTemplateStatus } from '@/lib/message-templates';

function getText(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

function getInt(formData: FormData, key: string, fallback = 0) {
  const value = Number.parseInt(getText(formData, key), 10);
  return Number.isFinite(value) ? value : fallback;
}

function normalizeAudience(value: string): MessageTemplateAudience {
  return ['master', 'salon', 'client', 'partner', 'any'].includes(value) ? (value as MessageTemplateAudience) : 'any';
}

function normalizeStatus(value: string): MessageTemplateStatus {
  return ['active', 'draft', 'archived'].includes(value) ? (value as MessageTemplateStatus) : 'active';
}

function normalizeCategory(value: string): MessageTemplateCategory {
  return ['first_touch', 'questionnaire', 'follow_up', 'pilot', 'refusal', 'feedback', 'custom'].includes(value) ? (value as MessageTemplateCategory) : 'custom';
}

function normalizeChannel(value: string): MessageTemplateChannel {
  return ['instagram', 'telegram', 'whatsapp', 'email', 'phone', 'any'].includes(value) ? (value as MessageTemplateChannel) : 'any';
}

function revalidateTemplates(id?: string) {
  revalidatePath('/settings');
  revalidatePath('/settings/message-templates');
  if (id) revalidatePath(`/settings/message-templates/${id}`);
  revalidatePath('/people');
  revalidatePath('/dashboard');
}

function redirectToDemo() {
  redirect('/settings/message-templates?demo=1');
}

export async function createMessageTemplateAction(formData: FormData) {
  await requirePermission('manageSettings', '/dashboard?error=admin-only');

  const title = getText(formData, 'title');
  const body = getText(formData, 'body');
  if (!title || !body) redirect('/settings/message-templates?error=required');
  if (!isSupabaseConfigured()) redirectToDemo();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('message_templates')
    .insert({
      title,
      short_title: getText(formData, 'short_title') || title,
      description: getText(formData, 'description') || null,
      audience: normalizeAudience(getText(formData, 'audience')),
      category: normalizeCategory(getText(formData, 'category')),
      channel: normalizeChannel(getText(formData, 'channel')),
      status: normalizeStatus(getText(formData, 'status')),
      body,
      order_index: getInt(formData, 'order_index', 99)
    })
    .select('id')
    .single();

  if (error || !data) redirect('/settings/message-templates?error=create-failed');

  revalidateTemplates(String(data.id));
  redirect(`/settings/message-templates/${data.id}?saved=created`);
}

export async function updateMessageTemplateAction(formData: FormData) {
  await requirePermission('manageSettings', '/dashboard?error=admin-only');

  const id = getText(formData, 'id');
  const title = getText(formData, 'title');
  const body = getText(formData, 'body');
  if (!id || !title || !body) redirect('/settings/message-templates?error=required');
  if (!isSupabaseConfigured()) redirectToDemo();

  const supabase = await createClient();
  const { error } = await supabase
    .from('message_templates')
    .update({
      title,
      short_title: getText(formData, 'short_title') || title,
      description: getText(formData, 'description') || null,
      audience: normalizeAudience(getText(formData, 'audience')),
      category: normalizeCategory(getText(formData, 'category')),
      channel: normalizeChannel(getText(formData, 'channel')),
      status: normalizeStatus(getText(formData, 'status')),
      body,
      order_index: getInt(formData, 'order_index', 99),
      updated_at: new Date().toISOString()
    })
    .eq('id', id);

  if (error) redirect(`/settings/message-templates/${id}?error=update-failed`);

  revalidateTemplates(id);
  redirect(`/settings/message-templates/${id}?saved=template`);
}

export async function deleteMessageTemplateAction(formData: FormData) {
  await requirePermission('manageSettings', '/dashboard?error=admin-only');

  const id = getText(formData, 'id');
  if (!id) redirect('/settings/message-templates?error=required');
  if (!isSupabaseConfigured()) redirectToDemo();

  const supabase = await createClient();
  const { error } = await supabase.from('message_templates').delete().eq('id', id);
  if (error) redirect(`/settings/message-templates/${id}?error=delete-failed`);

  revalidateTemplates();
  redirect('/settings/message-templates?deleted=template');
}
