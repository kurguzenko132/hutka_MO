'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { requirePermission } from '@/lib/permissions';
import type { MessageTemplate, MessageTemplateAudience, MessageTemplateCategory, MessageTemplateChannel, MessageTemplateStatus } from '@/lib/message-template-shared';
import { recordActivityLog } from '@/lib/activity-log';

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

export type MessageTemplateMutationInput = {
  id?: string;
  title: string;
  shortTitle?: string;
  description?: string;
  audience?: string;
  category?: string;
  channel?: string;
  status?: string;
  body: string;
  orderIndex?: number;
};

export type MessageTemplateMutationResult = {
  ok: boolean;
  error?: string;
  item?: MessageTemplate;
};

function mapTemplate(row: Record<string, unknown>): MessageTemplate {
  return {
    id: String(row.id),
    title: String(row.title ?? 'Шаблон сообщения'),
    shortTitle: String(row.short_title ?? row.title ?? 'Шаблон'),
    description: String(row.description ?? ''),
    audience: normalizeAudience(String(row.audience ?? 'any')),
    category: normalizeCategory(String(row.category ?? 'custom')),
    channel: normalizeChannel(String(row.channel ?? 'any')),
    status: normalizeStatus(String(row.status ?? 'active')),
    body: String(row.body ?? ''),
    orderIndex: Number(row.order_index ?? 99),
    createdAt: row.created_at ? String(row.created_at) : undefined,
    updatedAt: row.updated_at ? String(row.updated_at) : undefined
  };
}

const templateSelect = 'id,title,short_title,description,audience,category,channel,status,body,order_index,created_at,updated_at' as const;

export async function createMessageTemplateAction(formData: FormData) {
  const result = await createMessageTemplateMutation({
    title: getText(formData, 'title'),
    shortTitle: getText(formData, 'short_title'),
    description: getText(formData, 'description'),
    audience: getText(formData, 'audience'),
    category: getText(formData, 'category'),
    channel: getText(formData, 'channel'),
    status: getText(formData, 'status'),
    body: getText(formData, 'body'),
    orderIndex: getInt(formData, 'order_index', 99)
  });
  if (!result.ok || !result.item) redirect(`/settings/message-templates?error=${encodeURIComponent(result.error || 'create-failed')}`);
  revalidateTemplates(result.item.id);
  redirect(`/settings/message-templates/${result.item.id}?saved=created`);
}

export async function createMessageTemplateMutation(
  input: MessageTemplateMutationInput
): Promise<MessageTemplateMutationResult> {
  const user = await requirePermission('manageSettings', '/dashboard?error=admin-only');
  const title = input.title.trim();
  const body = input.body.trim();
  if (!title || !body) return { ok: false, error: 'required' };
  if (!isSupabaseConfigured()) return { ok: false, error: 'demo' };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('message_templates')
    .insert({
      title,
      short_title: input.shortTitle?.trim() || title,
      description: input.description?.trim() || null,
      audience: normalizeAudience(input.audience ?? ''),
      category: normalizeCategory(input.category ?? ''),
      channel: normalizeChannel(input.channel ?? ''),
      status: normalizeStatus(input.status ?? ''),
      body,
      order_index: Number.isFinite(input.orderIndex) ? input.orderIndex ?? 99 : 99
    })
    .select(templateSelect)
    .single();

  if (error || !data) return { ok: false, error: 'create-failed' };

  await recordActivityLog({
    userId: user.profileId,
    action: 'создал шаблон сообщения',
    entityType: 'message_template',
    entityId: String(data.id),
    entityTitle: title
  });
  return { ok: true, item: mapTemplate(data as Record<string, unknown>) };
}

export async function updateMessageTemplateAction(formData: FormData) {
  const result = await updateMessageTemplateMutation({
    id: getText(formData, 'id'),
    title: getText(formData, 'title'),
    shortTitle: getText(formData, 'short_title'),
    description: getText(formData, 'description'),
    audience: getText(formData, 'audience'),
    category: getText(formData, 'category'),
    channel: getText(formData, 'channel'),
    status: getText(formData, 'status'),
    body: getText(formData, 'body'),
    orderIndex: getInt(formData, 'order_index', 99)
  });
  const id = getText(formData, 'id');
  if (!result.ok) redirect(`/settings/message-templates/${id}?error=${encodeURIComponent(result.error || 'update-failed')}`);
  revalidateTemplates(id);
  redirect(`/settings/message-templates/${id}?saved=template`);
}

export async function updateMessageTemplateMutation(
  input: MessageTemplateMutationInput
): Promise<MessageTemplateMutationResult> {
  const user = await requirePermission('manageSettings', '/dashboard?error=admin-only');
  const id = input.id?.trim() ?? '';
  const title = input.title.trim();
  const body = input.body.trim();
  if (!id || !title || !body) return { ok: false, error: 'required' };
  if (!isSupabaseConfigured()) return { ok: false, error: 'demo' };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('message_templates')
    .update({
      title,
      short_title: input.shortTitle?.trim() || title,
      description: input.description?.trim() || null,
      audience: normalizeAudience(input.audience ?? ''),
      category: normalizeCategory(input.category ?? ''),
      channel: normalizeChannel(input.channel ?? ''),
      status: normalizeStatus(input.status ?? ''),
      body,
      order_index: Number.isFinite(input.orderIndex) ? input.orderIndex ?? 99 : 99,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select(templateSelect)
    .maybeSingle();

  if (error) return { ok: false, error: 'update-failed' };
  if (!data?.id) return { ok: false, error: 'template-not-found' };
  await recordActivityLog({
    userId: user.profileId,
    action: 'изменил шаблон сообщения',
    entityType: 'message_template',
    entityId: id,
    entityTitle: title
  });
  return { ok: true, item: mapTemplate(data as Record<string, unknown>) };
}

export async function deleteMessageTemplateAction(formData: FormData) {
  const id = getText(formData, 'id');
  const result = await deleteMessageTemplateMutation(id);
  if (!result.ok) redirect(`/settings/message-templates/${id}?error=${encodeURIComponent(result.error || 'delete-failed')}`);
  revalidateTemplates();
  redirect('/settings/message-templates?deleted=template');
}

export async function deleteMessageTemplateMutation(
  rawId: string
): Promise<MessageTemplateMutationResult> {
  const user = await requirePermission('manageSettings', '/dashboard?error=admin-only');
  const id = rawId.trim();
  if (!id) return { ok: false, error: 'required' };
  if (!isSupabaseConfigured()) return { ok: false, error: 'demo' };

  const supabase = await createClient();
  const { data: template, error } = await supabase
    .from('message_templates')
    .delete()
    .eq('id', id)
    .select('id,title')
    .maybeSingle();
  if (error) return { ok: false, error: 'delete-failed' };
  if (!template?.id) return { ok: false, error: 'template-not-found' };

  await recordActivityLog({
    userId: user.profileId,
    action: 'удалил шаблон сообщения',
    entityType: 'message_template',
    entityId: id,
    entityTitle: String(template.title ?? 'Шаблон сообщения')
  });
  return { ok: true };
}
