import { LeadProfile } from '@/components/people/lead-profile';
import { ActionNotice } from '@/components/ui/action-notice';

export default async function LeadPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  return (
    <div className="space-y-4">
      <ActionNotice searchParams={query} />
      <LeadProfile id={id} />
    </div>
  );
}
