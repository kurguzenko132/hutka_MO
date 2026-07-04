import { getLeads, type LeadFilters } from '@/lib/leads';
import { requirePermission } from '@/lib/permissions';

function csvCell(value: unknown) {
  const text = String(value ?? '').replace(/"/g, '""');
  return `"${text}"`;
}

function buildFilters(searchParams: URLSearchParams): LeadFilters {
  return {
    q: searchParams.get('q') ?? undefined,
    type: searchParams.get('type') ?? undefined,
    city: searchParams.get('city') ?? undefined,
    niche: searchParams.get('niche') ?? undefined,
    stage: searchParams.get('stage') ?? undefined,
    source: searchParams.get('source') ?? undefined,
    priority: searchParams.get('priority') ?? undefined,
    tag: searchParams.get('tag') ?? undefined,
    view: searchParams.get('view') ?? undefined
  };
}

export async function GET(request: Request) {
  await requirePermission('manageContacts', '/people?error=forbidden');

  const url = new URL(request.url);
  const leads = await getLeads(buildFilters(url.searchParams));
  const header = ['Имя', 'Тип', 'Ниша', 'Город', 'Стадия', 'Источник', 'Приоритет', 'Следующий шаг', 'Дата следующего контакта', 'Теги'];
  const rows = leads.map((lead) => [
    lead.name,
    lead.type,
    lead.niche,
    lead.city,
    lead.stage,
    lead.source,
    lead.priority,
    lead.nextStep,
    lead.nextDate,
    lead.tags.join(', ')
  ]);

  const csv = [header, ...rows].map((row) => row.map(csvCell).join(';')).join('\n');
  const body = `\uFEFF${csv}`;

  return new Response(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="hutka-contacts.csv"'
    }
  });
}
