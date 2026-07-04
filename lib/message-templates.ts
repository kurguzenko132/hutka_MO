import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';

export type MessageTemplateAudience = 'master' | 'salon' | 'client' | 'partner' | 'any';
export type MessageTemplateStatus = 'active' | 'draft' | 'archived';
export type MessageTemplateCategory = 'first_touch' | 'questionnaire' | 'follow_up' | 'pilot' | 'refusal' | 'feedback' | 'custom';
export type MessageTemplateChannel = 'instagram' | 'telegram' | 'whatsapp' | 'email' | 'phone' | 'any';

export type MessageTemplate = {
  id: string;
  title: string;
  shortTitle: string;
  description: string;
  audience: MessageTemplateAudience;
  category: MessageTemplateCategory;
  channel: MessageTemplateChannel;
  status: MessageTemplateStatus;
  body: string;
  orderIndex?: number;
  createdAt?: string;
  updatedAt?: string;
};

export const messageTemplateAudienceOptions: Array<{ value: MessageTemplateAudience; label: string }> = [
  { value: 'master', label: 'Мастер' },
  { value: 'salon', label: 'Салон' },
  { value: 'client', label: 'Клиент' },
  { value: 'partner', label: 'Партнер' },
  { value: 'any', label: 'Любой контакт' }
];

export const messageTemplateStatusOptions: Array<{ value: MessageTemplateStatus; label: string }> = [
  { value: 'active', label: 'Активен' },
  { value: 'draft', label: 'Черновик' },
  { value: 'archived', label: 'Архив' }
];

export const messageTemplateCategoryOptions: Array<{ value: MessageTemplateCategory; label: string }> = [
  { value: 'first_touch', label: 'Первое касание' },
  { value: 'questionnaire', label: 'Анкета' },
  { value: 'follow_up', label: 'Follow-up' },
  { value: 'pilot', label: 'Пилот' },
  { value: 'refusal', label: 'Отказ / пауза' },
  { value: 'feedback', label: 'Фидбек' },
  { value: 'custom', label: 'Другое' }
];

export const messageTemplateChannelOptions: Array<{ value: MessageTemplateChannel; label: string }> = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'whatsapp', label: 'WhatsApp / Viber' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Телефон' },
  { value: 'any', label: 'Любой канал' }
];

export const defaultMessageTemplates: MessageTemplate[] = [
  {
    id: 'first-touch-master',
    title: 'Первое сообщение индивидуальному мастеру',
    shortTitle: 'Мастер: первое касание',
    audience: 'master',
    category: 'first_touch',
    channel: 'instagram',
    status: 'active',
    description: 'Короткое первое сообщение, чтобы аккуратно начать диалог с мастером.',
    orderIndex: 1,
    body: 'Привет, {{first_name}}! Мы сейчас запускаем Hutka — сервис, где beauty-мастера смогут получать заявки через карту и удобнее вести запись. Хочу задать пару коротких вопросов, чтобы понять, насколько это может быть полезно для вашего направления {{niche}}. Можно отправить короткую анкету?'
  },
  {
    id: 'send-questionnaire',
    title: 'Отправка персональной анкеты',
    shortTitle: 'Отправить анкету',
    audience: 'any',
    category: 'questionnaire',
    channel: 'any',
    status: 'active',
    description: 'Сообщение для отправки персональной ссылки на вопросы из карточки контакта.',
    orderIndex: 2,
    body: '{{first_name}}, спасибо! Вот короткая анкета — она поможет понять, как вам может быть полезна Hutka и что нужно учесть в пилоте:\n\n{{questionnaire_link}}\n\nОтветы займут 2–4 минуты.'
  },
  {
    id: 'questionnaire-reminder',
    title: 'Напоминание пройти анкету',
    shortTitle: 'Напоминание по анкете',
    audience: 'any',
    category: 'follow_up',
    channel: 'any',
    status: 'active',
    description: 'Мягкое напоминание, если человек получил ссылку, но еще не ответил.',
    orderIndex: 3,
    body: '{{first_name}}, привет! Напомню про короткую анкету по Hutka. Она нужна, чтобы мы не предлагали лишнее, а поняли именно вашу ситуацию: {{questionnaire_link}}\n\nБуду благодарен за ответы, когда будет удобно.'
  },
  {
    id: 'pilot-invite',
    title: 'Приглашение в пилот',
    shortTitle: 'Пригласить в пилот',
    audience: 'any',
    category: 'pilot',
    channel: 'any',
    status: 'active',
    description: 'Сообщение, когда контакт подходит для раннего тестирования.',
    orderIndex: 4,
    body: '{{first_name}}, по вашим ответам вижу, что вы хорошо подходите для первой пилотной группы Hutka. Предлагаю подключить вас к раннему тесту: поможем оформить профиль, посмотрим, как работает карта и какие заявки можно получать. Вам удобно обсудить детали?'
  },
  {
    id: 'refusal-clarify',
    title: 'Уточнить причину отказа',
    shortTitle: 'Причина отказа',
    audience: 'any',
    category: 'refusal',
    channel: 'any',
    status: 'active',
    description: 'Короткое сообщение, чтобы понять реальную причину отказа или паузы.',
    orderIndex: 5,
    body: 'Понял, {{first_name}}, спасибо за честный ответ. Можно коротко уточнить, что больше всего мешает сейчас: нет времени, пока непонятна польза, уже есть система, не хочется заполнять профиль или просто сейчас неактуально? Это поможет нам лучше доработать Hutka.'
  },
  {
    id: 'feedback-after-pilot',
    title: 'Фидбек после теста',
    shortTitle: 'Фидбек после пилота',
    audience: 'any',
    category: 'feedback',
    channel: 'any',
    status: 'active',
    description: 'Сообщение для сбора обратной связи после пилота.',
    orderIndex: 6,
    body: '{{first_name}}, спасибо, что протестировали Hutka. Очень важно понять, что было полезно, что неудобно и чего не хватило. Можете коротко написать 2–3 мысли или пройти мини-анкету: {{questionnaire_link}}'
  }
];

function asAudience(value: unknown): MessageTemplateAudience {
  const text = String(value ?? 'any');
  return ['master', 'salon', 'client', 'partner', 'any'].includes(text) ? (text as MessageTemplateAudience) : 'any';
}

function asStatus(value: unknown): MessageTemplateStatus {
  const text = String(value ?? 'active');
  return ['active', 'draft', 'archived'].includes(text) ? (text as MessageTemplateStatus) : 'active';
}

function asCategory(value: unknown): MessageTemplateCategory {
  const text = String(value ?? 'custom');
  return ['first_touch', 'questionnaire', 'follow_up', 'pilot', 'refusal', 'feedback', 'custom'].includes(text) ? (text as MessageTemplateCategory) : 'custom';
}

function asChannel(value: unknown): MessageTemplateChannel {
  const text = String(value ?? 'any');
  return ['instagram', 'telegram', 'whatsapp', 'email', 'phone', 'any'].includes(text) ? (text as MessageTemplateChannel) : 'any';
}

function labelByValue<T extends string>(items: Array<{ value: T; label: string }>, value: T) {
  return items.find((item) => item.value === value)?.label ?? value;
}

export function messageTemplateAudienceLabel(audience: string) {
  return labelByValue(messageTemplateAudienceOptions, asAudience(audience));
}

export function messageTemplateStatusLabel(status: string) {
  return labelByValue(messageTemplateStatusOptions, asStatus(status));
}

export function messageTemplateCategoryLabel(category: string) {
  return labelByValue(messageTemplateCategoryOptions, asCategory(category));
}

export function messageTemplateChannelLabel(channel: string) {
  return labelByValue(messageTemplateChannelOptions, asChannel(channel));
}

function mapTemplateRow(row: Record<string, unknown>): MessageTemplate {
  return {
    id: String(row.id),
    title: String(row.title ?? 'Шаблон сообщения'),
    shortTitle: String(row.short_title ?? row.title ?? 'Шаблон'),
    description: String(row.description ?? ''),
    audience: asAudience(row.audience),
    category: asCategory(row.category),
    channel: asChannel(row.channel),
    status: asStatus(row.status),
    body: String(row.body ?? ''),
    orderIndex: Number(row.order_index ?? 0),
    createdAt: row.created_at ? String(row.created_at) : undefined,
    updatedAt: row.updated_at ? String(row.updated_at) : undefined
  };
}

function leadTypeToAudience(type?: string): MessageTemplateAudience {
  const value = String(type ?? '').toLowerCase();
  if (value.includes('салон') || value.includes('salon')) return 'salon';
  if (value.includes('клиент') || value.includes('client')) return 'client';
  if (value.includes('партнер') || value.includes('partner')) return 'partner';
  if (value.includes('мастер') || value.includes('master')) return 'master';
  return 'any';
}

export async function getMessageTemplates(audience?: MessageTemplateAudience | 'all', includeInactive = false): Promise<MessageTemplate[]> {
  if (!isSupabaseConfigured()) {
    return defaultMessageTemplates.filter((template) => {
      const audienceMatch = !audience || audience === 'all' || template.audience === audience || template.audience === 'any';
      const statusMatch = includeInactive || template.status === 'active';
      return audienceMatch && statusMatch;
    });
  }

  try {
    const supabase = await createClient();
    let query = supabase
      .from('message_templates')
      .select('id,title,short_title,description,audience,category,channel,status,body,order_index,created_at,updated_at')
      .order('order_index', { ascending: true })
      .order('created_at', { ascending: true });

    if (!includeInactive) query = query.eq('status', 'active');
    if (audience && audience !== 'all') query = query.in('audience', [audience, 'any']);

    const { data, error } = await query;
    if (error || !data) return [];
    return data.map((row) => mapTemplateRow(row as Record<string, unknown>));
  } catch {
    return [];
  }
}

export async function getMessageTemplatesForLead(type?: string): Promise<MessageTemplate[]> {
  return getMessageTemplates(leadTypeToAudience(type), false);
}

export async function getMessageTemplateById(id: string): Promise<MessageTemplate | null> {
  if (!id) return null;

  if (!isSupabaseConfigured()) {
    return defaultMessageTemplates.find((template) => template.id === id) ?? null;
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('message_templates')
      .select('id,title,short_title,description,audience,category,channel,status,body,order_index,created_at,updated_at')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) return null;
    return mapTemplateRow(data as Record<string, unknown>);
  } catch {
    return null;
  }
}
