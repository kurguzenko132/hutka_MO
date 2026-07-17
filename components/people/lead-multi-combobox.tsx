'use client';

import { useEffect, useState } from 'react';
import { Check, LoaderCircle, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { LeadOption } from '@/lib/leads';

export function LeadMultiCombobox({
  name,
  initialOptions = [],
  disabled = false,
  placeholder = 'Найти контакт...'
}: {
  name: string;
  initialOptions?: LeadOption[];
  disabled?: boolean;
  placeholder?: string;
}) {
  const [selected, setSelected] = useState(initialOptions);
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<LeadOption[]>([]);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open || disabled) return;

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setPending(true);
      try {
        const params = new URLSearchParams();
        if (query.trim()) params.set('q', query.trim());
        const response = await fetch(`/api/leads/options?${params.toString()}`, {
          signal: controller.signal,
          cache: 'no-store'
        });
        const payload = response.ok ? await response.json() as { items?: LeadOption[] } : {};
        setOptions(Array.isArray(payload.items) ? payload.items : []);
      } catch {
        if (!controller.signal.aborted) setOptions([]);
      } finally {
        if (!controller.signal.aborted) setPending(false);
      }
    }, 180);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [disabled, open, query]);

  const selectedIds = new Set(selected.map((option) => option.id));
  const availableOptions = options.filter((option) => !selectedIds.has(option.id));

  function add(option: LeadOption) {
    setSelected((current) => current.some((item) => item.id === option.id) ? current : [...current, option]);
    setQuery('');
    setOpen(false);
  }

  function remove(id: string) {
    setSelected((current) => current.filter((option) => option.id !== id));
  }

  return (
    <div
      className="space-y-2"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      {selected.map((option) => <input key={option.id} type="hidden" name={name} value={option.id} />)}

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-app-faint" />
        <Input
          value={query}
          disabled={disabled}
          autoComplete="off"
          placeholder={placeholder}
          className="pl-9"
          aria-label="Поиск контактов"
          aria-expanded={open}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setOpen(false);
          }}
        />

        {open ? (
          <div className="absolute z-30 mt-2 max-h-64 w-full overflow-y-auto rounded-xl border border-app-line bg-white p-1 shadow-card">
            {pending ? (
              <div className="flex items-center gap-2 px-3 py-3 text-sm text-app-muted">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Ищу контакты...
              </div>
            ) : availableOptions.length > 0 ? (
              availableOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm font-semibold text-app-text hover:bg-purple-50"
                  onClick={() => add(option)}
                >
                  <span className="min-w-0 truncate">{option.name}</span>
                  <Check className="h-4 w-4 shrink-0 text-app-purple" />
                </button>
              ))
            ) : (
              <p className="px-3 py-3 text-sm text-app-muted">Контакты не найдены</p>
            )}
          </div>
        ) : null}
      </div>

      {selected.length > 0 ? (
        <div className="flex flex-wrap gap-2" aria-label="Выбранные контакты">
          {selected.map((option) => (
            <span
              key={option.id}
              className="inline-flex max-w-full items-center gap-1 rounded-lg border border-app-line bg-app-soft px-2 py-1 text-xs font-semibold text-app-text"
            >
              <span className="truncate">{option.name}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={disabled}
                className="h-6 w-6 shrink-0"
                aria-label={`Убрать контакт ${option.name}`}
                onClick={() => remove(option.id)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-app-muted">Контакты не выбраны</p>
      )}
    </div>
  );
}
