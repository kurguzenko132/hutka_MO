import Link from 'next/link';
import { BookmarkPlus, Download, FilterX, Plus, Search, Trash2, Upload, Wand2 } from 'lucide-react';
import { createSavedLeadViewAction, deleteSavedLeadViewAction } from '@/actions/lead-views.actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import type { LeadFilterOptions, LeadFilters } from '@/lib/leads';
import type { LeadSmartView, SavedLeadView } from '@/lib/lead-views';
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

function hiddenFilterInputs(filters: LeadFilters) {
  return (Object.entries(filters) as Array<[keyof LeadFilters, string | undefined]>).map(([key, value]) =>
    value ? <input key={key} type="hidden" name={key} value={value} /> : null
  );
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
  smartViews = [],
  savedViews = []
}: {
  filters: LeadFilters;
  options: LeadFilterOptions;
  total: number;
  shown: number;
  role?: UserRole;
  smartViews?: LeadSmartView[];
  savedViews?: SavedLeadView[];
}) {
  const active = activeFilterCount(filters);
  const canManageContacts = can(role, 'manageContacts');

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
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

          <form action={createSavedLeadViewAction} className="w-full rounded-2xl border border-app-line bg-slate-50/70 p-3 lg:max-w-sm">
            {hiddenFilterInputs(filters)}
            <p className="text-sm font-black text-app-text">Сохранить текущий вид</p>
            <p className="mt-1 text-xs leading-5 text-app-muted">Сохрани набор фильтров, чтобы быстро возвращаться к нему позже.</p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row lg:flex-col xl:flex-row">
              <Input name="name" placeholder="Например: Минск · маникюр · пилот" disabled={active === 0} />
              <Button type="submit" variant="secondary" disabled={active === 0}>
                <BookmarkPlus className="h-4 w-4" />
                Сохранить
              </Button>
            </div>
            {active === 0 ? <p className="mt-2 text-xs text-app-faint">Сначала примени фильтр или быстрый вид.</p> : null}
          </form>
        </div>

        {savedViews.length > 0 ? (
          <div className="mt-4 border-t border-app-line pt-4">
            <p className="text-xs font-bold uppercase tracking-wide text-app-faint">Мои сохраненные виды</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {savedViews.map((view) => (
                <div key={view.id} className="inline-flex min-w-0 max-w-full items-center overflow-hidden rounded-full border border-app-line bg-white text-sm shadow-sm">
                  <Link href={view.href} className="min-w-0 truncate px-3 py-1.5 font-semibold text-app-text transition hover:text-app-purple">
                    {view.name}
                  </Link>
                  <form action={deleteSavedLeadViewAction}>
                    <input type="hidden" name="id" value={view.id} />
                    <button
                      type="submit"
                      className="border-l border-app-line px-2 py-1.5 text-app-faint transition hover:bg-red-50 hover:text-app-red"
                      title="Удалить сохраненный вид"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </form>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </Card>

      <Card className="p-4">
        <form className="space-y-4" action="/people">
          <input type="hidden" name="view" value={filters.view ?? ''} />
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
                <Link href={buildHref('/people/export', filters)}>
                  <Download className="h-4 w-4" />
                  Экспорт
                </Link>
              </Button>
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
