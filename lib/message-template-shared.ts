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
  { value: 'follow_up', label: 'Действие' },
  { value: 'pilot', label: 'Тестирование' },
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

function labelByValue<T extends string>(items: Array<{ value: T; label: string }>, value: string) {
  return items.find((item) => item.value === value)?.label ?? value;
}

export function messageTemplateAudienceLabel(audience: string) {
  return labelByValue(messageTemplateAudienceOptions, audience);
}

export function messageTemplateStatusLabel(status: string) {
  return labelByValue(messageTemplateStatusOptions, status);
}

export function messageTemplateCategoryLabel(category: string) {
  return labelByValue(messageTemplateCategoryOptions, category);
}

export function messageTemplateChannelLabel(channel: string) {
  return labelByValue(messageTemplateChannelOptions, channel);
}
