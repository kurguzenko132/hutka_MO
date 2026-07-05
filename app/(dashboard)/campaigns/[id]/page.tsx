import Link from 'next/link';
import { ArrowLeft, BarChart3, Plus, Save, Trash2, Users } from 'lucide-react';
import { notFound } from 'next/navigation';
import { addLeadToCampaignAction, deleteCampaignAction, removeLeadFromCampaignAction, updateCampaignResultAction } from '@/actions/campaigns.actions';
import { Field, FormSection } from '@/components/forms/form-section';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { getCampaignById, statusTone } from '@/lib/campaigns';
import { getLeadOptions } from '@/lib/leads';
import { getCurrentUserContext } from '@/lib/permissions';
import { can } from '@/lib/roles';
import { canonicalFunnelStageNames } from '@/lib/stages';

const errorMessages: Record<string, string> = {
  'missing-lead': 'Выбери контакт для добавления в кампанию.',
  'lead-add-failed': 'Не удалось добавить контакт в кампанию.',
  'result-save-failed': 'Не удалось сохранить вывод по кампании.',
  'confirmation-required': 'Чтобы удалить кампанию, введи УДАЛИТЬ в поле подтверждения.'
};

function scoreTone(score: number): 'red' | 'yellow' | 'gray' {
  if (score >= 75) return 'red';
  if (score >= 45) return 'yellow';
  return 'gray';
}

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

  const leads = canManageCampaigns ? await getLeadOptions() : [];
  const linkedIds = new Set(campaign.contacts.map((contact) => contact.id));
  const availableLeads = leads.filter((lead) => !linkedIds.has(lead.id));
  const error = paramsValue?.error ? errorMessages[paramsValue.error] : undefined;
  const funnelCounts = canonicalFunnelStageNames.map((stage) => ({
    stage,
    count: campaign.contacts.filter((contact) => contact.stage === stage).length
  }));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Button asChild variant="secondary">
        <Link href="/campaigns"><ArrowLeft className="h-4 w-4" />Назад</Link>
      </Button>

      <PageHeader title={campaign.name} subtitle={campaign.goal || 'Кампания без описанной цели'} />

      {error && <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <main className="space-y-6">
          <Card>
            <CardContent className="space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={statusTone(campaign.status)}>{campaign.statusLabel}</Badge>
                <Badge tone="purple">{campaign.channel}</Badge>
                {campaign.city && <Badge tone="gray">{campaign.city}</Badge>}
                {campaign.niche && <Badge tone="pink">{campaign.niche}</Badge>}
                <Badge tone="green">Конверсия: {campaign.metrics.conversion}</Badge>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <Metric label="Добавлено контактов" value={campaign.metrics.contacts} />
                <Metric label="Ответили" value={campaign.metrics.responses} />
                <Metric label="Заинтересованы" value={campaign.metrics.surveys} />
                <Metric label="Тестируют" value={campaign.metrics.participants} />
                <Metric label="Отказались" value={campaign.metrics.refused} />
              </div>

              <div className="grid gap-4 rounded-2xl bg-slate-50 p-4 md:grid-cols-2">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-app-muted">Оффер</p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-app-text">{campaign.offerText || 'Оффер не указан'}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-app-muted">Период и бюджет</p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-app-text">
                    {campaign.startDate || '—'} — {campaign.endDate || '—'} · Бюджет: {campaign.budget || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <FormSection title="Воронка кампании" subtitle="Стадии контактов, которые пришли из этой кампании.">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {funnelCounts.map((item) => (
                <div key={item.stage} className="rounded-2xl border border-app-line bg-white p-4">
                  <p className="text-sm font-black text-app-text">{item.stage}</p>
                  <p className="mt-2 text-2xl font-black text-app-text">{item.count}</p>
                </div>
              ))}
            </div>
            <Button asChild className="mt-4" variant="secondary">
              <Link href={`/funnels?campaignId=${campaign.id}`}>
                <BarChart3 className="h-4 w-4" />
                Открыть в воронке
              </Link>
            </Button>
          </FormSection>

          <FormSection title="Контакты в кампании" subtitle="Список людей, которых ты добавил в эту маркетинговую активность.">
            <div className="space-y-3">
              {campaign.contacts.length === 0 && (
                <p className="rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-app-muted">
                  {canManageCampaigns ? 'Пока контактов нет. Добавь первый контакт справа.' : 'Пока контактов нет.'}
                </p>
              )}
              {campaign.contacts.map((contact) => (
                <div key={contact.id} className="rounded-2xl border border-app-line bg-white p-4 transition hover:border-purple-200 hover:bg-purple-50/40">
                  <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
                    <Link href={`/people/${contact.id}`} className="min-w-0">
                      <p className="font-black text-app-text">{contact.name}</p>
                      <p className="mt-1 text-sm text-app-muted">{contact.type} · {contact.niche} · {contact.city} · {contact.source}</p>
                    </Link>
                    <div className="flex flex-wrap gap-2">
                      <Badge tone="purple">{contact.stage}</Badge>
                      <Badge tone={scoreTone(contact.score)}>score {contact.score}</Badge>
                      {canManageCampaigns && (
                        <form action={removeLeadFromCampaignAction}>
                          <input type="hidden" name="campaign_id" value={campaign.id} />
                          <input type="hidden" name="lead_id" value={contact.id} />
                          <Button type="submit" size="sm" variant="ghost" className="text-red-600 hover:bg-red-50 hover:text-red-700">
                            <Trash2 className="h-3.5 w-3.5" />
                            Убрать
                          </Button>
                        </form>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </FormSection>
        </main>

        <aside className="space-y-6">
          {canManageCampaigns && (
            <form action={addLeadToCampaignAction}>
              <input type="hidden" name="campaign_id" value={campaign.id} />
              <FormSection title="Добавить контакт" subtitle="Привяжи существующий контакт к кампании.">
                <div className="space-y-4">
                  <Field label="Контакт">
                    <Select name="lead_id" defaultValue="">
                      <option value="">Выбрать контакт</option>
                      {availableLeads.map((lead) => (
                        <option key={lead.id} value={lead.id}>{lead.name}</option>
                      ))}
                    </Select>
                  </Field>
                  <Button type="submit" className="w-full"><Plus className="h-4 w-4" />Добавить в кампанию</Button>
                </div>
              </FormSection>
            </form>
          )}

          {canManageCampaigns && (
            <form action={updateCampaignResultAction}>
              <input type="hidden" name="campaign_id" value={campaign.id} />
              <FormSection title="Вывод по кампании" subtitle="Фиксируй, что сработало, а что нет.">
                <div className="space-y-4">
                  <Field label="Статус">
                    <Select name="status" defaultValue={campaign.statusLabel}>
                      <option>Планируется</option>
                      <option>Активна</option>
                      <option>На паузе</option>
                      <option>Завершена</option>
                    </Select>
                  </Field>
                  <Field label="Дата завершения">
                    <Input name="end_date" type="date" />
                  </Field>
                  <Field label="Вывод / заметки">
                    <Textarea name="result_notes" defaultValue={campaign.resultNotes ?? ''} placeholder="Например: Telegram дал меньше контактов, но выше качество и готовность к тестированию." />
                  </Field>
                  <Button type="submit" className="w-full"><Save className="h-4 w-4" />Сохранить вывод</Button>
                </div>
              </FormSection>
            </form>
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

          {canManageCampaigns && (
            <form action={deleteCampaignAction}>
              <input type="hidden" name="campaign_id" value={campaign.id} />
              <FormSection title="Удалить кампанию" subtitle="Удалится кампания и связи с контактами. Контакты останутся в базе.">
                <Input name="confirmation" placeholder="Напиши: УДАЛИТЬ" required />
                <Button type="submit" variant="danger" className="w-full"><Trash2 className="h-4 w-4" />Удалить кампанию</Button>
              </FormSection>
            </form>
          )}
        </aside>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-app-faint">{label}</p>
      <p className="mt-1 text-2xl font-black text-app-text">{value}</p>
    </div>
  );
}
