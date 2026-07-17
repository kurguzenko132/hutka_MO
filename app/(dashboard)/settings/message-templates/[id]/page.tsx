import Link from 'next/link';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { MessageTemplateDetailWorkspace } from '@/components/settings/message-template-detail-workspace';
import { requireAdmin } from '@/lib/permissions';
import { getMessageTemplateById } from '@/lib/message-templates';

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

      <MessageTemplateDetailWorkspace initialTemplate={template} />
    </div>
  );
}
