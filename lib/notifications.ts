import { addDays, differenceInCalendarDays, format, isToday, isTomorrow, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { getCurrentUserContext } from '@/lib/permissions';

export type NotificationTone = 'red' | 'yellow' | 'blue' | 'purple' | 'green' | 'pink' | 'gray';
export type NotificationCategory = 'followup' | 'survey' | 'activity' | 'contact' | 'campaign';

export type WorkspaceNotification = {
  key: string;
  category: NotificationCategory;
  tone: NotificationTone;
  title: string;
  description: string;
  date: string;
  dateRaw: string;
  href: string;
  unread: boolean;
  urgent: boolean;
};

export type NotificationStats = {
  total: number;
  unread: number;
  urgent: number;
  overdueFollowUps: number;
  surveyResponses: number;
  hotContacts: number;
};

export type NotificationCenterData = {
  demoMode: boolean;
  stats: NotificationStats;
  notifications: WorkspaceNotification[];
  eventKeys: string[];
};

type TaskRow = {
  id: string;
  title?: string | null;
  due_date?: string | null;
  priority?: string | null;
  leads?: unknown;
};

type AnswerRow = {
  id: string;
  response_group_id?: string | null;
  respondent_name?: string | null;
  respondent_contact?: string | null;
  created_at?: string | null;
  surveys?: unknown;
  leads?: unknown;
};

type InteractionRow = {
  id: string;
  type?: string | null;
  text?: string | null;
  result?: string | null;
  created_at?: string | null;
  leads?: unknown;
};

type LeadRow = {
  id: string;
  name?: string | null;
  type?: string | null;
  niche?: string | null;
  city?: string | null;
  priority_score?: number | null;
  updated_at?: string | null;
  funnel_stages?: unknown;
};

type CampaignRow = {
  id: string;
  name?: string | null;
  status?: string | null;
  contacts?: number | null;
  participants?: number | null;
};

type ReadRow = {
  event_key?: string | null;
};

function relatedLead(value: unknown): { id?: string; name?: string } {
  if (!value) return {};
  if (Array.isArray(value)) return relatedLead(value[0]);
  if (typeof value === 'object') {
    const item = value as { id?: unknown; name?: unknown };
    return {
      id: typeof item.id === 'string' ? item.id : undefined,
      name: typeof item.name === 'string' ? item.name : undefined
    };
  }
  return {};
}

function relatedSurvey(value: unknown): { id?: string; title?: string; slug?: string } {
  if (!value) return {};
  if (Array.isArray(value)) return relatedSurvey(value[0]);
  if (typeof value === 'object') {
    const item = value as { id?: unknown; title?: unknown; slug?: unknown };
    return {
      id: typeof item.id === 'string' ? item.id : undefined,
      title: typeof item.title === 'string' ? item.title : undefined,
      slug: typeof item.slug === 'string' ? item.slug : undefined
    };
  }
  return {};
}

function relatedStageName(value: unknown): string | undefined {
  if (!value) return undefined;
  if (Array.isArray(value)) return relatedStageName(value[0]);
  if (typeof value === 'object' && 'name' in value) {
    const name = (value as { name?: unknown }).name;
    return typeof name === 'string' ? name : undefined;
  }
  return undefined;
}

function typeLabel(value?: string | null) {
  const map: Record<string, string> = {
    master: 'Мастер',
    salon: 'Салон',
    client: 'Клиент',
    partner: 'Партнер'
  };
  return map[value ?? ''] ?? 'Контакт';
}

function interactionTitle(type?: string | null) {
  const map: Record<string, string> = {
    message: 'Новое сообщение',
    call: 'Звонок по контакту',
    meeting: 'Встреча проведена',
    survey_sent: 'Опрос отправлен',
    survey_completed: 'Опрос пройден',
    note: 'Новая заметка',
    status_change: 'Изменение стадии',
    task_status: 'Обновление задачи'
  };
  return map[type ?? ''] ?? 'Активность по контакту';
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  const parsed = parseISO(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  if (isToday(parsed)) return `Сегодня, ${format(parsed, 'HH:mm', { locale: ru })}`;
  if (isTomorrow(parsed)) return `Завтра, ${format(parsed, 'HH:mm', { locale: ru })}`;
  return format(parsed, 'd MMM, HH:mm', { locale: ru });
}

function dueDescription(value?: string | null) {
  if (!value) return 'Срок не указан';
  const parsed = parseISO(value);
  if (Number.isNaN(parsed.getTime())) return 'Срок не указан';
  const diff = differenceInCalendarDays(parsed, new Date());
  if (diff < 0) return `Просрочено на ${Math.abs(diff)} дн.`;
  if (diff === 0) return 'Срок сегодня';
  if (diff === 1) return 'Срок завтра';
  return `Срок через ${diff} дн.`;
}

function normalizeDate(value?: string | null) {
  return value ?? new Date().toISOString();
}

function isUrgentTask(task: TaskRow) {
  if (!task.due_date) return false;
  const parsed = parseISO(task.due_date);
  return !Number.isNaN(parsed.getTime()) && parsed.getTime() < Date.now();
}

function demoNotifications(): NotificationCenterData {
  const now = new Date();
  const notifications: WorkspaceNotification[] = [
    {
      key: 'demo:task:1',
      category: 'followup',
      tone: 'red',
      title: 'Просрочен follow-up',
      description: 'Анна Смирнова ждёт повторного сообщения по пилоту карты.',
      date: 'Сегодня, 10:30',
      dateRaw: now.toISOString(),
      href: '/people/anna-smirnova',
      unread: true,
      urgent: true
    },
    {
      key: 'demo:survey:1',
      category: 'survey',
      tone: 'blue',
      title: 'Новый ответ на опрос',
      description: 'Мастер оставил ответы по боли: нужны новые клиенты и простая запись.',
      date: 'Сегодня, 09:45',
      dateRaw: addDays(now, 0).toISOString(),
      href: '/surveys',
      unread: true,
      urgent: false
    },
    {
      key: 'demo:hot:1',
      category: 'contact',
      tone: 'pink',
      title: 'Горячий контакт',
      description: 'Ольга Кузнецова набрала 86/100 и готова к ручной работе.',
      date: 'Вчера, 18:10',
      dateRaw: addDays(now, -1).toISOString(),
      href: '/people/olga-kuznetsova',
      unread: false,
      urgent: false
    }
  ];

  return buildNotificationData(notifications, true);
}

function buildNotificationData(notifications: WorkspaceNotification[], demoMode = false): NotificationCenterData {
  const sorted = [...notifications].sort((a, b) => Number(b.urgent) - Number(a.urgent) || new Date(b.dateRaw).getTime() - new Date(a.dateRaw).getTime());

  return {
    demoMode,
    notifications: sorted,
    eventKeys: sorted.map((item) => item.key),
    stats: {
      total: sorted.length,
      unread: sorted.filter((item) => item.unread).length,
      urgent: sorted.filter((item) => item.urgent).length,
      overdueFollowUps: sorted.filter((item) => item.category === 'followup' && item.urgent).length,
      surveyResponses: sorted.filter((item) => item.category === 'survey').length,
      hotContacts: sorted.filter((item) => item.category === 'contact').length
    }
  };
}

export async function getNotificationCenterData(): Promise<NotificationCenterData> {
  if (!isSupabaseConfigured()) return demoNotifications();

  try {
    const supabase = await createClient();
    const user = await getCurrentUserContext();

    const [tasksRes, answersRes, interactionsRes, hotLeadsRes, campaignsRes, readsRes] = await Promise.all([
      supabase
        .from('tasks')
        .select('id,title,due_date,priority,leads(id,name)')
        .neq('status', 'done')
        .neq('status', 'cancelled')
        .not('due_date', 'is', null)
        .lte('due_date', addDays(new Date(), 2).toISOString())
        .order('due_date', { ascending: true })
        .limit(20),
      supabase
        .from('survey_answers')
        .select('id,response_group_id,respondent_name,respondent_contact,created_at,surveys(id,title,slug),leads(id,name)')
        .order('created_at', { ascending: false })
        .limit(80),
      supabase
        .from('lead_interactions')
        .select('id,type,text,result,created_at,leads(id,name)')
        .order('created_at', { ascending: false })
        .limit(30),
      supabase
        .from('leads')
        .select('id,name,type,niche,city,priority_score,updated_at,funnel_stages(name)')
        .gte('priority_score', 75)
        .order('updated_at', { ascending: false })
        .limit(15),
      supabase
        .from('view_campaign_performance')
        .select('id,name,status,contacts,participants')
        .eq('status', 'active')
        .order('participants', { ascending: false })
        .limit(10),
      user?.profileId
        ? supabase.from('notification_reads').select('event_key').eq('profile_id', user.profileId)
        : Promise.resolve({ data: [], error: null })
    ]);

    const readKeys = new Set(((readsRes.data ?? []) as ReadRow[]).map((row) => row.event_key).filter((key): key is string => Boolean(key)));
    const notifications: WorkspaceNotification[] = [];

    ((tasksRes.data ?? []) as TaskRow[]).forEach((task) => {
      const lead = relatedLead(task.leads);
      const key = `task:${task.id}`;
      notifications.push({
        key,
        category: 'followup',
        tone: isUrgentTask(task) ? 'red' : 'yellow',
        title: isUrgentTask(task) ? 'Просрочен follow-up' : 'Скоро срок задачи',
        description: `${lead.name ? `${lead.name}: ` : ''}${task.title ?? 'Задача'} · ${dueDescription(task.due_date)}`,
        date: formatDate(task.due_date),
        dateRaw: normalizeDate(task.due_date),
        href: lead.id ? `/people/${lead.id}` : '/tasks',
        unread: !readKeys.has(key),
        urgent: isUrgentTask(task)
      });
    });

    const groupedAnswers = new Map<string, AnswerRow>();
    ((answersRes.data ?? []) as AnswerRow[]).forEach((answer) => {
      const key = answer.response_group_id ?? answer.id;
      if (!groupedAnswers.has(key)) groupedAnswers.set(key, answer);
    });

    Array.from(groupedAnswers.entries()).slice(0, 20).forEach(([groupKey, answer]) => {
      const survey = relatedSurvey(answer.surveys);
      const lead = relatedLead(answer.leads);
      const key = `survey:${groupKey}`;
      const respondent = lead.name ?? answer.respondent_name ?? answer.respondent_contact ?? 'Новый респондент';
      notifications.push({
        key,
        category: 'survey',
        tone: 'blue',
        title: 'Новый ответ на опрос',
        description: `${respondent} прошел(ла) опрос «${survey.title ?? 'Без названия'}».`,
        date: formatDate(answer.created_at),
        dateRaw: normalizeDate(answer.created_at),
        href: survey.id ? `/surveys/${survey.id}` : '/surveys',
        unread: !readKeys.has(key),
        urgent: false
      });
    });

    ((interactionsRes.data ?? []) as InteractionRow[]).slice(0, 18).forEach((interaction) => {
      const lead = relatedLead(interaction.leads);
      const key = `interaction:${interaction.id}`;
      notifications.push({
        key,
        category: 'activity',
        tone: 'purple',
        title: interactionTitle(interaction.type),
        description: `${lead.name ? `${lead.name}: ` : ''}${interaction.text || interaction.result || 'Новая активность'}`,
        date: formatDate(interaction.created_at),
        dateRaw: normalizeDate(interaction.created_at),
        href: lead.id ? `/people/${lead.id}` : '/people',
        unread: !readKeys.has(key),
        urgent: false
      });
    });

    ((hotLeadsRes.data ?? []) as LeadRow[]).forEach((lead) => {
      const key = `hot:${lead.id}`;
      const stage = relatedStageName(lead.funnel_stages) ?? 'Без стадии';
      notifications.push({
        key,
        category: 'contact',
        tone: 'pink',
        title: 'Горячий контакт',
        description: `${lead.name ?? 'Контакт'} · ${typeLabel(lead.type)} · ${lead.niche || 'ниша не указана'} · стадия ${stage} · ${lead.priority_score ?? 0}/100`,
        date: formatDate(lead.updated_at),
        dateRaw: normalizeDate(lead.updated_at),
        href: `/people/${lead.id}`,
        unread: !readKeys.has(key),
        urgent: false
      });
    });

    ((campaignsRes.data ?? []) as CampaignRow[]).forEach((campaign) => {
      if ((campaign.contacts ?? 0) === 0) return;
      const key = `campaign:${campaign.id}:${campaign.contacts}:${campaign.participants}`;
      notifications.push({
        key,
        category: 'campaign',
        tone: 'green',
        title: 'Активная кампания с результатом',
        description: `${campaign.name ?? 'Кампания'}: ${campaign.contacts ?? 0} контактов, ${campaign.participants ?? 0} готовы к пилоту.`,
        date: formatDate(new Date().toISOString()),
        dateRaw: new Date().toISOString(),
        href: `/campaigns/${campaign.id}`,
        unread: !readKeys.has(key),
        urgent: false
      });
    });

    return buildNotificationData(notifications.slice(0, 60));
  } catch {
    return buildNotificationData([]);
  }
}

export async function getUnreadNotificationCount(): Promise<number> {
  const data = await getNotificationCenterData();
  return data.stats.unread;
}
