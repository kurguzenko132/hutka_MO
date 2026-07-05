import { FunnelBoard } from '@/components/funnels/funnel-board';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { getFunnelBoard } from '@/lib/funnels';
import { getCampaignOptions } from '@/lib/campaigns';
import { getCurrentUserContext } from '@/lib/permissions';
import { can } from '@/lib/roles';

type SearchParams = {
  updated?: string;
  error?: string;
  campaignId?: string;
};

export default async function FunnelsPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const user = await getCurrentUserContext();
  const role = user?.role ?? 'viewer';
  const canManageFunnels = can(role, 'manageFunnels');
  const params = await searchParams;
  const campaignId = params?.campaignId;
  const [board, campaigns] = await Promise.all([getFunnelBoard(campaignId), getCampaignOptions()]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Воронка"
        subtitle="Состояние контактов по стадиям. Кампания показывает, откуда пришли контакты, а воронка — что с ними происходит."
        actionLabel={can(role, 'manageContacts') ? 'Добавить контакт' : undefined}
        actionHref={can(role, 'manageContacts') ? '/people/new' : undefined}
      />

      <Card>
        <CardContent className="p-4">
          <form action="/funnels" className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <label className="space-y-1.5">
              <span className="text-xs font-bold uppercase tracking-wide text-app-faint">Кампания</span>
              <Select name="campaignId" defaultValue={campaignId ?? ''}>
                <option value="">Все кампании</option>
                {campaigns.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>{campaign.name}</option>
                ))}
              </Select>
            </label>
            <Button type="submit" variant="secondary">Показать</Button>
          </form>
        </CardContent>
      </Card>

      {params?.updated && (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
          Стадия контакта обновлена. Воронка, dashboard и отчеты пересчитаны.
        </div>
      )}
      {params?.error && (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700">
          Не удалось обновить стадию. Проверь подключение Supabase и попробуй еще раз.
        </div>
      )}

      <FunnelBoard board={board} canManageFunnels={canManageFunnels} campaignId={campaignId} />
    </div>
  );
}
