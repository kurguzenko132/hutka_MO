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
    description: 'Уточнить готовность к пилоту и отправить ссылку на опрос.',
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
    title: 'Отправить опрос салону Beauty Line',
    description: 'Короткий опрос по текущей записи, ролям сотрудников и интересу к карте.',
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
    title: 'Закрыть старый follow-up',
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

export async function getTasks(filters: TaskFilters = {}): Promise<TaskListItem[]> {
  let items: TaskListItem[];

  if (!isSupabaseConfigured()) {
    items = demoTasks;
  } else {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('tasks')
      .select('id,title,description,due_date,priority,status,created_at,leads(id,name)')
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false });

    if (error || !data) {
      items = [];
    } else {
      const taskIds = data.map((task) => String(task.id)).filter(Boolean);
      const assigneesByTaskId = await getTaskAssigneesByTaskId(taskIds);
      items = data.map((task) => {
        const taskId = String(task.id);
        return mapDbTask(task as Record<string, unknown>, assigneesByTaskId.get(taskId) ?? []);
      });
    }
  }

  return items.filter((task) => matchesTaskFilters(task, filters));
}

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
    supabase.from('leads').select('id,name').order('name', { ascending: true }),
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
