import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';

export type TaskListItem = {
  id: string;
  title: string;
  description?: string;
  dueDate: string;
  priority: string;
  status: string;
  leadName?: string;
  group: 'Просрочено' | 'Сегодня' | 'Позже';
};

function formatDate(value?: string | null) {
  if (!value) return 'Без даты';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Без даты';
  return date.toLocaleDateString('ru-RU');
}

function priorityLabel(priority?: string | null) {
  const map: Record<string, string> = {
    low: 'Низкий',
    medium: 'Средний',
    high: 'Высокий',
    urgent: 'Срочно'
  };
  return map[priority ?? ''] ?? 'Средний';
}

function statusLabel(status?: string | null) {
  const map: Record<string, string> = {
    todo: 'К выполнению',
    in_progress: 'В работе',
    done: 'Готово',
    cancelled: 'Отменено'
  };
  return map[status ?? ''] ?? 'К выполнению';
}

function taskGroup(value?: string | null): TaskListItem['group'] {
  if (!value) return 'Позже';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Позже';
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

  if (date < start) return 'Просрочено';
  if (date >= start && date < end) return 'Сегодня';
  return 'Позже';
}

function relatedName(value: unknown): string | undefined {
  if (!value) return undefined;
  if (Array.isArray(value)) return relatedName(value[0]);
  if (typeof value === 'object' && 'name' in value) {
    const name = (value as { name?: unknown }).name;
    return typeof name === 'string' ? name : undefined;
  }
  return undefined;
}

export async function getTasks(): Promise<TaskListItem[]> {
  if (!isSupabaseConfigured()) {
    return [
      { id: '1', title: 'Написать Анне повторно', dueDate: 'Сегодня', priority: 'Высокий', status: 'К выполнению', leadName: 'Анна Смирнова', group: 'Сегодня' },
      { id: '2', title: 'Отправить опрос салону Beauty Line', dueDate: 'Вчера', priority: 'Срочно', status: 'К выполнению', leadName: 'Салон Beauty Line', group: 'Просрочено' },
      { id: '3', title: 'Подготовить отчет по Instagram', dueDate: 'Позже', priority: 'Средний', status: 'К выполнению', group: 'Позже' }
    ];
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('tasks')
    .select('id,title,description,due_date,priority,status,leads(name)')
    .neq('status', 'done')
    .order('due_date', { ascending: true, nullsFirst: false });

  if (error || !data) return [];

  return data.map((task) => ({
    id: String(task.id),
    title: String(task.title),
    description: task.description ? String(task.description) : undefined,
    dueDate: formatDate(task.due_date ? String(task.due_date) : null),
    priority: priorityLabel(task.priority),
    status: statusLabel(task.status),
    leadName: relatedName(task.leads),
    group: taskGroup(task.due_date ? String(task.due_date) : null)
  }));
}
