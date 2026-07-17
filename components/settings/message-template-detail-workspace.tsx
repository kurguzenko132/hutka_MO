'use client';

import { useRouter } from 'next/navigation';
import { LoaderCircle, MessageSquareText, Trash2 } from 'lucide-react';
import { type FormEvent, type ReactNode, useRef, useState, useTransition } from 'react';
import {
  deleteMessageTemplateMutation,
  updateMessageTemplateMutation
} from '@/actions/message-templates.actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  type MessageTemplate,
  messageTemplateAudienceOptions,
  messageTemplateCategoryOptions,
  messageTemplateChannelOptions,
  messageTemplateStatusOptions
} from '@/lib/message-template-shared';

function fieldLabel(text: string) {
  return <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-app-muted">{text}</label>;
}

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

function MutationButton({ pending, children, ...props }: React.ComponentProps<typeof Button> & { pending: boolean; children: ReactNode }) {
  return (
    <Button {...props} type="submit" disabled={props.disabled || pending} aria-busy={pending || undefined}>
      {pending && <LoaderCircle className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />}
      {children}
    </Button>
  );
}

export function MessageTemplateDetailWorkspace({ initialTemplate }: { initialTemplate: MessageTemplate }) {
  const router = useRouter();
  const [template, setTemplate] = useState(initialTemplate);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const pendingRef = useRef<string | null>(null);
  const [, startTransition] = useTransition();

  function runMutation(key: string, task: () => Promise<void>) {
    if (pendingRef.current) return false;
    pendingRef.current = key;
    setPendingKey(key);
    startTransition(async () => {
      try {
        await task();
      } finally {
        pendingRef.current = null;
        setPendingKey(null);
      }
    });
    return true;
  }

  function saveTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingRef.current) return;
    const formData = new FormData(event.currentTarget);
    const title = value(formData, 'title');
    const body = value(formData, 'body');
    if (!title || !body) return;

    const parsedOrder = Number.parseInt(value(formData, 'order_index'), 10);
    const optimistic: MessageTemplate = {
      ...template,
      title,
      shortTitle: value(formData, 'short_title') || title,
      description: value(formData, 'description'),
      audience: value(formData, 'audience') as MessageTemplate['audience'],
      category: value(formData, 'category') as MessageTemplate['category'],
      channel: value(formData, 'channel') as MessageTemplate['channel'],
      status: value(formData, 'status') as MessageTemplate['status'],
      body,
      orderIndex: Number.isFinite(parsedOrder) ? parsedOrder : 99
    };
    setTemplate(optimistic);
    runMutation('save', async () => {
      const result = await updateMessageTemplateMutation({ ...optimistic, id: template.id });
      if (!result.ok || !result.item) {
        setTemplate(template);
        setNotice({
          tone: 'error',
          text: result.error === 'demo'
            ? 'Supabase не настроен, шаблон не сохранен.'
            : result.error === 'template-not-found'
              ? 'Шаблон больше не найден.'
              : 'Не удалось сохранить шаблон.'
        });
        return;
      }
      setTemplate(result.item);
      setNotice({ tone: 'success', text: 'Шаблон сохранен.' });
    });
  }

  function deleteTemplate() {
    if (
      pendingRef.current
      || !window.confirm(`Удалить шаблон «${template.title}»?`)
    ) return;

    runMutation('delete', async () => {
      const result = await deleteMessageTemplateMutation(template.id);
      if (!result.ok) {
        setNotice({
          tone: 'error',
          text: result.error === 'template-not-found'
            ? 'Шаблон уже удален.'
            : 'Не удалось удалить шаблон.'
        });
        return;
      }
      router.replace('/settings/message-templates?deleted=template');
    });
  }

  return (
    <div className="space-y-6">
      {notice && (
        <div role="status" aria-live="polite" className={`rounded-xl border px-4 py-3 text-sm font-semibold ${notice.tone === 'error' ? 'border-red-100 bg-red-50 text-red-700' : 'border-emerald-100 bg-emerald-50 text-emerald-700'}`}>
          {notice.text}
        </div>
      )}

      <Card key={`${template.id}-${template.updatedAt ?? ''}`}>
        <CardHeader><CardTitle className="flex items-center gap-2"><MessageSquareText className="h-4 w-4 text-app-purple" />Настройки шаблона</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={saveTemplate} className="grid gap-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <div>{fieldLabel('Название')}<Input name="title" defaultValue={template.title} required /></div>
              <div>{fieldLabel('Короткое название')}<Input name="short_title" defaultValue={template.shortTitle} /></div>
              <div>{fieldLabel('Аудитория')}<Select name="audience" defaultValue={template.audience}>{messageTemplateAudienceOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</Select></div>
              <div>{fieldLabel('Категория')}<Select name="category" defaultValue={template.category}>{messageTemplateCategoryOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</Select></div>
              <div>{fieldLabel('Канал')}<Select name="channel" defaultValue={template.channel}>{messageTemplateChannelOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</Select></div>
              <div>{fieldLabel('Статус')}<Select name="status" defaultValue={template.status}>{messageTemplateStatusOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</Select></div>
              <div>{fieldLabel('Порядок')}<Input name="order_index" type="number" defaultValue={String(template.orderIndex ?? 99)} /></div>
              <div>{fieldLabel('Описание')}<Input name="description" defaultValue={template.description} /></div>
            </div>
            <div>
              {fieldLabel('Текст сообщения')}
              <Textarea name="body" rows={12} defaultValue={template.body} required />
              <div className="mt-3 rounded-2xl bg-app-soft p-4 text-xs leading-6 text-app-muted">Доступные переменные: {'{{name}}'}, {'{{first_name}}'}, {'{{type}}'}, {'{{niche}}'}, {'{{city}}'}, {'{{stage}}'}, {'{{instagram}}'}, {'{{telegram}}'}, {'{{questionnaire_link}}'}, {'{{sender_name}}'}, {'{{sender_title}}'}.</div>
            </div>
            <MutationButton pending={pendingKey === 'save'}>Сохранить шаблон</MutationButton>
          </form>
        </CardContent>
      </Card>

      <Card className="border-red-100">
        <CardHeader><CardTitle className="text-red-700">Опасная зона</CardTitle></CardHeader>
        <CardContent>
          <Button type="button" variant="danger" disabled={Boolean(pendingKey)} aria-busy={pendingKey === 'delete' || undefined} onClick={deleteTemplate}>
            {pendingKey === 'delete' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Удалить шаблон
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
