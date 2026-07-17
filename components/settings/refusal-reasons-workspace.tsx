'use client';

import { CircleOff, LoaderCircle, PlusCircle, Trash2 } from 'lucide-react';
import { type FormEvent, type ReactNode, useRef, useState, useTransition } from 'react';
import {
  createRefusalReasonMutation,
  deleteRefusalReasonMutation,
  updateRefusalReasonMutation,
  type RefusalReasonMutationResult
} from '@/actions/refusals.actions';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { RefusalReason } from '@/lib/refusals';

const colors: Array<{ label: string; value: BadgeTone }> = [
  { label: 'Фиолетовый', value: 'purple' },
  { label: 'Розовый', value: 'pink' },
  { label: 'Зеленый', value: 'green' },
  { label: 'Желтый', value: 'yellow' },
  { label: 'Красный', value: 'red' },
  { label: 'Синий', value: 'blue' },
  { label: 'Серый', value: 'gray' }
];

function fieldLabel(text: string) {
  return <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-app-muted">{text}</label>;
}

function colorTone(value?: string): BadgeTone {
  return colors.some((color) => color.value === value) ? value as BadgeTone : 'gray';
}

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

function integer(formData: FormData, key: string, fallback = 99) {
  const value = Number.parseInt(text(formData, key), 10);
  return Number.isFinite(value) ? value : fallback;
}

function sortReasons(items: RefusalReason[]) {
  return [...items].sort((a, b) => a.orderIndex - b.orderIndex || a.name.localeCompare(b.name, 'ru'));
}

function errorMessage(result: RefusalReasonMutationResult) {
  if (result.error === 'demo') return 'Supabase не настроен, изменение не сохранено.';
  if (result.error === 'name-required' || result.error === 'update-required') return 'Укажи название причины отказа.';
  if (result.error === 'reason-not-found') return 'Причина отказа больше не найдена.';
  if (result.error === 'in-use') return `Причина используется в ${result.count ?? 0} контактах и не может быть удалена.`;
  return 'Не удалось сохранить причину отказа.';
}

function MutationButton({
  pending,
  children,
  ...props
}: React.ComponentProps<typeof Button> & { pending: boolean; children: ReactNode }) {
  return (
    <Button {...props} type="submit" disabled={props.disabled || pending} aria-busy={pending || undefined}>
      {pending && <LoaderCircle className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />}
      {children}
    </Button>
  );
}

export function RefusalReasonsWorkspace({ initialReasons }: { initialReasons: RefusalReason[] }) {
  const [reasons, setReasons] = useState(initialReasons);
  const [pendingKeys, setPendingKeys] = useState<string[]>([]);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const pendingRef = useRef(new Set<string>());
  const [, startTransition] = useTransition();

  function runMutation(key: string, task: () => Promise<void>) {
    if (pendingRef.current.has(key)) return false;
    pendingRef.current.add(key);
    setPendingKeys((current) => [...current, key]);
    startTransition(async () => {
      try {
        await task();
      } finally {
        pendingRef.current.delete(key);
        setPendingKeys((current) => current.filter((item) => item !== key));
      }
    });
    return true;
  }

  function isPending(key: string) {
    return pendingKeys.includes(key);
  }

  function createReason(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const name = text(formData, 'name');
    const key = 'reason:create';
    if (!name || pendingRef.current.has(key)) return;

    const temporaryId = `temporary-reason-${crypto.randomUUID()}`;
    const temporary: RefusalReason = {
      id: temporaryId,
      name,
      description: text(formData, 'description') || undefined,
      color: text(formData, 'color') || 'red',
      orderIndex: integer(formData, 'order_index'),
      isActive: text(formData, 'is_active') !== 'false',
      usageCount: 0
    };
    setReasons((current) => sortReasons([...current, temporary]));
    runMutation(key, async () => {
      const result = await createRefusalReasonMutation(temporary);
      if (!result.ok || !result.item) {
        setReasons((current) => current.filter((item) => item.id !== temporaryId));
        setNotice({ tone: 'error', text: errorMessage(result) });
        return;
      }
      const savedReason = result.item;
      setReasons((current) => sortReasons(current.map((item) => (
        item.id === temporaryId ? { ...savedReason, usageCount: 0 } : item
      ))));
      form.reset();
      setNotice({ tone: 'success', text: 'Причина отказа добавлена.' });
    });
  }

  function updateReason(event: FormEvent<HTMLFormElement>, reason: RefusalReason) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const name = text(formData, 'name');
    const key = `reason:update:${reason.id}`;
    if (!name || pendingRef.current.has(key)) return;

    const optimistic: RefusalReason = {
      ...reason,
      name,
      description: text(formData, 'description') || undefined,
      color: text(formData, 'color') || 'gray',
      orderIndex: integer(formData, 'order_index'),
      isActive: text(formData, 'is_active') !== 'false'
    };
    setReasons((current) => sortReasons(current.map((item) => item.id === reason.id ? optimistic : item)));
    runMutation(key, async () => {
      const result = await updateRefusalReasonMutation(optimistic);
      if (!result.ok || !result.item) {
        setReasons((current) => sortReasons(current.map((item) => item.id === reason.id ? reason : item)));
        setNotice({ tone: 'error', text: errorMessage(result) });
        return;
      }
      const savedReason = result.item;
      setReasons((current) => sortReasons(current.map((item) => (
        item.id === reason.id ? { ...savedReason, usageCount: reason.usageCount ?? 0 } : item
      ))));
      setNotice({ tone: 'success', text: 'Причина отказа сохранена.' });
    });
  }

  function deleteReason(reason: RefusalReason) {
    const key = `reason:delete:${reason.id}`;
    if (
      pendingRef.current.has(key)
      || (reason.usageCount ?? 0) > 0
      || !window.confirm(`Удалить причину «${reason.name}»?`)
    ) return;

    setReasons((current) => current.filter((item) => item.id !== reason.id));
    runMutation(key, async () => {
      const result = await deleteRefusalReasonMutation(reason.id);
      if (!result.ok) {
        setReasons((current) => sortReasons([...current, reason]));
        setNotice({ tone: 'error', text: errorMessage(result) });
        return;
      }
      setNotice({ tone: 'success', text: 'Причина отказа удалена.' });
    });
  }

  return (
    <div className="space-y-6">
      {notice && (
        <div
          role="status"
          aria-live="polite"
          className={`rounded-xl border px-4 py-3 text-sm font-semibold ${notice.tone === 'error' ? 'border-red-100 bg-red-50 text-red-700' : 'border-emerald-100 bg-emerald-50 text-emerald-700'}`}
        >
          {notice.text}
        </div>
      )}

      <Card className="border-red-100 bg-gradient-to-br from-white to-red-50/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><PlusCircle className="h-4 w-4 text-app-red" />Добавить причину</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={createReason} className="grid gap-4">
            <div className="grid gap-4 lg:grid-cols-[1fr_160px_140px_140px] lg:items-end">
              <div>{fieldLabel('Название')}<Input name="name" placeholder="Например, Не верит, что будут заявки" required /></div>
              <div>{fieldLabel('Цвет')}<Select name="color" defaultValue="red">{colors.map((color) => <option key={color.value} value={color.value}>{color.label}</option>)}</Select></div>
              <div>{fieldLabel('Порядок')}<Input name="order_index" type="number" defaultValue="99" /></div>
              <div>{fieldLabel('Статус')}<Select name="is_active" defaultValue="true"><option value="true">Активна</option><option value="false">Скрыта</option></Select></div>
            </div>
            <div>{fieldLabel('Описание')}<Textarea name="description" rows={3} placeholder="Когда выбирать эту причину и что она значит для команды" /></div>
            <MutationButton pending={isPending('reason:create')}>Добавить причину</MutationButton>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {reasons.map((reason) => {
          const updateKey = `reason:update:${reason.id}`;
          const deleteKey = `reason:delete:${reason.id}`;
          return (
            <Card key={`${reason.id}-${reason.name}-${reason.color}-${reason.orderIndex}-${reason.isActive}`}>
              <CardContent className="p-5">
                <form onSubmit={(event) => updateReason(event, reason)} className="grid gap-4">
                  <div className="grid gap-4 lg:grid-cols-[1fr_150px_120px_140px_auto] lg:items-end">
                    <div>{fieldLabel('Причина')}<Input name="name" defaultValue={reason.name} required /></div>
                    <div>{fieldLabel('Цвет')}<Select name="color" defaultValue={reason.color}>{colors.map((color) => <option key={color.value} value={color.value}>{color.label}</option>)}</Select></div>
                    <div>{fieldLabel('Порядок')}<Input name="order_index" type="number" defaultValue={String(reason.orderIndex)} /></div>
                    <div>{fieldLabel('Статус')}<Select name="is_active" defaultValue={reason.isActive ? 'true' : 'false'}><option value="true">Активна</option><option value="false">Скрыта</option></Select></div>
                    <MutationButton variant="secondary" pending={isPending(updateKey)}>Сохранить</MutationButton>
                  </div>
                  <div>{fieldLabel('Описание')}<Textarea name="description" rows={3} defaultValue={reason.description ?? ''} /></div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={colorTone(reason.color)}>{reason.name}</Badge>
                    <Badge tone={reason.isActive ? 'green' : 'gray'}>{reason.isActive ? 'Активна' : 'Скрыта'}</Badge>
                    <Badge tone="gray">Использований: {reason.usageCount ?? 0}</Badge>
                  </div>
                </form>
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  className="mt-4"
                  disabled={(reason.usageCount ?? 0) > 0 || isPending(deleteKey)}
                  aria-busy={isPending(deleteKey) || undefined}
                  onClick={() => deleteReason(reason)}
                >
                  {isPending(deleteKey) ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  Удалить
                </Button>
              </CardContent>
            </Card>
          );
        })}

        {reasons.length === 0 && (
          <Card><CardContent className="flex items-center gap-3 p-6 text-sm text-app-muted"><CircleOff className="h-5 w-5 text-app-faint" />Причины отказа пока не настроены.</CardContent></Card>
        )}
      </div>
    </div>
  );
}
