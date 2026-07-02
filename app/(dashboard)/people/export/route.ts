import { getLeads } from '@/lib/leads';

function csvCell(value: unknown) {
  const text = String(value ?? '').replace(/"/g, '""');
  return `"${text}"`;
}

export async function GET() {
  const leads = await getLeads();
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
