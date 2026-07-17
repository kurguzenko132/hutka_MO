import Link from 'next/link';
import { ArrowLeft, BarChart3, Users } from 'lucide-react';
import { notFound } from 'next/navigation';
import {
  CampaignAddContactForm,
  CampaignContactList,
  CampaignContactsProvider,
  CampaignDeleteForm,
  CampaignFunnel,
  CampaignMetadataForm,
  CampaignMetadataHeader,
  CampaignOverview,
  CampaignResultForm,
} from '@/components/campaigns/campaign-contacts-workspace';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getCampaignById } from '@/lib/campaigns';
import { getCurrentUserContext } from '@/lib/permissions';
import { can } from '@/lib/roles';

const errorMessages: Record<string, string> = {
  'missing-lead': 'Выбери контакт для добавления в кампанию.',
  'lead-add-failed': 'Не удалось добавить контакт в кампанию.',
  'result-save-failed': 'Не удалось сохранить вывод по кампании.',
  'confirmation-required': 'Чтобы удалить кампанию, введи УДАЛИТЬ в поле подтверждения.'
};

export default async function CampaignDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ error?: string }>;
}) {
  const [{ id }, paramsValue, currentUser] = await Promise.all([params, searchParams, getCurrentUserContext()]);
  const currentRole = currentUser?.role ?? 'viewer';
  const canManageCampaigns = can(currentRole, 'manageCampaigns');
  const campaign = await getCampaignById(id);
  if (!campaign) notFound();

  const error = paramsValue?.error ? errorMessages[paramsValue.error] : undefined;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Button asChild variant="secondary">
        <Link href="/campaigns"><ArrowLeft className="h-4 w-4" />Назад</Link>
      </Button>

      {error && <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}

      <CampaignContactsProvider
        campaignId={campaign.id}
        initialContacts={campaign.contacts}
        initialMetrics={campaign.metrics}
        initialStageCounts={campaign.stageCounts}
        initialStatusLabel={campaign.statusLabel}
        initialMetadata={{ id: campaign.id, name: campaign.name, goal: campaign.goal, channel: campaign.channel, city: campaign.city, niche: campaign.niche, budget: campaign.budget, offerText: campaign.offerText, startDate: campaign.startDate, endDate: campaign.endDate }}
      >
        <CampaignMetadataHeader />
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <main className="space-y-6">
            <CampaignOverview />

            <CampaignFunnel />
            <CampaignContactList canManageCampaigns={canManageCampaigns} />
          </main>

          <aside className="space-y-6">
            {canManageCampaigns && <CampaignMetadataForm />}
            {canManageCampaigns && <CampaignAddContactForm />}

            {canManageCampaigns && (
              <CampaignResultForm
                initialResultNotes={campaign.resultNotes ?? ''}
                initialEndDate={campaign.endDate ?? ''}
              />
            )}

            <Card>
              <CardContent>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-purple-50 text-app-purple"><BarChart3 className="h-5 w-5" /></div>
                <h3 className="mt-4 text-lg font-black text-app-text">Как читать кампанию</h3>
                <p className="mt-2 text-sm leading-6 text-app-muted">Контакты — все люди в кампании. Ответы считаются по стадиям Ответил/Заинтересован/Тестирует. Тестируют — контакты на стадии Тестирует.</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-pink-50 text-pink-600"><Users className="h-5 w-5" /></div>
                <h3 className="mt-4 text-lg font-black text-app-text">Следующий шаг</h3>
                <p className="mt-2 text-sm leading-6 text-app-muted">После кампании зафиксируй вывод: какой канал, ниша и сообщение дали лучшие ответы.</p>
              </CardContent>
            </Card>

            {canManageCampaigns && <CampaignDeleteForm />}
          </aside>
        </div>
      </CampaignContactsProvider>
    </div>
  );
}
