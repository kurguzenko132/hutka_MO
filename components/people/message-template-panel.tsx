'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Check, Copy, MessageSquareText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { MessageTemplate } from '@/lib/message-templates';

export type MessageTemplateLead = {
  name: string;
  type: string;
  niche: string;
  city: string;
  stage: string;
  source: string;
  instagram?: string;
  telegram?: string;
  phone?: string;
  email?: string;
};

export type MessageTemplateSender = {
  name: string;
  title: string;
  email: string;
};

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || name || 'привет';
}

function applyTemplate(template: string, lead: MessageTemplateLead, sender: MessageTemplateSender, questionnaireLink: string) {
  const values: Record<string, string> = {
    name: lead.name,
    first_name: firstName(lead.name),
    type: lead.type,
    niche: lead.niche || 'ваше направление',
    city: lead.city || 'ваш город',
    stage: lead.stage || '',
    source: lead.source || '',
    instagram: lead.instagram || '',
    telegram: lead.telegram || '',
    phone: lead.phone || '',
    email: lead.email || '',
    questionnaire_link: questionnaireLink || '[вставь ссылку на анкету]',
    app_name: 'Hutka',
    sender_name: sender.name,
    sender_title: sender.title,
    sender_email: sender.email
  };

  return template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key: string) => values[key] ?? `{{${key}}}`);
}

function categoryLabel(value: string) {
  const map: Record<string, string> = {
    first_touch: 'Первое касание',
    questionnaire: 'Анкета',
    follow_up: 'Follow-up',
    pilot: 'Тестирование',
    refusal: 'Отказ / пауза',
    feedback: 'Фидбек',
    custom: 'Другое'
  };
  return map[value] ?? value;
}

function channelLabel(value: string) {
  const map: Record<string, string> = {
    instagram: 'Instagram',
    telegram: 'Telegram',
    whatsapp: 'WhatsApp / Viber',
    email: 'Email',
    phone: 'Телефон',
    any: 'Любой канал'
  };
  return map[value] ?? value;
}

export function MessageTemplatePanel({
  lead,
  sender,
  templates,
  canEditTemplates = false
}: {
  lead: MessageTemplateLead;
  sender: MessageTemplateSender;
  templates: MessageTemplate[];
  canEditTemplates?: boolean;
}) {
  const [selectedId, setSelectedId] = useState(templates[0]?.id ?? '');
  const [questionnaireLink, setQuestionnaireLink] = useState('');
  const [copied, setCopied] = useState(false);

  const selected = templates.find((template) => template.id === selectedId) ?? templates[0];
  const text = useMemo(() => selected ? applyTemplate(selected.body, lead, sender, questionnaireLink) : '', [selected, lead, sender, questionnaireLink]);

  async function copyText() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><MessageSquareText className="h-4 w-4 text-app-purple" />Шаблоны сообщений</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {templates.length ? (
          <>
            <div className="grid gap-3 sm:grid-cols-[1fr_0.8fr]">
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-app-text">Шаблон</span>
                <Select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
                  {templates.map((template) => <option key={template.id} value={template.id}>{template.shortTitle}</option>)}
                </Select>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-app-text">Ссылка на анкету, если нужна</span>
                <Input value={questionnaireLink} onChange={(event) => setQuestionnaireLink(event.target.value)} placeholder="/q/... или https://..." />
              </label>
            </div>

            {selected && (
              <div className="flex flex-wrap gap-2">
                <Badge tone="purple">{categoryLabel(selected.category)}</Badge>
                <Badge tone="blue">{channelLabel(selected.channel)}</Badge>
                <Badge tone="gray">{selected.audience === 'any' ? 'Любой контакт' : selected.audience}</Badge>
              </div>
            )}

            {selected?.description && <p className="text-sm leading-6 text-app-muted">{selected.description}</p>}

            <Textarea value={text} readOnly rows={10} className="min-h-[220px] text-sm leading-6" />

            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={copyText}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Скопировано' : 'Скопировать сообщение'}
              </Button>
              {canEditTemplates && (
                <Button asChild type="button" variant="secondary">
                  <Link href="/settings/message-templates">Редактировать шаблоны</Link>
                </Button>
              )}
            </div>

            <div className="rounded-2xl bg-app-soft p-4 text-xs leading-6 text-app-muted">
              Доступные переменные: <b>{'{{name}}'}</b>, <b>{'{{first_name}}'}</b>, <b>{'{{niche}}'}</b>, <b>{'{{city}}'}</b>, <b>{'{{questionnaire_link}}'}</b>, <b>{'{{sender_name}}'}</b>.
            </div>
          </>
        ) : (
          <p className="text-sm text-app-muted">Активных шаблонов пока нет. Создай первый шаблон в настройках.</p>
        )}
      </CardContent>
    </Card>
  );
}
