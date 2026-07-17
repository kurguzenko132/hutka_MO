export type QuestionType = 'short_text' | 'long_text' | 'single_choice' | 'multiple_choice' | 'yes_no' | 'number' | 'rating';
export type QuestionPackAudience = 'master' | 'salon' | 'client' | 'partner' | 'any';
export type QuestionPackStatus = 'active' | 'draft' | 'archived';

export type QuestionPackQuestion = {
  id?: string;
  text: string;
  type: QuestionType;
  required?: boolean;
  options?: string[];
  orderIndex?: number;
};

export type QuestionPack = {
  id: string;
  title: string;
  shortTitle: string;
  description: string;
  audience: QuestionPackAudience;
  badge: string;
  status?: QuestionPackStatus;
  questions: QuestionPackQuestion[];
};

export type QuestionPackListItem = Omit<QuestionPack, 'questions'> & {
  questionsCount: number;
  createdAt?: string;
  updatedAt?: string;
};

export const questionTypeOptions: Array<{ value: QuestionType; label: string }> = [
  { value: 'short_text', label: 'Короткий ответ' },
  { value: 'long_text', label: 'Развернутый ответ' },
  { value: 'single_choice', label: 'Один вариант' },
  { value: 'multiple_choice', label: 'Несколько вариантов' },
  { value: 'yes_no', label: 'Да / нет' },
  { value: 'number', label: 'Число' },
  { value: 'rating', label: 'Оценка' }
];

export const questionPackAudienceOptions: Array<{ value: QuestionPackAudience; label: string }> = [
  { value: 'master', label: 'Мастер' },
  { value: 'salon', label: 'Салон' },
  { value: 'client', label: 'Клиент' },
  { value: 'partner', label: 'Партнер' },
  { value: 'any', label: 'Любой контакт' }
];

export const questionPackStatusOptions: Array<{ value: QuestionPackStatus; label: string }> = [
  { value: 'active', label: 'Активен' },
  { value: 'draft', label: 'Черновик' },
  { value: 'archived', label: 'Архив' }
];

function labelByValue<T extends string>(items: Array<{ value: T; label: string }>, value: string) {
  return items.find((item) => item.value === value)?.label ?? value;
}

export function questionTypeLabel(type: string) {
  return labelByValue(questionTypeOptions, type);
}

export function questionPackAudienceLabel(audience: string) {
  return labelByValue(questionPackAudienceOptions, audience);
}

export function questionPackStatusLabel(status: string) {
  return labelByValue(questionPackStatusOptions, status);
}
