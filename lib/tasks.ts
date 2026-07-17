import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';

export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'cancelled';
export type TaskPriority = 'none' | 'low' | 'medium' | 'high' | 'urgent';
export type TaskDueFilter = 'overdue' | 'today' | 'week' | 'later' | 'no_date';
export type TaskAssigneeRole = 'responsible' | 'executor' | 'co_executor';

export type TaskFilters = {
  q?: string;
  status?: TaskStatus | 'active' | '';
  priority?: TaskPriority | '';
  due?: TaskDueFilter | '';
  leadId?: string;
  profileId?: string;
};

export type TaskTeamMember = {
  id: string;
  fullName: string;
  email: string;
  jobTitle: string;
  avatarUrl?: string;
};

export type TaskAssignee = TaskTeamMember & {
  role: TaskAssigneeRole;
  roleLabel: string;
};

export type TaskListItem = {
  id: string;
  title: string;
  description?: string;
  dueDate: string;
  dueDateRaw?: string;
  priority: string;
  priorityValue: TaskPriority;
  status: string;
  statusValue: TaskStatus;
  leadId?: string;
  leadName?: string;
  assignees: TaskAssignee[];
  group: 'Просрочено' | 'Сегодня' | 'На неделе' | 'Позже' | 'Без даты' | 'Готово' | 'Отменено';
  createdAt?: string;
};

export type TaskFilterOptions = {
  leads: Array<{ id: string; name: string }>;
  teamMembers: TaskTeamMember[];
};

export type TaskSummary = {
  total: number;
  overdue: number;
  today: number;
  urgent: number;
  done: number;
};

export type TaskDirectoryPage = {
  items: TaskListItem[];
  summary: TaskSummary;
  total: number;
  currentPage: number;
  pageCount: number;
  pageSize: number;
};

export type TaskReportSummary = {
  total: number;
  overdue: number;
  today: number;
  later: number;
};

const taskPriorities: TaskPriority[] = ['none', 'low', 'medium', 'high', 'urgent'];
const taskStatuses: TaskStatus[] = ['todo', 'in_progress', 'done', 'cancelled'];

export const taskAssigneeRoleLabels: Record<TaskAssigneeRole, string> = {
  responsible: 'Ответственный',
  executor: 'Исполнитель',
  co_executor: 'Соисполнитель'
};

const taskAssigneeRoleOrder: Record<TaskAssigneeRole, number> = {
  responsible: 0,
  executor: 1,
  co_executor: 2
};

function formatDate(value?: string | null) {
  if (!value) return 'Без даты';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Без даты';
  return date.toLocaleDateString('ru-RU');
}

function toDateInput(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

export function priorityLabel(priority?: string | null) {
  const map: Record<string, string> = {
    none: 'Без приоритета',
    low: 'Низкий',
    medium: 'Средний',
    high: 'Высокий',
    urgent: 'Срочно'
  };
  return map[priority ?? ''] ?? 'Без приоритета';
}

export function statusLabel(status?: string | null) {
  const map: Record<string, string> = {
    todo: 'К выполнению',
    in_progress: 'В работе',
    done: 'Готово',
    cancelled: 'Отменено'
  };
  return map[status ?? ''] ?? 'К выполнению';
}

function normalize(value?: string | null) {
  return String(value ?? '').trim().toLowerCase();
}

function safeNumber(value: unknown) {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizePriority(value?: string | null): TaskPriority {
  return taskPriorities.includes(value as TaskPriority) ? (value as TaskPriority) : 'none';
}

function normalizeStatus(value?: string | null): TaskStatus {
  return taskStatuses.includes(value as TaskStatus) ? (value as TaskStatus) : 'todo';
}

function startOfToday() {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), today.getDate());
}

function taskGroup(value?: string | null, status?: TaskStatus): TaskListItem['group'] {
  if (status === 'done') return 'Готово';
  if (status === 'cancelled') return 'Отменено';
  if (!value) return 'Без даты';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Без даты';

  const today = startOfToday();
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  const weekEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7);

  if (date < today) return 'Просрочено';
  if (date >= today && date < tomorrow) return 'Сегодня';
  if (date >= tomorrow && date < weekEnd) return 'На неделе';
  return 'Позже';
}

function dueMatches(value: string | undefined, filter?: TaskDueFilter | '') {
  if (!filter) return true;
  const group = taskGroup(value, 'todo');
  if (filter === 'overdue') return group === 'Просрочено';
  if (filter === 'today') return group === 'Сегодня';
  if (filter === 'week') return group === 'На неделе';
  if (filter === 'later') return group === 'Позже';
  if (filter === 'no_date') return group === 'Без даты';
  return true;
}

function matchesTaskFilters(task: TaskListItem, filters: TaskFilters = {}) {
  const statusFilter = filters.status || 'active';

  if (statusFilter === 'active' && ['done', 'cancelled'].includes(task.statusValue)) {
    return false;
  }

  if (statusFilter && statusFilter !== 'active' && task.statusValue !== statusFilter) {
    return false;
  }

  if (filters.priority && task.priorityValue !== filters.priority) {
    return false;
  }

  if (filters.leadId && task.leadId !== filters.leadId) {
    return false;
  }

  if (filters.profileId && !task.assignees.some((assignee) => assignee.id === filters.profileId)) {
    return false;
  }

  if (!dueMatches(task.dueDateRaw, filters.due)) {
    return false;
  }

  const q = normalize(filters.q);
  if (!q) return true;

  const searchable = [
    task.title,
    task.description,
    task.priority,
    task.status,
    task.leadName,
    task.dueDate,
    ...task.assignees.flatMap((assignee) => [assignee.fullName, assignee.email, assignee.jobTitle, assignee.roleLabel])
  ]
    .map((value) => normalize(value))
    .join(' ');

  return searchable.includes(q);
}

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

function relatedProfile(value: unknown): TaskTeamMember | null {
  if (!value) return null;
  if (Array.isArray(value)) return relatedProfile(value[0]);
  if (typeof value !== 'object') return null;

  const item = value as Record<string, unknown>;
  const id = typeof item.id === 'string' ? item.id : '';
  if (!id) return null;

  const email = typeof item.email === 'string' ? item.email : '';
  const fullName = typeof item.full_name === 'string' && item.full_name.trim()
    ? item.full_name
    : email || 'Пользователь';

  return {
    id,
    fullName,
    email,
    jobTitle: typeof item.job_title === 'string' ? item.job_title : '',
    avatarUrl: typeof item.avatar_url === 'string' ? item.avatar_url : undefined
  };
}

function mapTaskAssignee(row: Record<string, unknown>): TaskAssignee | null {
  const role = String(row.role ?? '') as TaskAssigneeRole;
  if (!taskAssigneeRoleLabels[role]) return null;

  const profile = relatedProfile(row.profiles);
  if (!profile) return null;

  return {
    ...profile,
    role,
    roleLabel: taskAssigneeRoleLabels[role]
  };
}

function sortAssignees(items: TaskAssignee[]) {
  return [...items].sort((a, b) => taskAssigneeRoleOrder[a.role] - taskAssigneeRoleOrder[b.role] || a.fullName.localeCompare(b.fullName, 'ru'));
}

function mapDbTask(row: Record<string, unknown>, assignees: TaskAssignee[] = []): TaskListItem {
  const status = normalizeStatus(String(row.status ?? 'todo'));
  const priority = normalizePriority(String(row.priority ?? 'none'));
  const dueDateRaw = row.due_date ? String(row.due_date) : '';
  const lead = relatedLead(row.leads);

  return {
    id: String(row.id),
    title: String(row.title ?? 'Без названия'),
    description: row.description ? String(row.description) : undefined,
    dueDate: formatDate(dueDateRaw),
    dueDateRaw: toDateInput(dueDateRaw),
    priority: priorityLabel(priority),
    priorityValue: priority,
    status: statusLabel(status),
    statusValue: status,
    leadId: lead.id,
    leadName: lead.name,
    assignees: sortAssignees(assignees),
    group: taskGroup(dueDateRaw, status),
    createdAt: row.created_at ? String(row.created_at) : undefined
  };
}

const demoTasks: TaskListItem[] = [
  {
    id: '1',
    title: 'Написать Анне повторно',
    description: 'Уточнить интерес к тестированию и отправить ссылку на анкету.',
    dueDate: 'Сегодня',
    dueDateRaw: new Date().toISOString().slice(0, 10),
    priority: 'Высокий',
    priorityValue: 'high',
    status: 'К выполнению',
    statusValue: 'todo',
    leadId: '1',
    leadName: 'Анна Смирнова',
    assignees: [
      {
        id: 'demo-team-1',
        fullName: 'Даниил',
        email: 'daniil@example.com',
        jobTitle: 'Маркетолог',
        role: 'responsible',
        roleLabel: taskAssigneeRoleLabels.responsible
      }
    ],
    group: 'Сегодня'
  },
  {
    id: '2',
    title: 'Отправить анкету салону Beauty Line',
    description: 'Короткая анкета по текущей записи, ролям сотрудников и интересу к карте.',
    dueDate: 'Вчера',
    dueDateRaw: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
    priority: 'Срочно',
    priorityValue: 'urgent',
    status: 'К выполнению',
    statusValue: 'todo',
    leadId: '2',
    leadName: 'Салон Beauty Line',
    assignees: [
      {
        id: 'demo-team-2',
        fullName: 'Команда Hutka',
        email: 'team@example.com',
        jobTitle: 'Соисполнитель',
        role: 'co_executor',
        roleLabel: taskAssigneeRoleLabels.co_executor
      }
    ],
    group: 'Просрочено'
  },
  {
    id: '3',
    title: 'Подготовить отчет по Instagram',
    description: 'Сравнить конверсию офферов “CRM” и “клиенты с карты”.',
    dueDate: 'Позже',
    dueDateRaw: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
    priority: 'Средний',
    priorityValue: 'medium',
    status: 'В работе',
    statusValue: 'in_progress',
    assignees: [],
    group: 'На неделе'
  },
  {
    id: '4',
    title: 'Закрыть старое действие',
    description: 'Пример выполненной задачи для фильтра “Готово”.',
    dueDate: 'Без даты',
    priority: 'Низкий',
    priorityValue: 'low',
    status: 'Готово',
    statusValue: 'done',
    leadName: 'Мария Иванова',
    assignees: [],
    group: 'Готово'
  }
];

async function getTaskAssigneesByTaskId(taskIds: string[]) {
  const assigneesByTaskId = new Map<string, TaskAssignee[]>();
  if (taskIds.length === 0) return assigneesByTaskId;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('task_assignees')
    .select('task_id,role,profiles(id,full_name,email,job_title,avatar_url)')
    .in('task_id', taskIds);

  if (error || !data) return assigneesByTaskId;

  (data as Array<Record<string, unknown>>).forEach((row) => {
    const taskId = typeof row.task_id === 'string' ? row.task_id : '';
    const assignee = mapTaskAssignee(row);
    if (!taskId || !assignee) return;
    assigneesByTaskId.set(taskId, [...(assigneesByTaskId.get(taskId) ?? []), assignee]);
  });

  return assigneesByTaskId;
}

const getAllTasks = cache(async (): Promise<TaskListItem[]> => {
  if (!isSupabaseConfigured()) {
    return demoTasks;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('tasks')
    .select('id,title,description,due_date,priority,status,created_at,leads(id,name)')
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  const taskIds = data.map((task) => String(task.id)).filter(Boolean);
  const assigneesByTaskId = await getTaskAssigneesByTaskId(taskIds);
  return data.map((task) => {
    const taskId = String(task.id);
    return mapDbTask(task as Record<string, unknown>, assigneesByTaskId.get(taskId) ?? []);
  });
});

export async function getTasks(filters: TaskFilters = {}): Promise<TaskListItem[]> {
  const items = await getAllTasks();
  return items.filter((task) => matchesTaskFilters(task, filters));
}

function summarizeTasks(tasks: TaskListItem[]): TaskSummary {
  return {
    total: tasks.length,
    overdue: tasks.filter((task) => task.group === 'Просрочено').length,
    today: tasks.filter((task) => task.group === 'Сегодня').length,
    urgent: tasks.filter((task) => task.priorityValue === 'urgent').length,
    done: tasks.filter((task) => task.statusValue === 'done').length
  };
}

async function getTaskDirectoryPageFallback(
  filters: TaskFilters,
  requestedPage: number,
  pageSize: number
): Promise<TaskDirectoryPage> {
  const items = await getTasks(filters);
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(Math.max(requestedPage, 1), pageCount);
  return {
    items: items.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    summary: summarizeTasks(items),
    total: items.length,
    currentPage,
    pageCount,
    pageSize
  };
}

function taskDirectoryParams(filters: TaskFilters, page: number, pageSize: number) {
  return {
    p_q: filters.q || null,
    p_status: filters.status || 'active',
    p_priority: filters.priority || null,
    p_due: filters.due || null,
    p_lead_id: filters.leadId || null,
    p_profile_id: filters.profileId || null,
    p_offset: (page - 1) * pageSize,
    p_limit: pageSize
  };
}

function parseTaskDirectoryPayload(data: unknown) {
  if (!data || typeof data !== 'object') return null;
  const payload = data as { total?: unknown; items?: unknown; summary?: unknown };
  const summary = payload.summary && typeof payload.summary === 'object'
    ? payload.summary as Record<string, unknown>
    : {};
  const items = Array.isArray(payload.items)
    ? payload.items
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
      .map((item) => {
        const rawAssignees = Array.isArray(item.assignees) ? item.assignees : [];
        return mapDbTask(
          item,
          rawAssignees
            .filter((assignee): assignee is Record<string, unknown> => Boolean(assignee) && typeof assignee === 'object')
            .map(mapTaskAssignee)
            .filter((assignee): assignee is TaskAssignee => assignee !== null)
        );
      })
    : [];

  return {
    items,
    total: Math.max(0, safeNumber(payload.total)),
    summary: {
      total: Math.max(0, safeNumber(summary.total)),
      overdue: Math.max(0, safeNumber(summary.overdue)),
      today: Math.max(0, safeNumber(summary.today)),
      urgent: Math.max(0, safeNumber(summary.urgent)),
      done: Math.max(0, safeNumber(summary.done))
    }
  };
}

export async function getTaskDirectoryPage(
  filters: TaskFilters = {},
  requestedPage = 1,
  requestedPageSize = 40
): Promise<TaskDirectoryPage> {
  const pageSize = Math.min(Math.max(Math.floor(requestedPageSize) || 40, 1), 100);
  const page = Math.max(Math.floor(requestedPage) || 1, 1);

  if (!isSupabaseConfigured()) {
    return getTaskDirectoryPageFallback(filters, page, pageSize);
  }

  try {
    const supabase = await createClient();
    const firstResult = await supabase.rpc('get_task_directory_page', taskDirectoryParams(filters, page, pageSize));
    if (firstResult.error) return getTaskDirectoryPageFallback(filters, page, pageSize);

    const firstPayload = parseTaskDirectoryPayload(firstResult.data);
    if (!firstPayload) return getTaskDirectoryPageFallback(filters, page, pageSize);

    const pageCount = Math.max(1, Math.ceil(firstPayload.total / pageSize));
    const currentPage = Math.min(page, pageCount);
    if (currentPage === page) {
      return { ...firstPayload, currentPage, pageCount, pageSize };
    }

    const finalResult = await supabase.rpc('get_task_directory_page', taskDirectoryParams(filters, currentPage, pageSize));
    const finalPayload = finalResult.error ? null : parseTaskDirectoryPayload(finalResult.data);
    return {
      items: finalPayload?.items ?? [],
      summary: finalPayload?.summary ?? firstPayload.summary,
      total: finalPayload?.total ?? firstPayload.total,
      currentPage,
      pageCount,
      pageSize
    };
  } catch {
    return getTaskDirectoryPageFallback(filters, page, pageSize);
  }
}

export const getTaskPreview = cache(async (requestedLimit = 5): Promise<TaskListItem[]> => {
  const limit = Math.min(Math.max(Math.floor(requestedLimit) || 5, 1), 20);
  if (!isSupabaseConfigured()) {
    return (await getTasks({ status: 'active' })).slice(0, limit);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('tasks')
    .select('id,title,description,due_date,priority,status,created_at,leads(id,name)')
    .in('status', ['todo', 'in_progress'])
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  const taskIds = data.map((task) => String(task.id)).filter(Boolean);
  const assigneesByTaskId = await getTaskAssigneesByTaskId(taskIds);
  return data.map((task) => {
    const taskId = String(task.id);
    return mapDbTask(task as Record<string, unknown>, assigneesByTaskId.get(taskId) ?? []);
  });
});

export const getTaskReportSummary = cache(async (): Promise<TaskReportSummary> => {
  if (!isSupabaseConfigured()) {
    const tasks = await getTasks({ status: 'active' });
    return {
      total: tasks.length,
      overdue: tasks.filter((task) => task.group === 'Просрочено').length,
      today: tasks.filter((task) => task.group === 'Сегодня').length,
      later: tasks.filter((task) => task.group === 'Позже').length
    };
  }

  const today = startOfToday();
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  const weekEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7);
  const supabase = await createClient();
  const activeStatuses: TaskStatus[] = ['todo', 'in_progress'];
  const [totalResult, overdueResult, todayResult, laterResult] = await Promise.all([
    supabase.from('tasks').select('id', { count: 'exact', head: true }).in('status', activeStatuses),
    supabase.from('tasks').select('id', { count: 'exact', head: true }).in('status', activeStatuses).lt('due_date', today.toISOString()),
    supabase.from('tasks').select('id', { count: 'exact', head: true }).in('status', activeStatuses).gte('due_date', today.toISOString()).lt('due_date', tomorrow.toISOString()),
    supabase.from('tasks').select('id', { count: 'exact', head: true }).in('status', activeStatuses).gte('due_date', weekEnd.toISOString())
  ]);

  return {
    total: totalResult.count ?? 0,
    overdue: overdueResult.count ?? 0,
    today: todayResult.count ?? 0,
    later: laterResult.count ?? 0
  };
});

export async function getTaskTeamOptions(): Promise<TaskTeamMember[]> {
  if (!isSupabaseConfigured()) {
    return [
      { id: 'demo-team-1', fullName: 'Даниил', email: 'daniil@example.com', jobTitle: 'Маркетолог' },
      { id: 'demo-team-2', fullName: 'Команда Hutka', email: 'team@example.com', jobTitle: 'Соисполнитель' }
    ];
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('id,full_name,email,job_title,avatar_url')
    .order('full_name', { ascending: true });

  if (error || !data) return [];

  return data.map((profile) => {
    const email = typeof profile.email === 'string' ? profile.email : '';
    return {
      id: String(profile.id),
      fullName: typeof profile.full_name === 'string' && profile.full_name.trim() ? profile.full_name : email || 'Пользователь',
      email,
      jobTitle: typeof profile.job_title === 'string' ? profile.job_title : '',
      avatarUrl: typeof profile.avatar_url === 'string' ? profile.avatar_url : undefined
    };
  });
}

export async function getTaskFilterOptions(): Promise<TaskFilterOptions> {
  if (!isSupabaseConfigured()) {
    const leads = demoTasks
      .filter((task) => task.leadId && task.leadName)
      .map((task) => ({ id: task.leadId as string, name: task.leadName as string }));
    return { leads, teamMembers: await getTaskTeamOptions() };
  }

  const supabase = await createClient();
  const [{ data, error }, teamMembers] = await Promise.all([
    supabase.from('leads').select('id,name,tasks!inner(id)').order('name', { ascending: true }).limit(1000),
    getTaskTeamOptions()
  ]);
  if (error || !data) return { leads: [], teamMembers };

  return {
    leads: data.map((lead) => ({ id: String(lead.id), name: String(lead.name) })),
    teamMembers
  };
}

export function getTaskSummary(tasks: TaskListItem[]) {
  return {
    total: tasks.length,
    overdue: tasks.filter((task) => task.group === 'Просрочено').length,
    today: tasks.filter((task) => task.group === 'Сегодня').length,
    inProgress: tasks.filter((task) => task.statusValue === 'in_progress').length,
    urgent: tasks.filter((task) => task.priorityValue === 'urgent').length,
    done: tasks.filter((task) => task.statusValue === 'done').length
  };
}
