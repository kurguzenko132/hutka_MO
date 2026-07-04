import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';

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

export const defaultQuestionPacks: QuestionPack[] = [
  {
    id: 'master-discovery',
    title: 'Диагностика индивидуального мастера',
    shortTitle: 'Мастер: диагностика',
    audience: 'master',
    badge: 'старт',
    status: 'active',
    description: 'Базовый пакет, чтобы быстро понять нишу, запись, клиентов, боли и готовность к пилоту.',
    questions: [
      { text: 'Какое у вас beauty-направление и какие основные услуги вы оказываете?', type: 'long_text', required: true },
      { text: 'В каком городе и районе вы принимаете клиентов?', type: 'short_text', required: true },
      { text: 'Как сейчас клиенты записываются к вам?', type: 'single_choice', required: true, options: ['Instagram Direct', 'Telegram', 'WhatsApp/Viber', 'Телефон', 'Онлайн-запись', 'Через администратора', 'Другое'] },
      { text: 'Есть ли у вас свободные окна, которые хотелось бы заполнять?', type: 'single_choice', required: true, options: ['Да, часто', 'Иногда', 'Редко', 'Почти нет свободных окон'] },
      { text: 'Какая главная проблема сейчас: клиенты, запись, повторные визиты, продвижение или другое?', type: 'long_text', required: true },
      { text: 'Пользуетесь ли вы CRM или сервисом онлайн-записи?', type: 'yes_no', required: true },
      { text: 'Что должно быть в приложении, чтобы вы реально начали им пользоваться?', type: 'long_text', required: true },
      { text: 'Готовы ли протестировать раннюю версию Hutka?', type: 'single_choice', required: true, options: ['Да, готов(а)', 'Можно попробовать позже', 'Пока не готов(а)', 'Нужно больше информации'] }
    ]
  },
  {
    id: 'master-map-profile',
    title: 'Профиль мастера для карты',
    shortTitle: 'Мастер: профиль на карте',
    audience: 'master',
    badge: 'карта',
    status: 'active',
    description: 'Пак для сбора данных, которые нужны для карточки мастера на карте: услуги, цены, фото, адрес, расписание.',
    questions: [
      { text: 'Как вы хотите, чтобы назывался ваш профиль на карте?', type: 'short_text', required: true },
      { text: 'Опишите себя как мастера в 2–4 предложениях.', type: 'long_text', required: true },
      { text: 'Какие 3–7 услуг нужно показать в первую очередь?', type: 'long_text', required: true },
      { text: 'Какая стартовая цена или диапазон цен по основным услугам?', type: 'short_text', required: true },
      { text: 'Где вы принимаете клиентов: салон, студия, дом, выезд?', type: 'single_choice', required: true, options: ['Салон', 'Студия', 'На дому', 'Выезд к клиенту', 'Смешанный формат'] },
      { text: 'Какие дни и время обычно доступны для записи?', type: 'long_text', required: true },
      { text: 'Какие фото/материалы вы готовы добавить в профиль?', type: 'multiple_choice', required: false, options: ['Фото работ', 'Фото рабочего места', 'Портфолио Instagram', 'Отзывы клиентов', 'Прайс', 'Сертификаты'] },
      { text: 'Что важно подчеркнуть в вашем профиле, чтобы клиент выбрал именно вас?', type: 'long_text', required: false }
    ]
  },
  {
    id: 'salon-discovery',
    title: 'Диагностика салона',
    shortTitle: 'Салон: диагностика',
    audience: 'salon',
    badge: 'b2b',
    status: 'active',
    description: 'Пак для салона: команда, запись, администраторы, текущая CRM, проблемы и интерес к карте.',
    questions: [
      { text: 'Сколько мастеров работает в салоне и какие направления закрываете?', type: 'long_text', required: true },
      { text: 'Кто сейчас ведет запись клиентов?', type: 'single_choice', required: true, options: ['Администратор', 'Владелец', 'Каждый мастер сам', 'CRM/онлайн-запись', 'Смешанный формат'] },
      { text: 'Какой системой сейчас пользуетесь для записи и клиентской базы?', type: 'short_text', required: true },
      { text: 'Что не устраивает в текущем процессе записи или CRM?', type: 'long_text', required: true },
      { text: 'Есть ли проблема с пустыми окнами у мастеров?', type: 'single_choice', required: true, options: ['Да, часто', 'Иногда', 'Нет, загрузка стабильная', 'Сложно оценить'] },
      { text: 'Нужен ли салону дополнительный канал заявок через карту?', type: 'yes_no', required: true },
      { text: 'Какие роли нужны в системе: владелец, администратор, мастер, управляющий?', type: 'multiple_choice', required: true, options: ['Владелец', 'Администратор', 'Управляющий', 'Мастер', 'Маркетолог'] },
      { text: 'На каких условиях вы готовы протестировать Hutka?', type: 'long_text', required: false }
    ]
  },
  {
    id: 'pilot-feedback',
    title: 'Обратная связь после пилота',
    shortTitle: 'Фидбек после теста',
    audience: 'any',
    badge: 'фидбек',
    status: 'active',
    description: 'Пак после тестирования: что понятно, что мешает, чего не хватило, готовность пользоваться дальше.',
    questions: [
      { text: 'Что было самым понятным и полезным в Hutka?', type: 'long_text', required: true },
      { text: 'Что было непонятно или неудобно?', type: 'long_text', required: true },
      { text: 'Какую оценку вы бы поставили текущей версии?', type: 'rating', required: true },
      { text: 'Какая функция нужна вам в первую очередь?', type: 'long_text', required: true },
      { text: 'Будете ли пользоваться дальше, если мы доработаем замечания?', type: 'single_choice', required: true, options: ['Да', 'Скорее да', 'Не уверен(а)', 'Скорее нет', 'Нет'] },
      { text: 'Что должно измениться, чтобы вы точно остались?', type: 'long_text', required: false },
      { text: 'Можно ли использовать ваш отзыв как кейс/цитату?', type: 'yes_no', required: false }
    ]
  },
  {
    id: 'refusal-reason',
    title: 'Причина отказа / паузы',
    shortTitle: 'Причина отказа',
    audience: 'any',
    badge: 'отказ',
    status: 'active',
    description: 'Короткий пак, чтобы понять, почему человек не идет дальше, и можно ли вернуться позже.',
    questions: [
      { text: 'Почему сейчас не готовы тестировать Hutka?', type: 'single_choice', required: true, options: ['Нет времени', 'Неактуально', 'Уже есть CRM', 'Не понимаю пользу', 'Не хочу заполнять профиль', 'Не верю, что будут заявки', 'Не готов(а) платить', 'Другое'] },
      { text: 'Что могло бы изменить ваше решение?', type: 'long_text', required: false },
      { text: 'Можно ли вернуться к вам позже?', type: 'single_choice', required: true, options: ['Да, через 1–2 недели', 'Да, через месяц', 'Да, позже', 'Нет'] },
      { text: 'Какой формат был бы удобнее: короткий созвон, видео-демо, текстовая инструкция или готовый профиль?', type: 'multiple_choice', required: false, options: ['Короткий созвон', 'Видео-демо', 'Текстовая инструкция', 'Помощь с заполнением профиля', 'Не нужно'] }
    ]
  },
  {
    id: 'client-map-research',
    title: 'Исследование клиента карты',
    shortTitle: 'Клиент: карта',
    audience: 'client',
    badge: 'b2c',
    status: 'active',
    description: 'Пак для клиентов, чтобы понять, как они ищут мастеров и что должно быть в карточке на карте.',
    questions: [
      { text: 'Как вы обычно ищете beauty-мастера?', type: 'multiple_choice', required: true, options: ['Instagram', 'TikTok', 'Google/Яндекс', 'По рекомендациям', 'Карты', 'Telegram-чаты', 'Сервисы записи', 'Другое'] },
      { text: 'Что важнее при выборе мастера?', type: 'multiple_choice', required: true, options: ['Фото работ', 'Отзывы', 'Цена', 'Близость', 'Свободное время', 'Опыт', 'Сертификаты', 'Скорость ответа'] },
      { text: 'Записались бы вы к мастеру через карту, если видны работы, цены, отзывы и свободные окна?', type: 'yes_no', required: true },
      { text: 'Что должно быть в карточке мастера, чтобы вызвать доверие?', type: 'long_text', required: true },
      { text: 'Какая главная причина не записаться через приложение?', type: 'long_text', required: false }
    ]
  }
];

function parseOptions(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((item) => String(item)).filter(Boolean);
  if (typeof value === 'string') {
    try {
      return parseOptions(JSON.parse(value) as unknown);
    } catch {
      return value.split(/\n|,/).map((item) => item.trim()).filter(Boolean);
    }
  }
  return [];
}

function asAudience(value: unknown): QuestionPackAudience {
  const text = String(value ?? 'any');
  return ['master', 'salon', 'client', 'partner', 'any'].includes(text) ? (text as QuestionPackAudience) : 'any';
}

function asStatus(value: unknown): QuestionPackStatus {
  const text = String(value ?? 'active');
  return ['active', 'draft', 'archived'].includes(text) ? (text as QuestionPackStatus) : 'active';
}

function asQuestionType(value: unknown): QuestionType {
  const text = String(value ?? 'short_text');
  return ['short_text', 'long_text', 'single_choice', 'multiple_choice', 'yes_no', 'number', 'rating'].includes(text) ? (text as QuestionType) : 'short_text';
}

function labelByValue<T extends string>(items: Array<{ value: T; label: string }>, value: T) {
  return items.find((item) => item.value === value)?.label ?? value;
}

export function questionTypeLabel(type: string) {
  return labelByValue(questionTypeOptions, asQuestionType(type));
}

export function questionPackAudienceLabel(audience: string) {
  return labelByValue(questionPackAudienceOptions, asAudience(audience));
}

export function questionPackStatusLabel(status: string) {
  return labelByValue(questionPackStatusOptions, asStatus(status));
}

function mapStaticPack(pack: QuestionPack): QuestionPackListItem {
  return {
    id: pack.id,
    title: pack.title,
    shortTitle: pack.shortTitle,
    description: pack.description,
    audience: pack.audience,
    badge: pack.badge,
    status: pack.status ?? 'active',
    questionsCount: pack.questions.length
  };
}

function relatedCount(value: unknown) {
  return Array.isArray(value) ? value.length : 0;
}

function mapPackRow(row: Record<string, unknown>): QuestionPackListItem {
  return {
    id: String(row.id),
    title: String(row.title ?? 'Пак вопросов'),
    shortTitle: String(row.short_title ?? row.title ?? 'Пак'),
    description: String(row.description ?? ''),
    audience: asAudience(row.audience),
    badge: String(row.badge ?? 'пак'),
    status: asStatus(row.status),
    questionsCount: typeof row.questions_count === 'number' ? row.questions_count : relatedCount(row.question_pack_questions),
    createdAt: row.created_at ? String(row.created_at) : undefined,
    updatedAt: row.updated_at ? String(row.updated_at) : undefined
  };
}

function mapQuestionRow(row: Record<string, unknown>): QuestionPackQuestion {
  return {
    id: String(row.id),
    text: String(row.question_text ?? 'Вопрос'),
    type: asQuestionType(row.question_type),
    options: parseOptions(row.options),
    required: Boolean(row.required),
    orderIndex: Number(row.order_index ?? 0)
  };
}

export async function getQuestionPacks(audience?: QuestionPackAudience | 'all', includeInactive = false): Promise<QuestionPack[]> {
  if (!isSupabaseConfigured()) {
    return defaultQuestionPacks.filter((pack) => {
      const audienceMatch = !audience || audience === 'all' || pack.audience === audience || pack.audience === 'any';
      const statusMatch = includeInactive || (pack.status ?? 'active') === 'active';
      return audienceMatch && statusMatch;
    });
  }

  try {
    const supabase = await createClient();
    let query = supabase
      .from('question_packs')
      .select('id,title,short_title,description,audience,badge,status,created_at,updated_at,question_pack_questions(id,question_text,question_type,options,required,order_index)')
      .order('created_at', { ascending: true });

    if (!includeInactive) query = query.eq('status', 'active');
    if (audience && audience !== 'all') query = query.in('audience', [audience, 'any']);

    const { data, error } = await query;
    if (error || !data) return [];

    return data.map((raw) => {
      const row = raw as Record<string, unknown>;
      const questions = Array.isArray(row.question_pack_questions)
        ? row.question_pack_questions
            .map((question) => mapQuestionRow(question as Record<string, unknown>))
            .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
        : [];
      return {
        id: String(row.id),
        title: String(row.title ?? 'Пак вопросов'),
        shortTitle: String(row.short_title ?? row.title ?? 'Пак'),
        description: String(row.description ?? ''),
        audience: asAudience(row.audience),
        badge: String(row.badge ?? 'пак'),
        status: asStatus(row.status),
        questions
      };
    });
  } catch {
    return [];
  }
}

export async function getQuestionPackList(includeInactive = true): Promise<QuestionPackListItem[]> {
  if (!isSupabaseConfigured()) return defaultQuestionPacks.map(mapStaticPack);

  try {
    const supabase = await createClient();
    let query = supabase
      .from('question_packs')
      .select('id,title,short_title,description,audience,badge,status,created_at,updated_at,question_pack_questions(id)')
      .order('created_at', { ascending: true });

    if (!includeInactive) query = query.eq('status', 'active');

    const { data, error } = await query;
    if (error || !data) return [];
    return data.map((row) => mapPackRow(row as Record<string, unknown>));
  } catch {
    return [];
  }
}

export async function getQuestionPackById(id: string): Promise<QuestionPack | null> {
  if (!id) return null;

  if (!isSupabaseConfigured()) {
    return defaultQuestionPacks.find((pack) => pack.id === id) ?? null;
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('question_packs')
      .select('id,title,short_title,description,audience,badge,status,question_pack_questions(id,question_text,question_type,options,required,order_index)')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) return null;

    const row = data as Record<string, unknown>;
    const questions = Array.isArray(row.question_pack_questions)
      ? row.question_pack_questions
          .map((question) => mapQuestionRow(question as Record<string, unknown>))
          .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
      : [];

    return {
      id: String(row.id),
      title: String(row.title ?? 'Пак вопросов'),
      shortTitle: String(row.short_title ?? row.title ?? 'Пак'),
      description: String(row.description ?? ''),
      audience: asAudience(row.audience),
      badge: String(row.badge ?? 'пак'),
      status: asStatus(row.status),
      questions
    };
  } catch {
    return null;
  }
}
