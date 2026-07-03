import Link from 'next/link';
import { AlertCircle, CheckCircle2, MessageSquareText, Trash2 } from 'lucide-react';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { requireAdmin } from '@/lib/permissions';
import { getMessageTemplateById, messageTemplateAudienceOptions, messageTemplateCategoryOptions, messageTemplateChannelOptions, messageTemplateStatusOptions } from '@/lib/message-templates';
import { deleteMessageTemplateAction, updateMessageTemplateAction } from '@/actions/message-templates.actions';

function fieldLabel(text: string) {
  return <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-app-muted">{text}</label>;
}

function Notice({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const error = typeof searchParams.error === 'string' ? searchParams.error : '';
  const saved = typeof searchParams.saved === 'string' ? searchParams.saved : '';
  if (!error && !saved) return null;

  return (
    <div className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm ${error ? 'border-red-100 bg-red-50 text-red-700' : 'border-emerald-100 bg-emerald-50 text-emerald-700'}`}>
      {error ? <AlertCircle className="mt-0.5 h-4 w-4" /> : <CheckCircle2 className="mt-0.5 h-4 w-4" />}
      <span>{error ? 'Не удалось сохранить шаблон.' : 'Шаблон сохранен.'}</span>
    </div>
  );
}

export default async function MessageTemplateDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const template = await getMessageTemplateById(id);
  if (!template) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title={template.title}
        subtitle="Редактируй текст сообщения и переменные. Активные шаблоны будут доступны в карточке контакта."
        actions={<Button asChild variant="secondary"><Link href="/settings/message-templates">Все шаблоны</Link></Button>}
      />

      <Notice searchParams={query} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><MessageSquareText className="h-4 w-4 text-app-purple" />Настройки шаблона</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={updateMessageTemplateAction} className="grid gap-4">
            <input type="hidden" name="id" value={template.id} />
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                {fieldLabel('Название')}
                <Input name="title" defaultValue={template.title} required />
              </div>
              <div>
                {fieldLabel('Короткое название')}
                <Input name="short_title" defaultValue={template.shortTitle} />
              </div>
              <div>
                {fieldLabel('Аудитория')}
                <Select name="audience" defaultValue={template.audience}>
                  {messageTemplateAudienceOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </Select>
              </div>
              <div>
                {fieldLabel('Категория')}
                <Select name="category" defaultValue={template.category}>
                  {messageTemplateCategoryOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </Select>
              </div>
              <div>
                {fieldLabel('Канал')}
                <Select name="channel" defaultValue={template.channel}>
                  {messageTemplateChannelOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </Select>
              </div>
              <div>
                {fieldLabel('Статус')}
                <Select name="status" defaultValue={template.status}>
                  {messageTemplateStatusOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </Select>
              </div>
              <div>
                {fieldLabel('Порядок')}
                <Input name="order_index" type="number" defaultValue={String(template.orderIndex ?? 99)} />
              </div>
              <div>
                {fieldLabel('Описание')}
                <Input name="description" defaultValue={template.description} />
              </div>
            </div>
            <div>
              {fieldLabel('Текст сообщения')}
              <Textarea name="body" rows={12} defaultValue={template.body} required />
              <div className="mt-3 rounded-2xl bg-app-soft p-4 text-xs leading-6 text-app-muted">
                Доступные переменные: {'{{name}}'}, {'{{first_name}}'}, {'{{type}}'}, {'{{niche}}'}, {'{{city}}'}, {'{{stage}}'}, {'{{instagram}}'}, {'{{telegram}}'}, {'{{questionnaire_link}}'}, {'{{sender_name}}'}, {'{{sender_title}}'}.
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit">Сохранить шаблон</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="border-red-100">
        <CardHeader>
          <CardTitle className="text-red-700">Опасная зона</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={deleteMessageTemplateAction}>
            <input type="hidden" name="id" value={template.id} />
            <Button type="submit" variant="danger"><Trash2 className="h-4 w-4" />Удалить шаблон</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
