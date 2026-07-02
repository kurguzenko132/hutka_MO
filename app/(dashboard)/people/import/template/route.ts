import { buildImportTemplateCsv } from '@/lib/imports';

export async function GET() {
  return new Response(buildImportTemplateCsv(), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="hutka_contacts_template.csv"'
    }
  });
}
