export type InsightImportance = 'low' | 'medium' | 'high' | 'critical';
export type InsightStatus = 'new' | 'in_review' | 'accepted' | 'archived';

export type InsightRelation = {
  id: string;
  name: string;
  href: string;
  type: 'lead' | 'campaign' | 'survey';
};

export type InsightListItem = {
  id: string;
  title: string;
  description?: string;
  category: string;
  evidence?: string;
  importance: InsightImportance;
  importanceLabel: string;
  status: InsightStatus;
  statusLabel: string;
  nextAction?: string;
  createdAt: string;
  relationsCount: number;
};

export type InsightDetail = InsightListItem & {
  leads: InsightRelation[];
  campaigns: InsightRelation[];
  surveys: InsightRelation[];
};

export type InsightOption = { id: string; name: string };

export const insightCategories = [
  'Боль', 'Возражение', 'Желание', 'Продуктовый вывод', 'Маркетинговый вывод',
  'Сегмент', 'Канал привлечения', 'Цена', 'Конкуренты', 'Онбординг', 'Карта', 'CRM'
];

export const insightImportanceToDb: Record<string, InsightImportance> = {
  'Низкая': 'low',
  'Средняя': 'medium',
  'Высокая': 'high',
  'Критично': 'critical'
};

export const insightStatusToDb: Record<string, InsightStatus> = {
  'Новый': 'new',
  'На проверке': 'in_review',
  'Принят': 'accepted',
  'В архиве': 'archived'
};

const importanceLabelMap: Record<string, string> = {
  low: 'Низкая', medium: 'Средняя', high: 'Высокая', critical: 'Критично'
};

const statusLabelMap: Record<string, string> = {
  new: 'Новый', in_review: 'На проверке', accepted: 'Принят', archived: 'В архиве'
};

export function insightImportanceLabel(value?: string | null) {
  return importanceLabelMap[value ?? ''] ?? 'Средняя';
}

export function insightStatusLabel(value?: string | null) {
  return statusLabelMap[value ?? ''] ?? 'Новый';
}

export function insightImportanceTone(value?: string | null): 'purple' | 'pink' | 'green' | 'yellow' | 'red' | 'blue' | 'gray' {
  if (value === 'critical') return 'red';
  if (value === 'high') return 'pink';
  if (value === 'medium') return 'purple';
  return 'gray';
}

export function insightStatusTone(value?: string | null): 'purple' | 'pink' | 'green' | 'yellow' | 'red' | 'blue' | 'gray' {
  if (value === 'accepted') return 'green';
  if (value === 'in_review') return 'yellow';
  if (value === 'archived') return 'gray';
  return 'blue';
}
