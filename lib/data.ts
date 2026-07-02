import {
  BarChart3,
  Brain,
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  FlaskConical,
  Heart,
  MapPinned,
  MessageSquareText,
  Search,
  Send,
  Sparkles,
  Star,
  Timer,
  Users,
  Zap
} from 'lucide-react';

export type LeadType = 'Мастер' | 'Салон' | 'Клиент' | 'Партнер';
export type Priority = 'Высокий' | 'Средний' | 'Низкий';

export type Lead = {
  id: string;
  name: string;
  type: LeadType;
  niche: string;
  city: string;
  stage: string;
  source: string;
  priority: Priority;
  nextStep: string;
  nextDate: string;
  nextDateRaw?: string;
  tags: string[];
  score: number;
  instagram?: string;
  telegram?: string;
  phone?: string;
  email?: string;
  notes?: string;
};

export const navItems = [
  { title: 'Главная', href: '/dashboard', icon: BarChart3 },
  { title: 'Люди', href: '/people', icon: Users },
  { title: 'Воронки', href: '/funnels', icon: Send },
  { title: 'Опросники', href: '/surveys', icon: ClipboardList },
  { title: 'Кампании', href: '/campaigns', icon: Zap },
  { title: 'Задачи', href: '/tasks', icon: CalendarCheck, badge: '12' },
  { title: 'Инсайты', href: '/insights', icon: Sparkles },
  { title: 'География', href: '/geography', icon: MapPinned },
  { title: 'Отчеты', href: '/reports', icon: BarChart3 },
  { title: 'Гипотезы', href: '/hypotheses', icon: Brain },
  { title: 'Настройки', href: '/settings', icon: CheckCircle2 }
];

export const kpis = [
  { label: 'Всего контактов', value: '2 842', delta: '+142 за неделю', icon: Users, tone: 'purple' },
  { label: 'Новых за неделю', value: '312', delta: '+18% к прошлой неделе', icon: Zap, tone: 'blue' },
  { label: 'Готовы к пилоту', value: '128', delta: '+9% к прошлой неделе', icon: Send, tone: 'purple' },
  { label: 'Активные участники', value: '63', delta: '+6% к прошлой неделе', icon: Heart, tone: 'green' },
  { label: 'Просроченные действия', value: '17', delta: '-5 к вчера', icon: Timer, tone: 'red' }
] as const;

export const funnel = [
  { label: 'Найдено', count: 2842, percent: '100%', icon: Search },
  { label: 'Написал', count: 1126, percent: '39,6%', icon: MessageSquareText },
  { label: 'Ответил', count: 612, percent: '21,5%', icon: Send },
  { label: 'Опрос', count: 310, percent: '10,9%', icon: ClipboardList },
  { label: 'Тест', count: 128, percent: '4,5%', icon: FlaskConical },
  { label: 'Активен', count: 63, percent: '2,2%', icon: Star }
];

export const todayTasks = [
  { title: 'Написать новым контактам', count: 18 },
  { title: 'Провести опросы', count: 7 },
  { title: 'Назначить пилот', count: 5 },
  { title: 'Позвонить контактам', count: 4 },
  { title: 'Проверить обратную связь', count: 3 }
];

export const channels = [
  { name: 'Instagram', value: 1128, width: '100%' },
  { name: 'Telegram', value: 642, width: '58%' },
  { name: 'Реклама FB/IG', value: 412, width: '39%' },
  { name: 'Сарафанное радио', value: 298, width: '28%' },
  { name: 'TikTok', value: 192, width: '18%' }
];

export const niches = [
  { name: 'Маникюр', value: 842, width: '100%' },
  { name: 'Брови и ресницы', value: 623, width: '74%' },
  { name: 'Косметология', value: 512, width: '61%' },
  { name: 'Парикмахерские', value: 408, width: '48%' },
  { name: 'Визаж', value: 287, width: '34%' }
];

export const insights = [
  'Конверсия в тест выше у мастеров с опытом от 2 до 5 лет',
  'Лучше всего отвечают контакты из Telegram и Instagram',
  'Рост интереса к нише косметологии в городах 500K+'
];

export const leads: Lead[] = [
  {
    id: 'anna-smirnova',
    name: 'Анна Смирнова',
    type: 'Мастер',
    niche: 'Брови и ресницы',
    city: 'Москва',
    stage: 'Тест',
    source: 'Instagram',
    priority: 'Высокий',
    nextStep: 'Назначить тест',
    nextDate: '22.05.2025',
    tags: ['Горячий контакт', 'Нужны клиенты', 'Нет CRM', 'Готова тестировать'],
    score: 86,
    instagram: '@anna.brows.msk',
    phone: '+7 (916) 123-45-67',
    notes: 'Ведет запись в заметках, хочет больше клиентов и понятную карту.'
  },
  {
    id: 'ekaterina-lebedeva',
    name: 'Екатерина Лебедева',
    type: 'Салон',
    niche: 'Маникюр',
    city: 'Санкт-Петербург',
    stage: 'Опрос',
    source: 'Telegram',
    priority: 'Средний',
    nextStep: 'Отправить опрос',
    nextDate: '21.05.2025',
    tags: ['Салон', 'Есть администратор'],
    score: 62
  },
  {
    id: 'olga-kuznetsova',
    name: 'Ольга Кузнецова',
    type: 'Мастер',
    niche: 'Косметология',
    city: 'Казань',
    stage: 'Ответил',
    source: 'Рекомендация',
    priority: 'Средний',
    nextStep: 'Связаться',
    nextDate: '21.05.2025',
    tags: ['Пустые окна', 'Нужны клиенты'],
    score: 67
  },
  {
    id: 'beauty-line',
    name: 'Салон Beauty Line',
    type: 'Салон',
    niche: 'Парикмахерские',
    city: 'Новосибирск',
    stage: 'Написал',
    source: 'Офлайн',
    priority: 'Низкий',
    nextStep: 'Написать',
    nextDate: '22.05.2025',
    tags: ['Салон', 'Вернуться позже'],
    score: 41
  },
  {
    id: 'darya-volkova',
    name: 'Дарья Волкова',
    type: 'Мастер',
    niche: 'Маникюр',
    city: 'Екатеринбург',
    stage: 'Найдено',
    source: 'TikTok',
    priority: 'Низкий',
    nextStep: 'Написать',
    nextDate: '23.05.2025',
    tags: ['Начинающий мастер'],
    score: 38
  }
];

export const activity = [
  { date: '21.05.2025 10:30', title: 'Назначен тест', text: 'Тест раннего доступа к карте мастеров' },
  { date: '21.05.2025 09:15', title: 'Отправлено сообщение', text: 'Предложение пройти короткий опрос' },
  { date: '20.05.2025 16:45', title: 'Ответила на опрос', text: 'Опрос потребностей мастеров' },
  { date: '19.05.2025 14:20', title: 'Написала в директ', text: 'Ответила на сторис' },
  { date: '18.05.2025 11:05', title: 'Найдена', text: 'Instagram / Reels' }
];

export const needs = [
  'Нестабильный поток клиентов',
  'Нет системы записи и напоминаний',
  'Хочет автоматизировать процессы',
  'Нужна помощь в продвижении',
  'Нет CRM, ведет записи в заметках'
];

export const surveyAnswers = [
  { question: 'Сколько клиентов в неделю?', answer: '10–15' },
  { question: 'Что мешает расти?', answer: 'Нет времени на продвижение' },
  { question: 'Какие инструменты используете?', answer: 'Instagram, WhatsApp' },
  { question: 'Что хотите улучшить?', answer: 'Привлечение клиентов и автоматизация' }
];
