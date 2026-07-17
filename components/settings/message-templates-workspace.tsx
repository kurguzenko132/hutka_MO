'use client';

import Link from 'next/link';
import { LoaderCircle, MessageSquareText, PlusCircle } from 'lucide-react';
import { type FormEvent, type ReactNode, useRef, useState, useTransition } from 'react';
import {
  createMessageTemplateMutation,
  type MessageTemplateMutationResult
} from '@/actions/message-templates.actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  type MessageTemplate,
  type MessageTemplateAudience,
  type MessageTemplateCategory,
  type MessageTemplateChannel,
  type MessageTemplateStatus,
  messageTemplateAudienceLabel,
  messageTemplateAudienceOptions,
  messageTemplateCategoryLabel,
  messageTemplateCategoryOptions,
  messageTemplateChannelLabel,
  messageTemplateChannelOptions,
  messageTemplateStatusLabel,
  messageTemplateStatusOptions
} from '@/lib/message-template-shared';

function fieldLabel(text: string) {
  return <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-app-muted">{text}</label>;
}

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

function numberValue(formData: FormData, key: string, fallback = 99) {
  const parsed = Number.parseInt(value(formData, key), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function sortTemplates(items: MessageTemplate[]) {
  return [...items].sort((a, b) => (a.orderIndex ?? 99) - (b.orderIndex ?? 99) || a.title.localeCompare(b.title, 'ru'));
}

function mutationError(result: MessageTemplateMutationResult) {
  if (result.error === 'demo') return 'Supabase не настроен, шаблон не сохранен.';
  if (result.error === 'required') return 'Заполни название и текст сообщения.';
  return 'Не удалось создать шаблон сообщения.';
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

export function MessageTemplatesWorkspace({ initialTemplates }: { initialTemplates: MessageTemplate[] }) {
  const [templates, setTemplates] = useState(initialTemplates);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const pendingRef = useRef(false);
  const [, startTransition] = useTransition();

  function createTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingRef.current) return;
    const form = event.currentTarget;
    const formData = new FormData(form);
    const title = value(formData, 'title');
    const body = value(formData, 'body');
    if (!title || !body) return;

    const temporaryId = `temporary-template-${crypto.randomUUID()}`;
    const temporary: MessageTemplate = {
      id: temporaryId,
      title,
      shortTitle: value(formData, 'short_title') || title,
      description: value(formData, 'description'),
      audience: (value(formData, 'audience') || 'any') as MessageTemplateAudience,
      category: (value(formData, 'category') || 'custom') as MessageTemplateCategory,
      channel: (value(formData, 'channel') || 'any') as MessageTemplateChannel,
      status: (value(formData, 'status') || 'active') as MessageTemplateStatus,
      body,
      orderIndex: numberValue(formData, 'order_index')
    };

    pendingRef.current = true;
    setPending(true);
    setTemplates((current) => sortTemplates([...current, temporary]));
    startTransition(async () => {
      try {
        const result = await createMessageTemplateMutation(temporary);
        if (!result.ok || !result.item) {
          setTemplates((current) => current.filter((item) => item.id !== temporaryId));
          setNotice({ tone: 'error', text: mutationError(result) });
          return;
        }
        const savedTemplate = result.item;
        setTemplates((current) => sortTemplates(current.map((item) => (
          item.id === temporaryId ? savedTemplate : item
        ))));
        form.reset();
        setNotice({ tone: 'success', text: 'Шаблон сообщения создан.' });
      } finally {
        pendingRef.current = false;
        setPending(false);
      }
    });
  }

  return (
    <div className="space-y-6">
      {notice && (
        <div role="status" aria-live="polite" className={`rounded-xl border px-4 py-3 text-sm font-semibold ${notice.tone === 'error' ? 'border-red-100 bg-red-50 text-red-700' : 'border-emerald-100 bg-emerald-50 text-emerald-700'}`}>
          {notice.text}
        </div>
      )}

      <Card className="border-purple-100 bg-gradient-to-br from-white to-purple-50">
        <CardHeader><CardTitle className="flex items-center gap-2"><PlusCircle className="h-4 w-4 text-app-purple" />Создать шаблон</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={createTemplate} className="grid gap-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <div>{fieldLabel('Название')}<Input name="title" placeholder="Например, Первое сообщение мастеру" required /></div>
              <div>{fieldLabel('Короткое название')}<Input name="short_title" placeholder="Мастер: первое касание" /></div>
              <div>{fieldLabel('Аудитория')}<Select name="audience" defaultValue="any">{messageTemplateAudienceOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</Select></div>
              <div>{fieldLabel('Категория')}<Select name="category" defaultValue="first_touch">{messageTemplateCategoryOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</Select></div>
              <div>{fieldLabel('Канал')}<Select name="channel" defaultValue="any">{messageTemplateChannelOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</Select></div>
              <div>{fieldLabel('Статус')}<Select name="status" defaultValue="active">{messageTemplateStatusOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</Select></div>
              <div>{fieldLabel('Порядок')}<Input name="order_index" type="number" defaultValue="99" /></div>
              <div>{fieldLabel('Описание')}<Input name="description" placeholder="Когда использовать этот шаблон" /></div>
            </div>
            <div>
              {fieldLabel('Текст сообщения')}
              <Textarea name="body" rows={8} placeholder="Привет, {{first_name}}! ... {{questionnaire_link}}" required />
              <p className="mt-2 text-xs leading-5 text-app-muted">Переменные: {'{{name}}'}, {'{{first_name}}'}, {'{{niche}}'}, {'{{city}}'}, {'{{questionnaire_link}}'}, {'{{sender_name}}'}.</p>
            </div>
            <MutationButton pending={pending}>Создать шаблон</MutationButton>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {templates.length ? templates.map((template) => {
          const isTemporary = template.id.startsWith('temporary-template-');
          return (
          <Link
            prefetch={false}
            key={template.id}
            href={isTemporary ? '#' : `/settings/message-templates/${template.id}`}
            aria-disabled={isTemporary || undefined}
            tabIndex={isTemporary ? -1 : undefined}
            className={`performance-contain block rounded-2xl border border-app-line bg-white p-5 shadow-card transition hover:border-purple-200 hover:bg-purple-50/40 ${isTemporary ? 'pointer-events-none opacity-70' : ''}`}
          >
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <MessageSquareText className="h-4 w-4 text-app-purple" />
                  <h2 className="text-lg font-black text-app-text">{template.title}</h2>
                  {isTemporary && <Badge tone="yellow">Сохраняется</Badge>}
                  <Badge tone={template.status === 'active' ? 'green' : template.status === 'draft' ? 'yellow' : 'gray'}>{messageTemplateStatusLabel(template.status)}</Badge>
                </div>
                {template.description && <p className="mt-2 max-w-3xl text-sm leading-6 text-app-muted">{template.description}</p>}
                <p className="mt-3 line-clamp-2 text-sm leading-6 text-app-muted">{template.body}</p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <Badge tone="purple">{messageTemplateCategoryLabel(template.category)}</Badge>
                <Badge tone="blue">{messageTemplateChannelLabel(template.channel)}</Badge>
                <Badge tone="gray">{messageTemplateAudienceLabel(template.audience)}</Badge>
              </div>
            </div>
          </Link>
        );
        }) : <p className="rounded-2xl border border-app-line bg-white p-5 text-sm text-app-muted">Шаблонов пока нет.</p>}
      </div>
    </div>
  );
}
