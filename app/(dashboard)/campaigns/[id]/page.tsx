import Link from 'next/link';
import { ArrowLeft, BarChart3, Plus, Save, Trash2, Users } from 'lucide-react';
import { notFound } from 'next/navigation';
import { addLeadToCampaignAction, deleteCampaignAction, updateCampaignResultAction } from '@/actions/campaigns.actions';
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

const errorMessages: Record<string, string> = {
  'missing-lead': 'Выбери контакт для добавления в кампанию.',
  'lead-add-failed': 'Не удалось добавить контакт в кампанию.',
  'result-save-failed': 'Не удалось сохранить вывод по кампании.'
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

              <div className="grid gap-3 sm:grid-cols-4">
                <Metric label="Контакты" value={campaign.metrics.contacts} />
                <Metric label="Ответы" value={campaign.metrics.responses} />
                <Metric label="Опрос / интерес" value={campaign.metrics.surveys} />
                <Metric label="Участники" value={campaign.metrics.participants} />
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

          <FormSection title="Контакты в кампании" subtitle="Список людей, которых ты добавил в этот маркетинговый эксперимент.">
            <div className="space-y-3">
              {campaign.contacts.length === 0 && (
                <p className="rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-app-muted">
                  {canManageCampaigns ? 'Пока контактов нет. Добавь первый контакт справа.' : 'Пока контактов нет.'}
                </p>
              )}
              {campaign.contacts.map((contact) => (
                <Link key={contact.id} href={`/people/${contact.id}`} className="block rounded-2xl border border-app-line bg-white p-4 transition hover:border-purple-200 hover:bg-purple-50/40">
                  <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
                    <div>
                      <p className="font-black text-app-text">{contact.name}</p>
                      <p className="mt-1 text-sm text-app-muted">{contact.type} · {contact.niche} · {contact.city} · {contact.source}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge tone="purple">{contact.stage}</Badge>
                      <Badge tone={scoreTone(contact.score)}>score {contact.score}</Badge>
                    </div>
                  </div>
                </Link>
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
                    <Textarea name="result_notes" defaultValue={campaign.resultNotes ?? ''} placeholder="Например: Telegram дал меньше контактов, но выше качество и готовность к пилоту." />
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
              <p className="mt-2 text-sm leading-6 text-app-muted">Контакты — все привязанные люди. Ответы считаются по стадиям Ответил/Опрос/Тест/Активен. Участники — контакты на стадии Тест/Активен или с высоким score.</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-pink-50 text-pink-600"><Users className="h-5 w-5" /></div>
              <h3 className="mt-4 text-lg font-black text-app-text">Следующий шаг</h3>
              <p className="mt-2 text-sm leading-6 text-app-muted">После кампаний можно будет связывать выводы с гипотезами и автоматически создавать инсайты.</p>
            </CardContent>
          </Card>

          {canManageCampaigns && (
            <form action={deleteCampaignAction}>
              <input type="hidden" name="campaign_id" value={campaign.id} />
              <FormSection title="Удалить кампанию" subtitle="Удалится кампания и связи с контактами. Контакты останутся в базе.">
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
