import Link from 'next/link';
import { Download, FilterX, Plus, Search, Upload, Wand2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import type { LeadFilterOptions, LeadFilters } from '@/lib/leads';
import type { LeadSmartView } from '@/lib/lead-views';
import { can, type UserRole } from '@/lib/roles';
import { cn } from '@/lib/utils';

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


function buildHref(base: string, filters: LeadFilters) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, String(value));
  });
  const query = params.toString();
  return query ? `${base}?${query}` : base;
}

function activeFilterCount(filters: LeadFilters) {
  return Object.values(filters).filter(Boolean).length;
}

const toneClass: Record<LeadSmartView['tone'], string> = {
  purple: 'border-purple-100 bg-purple-50 text-purple-800 hover:border-purple-200 hover:bg-purple-100',
  blue: 'border-blue-100 bg-blue-50 text-blue-800 hover:border-blue-200 hover:bg-blue-100',
  green: 'border-emerald-100 bg-emerald-50 text-emerald-800 hover:border-emerald-200 hover:bg-emerald-100',
  yellow: 'border-amber-100 bg-amber-50 text-amber-800 hover:border-amber-200 hover:bg-amber-100',
  red: 'border-red-100 bg-red-50 text-red-800 hover:border-red-200 hover:bg-red-100',
  gray: 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-slate-100',
  pink: 'border-pink-100 bg-pink-50 text-pink-800 hover:border-pink-200 hover:bg-pink-100'
};

export function PeopleFilters({
  filters,
  options,
  total,
  shown,
  role = 'viewer',
  smartViews = []
}: {
  filters: LeadFilters;
  options: LeadFilterOptions;
  total: number;
  shown: number;
  role?: UserRole;
  smartViews?: LeadSmartView[];
}) {
  const active = activeFilterCount(filters);
  const canManageContacts = can(role, 'manageContacts');

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-col gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-purple-50 text-app-purple">
                <Wand2 className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="font-black text-app-text">Быстрые виды</p>
                <p className="text-sm text-app-muted">Готовые выборки для ежедневной работы без ручной настройки фильтров.</p>
              </div>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {smartViews.map((view) => {
                const activeView = filters.view === view.id;
                return (
                  <Link
                    key={view.id}
                    href={view.href}
                    className={cn(
                      'min-w-0 rounded-2xl border p-3 transition',
                      toneClass[view.tone],
                      activeView && 'ring-2 ring-app-purple ring-offset-2'
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black">{view.title}</p>
                        <p className="mt-1 line-clamp-2 text-xs leading-5 opacity-80">{view.description}</p>
                      </div>
                      <Badge tone={view.tone}>{view.count}</Badge>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <form className="space-y-4" action="/people">
          <input type="hidden" name="view" value={filters.view ?? ''} />
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <label className="space-y-1.5 md:col-span-2 xl:col-span-2">
                <span className="text-xs font-bold uppercase tracking-wide text-app-faint">Поиск</span>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-app-faint" />
                  <Input name="q" defaultValue={filters.q ?? ''} placeholder="Имя, город, Instagram, телефон, тег..." className="pl-9" />
                </div>
              </label>

              <FieldSelect name="type" label="Тип контакта" value={filters.type} options={options.types} />
              <FieldSelect name="city" label="Город" value={filters.city} options={options.cities} />
              <FieldSelect name="niche" label="Ниша" value={filters.niche} options={options.niches} />
              <FieldSelect name="stage" label="Статус" value={filters.stage} options={options.stages} />
              <FieldSelect name="source" label="Источник" value={filters.source} options={options.sources} />
              <FieldSelect name="tag" label="Тег" value={filters.tag} options={options.tags} />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="submit" variant="secondary">
                Применить
              </Button>
              <Button asChild variant="ghost">
                <Link href="/people">
                  <FilterX className="h-4 w-4" />
                  Сбросить
                </Link>
              </Button>
              {canManageContacts && (
                <Button asChild variant="secondary">
                  <Link href={buildHref('/people/export', filters)}>
                    <Download className="h-4 w-4" />
                    Экспорт
                  </Link>
                </Button>
              )}
              {canManageContacts && (
                <Button asChild variant="secondary">
                  <Link href="/people/import">
                    <Upload className="h-4 w-4" />
                    Импорт
                  </Link>
                </Button>
              )}
              {canManageContacts && (
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
            <div className="flex flex-wrap items-center gap-2">
              {filters.view ? <Badge tone="purple">Вид: {smartViews.find((view) => view.id === filters.view)?.title ?? filters.view}</Badge> : null}
              {active > 0 ? (
                <p className="rounded-full bg-purple-50 px-3 py-1 font-semibold text-app-purple">Активных фильтров: {active}</p>
              ) : (
                <p>Фильтры не применены</p>
              )}
            </div>
          </div>
        </form>
      </Card>
    </div>
  );
}
