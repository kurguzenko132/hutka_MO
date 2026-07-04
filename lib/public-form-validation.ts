export const publicFormHoneypotName = 'website';

export const publicFormLimits = {
  respondentName: 120,
  respondentContact: 180,
  answerValue: 4000,
  answerValues: 20,
  totalAnswerLength: 20000
};

export function hasPublicFormHoneypot(formData: FormData) {
  return String(formData.get(publicFormHoneypotName) ?? '').trim().length > 0;
}

export function getLimitedText(formData: FormData, key: string, limit: number) {
  const value = String(formData.get(key) ?? '').trim();
  return value.length <= limit ? value : null;
}

export function getLimitedValues(formData: FormData, key: string) {
  const values = formData.getAll(key).map((value) => String(value).trim()).filter(Boolean);
  if (values.length > publicFormLimits.answerValues) return null;
  if (values.some((value) => value.length > publicFormLimits.answerValue)) return null;
  return values;
}

export function answerLength(answer: string | string[]) {
  return Array.isArray(answer) ? answer.reduce((sum, value) => sum + value.length, 0) : answer.length;
}
