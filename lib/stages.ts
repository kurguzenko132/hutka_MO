import type { BadgeTone } from '@/components/ui/badge';

export type CanonicalStage = {
  id: string;
  name: string;
  color: BadgeTone;
  orderIndex: number;
  aliases: string[];
};

export const canonicalFunnelStages: CanonicalStage[] = [
  { id: 'new', name: 'Новый', color: 'gray', orderIndex: 1, aliases: ['найден', 'найдено', 'новый', 'новая'] },
  { id: 'message', name: 'Написали', color: 'purple', orderIndex: 2, aliases: ['написал', 'написали', 'написана'] },
  { id: 'replied', name: 'Ответил', color: 'blue', orderIndex: 3, aliases: ['ответил', 'ответила', 'ответили'] },
  {
    id: 'interested',
    name: 'Заинтересован',
    color: 'yellow',
    orderIndex: 4,
    aliases: ['заинтересован', 'заинтересована', 'опрос', 'анкета', 'готов к пилоту', 'горячий контакт', 'горячий лид']
  },
  {
    id: 'testing',
    name: 'Тестирует',
    color: 'green',
    orderIndex: 5,
    aliases: ['тест', 'тестирует', 'тестирование', 'активен', 'активна', 'активный участник', 'тестер', 'пилот', 'готов тестировать', 'готова тестировать']
  },
  { id: 'paused', name: 'Пауза', color: 'gray', orderIndex: 6, aliases: ['пауза', 'вернуться позже', 'отложен', 'отложена'] },
  { id: 'refused', name: 'Отказ', color: 'red', orderIndex: 7, aliases: ['отказ', 'отказы', 'lost', 'rejected'] }
];

export const canonicalFunnelStageNames = canonicalFunnelStages.map((stage) => stage.name);

const aliasToStage = new Map<string, CanonicalStage>();
for (const stage of canonicalFunnelStages) {
  aliasToStage.set(normalizeKey(stage.name), stage);
  stage.aliases.forEach((alias) => aliasToStage.set(normalizeKey(alias), stage));
}

function normalizeKey(value?: string | null) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replaceAll('ё', 'е');
}

export function getCanonicalStage(value?: string | null) {
  const key = normalizeKey(value);
  return aliasToStage.get(key) ?? canonicalFunnelStages[0];
}

export function normalizeStageName(value?: string | null) {
  return getCanonicalStage(value).name;
}

export function normalizeContactTagName(value?: string | null) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';

  const key = normalizeKey(raw);
  if (['горячий контакт', 'горячий лид', 'готов к пилоту'].includes(key)) return 'Заинтересован';
  if (['готов тестировать', 'готова тестировать', 'тестер', 'пилот'].includes(key)) return 'Тестирует';
  return raw.replace(/пилот/gi, 'тестирование');
}

export function uniqueNormalizedTags(values: Array<string | undefined | null>) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const tag = normalizeContactTagName(value);
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    result.push(tag);
  }

  return result;
}

export function stageTone(stage?: string | null): BadgeTone {
  return getCanonicalStage(stage).color;
}

export function isInterestedStage(stage?: string | null) {
  return normalizeStageName(stage) === 'Заинтересован';
}

export function isTestingStage(stage?: string | null) {
  return normalizeStageName(stage) === 'Тестирует';
}

export function isPausedStage(stage?: string | null) {
  return normalizeStageName(stage) === 'Пауза';
}

export function isRefusedStage(stage?: string | null) {
  return normalizeStageName(stage) === 'Отказ';
}

export function orderStageNames(values: Array<string | undefined | null>) {
  const normalized = Array.from(new Set(values.map((value) => normalizeStageName(value)).filter(Boolean)));
  const order = new Map(canonicalFunnelStages.map((stage) => [stage.name, stage.orderIndex]));
  return normalized.sort((a, b) => (order.get(a) ?? 999) - (order.get(b) ?? 999) || a.localeCompare(b, 'ru'));
}
