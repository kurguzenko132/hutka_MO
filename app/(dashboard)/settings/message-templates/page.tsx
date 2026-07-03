import Link from 'next/link';
import { AlertCircle, CheckCircle2, MessageSquareText, PlusCircle } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { requireAdmin } from '@/lib/permissions';
import { getMessageTemplates, messageTemplateAudienceOptions, messageTemplateAudienceLabel, messageTemplateCategoryOptions, messageTemplateCategoryLabel, messageTemplateChannelOptions, messageTemplateChannelLabel, messageTemplateStatusOptions, messageTemplateStatusLabel } from '@/lib/message-templates';
import { createMessageTemplateAction } from '@/actions/message-templates.actions';

function Notice({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const error = typeof searchParams.error === 'string' ? searchParams.error : '';
  const saved = typeof searchParams.saved === 'string' ? searchParams.saved : '';
  const deleted = typeof searchParams.deleted === 'string' ? searchParams.deleted : '';
  const demo = typeof searchParams.demo === 'string' ? searchParams.demo : '';

  if (!error && !saved && !deleted && !demo) return null;

  const isError = Boolean(error);
  const message = isError
    ? 'Не удалось выполнить действие. Проверь обязательные поля и подключение Supabase.'
    : demo
      ? 'Supabase еще не настроен, поэтому шаблоны показаны в демо-режиме.'
      : deleted
        ? 'Шаблон удален.'
        : 'Шаблон сохранен.';

  return (
    <div className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm ${isError ? 'border-red-100 bg-red-50 text-red-700' : 'border-emerald-100 bg-emerald-50 text-emerald-700'}`}>
      {isError ? <AlertCircle className="mt-0.5 h-4 w-4" /> : <CheckCircle2 className="mt-0.5 h-4 w-4" />}
      <span>{message}</span>
    </div>
  );
}

function fieldLabel(text: string) {
  return <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-app-muted">{text}</label>;
}

export default async function MessageTemplatesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const params = await searchParams;
  const templates = await getMessageTemplates('all', true);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Шаблоны сообщений"
        subtitle="Создавай готовые тексты для первого касания, отправки анкеты, follow-up, пилота и отказов. Потом их можно копировать прямо из карточки контакта."
        actions={<Button asChild variant="secondary"><Link href="/settings">Назад в настройки</Link></Button>}
      />

      <Notice searchParams={params} />

      <Card className="border-purple-100 bg-gradient-to-br from-white to-purple-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><PlusCircle className="h-4 w-4 text-app-purple" />Создать шаблон</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createMessageTemplateAction} className="grid gap-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                {fieldLabel('Название')}
                <Input name="title" placeholder="Например, Первое сообщение мастеру" required />
              </div>
              <div>
                {fieldLabel('Короткое название')}
                <Input name="short_title" placeholder="Мастер: первое касание" />
              </div>
              <div>
                {fieldLabel('Аудитория')}
                <Select name="audience" defaultValue="any">
                  {messageTemplateAudienceOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </Select>
              </div>
              <div>
                {fieldLabel('Категория')}
                <Select name="category" defaultValue="first_touch">
                  {messageTemplateCategoryOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </Select>
              </div>
              <div>
                {fieldLabel('Канал')}
                <Select name="channel" defaultValue="any">
                  {messageTemplateChannelOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </Select>
              </div>
              <div>
                {fieldLabel('Статус')}
                <Select name="status" defaultValue="active">
                  {messageTemplateStatusOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </Select>
              </div>
              <div>
                {fieldLabel('Порядок')}
                <Input name="order_index" type="number" defaultValue="99" />
              </div>
              <div>
                {fieldLabel('Описание')}
                <Input name="description" placeholder="Когда использовать этот шаблон" />
              </div>
            </div>
            <div>
              {fieldLabel('Текст сообщения')}
              <Textarea name="body" rows={8} placeholder="Привет, {{first_name}}! ... {{questionnaire_link}}" required />
              <p className="mt-2 text-xs leading-5 text-app-muted">
                Переменные: {'{{name}}'}, {'{{first_name}}'}, {'{{niche}}'}, {'{{city}}'}, {'{{questionnaire_link}}'}, {'{{sender_name}}'}.
              </p>
            </div>
            <Button type="submit">Создать шаблон</Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {templates.length ? templates.map((template) => (
          <Link key={template.id} href={`/settings/message-templates/${template.id}`} className="block rounded-2xl border border-app-line bg-white p-5 shadow-card transition hover:border-purple-200 hover:bg-purple-50/40">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <MessageSquareText className="h-4 w-4 text-app-purple" />
                  <h2 className="text-lg font-black text-app-text">{template.title}</h2>
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
        )) : <p className="rounded-2xl border border-app-line bg-white p-5 text-sm text-app-muted">Шаблонов пока нет.</p>}
      </div>
    </div>
  );
}
