import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Download, FileSpreadsheet, Info, Upload, XCircle } from 'lucide-react';
import { importContactsCsvAction } from '@/actions/imports.actions';
import { Field, FormSection } from '@/components/forms/form-section';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SubmitButton } from '@/components/ui/submit-button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { getImportLogs, importTemplateHeaders } from '@/lib/imports';
import { requirePermission } from '@/lib/permissions';
import { getSettingsData } from '@/lib/settings';

const errorMessages: Record<string, string> = {
  'missing-file': 'Выбери CSV-файл для импорта.',
  'import-log-failed': 'Контакты обработаны, но не удалось записать журнал импорта. Проверь таблицу import_logs и RLS.',
  'save-failed': 'Не удалось импортировать контакты. Проверь файл и настройки Supabase.'
};

type ImportPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

export default async function ImportContactsPage({ searchParams }: ImportPageProps) {
  await requirePermission('manageContacts', '/people?error=forbidden');
  const params = (await searchParams) ?? {};
  const error = firstParam(params.error);
  const imported = firstParam(params.imported);
  const skipped = firstParam(params.skipped);
  const failed = firstParam(params.failed);
  const demo = firstParam(params.demo);
  const [settings, logs] = await Promise.all([getSettingsData(), getImportLogs()]);
  const sources = settings.sources.map((source) => source.name);
  const stages = settings.stages.map((stage) => stage.name);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="secondary">
          <Link href="/people">
            <ArrowLeft className="h-4 w-4" />
            Назад к контактам
          </Link>
        </Button>
      </div>

      <PageHeader title="Импорт контактов" subtitle="Загружай мастеров, салоны и партнеров из CSV-файла, таблиц и партнерских баз" />

      {error && (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700">
          {errorMessages[error] ?? 'Не удалось импортировать файл.'}
        </div>
      )}

      {(imported || demo) && (
        <div className="rounded-2xl border border-green-100 bg-green-50 p-4 text-sm font-semibold text-green-800">
          {demo ? 'Демо-режим: Supabase не настроен, файл не был сохранен.' : `Импорт завершен: добавлено ${imported}, пропущено ${skipped || 0}, ошибок ${failed || 0}.`}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <form action={importContactsCsvAction} className="space-y-6">
          <FormSection title="CSV-файл" subtitle="Файл должен содержать первую строку с названиями колонок. Поддерживаются запятые и точки с запятой.">
            <div className="space-y-4">
              <Field label="Файл CSV" hint="Максимально разумно загружать до 1000 строк за один импорт.">
                <Input name="file" type="file" accept=".csv,text/csv" required />
              </Field>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="secondary">
                  <Link prefetch={false} href="/people/import/template">
                    <Download className="h-4 w-4" />
                    Скачать шаблон
                  </Link>
                </Button>
                <Button asChild variant="ghost">
                  <Link prefetch={false} href="/people/export">
                    <FileSpreadsheet className="h-4 w-4" />
                    Посмотреть формат экспорта
                  </Link>
                </Button>
              </div>
            </div>
          </FormSection>

          <FormSection title="Настройки импорта" subtitle="Если в CSV нет источника, стадии или типа, Hutka применит значения ниже.">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Тип по умолчанию">
                <Select name="default_type" defaultValue="Мастер">
                  <option>Мастер</option>
                  <option>Салон</option>
                  <option>Клиент</option>
                  <option>Партнер</option>
                </Select>
              </Field>
              <Field label="Источник по умолчанию">
                <Select name="default_source" defaultValue={sources[0] ?? 'Импорт CSV'}>
                  {(sources.length ? sources : ['Импорт CSV', 'Instagram', 'Telegram']).map((source) => (
                    <option key={source}>{source}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Стадия по умолчанию">
                <Select name="default_stage" defaultValue={stages[0] ?? 'Новый'}>
                  {(stages.length ? stages : ['Новый']).map((stage) => (
                    <option key={stage}>{stage}</option>
                  ))}
                </Select>
              </Field>
              <label className="flex items-center gap-3 rounded-2xl border border-app-line bg-slate-50 px-4 py-3 text-sm font-semibold text-app-text">
                <input name="skip_duplicates" type="checkbox" defaultChecked className="h-4 w-4" />
                Пропускать дубли по Instagram, Telegram, телефону или email
              </label>
            </div>
          </FormSection>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button asChild variant="secondary">
              <Link href="/people">Отмена</Link>
            </Button>
            <SubmitButton>
              <Upload className="h-4 w-4" />
              Импортировать контакты
            </SubmitButton>
          </div>
        </form>

        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Поддерживаемые колонки</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {importTemplateHeaders.map((header) => (
                  <Badge key={header} tone="purple">{header}</Badge>
                ))}
              </div>
              <div className="mt-4 rounded-2xl bg-purple-50 p-4 text-sm leading-6 text-purple-900">
                <div className="mb-2 flex items-center gap-2 font-black">
                  <Info className="h-4 w-4" />
                  Можно использовать русские названия
                </div>
                Например: <b>имя</b>, <b>город</b>, <b>источник</b>, <b>стадия</b>, <b>теги</b>.
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Что происходит после импорта</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-app-muted">
              <div className="flex gap-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-app-green" />
                <p>Создаются контакты, источники, стадии и теги, которых еще нет в справочниках.</p>
              </div>
              <div className="flex gap-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-app-green" />
                <p>В карточке каждого контакта появляется запись в истории: «Контакт импортирован из файла».</p>
              </div>
              <div className="flex gap-3">
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-app-red" />
                <p>Строки без имени не импортируются и попадают в ошибки последнего импорта.</p>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Последние импорты</CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <div className="rounded-2xl bg-slate-50 p-6 text-center text-sm text-app-muted">
              Импортов пока нет. После первой загрузки CSV здесь появится история.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-b border-app-line text-xs uppercase tracking-wide text-app-faint">
                  <tr>
                    <th className="py-3 pr-4">Файл</th>
                    <th className="py-3 pr-4">Строк</th>
                    <th className="py-3 pr-4">Добавлено</th>
                    <th className="py-3 pr-4">Пропущено</th>
                    <th className="py-3 pr-4">Ошибки</th>
                    <th className="py-3 pr-4">Дата</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-app-line">
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td className="py-4 pr-4 font-bold text-app-text">{log.fileName}</td>
                      <td className="py-4 pr-4 text-app-muted">{log.totalRows}</td>
                      <td className="py-4 pr-4 text-app-green">{log.importedRows}</td>
                      <td className="py-4 pr-4 text-app-muted">{log.skippedRows}</td>
                      <td className="py-4 pr-4 text-app-red">{log.failedRows}</td>
                      <td className="py-4 pr-4 text-app-muted">{log.createdAt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
