'use client';

import { useEffect, useState } from 'react';
import { Check, LoaderCircle, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { LeadOption } from '@/lib/leads';

export function LeadCombobox({
  name,
  value,
  initialOption,
  excludeCampaignId,
  disabled = false,
  placeholder = 'Найти контакт...',
  onChange
}: {
  name: string;
  value?: LeadOption | null;
  initialOption?: LeadOption | null;
  excludeCampaignId?: string;
  disabled?: boolean;
  placeholder?: string;
  onChange?: (option: LeadOption | null) => void;
}) {
  const controlled = value !== undefined;
  const [internalValue, setInternalValue] = useState<LeadOption | null>(initialOption ?? null);
  const selected = controlled ? value ?? null : internalValue;
  const [query, setQuery] = useState(selected?.name ?? '');
  const [options, setOptions] = useState<LeadOption[]>([]);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (controlled) setQuery(value?.name ?? '');
  }, [controlled, value]);

  useEffect(() => {
    if (!open || disabled) return;

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setPending(true);
      try {
        const params = new URLSearchParams();
        if (query.trim()) params.set('q', query.trim());
        if (excludeCampaignId) params.set('excludeCampaignId', excludeCampaignId);
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
  }, [disabled, excludeCampaignId, open, query]);

  function select(option: LeadOption | null) {
    if (!controlled) setInternalValue(option);
    setQuery(option?.name ?? '');
    setOpen(false);
    onChange?.(option);
  }

  return (
    <div
      className="relative"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <input type="hidden" name={name} value={selected?.id ?? ''} />
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-app-faint" />
        <Input
          value={query}
          disabled={disabled}
          autoComplete="off"
          placeholder={placeholder}
          className="pl-9 pr-10"
          aria-label="Поиск контакта"
          aria-expanded={open}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            if (selected) {
              if (!controlled) setInternalValue(null);
              onChange?.(null);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setOpen(false);
          }}
        />
        {selected ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2"
            aria-label="Очистить контакт"
            onClick={() => select(null)}
          >
            <X className="h-4 w-4" />
          </Button>
        ) : null}
      </div>

      {open ? (
        <div className="absolute z-30 mt-2 max-h-64 w-full overflow-y-auto rounded-xl border border-app-line bg-white p-1 shadow-card">
          {pending ? (
            <div className="flex items-center gap-2 px-3 py-3 text-sm text-app-muted">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Ищу контакты...
            </div>
          ) : options.length > 0 ? (
            options.map((option) => (
              <button
                key={option.id}
                type="button"
                className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm font-semibold text-app-text hover:bg-purple-50"
                onClick={() => select(option)}
              >
                <span className="min-w-0 truncate">{option.name}</span>
                {selected?.id === option.id ? <Check className="h-4 w-4 shrink-0 text-app-purple" /> : null}
              </button>
            ))
          ) : (
            <p className="px-3 py-3 text-sm text-app-muted">Контакты не найдены</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
