import { buildImportTemplateCsv } from '@/lib/imports';
import { requirePermission } from '@/lib/permissions';

export async function GET() {
  await requirePermission('manageContacts', '/people?error=forbidden');

  return new Response(buildImportTemplateCsv(), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="hutka_contacts_template.csv"'
    }
  });
}
