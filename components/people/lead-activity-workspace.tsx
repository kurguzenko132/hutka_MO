'use client';

import { useState, type FormEvent } from 'react';
import { AlertTriangle, Check, LoaderCircle, Save } from 'lucide-react';
import { addLeadInteractionMutationAction } from '@/actions/leads.actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { LeadInteraction } from '@/lib/leads';

function interactionTitle(type?: string | null) {
  const map: Record<string, string> = {
    message: 'Сообщение',
    call: 'Звонок',
    meeting: 'Встреча',
    survey_sent: 'Анкета отправлена',
    survey_completed: 'Анкета заполнена',
    note: 'Заметка',
    status_change: 'Изменение статуса',
    task_status: 'Обновление задачи'
  };
  return map[type ?? ''] ?? 'Активность';
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Только что';
  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function ActivityTimeline({ items, canManage }: { items: LeadInteraction[]; canManage: boolean }) {
  return (
    <Card>
      <CardHeader><CardTitle>История активности</CardTitle></CardHeader>
      <CardContent>
        <div className="space-y-5">
          {items.length ? items.map((item, index) => (
            <div key={item.id} className="relative rounded-2xl border border-app-line bg-white p-4 pl-9">
              {index < items.length - 1 && <span className="absolute left-[17px] top-9 h-full w-px bg-purple-100" />}
              <span className="absolute left-3 top-5 h-3.5 w-3.5 rounded-full border-2 border-white bg-app-purple shadow" />
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-app-faint">{item.date}</p>
                  <p className="mt-1 font-bold text-app-text">{item.title}</p>
                </div>
                {(item.channel || item.result) && <Badge tone="gray">{item.channel}{item.result ? ` · ${item.result}` : ''}</Badge>}
              </div>
              <p className="mt-2 text-sm text-app-muted">{item.text}</p>
            </div>
          )) : (
            <p className="text-sm text-app-muted">
              {canManage ? 'Пока нет касаний. Добавь первое сообщение, звонок или заметку.' : 'Касаний пока нет.'}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function LeadActivityWorkspace({
  leadId,
  initialInteractions,
  canManage
}: {
  leadId: string;
  initialInteractions: LeadInteraction[];
  canManage: boolean;
}) {
  const [items, setItems] = useState(initialInteractions);
  const [type, setType] = useState('note');
  const [channel, setChannel] = useState('');
  const [text, setText] = useState('');
  const [result, setResult] = useState('');
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState('');
  const [noticeError, setNoticeError] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !text.trim()) return;

    const optimisticId = `optimistic-interaction-${Date.now()}`;
    const optimistic: LeadInteraction = {
      id: optimisticId,
      date: formatDateTime(new Date().toISOString()),
      title: interactionTitle(type),
      text: text.trim(),
      channel: channel.trim() || 'Hutka',
      result: result.trim() || undefined
    };
    const previousItems = items;
    setPending(true);
    setNotice('Сохраняю касание...');
    setNoticeError(false);
    setItems((current) => [optimistic, ...current]);

    try {
      const response = await addLeadInteractionMutationAction({
        leadId,
        type,
        channel,
        text,
        result
      });
      if (!response.ok || !response.interaction) {
        setItems(previousItems);
        setNotice('Не удалось сохранить касание. Изменение отменено.');
        setNoticeError(true);
      } else {
        const interaction = response.interaction;
        setItems((current) => current.map((item) => item.id === optimisticId ? {
          id: interaction.id,
          date: formatDateTime(interaction.createdAt),
          title: interactionTitle(interaction.type),
          text: interaction.text,
          channel: interaction.channel,
          result: interaction.result
        } : item));
        setText('');
        setResult('');
        setNotice('Касание сохранено.');
      }
    } catch {
      setItems(previousItems);
      setNotice('Не удалось связаться с сервером. Изменение отменено.');
      setNoticeError(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <ActivityTimeline items={items} canManage={canManage} />

      {canManage && (
        <Card>
          <CardHeader><CardTitle>Добавить касание</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={(event) => void submit(event)} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Select value={type} disabled={pending} onChange={(event) => setType(event.target.value)}>
                  <option value="note">Заметка</option>
                  <option value="message">Сообщение</option>
                  <option value="call">Звонок</option>
                  <option value="meeting">Встреча</option>
                  <option value="survey_sent">Анкета отправлена</option>
                  <option value="survey_completed">Анкета заполнена</option>
                  <option value="status_change">Изменение статуса</option>
                </Select>
                <Input value={channel} disabled={pending} onChange={(event) => setChannel(event.target.value)} placeholder="Канал: Instagram, Telegram..." />
              </div>
              <Textarea value={text} disabled={pending} onChange={(event) => setText(event.target.value)} placeholder="Что произошло, что ответил контакт, что важно не забыть..." required />
              <Input value={result} disabled={pending} onChange={(event) => setResult(event.target.value)} placeholder="Результат: ответил, ждём, отказ, заинтересован..." />
              <Button type="submit" disabled={pending || !text.trim()}>
                {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Сохранить касание
              </Button>
              {notice && (
                <p aria-live="polite" className={`flex items-start gap-2 text-sm font-semibold ${noticeError ? 'text-red-700' : 'text-emerald-700'}`}>
                  {noticeError ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> : <Check className="mt-0.5 h-4 w-4 shrink-0" />}
                  <span>{notice}</span>
                </p>
              )}
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
