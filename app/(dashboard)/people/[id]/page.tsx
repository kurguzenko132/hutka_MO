import { LeadProfile } from '@/components/people/lead-profile';

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LeadProfile id={id} />;
}
