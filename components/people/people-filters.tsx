import Link from 'next/link';
import { Download, FilterX, Plus, Search, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import type { LeadFilterOptions, LeadFilters } from '@/lib/leads';
import { can, type UserRole } from '@/lib/roles';

function FieldSelect({ name, label, value, options }: { name: keyof LeadFilters; label: string; value?: string; options: string[] }) {
  return (
    <label className="space-y-1.5">
      <span className="text-xs font-bold uppercase tracking-wide text-app-faint">{label}</span>
      <Select name={name} defaultValue={value ?? ''}>
        <option value="">Все</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </Select>
    </label>
  );
}

function activeFilterCount(filters: LeadFilters) {
  return Object.values(filters).filter(Boolean).length;
}

export function PeopleFilters({
  filters,
  options,
  total,
  shown,
  role = 'viewer'
}: {
  filters: LeadFilters;
  options: LeadFilterOptions;
  total: number;
  shown: number;
  role?: UserRole;
}) {
  const active = activeFilterCount(filters);

  return (
    <Card className="p-4">
      <form className="space-y-4" action="/people">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="grid flex-1 gap-3 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
            <label className="space-y-1.5 md:col-span-2 xl:col-span-4 2xl:col-span-2">
              <span className="text-xs font-bold uppercase tracking-wide text-app-faint">Поиск</span>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-app-faint" />
                <Input name="q" defaultValue={filters.q ?? ''} placeholder="Имя, город, Instagram, телефон, тег..." className="pl-9" />
              </div>
            </label>

            <FieldSelect name="type" label="Тип" value={filters.type} options={options.types} />
            <FieldSelect name="city" label="Город" value={filters.city} options={options.cities} />
            <FieldSelect name="niche" label="Ниша" value={filters.niche} options={options.niches} />
            <FieldSelect name="stage" label="Стадия" value={filters.stage} options={options.stages} />
            <FieldSelect name="source" label="Источник" value={filters.source} options={options.sources} />
            <FieldSelect name="priority" label="Приоритет" value={filters.priority} options={options.priorities} />
            <FieldSelect name="tag" label="Тег" value={filters.tag} options={options.tags} />
          </div>

          <div className="flex flex-wrap gap-2 xl:justify-end">
            <Button type="submit" variant="secondary">
              Применить
            </Button>
            <Button asChild variant="ghost">
              <Link href="/people">
                <FilterX className="h-4 w-4" />
                Сбросить
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/people/export">
                <Download className="h-4 w-4" />
                Экспорт
              </Link>
            </Button>
            {can(role, 'manageContacts') && (
              <Button asChild variant="secondary">
                <Link href="/people/import">
                  <Upload className="h-4 w-4" />
                  Импорт
                </Link>
              </Button>
            )}
            {can(role, 'manageContacts') && (
              <Button asChild>
                <Link href="/people/new">
                  <Plus className="h-4 w-4" />
                  Добавить контакт
                </Link>
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-app-line pt-4 text-sm text-app-muted">
          <p>
            Показано <span className="font-bold text-app-text">{shown}</span> из <span className="font-bold text-app-text">{total}</span> контактов
          </p>
          {active > 0 ? (
            <p className="rounded-full bg-purple-50 px-3 py-1 font-semibold text-app-purple">Активных фильтров: {active}</p>
          ) : (
            <p>Фильтры не применены</p>
          )}
        </div>
      </form>
    </Card>
  );
}
