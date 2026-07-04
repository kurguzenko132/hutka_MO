import Link from 'next/link';
import { FilterX, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import type { TaskFilterOptions, TaskFilters } from '@/lib/tasks';
import { can, type UserRole } from '@/lib/roles';

function activeFilterCount(filters: TaskFilters) {
  return Object.entries(filters).filter(([key, value]) => {
    if (!value) return false;
    if (key === 'status' && value === 'active') return false;
    return true;
  }).length;
}

export function TaskFiltersPanel({
  filters,
  options,
  total,
  shown,
  role = 'viewer'
}: {
  filters: TaskFilters;
  options: TaskFilterOptions;
  total: number;
  shown: number;
  role?: UserRole;
}) {
  const active = activeFilterCount(filters);

  return (
    <Card className="p-4">
      <form className="space-y-4" action="/tasks">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
          <label className="space-y-1.5 md:col-span-2 xl:col-span-2">
            <span className="text-xs font-bold uppercase tracking-wide text-app-faint">Поиск</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-app-faint" />
              <Input name="q" defaultValue={filters.q ?? ''} placeholder="Задача, описание, контакт..." className="pl-9" />
            </div>
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-app-faint">Статус</span>
            <Select name="status" defaultValue={filters.status || 'active'}>
              <option value="active">Активные</option>
              <option value="todo">К выполнению</option>
              <option value="in_progress">В работе</option>
              <option value="done">Готово</option>
              <option value="cancelled">Отменено</option>
            </Select>
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-app-faint">Приоритет</span>
            <Select name="priority" defaultValue={filters.priority ?? ''}>
              <option value="">Все</option>
              <option value="none">Без приоритета</option>
              <option value="low">Низкий</option>
              <option value="medium">Средний</option>
              <option value="high">Высокий</option>
              <option value="urgent">Срочно</option>
            </Select>
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-app-faint">Срок</span>
            <Select name="due" defaultValue={filters.due ?? ''}>
              <option value="">Любой</option>
              <option value="overdue">Просрочено</option>
              <option value="today">Сегодня</option>
              <option value="week">На неделе</option>
              <option value="later">Позже</option>
              <option value="no_date">Без даты</option>
            </Select>
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-app-faint">Контакт</span>
            <Select name="leadId" defaultValue={filters.leadId ?? ''}>
              <option value="">Все</option>
              {options.leads.map((lead) => (
                <option key={lead.id} value={lead.id}>{lead.name}</option>
              ))}
            </Select>
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-app-faint">Участник</span>
            <Select name="profileId" defaultValue={filters.profileId ?? ''}>
              <option value="">Все</option>
              {options.teamMembers.map((member) => (
                <option key={member.id} value={member.id}>{member.fullName}</option>
              ))}
            </Select>
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-app-line pt-4">
          <div className="text-sm text-app-muted">
            Показано <span className="font-bold text-app-text">{shown}</span> из <span className="font-bold text-app-text">{total}</span> задач
            {active > 0 && <span className="ml-2 rounded-full bg-purple-50 px-3 py-1 font-semibold text-app-purple">Фильтров: {active}</span>}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="secondary">Применить</Button>
            <Button asChild variant="ghost">
              <Link href="/tasks"><FilterX className="h-4 w-4" />Сбросить</Link>
            </Button>
            {can(role, 'manageTasks') && (
              <Button asChild>
                <Link href="/tasks/new"><Plus className="h-4 w-4" />Создать задачу</Link>
              </Button>
            )}
          </div>
        </div>
      </form>
    </Card>
  );
}
