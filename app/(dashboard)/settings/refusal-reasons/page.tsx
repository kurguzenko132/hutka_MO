import Link from 'next/link';
import { AlertCircle, CheckCircle2, CircleOff, PlusCircle, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { requireAdmin } from '@/lib/permissions';
import { getRefusalReasons } from '@/lib/refusals';
import { createRefusalReasonAction, deleteRefusalReasonAction, updateRefusalReasonAction } from '@/actions/refusals.actions';

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
  return colors.some((color) => color.value === value) ? (value as BadgeTone) : 'gray';
}

function Notice({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const error = typeof searchParams.error === 'string' ? searchParams.error : '';
  const saved = typeof searchParams.saved === 'string' ? searchParams.saved : '';
  const deleted = typeof searchParams.deleted === 'string' ? searchParams.deleted : '';
  const demo = typeof searchParams.demo === 'string' ? searchParams.demo : '';

  if (!error && !saved && !deleted && !demo) return null;

  const isError = Boolean(error);
  const message = isError
    ? 'Не удалось выполнить действие. Возможно, причина уже используется в контактах или Supabase не обновлен.'
    : demo
      ? 'Supabase еще не настроен, поэтому причины отказа показаны в demo-режиме.'
      : deleted
        ? 'Причина отказа удалена.'
        : 'Причина отказа сохранена.';

  return (
    <div className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm ${isError ? 'border-red-100 bg-red-50 text-red-700' : 'border-emerald-100 bg-emerald-50 text-emerald-700'}`}>
      {isError ? <AlertCircle className="mt-0.5 h-4 w-4" /> : <CheckCircle2 className="mt-0.5 h-4 w-4" />}
      <span>{message}</span>
    </div>
  );
}

export default async function RefusalReasonsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const params = await searchParams;
  const reasons = await getRefusalReasons(true);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Причины отказа"
        subtitle="Настрой причины, которые маркетолог выбирает при переводе контакта в отказ. Они попадут в карточку, отчеты и аналитику запусков."
        actions={<Button asChild variant="secondary"><Link href="/settings">Назад в настройки</Link></Button>}
      />

      <Notice searchParams={params} />

      <Card className="border-red-100 bg-gradient-to-br from-white to-red-50/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><PlusCircle className="h-4 w-4 text-app-red" />Добавить причину</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createRefusalReasonAction} className="grid gap-4">
            <div className="grid gap-4 lg:grid-cols-[1fr_160px_140px_140px] lg:items-end">
              <div>
                {fieldLabel('Название')}
                <Input name="name" placeholder="Например, Не верит, что будут заявки" required />
              </div>
              <div>
                {fieldLabel('Цвет')}
                <Select name="color" defaultValue="red">
                  {colors.map((color) => <option key={color.value} value={color.value}>{color.label}</option>)}
                </Select>
              </div>
              <div>
                {fieldLabel('Порядок')}
                <Input name="order_index" type="number" defaultValue="99" />
              </div>
              <div>
                {fieldLabel('Статус')}
                <Select name="is_active" defaultValue="true">
                  <option value="true">Активна</option>
                  <option value="false">Скрыта</option>
                </Select>
              </div>
            </div>
            <div>
              {fieldLabel('Описание')}
              <Textarea name="description" rows={3} placeholder="Когда выбирать эту причину и что она значит для команды" />
            </div>
            <Button type="submit">Добавить причину</Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {reasons.map((reason) => (
          <Card key={reason.id}>
            <CardContent className="p-5">
              <form action={updateRefusalReasonAction} className="grid gap-4">
                <input type="hidden" name="id" value={reason.id} />
                <div className="grid gap-4 lg:grid-cols-[1fr_150px_120px_140px_auto] lg:items-end">
                  <div>
                    {fieldLabel('Причина')}
                    <Input name="name" defaultValue={reason.name} required />
                  </div>
                  <div>
                    {fieldLabel('Цвет')}
                    <Select name="color" defaultValue={reason.color}>
                      {colors.map((color) => <option key={color.value} value={color.value}>{color.label}</option>)}
                    </Select>
                  </div>
                  <div>
                    {fieldLabel('Порядок')}
                    <Input name="order_index" type="number" defaultValue={String(reason.orderIndex)} />
                  </div>
                  <div>
                    {fieldLabel('Статус')}
                    <Select name="is_active" defaultValue={reason.isActive ? 'true' : 'false'}>
                      <option value="true">Активна</option>
                      <option value="false">Скрыта</option>
                    </Select>
                  </div>
                  <Button type="submit" variant="secondary">Сохранить</Button>
                </div>
                <div>
                  {fieldLabel('Описание')}
                  <Textarea name="description" rows={3} defaultValue={reason.description ?? ''} />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={colorTone(reason.color)}>{reason.name}</Badge>
                  <Badge tone={reason.isActive ? 'green' : 'gray'}>{reason.isActive ? 'Активна' : 'Скрыта'}</Badge>
                  <Badge tone="gray">Использований: {reason.usageCount ?? 0}</Badge>
                </div>
              </form>
              <form action={deleteRefusalReasonAction} className="mt-4">
                <input type="hidden" name="id" value={reason.id} />
                <Button type="submit" variant="danger" size="sm" disabled={(reason.usageCount ?? 0) > 0}>
                  <Trash2 className="h-4 w-4" />
                  Удалить
                </Button>
              </form>
            </CardContent>
          </Card>
        ))}

        {reasons.length === 0 && (
          <Card>
            <CardContent className="flex items-center gap-3 p-6 text-sm text-app-muted">
              <CircleOff className="h-5 w-5 text-app-faint" />
              Причины отказа пока не настроены.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
