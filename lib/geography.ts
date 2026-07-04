import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';

export type GeographyTone = 'purple' | 'pink' | 'green' | 'yellow' | 'red' | 'blue' | 'gray';

export type CitySummary = {
  city: string;
  contacts: number;
  masters: number;
  salons: number;
  clients: number;
  partners: number;
  readyToPilot: number;
  activeParticipants: number;
  hotContacts: number;
  topNiches: string[];
  topSources: string[];
  pilotReadiness: number;
};

export type CityNicheSummary = {
  city: string;
  niche: string;
  contacts: number;
  readyToPilot: number;
  activeParticipants: number;
  hotContacts: number;
  readiness: number;
};

export type LaunchRecommendation = {
  city: string;
  niche: string;
  title: string;
  reason: string;
  score: number;
  nextActions: string[];
};

export type GeographyData = {
  cities: CitySummary[];
  nichesByCity: CityNicheSummary[];
  recommendation: LaunchRecommendation;
  totals: {
    cities: number;
    contacts: number;
    readyToPilot: number;
    activeParticipants: number;
    hotContacts: number;
  };
};

const demoCities: CitySummary[] = [
  {
    city: 'Минск',
    contacts: 86,
    masters: 62,
    salons: 11,
    clients: 9,
    partners: 4,
    readyToPilot: 14,
    activeParticipants: 6,
    hotContacts: 21,
    topNiches: ['Маникюр', 'Брови и ресницы', 'Волосы'],
    topSources: ['Instagram', 'Telegram'],
    pilotReadiness: 84
  },
  {
    city: 'Брест',
    contacts: 42,
    masters: 31,
    salons: 5,
    clients: 4,
    partners: 2,
    readyToPilot: 8,
    activeParticipants: 3,
    hotContacts: 11,
    topNiches: ['Брови и ресницы', 'Маникюр'],
    topSources: ['Telegram', 'Рекомендация'],
    pilotReadiness: 72
  },
  {
    city: 'Гродно',
    contacts: 25,
    masters: 17,
    salons: 4,
    clients: 3,
    partners: 1,
    readyToPilot: 5,
    activeParticipants: 2,
    hotContacts: 7,
    topNiches: ['Косметология', 'Волосы'],
    topSources: ['Instagram', 'Офлайн'],
    pilotReadiness: 58
  },
  {
    city: 'Гомель',
    contacts: 18,
    masters: 12,
    salons: 3,
    clients: 2,
    partners: 1,
    readyToPilot: 2,
    activeParticipants: 1,
    hotContacts: 4,
    topNiches: ['Маникюр', 'Визаж'],
    topSources: ['TikTok', 'Instagram'],
    pilotReadiness: 39
  }
];

const demoNichesByCity: CityNicheSummary[] = [
  { city: 'Минск', niche: 'Маникюр', contacts: 34, readyToPilot: 8, activeParticipants: 4, hotContacts: 10, readiness: 88 },
  { city: 'Минск', niche: 'Брови и ресницы', contacts: 22, readyToPilot: 4, activeParticipants: 1, hotContacts: 6, readiness: 71 },
  { city: 'Брест', niche: 'Брови и ресницы', contacts: 16, readyToPilot: 5, activeParticipants: 2, hotContacts: 6, readiness: 82 },
  { city: 'Брест', niche: 'Маникюр', contacts: 14, readyToPilot: 2, activeParticipants: 1, hotContacts: 3, readiness: 55 },
  { city: 'Гродно', niche: 'Косметология', contacts: 9, readyToPilot: 2, activeParticipants: 1, hotContacts: 3, readiness: 59 },
  { city: 'Гомель', niche: 'Маникюр', contacts: 7, readyToPilot: 1, activeParticipants: 0, hotContacts: 2, readiness: 36 }
];

const demoRecommendation: LaunchRecommendation = {
  city: 'Минск',
  niche: 'Маникюр',
  title: 'Первый локальный фокус: Минск + мастера маникюра',
  reason: 'В городе больше всего контактов, сильнее плотность мастеров и выше готовность к тестированию. Это лучший вариант, чтобы быстро собрать первую карту и проверить реальные заявки.',
  score: 88,
  nextActions: [
    'Добрать до 20 активных мастеров в одной нише',
    'Проверить оффер “клиенты находят вас на карте”',
    'Собрать первые 5–10 клиентских заявок и оформить кейс'
  ]
};

const emptyRecommendation: LaunchRecommendation = {
  city: '—',
  niche: '—',
  title: 'Недостаточно данных для локального фокуса',
  reason: 'Добавь контакты с городами, нишами и стадиями, чтобы Hutka рассчитала лучший город и нишу для первой волны запуска.',
  score: 0,
  nextActions: [
    'Добавить первые контакты с городом и нишей',
    'Перевести заинтересованных людей в тестирование',
    'Вернуться к географии после появления реальных данных'
  ]
};

function toNumber(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === 'string' && value.trim()) return value.split(',').map((item) => item.trim()).filter(Boolean);
  return [];
}

function mapCity(row: Record<string, unknown>): CitySummary {
  return {
    city: String(row.city ?? 'Не указан'),
    contacts: toNumber(row.contacts),
    masters: toNumber(row.masters),
    salons: toNumber(row.salons),
    clients: toNumber(row.clients),
    partners: toNumber(row.partners),
    readyToPilot: toNumber(row.ready_to_pilot),
    activeParticipants: toNumber(row.active_participants),
    hotContacts: toNumber(row.hot_contacts),
    topNiches: toStringArray(row.top_niches),
    topSources: toStringArray(row.top_sources),
    pilotReadiness: toNumber(row.pilot_readiness)
  };
}

function mapCityNiche(row: Record<string, unknown>): CityNicheSummary {
  return {
    city: String(row.city ?? 'Не указан'),
    niche: String(row.niche ?? 'Не указана'),
    contacts: toNumber(row.contacts),
    readyToPilot: toNumber(row.ready_to_pilot),
    activeParticipants: toNumber(row.active_participants),
    hotContacts: toNumber(row.hot_contacts),
    readiness: toNumber(row.readiness)
  };
}

function calculateTotals(cities: CitySummary[]) {
  return {
    cities: cities.length,
    contacts: cities.reduce((sum, city) => sum + city.contacts, 0),
    readyToPilot: cities.reduce((sum, city) => sum + city.readyToPilot, 0),
    activeParticipants: cities.reduce((sum, city) => sum + city.activeParticipants, 0),
    hotContacts: cities.reduce((sum, city) => sum + city.hotContacts, 0)
  };
}

function buildRecommendation(cities: CitySummary[], nichesByCity: CityNicheSummary[]): LaunchRecommendation {
  const bestNiche = nichesByCity[0];
  const bestCity = cities[0];

  if (!bestCity) return emptyRecommendation;

  const city = bestNiche?.city ?? bestCity.city;
  const niche = bestNiche?.niche ?? bestCity.topNiches[0] ?? 'выбранная ниша';
  const score = Math.round(bestNiche?.readiness ?? bestCity.pilotReadiness);

  return {
    city,
    niche,
    title: `Первый локальный фокус: ${city} + ${niche}`,
    reason: `${city} показывает лучшую плотность контактов и готовность к тестированию. Ниша “${niche}” выглядит наиболее перспективной для проверки карты и первых заявок.`,
    score,
    nextActions: [
      `Добрать контакты в связке “${city} + ${niche}” до минимальной плотности`,
      'Перевести заинтересованные контакты в тестирование и помочь им заполнить профиль',
      'Запустить короткую кампанию на клиентов и проверить реальные записи с карты'
    ]
  };
}

export function readinessTone(value: number): GeographyTone {
  if (value >= 75) return 'green';
  if (value >= 55) return 'purple';
  if (value >= 35) return 'yellow';
  return 'gray';
}

export async function getGeographyData(): Promise<GeographyData> {
  if (!isSupabaseConfigured()) {
    return {
      cities: demoCities,
      nichesByCity: demoNichesByCity,
      recommendation: demoRecommendation,
      totals: calculateTotals(demoCities)
    };
  }

  const supabase = await createClient();

  const [citiesResult, nichesResult] = await Promise.all([
    supabase.from('view_geography_city_summary').select('*').order('pilot_readiness', { ascending: false }),
    supabase.from('view_geography_niche_summary').select('*').order('readiness', { ascending: false }).limit(12)
  ]);

  if (citiesResult.error || !citiesResult.data) {
    return {
      cities: [],
      nichesByCity: [],
      recommendation: emptyRecommendation,
      totals: calculateTotals([])
    };
  }

  const cities = citiesResult.data.map((row) => mapCity(row as Record<string, unknown>));
  const nichesByCity = nichesResult.error || !nichesResult.data
    ? []
    : nichesResult.data.map((row) => mapCityNiche(row as Record<string, unknown>));

  return {
    cities,
    nichesByCity,
    recommendation: buildRecommendation(cities, nichesByCity),
    totals: calculateTotals(cities)
  };
}
