import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { leads as demoLeads } from '@/lib/data';
import { isRefusedStage, normalizeStageName } from '@/lib/stages';

export type FollowUpReason =
  | 'overdue_followup'
  | 'today_followup'
  | 'missing_next_action'
  | 'hot_without_task'
  | 'unanswered_questionnaire'
  | 'stale_stage';

export type FollowUpRecommendation = {
  id: string;
  leadId: string;
  leadName: string;
  meta: string;
  stage: string;
  score: number;
  reason: FollowUpReason;
  title: string;
  description: string;
  suggestedTaskTitle: string;
  suggestedTaskDescription: string;
  suggestedDueDate: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  priorityLabel: string;
  tone: 'red' | 'yellow' | 'purple' | 'green' | 'blue' | 'gray' | 'pink';
  href: string;
  hasOpenTask: boolean;
  lastActivityLabel: string;
  questionnaireId?: string;
  questionnaireTitle?: string;
};

export type FollowUpSummary = {
  total: number;
  urgent: number;
  overdue: number;
  today: number;
  hot: number;
  questionnaires: number;
  withoutTasks: number;
};

export type FollowUpData = {
  recommendations: FollowUpRecommendation[];
  summary: FollowUpSummary;
  demoMode: boolean;
};

export type FollowUpDirectoryPage = {
  recommendations: FollowUpRecommendation[];
  bulkCandidates: FollowUpRecommendation[];
  summary: FollowUpSummary;
  total: number;
  currentPage: number;
  pageCount: number;
  pageSize: number;
  demoMode: boolean;
};

type DbLead = {
  id: string;
  name: string | null;
  niche: string | null;
  city: string | null;
  priority_score: number | null;
  next_step: string | null;
  next_contact_date: string | null;
  created_at: string | null;
  funnel_stages?: { name?: string | null } | { name?: string | null }[] | null;
};

type DbTask = {
  id: string;
  lead_id: string | null;
  title: string | null;
  status: string | null;
};

type DbQuestionnaire = {
  id: string;
  lead_id: string | null;
  title: string | null;
  status: string | null;
  created_at: string | null;
  lead_questionnaire_answers?: Array<{ id?: string | null }> | null;
};

function relatedStage(value: DbLead['funnel_stages']) {
  if (!value) return normalizeStageName();
  if (Array.isArray(value)) return normalizeStageName(value[0]?.name);
  return normalizeStageName(value.name);
}

function todayStart() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function addDays(days: number) {
  const date = todayStart();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function parseDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function dayDiff(value?: string | null) {
  const date = parseDate(value);
  if (!date) return undefined;
  const normalized = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((normalized.getTime() - todayStart().getTime()) / 86_400_000);
}

function formatDate(value?: string | null) {
  const date = parseDate(value);
  if (!date) return 'нет активности';
  return date.toLocaleDateString('ru-RU');
}

function priorityLabel(priority: FollowUpRecommendation['priority']) {
  const map = {
    low: 'Низкий',
    medium: 'Средний',
    high: 'Высокий',
    urgent: 'Срочно'
  } satisfies Record<FollowUpRecommendation['priority'], string>;
  return map[priority];
}

function stageNeedsMovement(stage: string) {
  const value = stage.toLowerCase();
  return ['новый', 'напис', 'ответ', 'заинтерес'].some((part) => value.includes(part));
}

function isRefused(stage: string) {
  return isRefusedStage(stage);
}

function titleForReason(reason: FollowUpReason) {
  const map: Record<FollowUpReason, string> = {
    overdue_followup: 'Просрочено действие',
    today_followup: 'Нужно сделать сегодня',
    missing_next_action: 'Нет запланированного действия',
    hot_without_task: 'Заинтересованный без действия',
    unanswered_questionnaire: 'Ждет ответа на вопросы',
    stale_stage: 'Давно без движения'
  };
  return map[reason];
}

function taskTitleForReason(reason: FollowUpReason, leadName: string) {
  const map: Record<FollowUpReason, string> = {
    overdue_followup: `Вернуться к контакту: ${leadName}`,
    today_followup: `Связаться сегодня: ${leadName}`,
    missing_next_action: `Назначить следующий шаг: ${leadName}`,
    hot_without_task: `Закрепить действие для контакта: ${leadName}`,
    unanswered_questionnaire: `Напомнить пройти анкету: ${leadName}`,
    stale_stage: `Разобрать зависший контакт: ${leadName}`
  };
  return map[reason];
}

function buildRecommendation(input: {
  lead: { id: string; name: string; meta: string; stage: string; score: number; nextStep?: string | null; nextContactDate?: string | null; lastActivity?: string | null };
  reason: FollowUpReason;
  description: string;
  dueDate?: string;
  priority?: FollowUpRecommendation['priority'];
  hasOpenTask: boolean;
  questionnaireId?: string;
  questionnaireTitle?: string;
}): FollowUpRecommendation {
  const priority = input.priority ?? 'medium';
  const toneByReason: Record<FollowUpReason, FollowUpRecommendation['tone']> = {
    overdue_followup: 'red',
    today_followup: 'yellow',
    missing_next_action: 'yellow',
    hot_without_task: 'purple',
    unanswered_questionnaire: 'blue',
    stale_stage: 'pink'
  };

  return {
    id: `${input.reason}:${input.lead.id}${input.questionnaireId ? `:${input.questionnaireId}` : ''}`,
    leadId: input.lead.id,
    leadName: input.lead.name,
    meta: input.lead.meta,
    stage: input.lead.stage,
    score: input.lead.score,
    reason: input.reason,
    title: titleForReason(input.reason),
    description: input.description,
    suggestedTaskTitle: taskTitleForReason(input.reason, input.lead.name),
    suggestedTaskDescription: `Автоматическая рекомендация Hutka. Причина: ${titleForReason(input.reason)}. ${input.description}`,
    suggestedDueDate: input.dueDate ?? addDays(1),
    priority,
    priorityLabel: priorityLabel(priority),
    tone: toneByReason[input.reason],
    href: `/people/${input.lead.id}`,
    hasOpenTask: input.hasOpenTask,
    lastActivityLabel: formatDate(input.lead.lastActivity),
    questionnaireId: input.questionnaireId,
    questionnaireTitle: input.questionnaireTitle
  };
}

function summarize(recommendations: FollowUpRecommendation[]): FollowUpSummary {
  return {
    total: recommendations.length,
    urgent: recommendations.filter((item) => item.priority === 'urgent').length,
    overdue: recommendations.filter((item) => item.reason === 'overdue_followup').length,
    today: recommendations.filter((item) => item.reason === 'today_followup').length,
    hot: recommendations.filter((item) => item.reason === 'hot_without_task').length,
    questionnaires: recommendations.filter((item) => item.reason === 'unanswered_questionnaire').length,
    withoutTasks: recommendations.filter((item) => !item.hasOpenTask).length
  };
}

function sortRecommendations(items: FollowUpRecommendation[]) {
  const weight: Record<FollowUpRecommendation['priority'], number> = { urgent: 0, high: 1, medium: 2, low: 3 };
  return [...items].sort((a, b) => {
    const priorityDiff = weight[a.priority] - weight[b.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return b.score - a.score;
  });
}

function buildDemoRecommendations(): FollowUpRecommendation[] {
  return sortRecommendations([
    buildRecommendation({
      lead: { id: demoLeads[0].id, name: demoLeads[0].name, meta: `${demoLeads[0].type} · ${demoLeads[0].niche} · ${demoLeads[0].city}`, stage: demoLeads[0].stage, score: demoLeads[0].score, lastActivity: new Date(Date.now() - 86400000).toISOString() },
      reason: 'hot_without_task',
      description: 'Высокий приоритет и интерес, но нет закрепленной задачи на следующий шаг.',
      priority: 'high',
      dueDate: addDays(0),
      hasOpenTask: false
    }),
    buildRecommendation({
      lead: { id: demoLeads[1].id, name: demoLeads[1].name, meta: `${demoLeads[1].type} · ${demoLeads[1].niche} · ${demoLeads[1].city}`, stage: demoLeads[1].stage, score: demoLeads[1].score, lastActivity: new Date(Date.now() - 5 * 86400000).toISOString() },
      reason: 'unanswered_questionnaire',
      description: 'Анкета была отправлена, но ответа еще нет. Нужно мягко напомнить.',
      priority: 'medium',
      dueDate: addDays(1),
      hasOpenTask: false,
      questionnaireId: 'demo-questionnaire',
      questionnaireTitle: 'Мастер: диагностика'
    }),
    buildRecommendation({
      lead: { id: demoLeads[2].id, name: demoLeads[2].name, meta: `${demoLeads[2].type} · ${demoLeads[2].niche} · ${demoLeads[2].city}`, stage: demoLeads[2].stage, score: demoLeads[2].score, lastActivity: new Date(Date.now() - 9 * 86400000).toISOString() },
      reason: 'stale_stage',
      description: 'Контакт давно не двигался по воронке. Нужно решить: дожимать, отправить анкету или перевести в паузу.',
      priority: 'medium',
      dueDate: addDays(2),
      hasOpenTask: true
    })
  ]);
}

function safeNumber(value: unknown) {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseFollowUpReason(value: unknown): FollowUpReason | null {
  const reason = String(value ?? '');
  const values: FollowUpReason[] = [
    'overdue_followup',
    'today_followup',
    'missing_next_action',
    'hot_without_task',
    'unanswered_questionnaire',
    'stale_stage'
  ];
  return values.includes(reason as FollowUpReason) ? reason as FollowUpReason : null;
}

function recommendationFromDirectoryRow(row: Record<string, unknown>): FollowUpRecommendation | null {
  const reason = parseFollowUpReason(row.reason);
  const leadId = String(row.id ?? '');
  if (!reason || !leadId) return null;

  const score = safeNumber(row.priority_score);
  const nextContactDate = row.next_contact_date ? String(row.next_contact_date) : null;
  const lastActivity = row.last_activity ? String(row.last_activity) : row.created_at ? String(row.created_at) : null;
  const overdueDays = Math.abs(dayDiff(nextContactDate) ?? 0);
  const staleDays = Math.abs(dayDiff(lastActivity) ?? 0);
  const questionnaireTitle = row.questionnaire_title ? String(row.questionnaire_title) : undefined;
  const descriptions: Record<FollowUpReason, string> = {
    overdue_followup: `Дата следующего контакта прошла ${overdueDays} дн. назад. Нужно связаться или обновить статус.`,
    today_followup: 'На сегодня запланирован следующий контакт. Лучше обработать до конца дня.',
    hot_without_task: 'Контакт с высоким приоритетом, но без открытой задачи. Есть риск потерять сильного кандидата на тестирование.',
    unanswered_questionnaire: `Вопросы для контакта «${questionnaireTitle ?? 'Анкета'}» созданы, но ответов пока нет. Нужно напомнить человеку пройти форму.`,
    missing_next_action: 'У контакта не заполнен следующий шаг или дата действия. Нужно назначить действие, чтобы контакт не потерялся.',
    stale_stage: `Последняя активность была ${staleDays} дн. назад, а контакт все еще на рабочей стадии. Нужно вернуть в работу или перевести в паузу.`
  };
  const priority: FollowUpRecommendation['priority'] =
    reason === 'overdue_followup' || (reason === 'today_followup' && score >= 75)
      ? 'urgent'
      : reason === 'today_followup' || reason === 'hot_without_task' || (['missing_next_action', 'stale_stage'].includes(reason) && score >= 60)
        ? 'high'
        : 'medium';

  return buildRecommendation({
    lead: {
      id: leadId,
      name: String(row.name ?? 'Контакт'),
      meta: [row.niche, row.city].filter((value) => Boolean(value)).map(String).join(' · ') || 'Контакт',
      stage: normalizeStageName(String(row.stage_name ?? '')),
      score,
      nextStep: row.next_step ? String(row.next_step) : null,
      nextContactDate,
      lastActivity
    },
    reason,
    description: descriptions[reason],
    dueDate: addDays(reason === 'overdue_followup' || reason === 'today_followup' || reason === 'hot_without_task' ? 0 : reason === 'stale_stage' ? 2 : 1),
    priority,
    hasOpenTask: Boolean(row.has_open_task),
    questionnaireId: row.questionnaire_id ? String(row.questionnaire_id) : undefined,
    questionnaireTitle
  });
}

function parseDirectoryRows(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .map(recommendationFromDirectoryRow)
    .filter((item): item is FollowUpRecommendation => item !== null);
}

function parseDirectoryPayload(value: unknown) {
  if (!value || typeof value !== 'object') return null;
  const payload = value as Record<string, unknown>;
  const rawSummary = payload.summary && typeof payload.summary === 'object'
    ? payload.summary as Record<string, unknown>
    : {};

  return {
    recommendations: parseDirectoryRows(payload.items),
    bulkCandidates: parseDirectoryRows(payload.bulk_items),
    total: Math.max(0, safeNumber(payload.total)),
    summary: {
      total: Math.max(0, safeNumber(rawSummary.total)),
      urgent: Math.max(0, safeNumber(rawSummary.urgent)),
      overdue: Math.max(0, safeNumber(rawSummary.overdue)),
      today: Math.max(0, safeNumber(rawSummary.today)),
      hot: Math.max(0, safeNumber(rawSummary.hot)),
      questionnaires: Math.max(0, safeNumber(rawSummary.questionnaires)),
      withoutTasks: Math.max(0, safeNumber(rawSummary.without_tasks))
    }
  };
}

async function getFollowUpDirectoryPageFallback(
  reason: FollowUpReason | undefined,
  requestedPage: number,
  pageSize: number
): Promise<FollowUpDirectoryPage> {
  const data = await getFollowUpRecommendations();
  const filtered = reason
    ? data.recommendations.filter((item) => item.reason === reason)
    : data.recommendations;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(Math.max(requestedPage, 1), pageCount);

  return {
    recommendations: filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    bulkCandidates: data.recommendations.filter((item) => !item.hasOpenTask).slice(0, 10),
    summary: data.summary,
    total: filtered.length,
    currentPage,
    pageCount,
    pageSize,
    demoMode: data.demoMode
  };
}

function followUpPageParams(reason: FollowUpReason | undefined, page: number, pageSize: number) {
  return {
    p_reason: reason ?? null,
    p_offset: (page - 1) * pageSize,
    p_limit: pageSize,
    p_bulk_limit: 10
  };
}

export async function getFollowUpDirectoryPage(
  reason?: FollowUpReason,
  requestedPage = 1,
  requestedPageSize = 40
): Promise<FollowUpDirectoryPage> {
  const pageSize = Math.min(Math.max(Math.floor(requestedPageSize) || 40, 1), 100);
  const page = Math.max(Math.floor(requestedPage) || 1, 1);
  if (!isSupabaseConfigured()) {
    return getFollowUpDirectoryPageFallback(reason, page, pageSize);
  }

  try {
    const supabase = await createClient();
    const firstResult = await supabase.rpc('get_followup_recommendations_page', followUpPageParams(reason, page, pageSize));
    if (firstResult.error) return getFollowUpDirectoryPageFallback(reason, page, pageSize);

    const firstPayload = parseDirectoryPayload(firstResult.data);
    if (!firstPayload) return getFollowUpDirectoryPageFallback(reason, page, pageSize);

    const pageCount = Math.max(1, Math.ceil(firstPayload.total / pageSize));
    const currentPage = Math.min(page, pageCount);
    if (currentPage === page) {
      return { ...firstPayload, currentPage, pageCount, pageSize, demoMode: false };
    }

    const finalResult = await supabase.rpc('get_followup_recommendations_page', followUpPageParams(reason, currentPage, pageSize));
    const finalPayload = finalResult.error ? null : parseDirectoryPayload(finalResult.data);
    return {
      recommendations: finalPayload?.recommendations ?? [],
      bulkCandidates: finalPayload?.bulkCandidates ?? firstPayload.bulkCandidates,
      summary: finalPayload?.summary ?? firstPayload.summary,
      total: finalPayload?.total ?? firstPayload.total,
      currentPage,
      pageCount,
      pageSize,
      demoMode: false
    };
  } catch {
    return getFollowUpDirectoryPageFallback(reason, page, pageSize);
  }
}

export async function getFollowUpRecommendations(): Promise<FollowUpData> {
  if (!isSupabaseConfigured()) {
    const recommendations = buildDemoRecommendations();
    return { recommendations, summary: summarize(recommendations), demoMode: true };
  }

  const supabase = await createClient();
  const [leadsResult, tasksResult, interactionsResult, questionnairesResult] = await Promise.all([
    supabase
      .from('leads')
      .select('id,name,niche,city,priority_score,next_step,next_contact_date,created_at,funnel_stages(name)')
      .order('created_at', { ascending: false }),
    supabase.from('tasks').select('id,lead_id,title,status').in('status', ['todo', 'in_progress']),
    supabase.from('lead_interactions').select('lead_id,created_at').order('created_at', { ascending: false }).limit(500),
    supabase
      .from('lead_questionnaires')
      .select('id,lead_id,title,status,created_at,lead_questionnaire_answers(id)')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
  ]);

  if (leadsResult.error || !leadsResult.data) {
    const recommendations: FollowUpRecommendation[] = [];
    return { recommendations, summary: summarize(recommendations), demoMode: false };
  }

  const openTasks = (tasksResult.data ?? []) as DbTask[];
  const tasksByLead = new Map<string, DbTask[]>();
  for (const task of openTasks) {
    if (!task.lead_id) continue;
    const list = tasksByLead.get(task.lead_id) ?? [];
    list.push(task);
    tasksByLead.set(task.lead_id, list);
  }

  const lastActivityByLead = new Map<string, string>();
  for (const activity of interactionsResult.data ?? []) {
    const leadId = String((activity as Record<string, unknown>).lead_id ?? '');
    const createdAt = String((activity as Record<string, unknown>).created_at ?? '');
    if (leadId && createdAt && !lastActivityByLead.has(leadId)) lastActivityByLead.set(leadId, createdAt);
  }

  const questionnairesByLead = new Map<string, DbQuestionnaire[]>();
  for (const questionnaire of (questionnairesResult.data ?? []) as DbQuestionnaire[]) {
    if (!questionnaire.lead_id) continue;
    const answers = questionnaire.lead_questionnaire_answers ?? [];
    if (answers.length > 0) continue;
    const list = questionnairesByLead.get(questionnaire.lead_id) ?? [];
    list.push(questionnaire);
    questionnairesByLead.set(questionnaire.lead_id, list);
  }

  const recommendations: FollowUpRecommendation[] = [];

  for (const rawLead of leadsResult.data as DbLead[]) {
    const stage = relatedStage(rawLead.funnel_stages);
    if (isRefused(stage)) continue;

    const lead = {
      id: String(rawLead.id),
      name: String(rawLead.name ?? 'Контакт'),
      meta: [rawLead.niche, rawLead.city].filter(Boolean).join(' · ') || 'Контакт',
      stage,
      score: Number(rawLead.priority_score ?? 0),
      nextStep: rawLead.next_step,
      nextContactDate: rawLead.next_contact_date,
      lastActivity: lastActivityByLead.get(rawLead.id) ?? rawLead.created_at
    };

    const leadTasks = tasksByLead.get(lead.id) ?? [];
    const hasOpenTask = leadTasks.length > 0;
    const diff = dayDiff(lead.nextContactDate);
    const missingNextAction = !String(lead.nextStep ?? '').trim() || !lead.nextContactDate;
    const lastActivityDiff = typeof dayDiff(lead.lastActivity) === 'number' ? Math.abs(dayDiff(lead.lastActivity) as number) : undefined;

    if (typeof diff === 'number' && diff < 0) {
      recommendations.push(buildRecommendation({
        lead,
        reason: 'overdue_followup',
        description: `Дата следующего контакта прошла ${Math.abs(diff)} дн. назад. Нужно связаться или обновить статус.`,
        priority: 'urgent',
        dueDate: addDays(0),
        hasOpenTask
      }));
      continue;
    }

    if (typeof diff === 'number' && diff === 0) {
      recommendations.push(buildRecommendation({
        lead,
        reason: 'today_followup',
        description: 'На сегодня запланирован следующий контакт. Лучше обработать до конца дня.',
        priority: lead.score >= 75 ? 'urgent' : 'high',
        dueDate: addDays(0),
        hasOpenTask
      }));
      continue;
    }

    if (lead.score >= 75 && !hasOpenTask) {
      recommendations.push(buildRecommendation({
        lead,
        reason: 'hot_without_task',
        description: 'Контакт с высоким приоритетом, но без открытой задачи. Есть риск потерять сильного кандидата на тестирование.',
        priority: 'high',
        dueDate: addDays(0),
        hasOpenTask
      }));
      continue;
    }

    const unansweredForms = questionnairesByLead.get(lead.id) ?? [];
    if (unansweredForms.length > 0 && !hasOpenTask) {
      const form = unansweredForms[0];
      recommendations.push(buildRecommendation({
        lead,
        reason: 'unanswered_questionnaire',
        description: `Вопросы для контакта «${form.title ?? 'Анкета'}» созданы, но ответов пока нет. Нужно напомнить человеку пройти форму.`,
        priority: 'medium',
        dueDate: addDays(1),
        hasOpenTask,
        questionnaireId: form.id,
        questionnaireTitle: form.title ?? 'Анкета'
      }));
      continue;
    }

    if (missingNextAction && !hasOpenTask) {
      recommendations.push(buildRecommendation({
        lead,
        reason: 'missing_next_action',
        description: 'У контакта не заполнен следующий шаг или дата действия. Нужно назначить действие, чтобы контакт не потерялся.',
        priority: lead.score >= 60 ? 'high' : 'medium',
        dueDate: addDays(1),
        hasOpenTask
      }));
      continue;
    }

    if (stageNeedsMovement(stage) && typeof lastActivityDiff === 'number' && lastActivityDiff >= 7 && !hasOpenTask) {
      recommendations.push(buildRecommendation({
        lead,
        reason: 'stale_stage',
        description: `Последняя активность была ${lastActivityDiff} дн. назад, а контакт все еще на рабочей стадии. Нужно вернуть в работу или перевести в паузу.`,
        priority: lead.score >= 60 ? 'high' : 'medium',
        dueDate: addDays(2),
        hasOpenTask
      }));
    }
  }

  const sorted = sortRecommendations(recommendations);
  return { recommendations: sorted, summary: summarize(sorted), demoMode: false };
}
