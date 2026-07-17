'use client';

import {
  createContext,
  useContext,
  useRef,
  useState,
  type FormEvent,
  type ReactNode
} from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BarChart3, Check, LoaderCircle, Plus, Save, Trash2 } from 'lucide-react';
import {
  addLeadToCampaignMutationAction,
  deleteCampaignMutation,
  removeLeadFromCampaignMutationAction,
  updateCampaignMetadataMutation,
  updateCampaignResultMutationAction
} from '@/actions/campaigns.actions';
import { Field, FormSection } from '@/components/forms/form-section';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { LeadCombobox } from '@/components/people/lead-combobox';
import type { CampaignContact, CampaignMetrics, CampaignStageCount } from '@/lib/campaigns';
import type { LeadOption } from '@/lib/leads';
import { canonicalFunnelStageNames, isInterestedStage, isTestingStage } from '@/lib/stages';

type CampaignContactsContextValue = {
  campaignId: string;
  contacts: CampaignContact[];
  metrics: CampaignMetrics;
  stageCounts: CampaignStageCount[];
  selectedLead: LeadOption | null;
  setSelectedLead: (lead: LeadOption | null) => void;
  addPending: boolean;
  removePendingIds: string[];
  resultPending: boolean;
  contactsPending: boolean;
  campaignStatusLabel: string;
  metadata: CampaignMetadata;
  metadataPending: boolean;
  busy: boolean;
  addContact: () => Promise<void>;
  removeContact: (contact: CampaignContact) => Promise<void>;
  loadMoreContacts: (visibleCount: number) => Promise<number>;
  saveResult: (input: { status: string; resultNotes: string; endDate: string }) => Promise<void>;
  saveMetadata: (input: CampaignMetadata) => Promise<void>;
};

type CampaignMetadata = {
  id: string;
  name: string;
  goal?: string;
  channel: string;
  city?: string;
  niche?: string;
  budget: number;
  offerText?: string;
  startDate?: string;
  endDate?: string;
};

const CampaignContactsContext = createContext<CampaignContactsContextValue | null>(null);

function useCampaignContacts() {
  const value = useContext(CampaignContactsContext);
  if (!value) throw new Error('Campaign contact controls must be inside CampaignContactsProvider.');
  return value;
}

function withConversion(metrics: Omit<CampaignMetrics, 'conversion'>): CampaignMetrics {
  return {
    ...metrics,
    conversion: `${Math.round((metrics.participants / (metrics.contacts || 1)) * 1000) / 10}%`
  };
}

function adjustMetrics(metrics: CampaignMetrics, contact: CampaignContact, delta: 1 | -1) {
  return withConversion({
    contacts: Math.max(0, metrics.contacts + delta),
    responses: Math.max(0, metrics.responses + (['Ответил', 'Заинтересован', 'Тестирует'].includes(contact.stage) ? delta : 0)),
    surveys: Math.max(0, metrics.surveys + (isInterestedStage(contact.stage) || isTestingStage(contact.stage) ? delta : 0)),
    participants: Math.max(0, metrics.participants + (isTestingStage(contact.stage) ? delta : 0)),
    refused: Math.max(0, metrics.refused + (contact.stage === 'Отказ' ? delta : 0))
  });
}

function adjustStageCounts(items: CampaignStageCount[], stageName: string, delta: 1 | -1) {
  const exists = items.some((item) => item.name === stageName);
  const next = exists ? items : [...items, { name: stageName, value: 0 }];
  return next.map((item) => item.name === stageName
    ? { ...item, value: Math.max(0, item.value + delta) }
    : item);
}

function optimisticContact(option: LeadOption): CampaignContact {
  return {
    id: option.id,
    name: option.name,
    type: 'Контакт',
    niche: 'Не указана',
    city: 'Не указан',
    stage: 'Новый',
    source: 'Не указан',
    score: 0
  };
}

const campaignStatusLabels: Record<string, string> = {
  draft: 'Планируется',
  active: 'Активна',
  paused: 'На паузе',
  finished: 'Завершена'
};

function campaignStatusTone(label: string): 'green' | 'yellow' | 'blue' | 'gray' {
  if (label === 'Активна') return 'green';
  if (label === 'На паузе') return 'yellow';
  if (label === 'Завершена') return 'blue';
  return 'gray';
}

function toDateInput(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const match = value.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : '';
}

export function CampaignContactsProvider({
  campaignId,
  initialContacts,
  initialMetrics,
  initialStageCounts,
  initialStatusLabel,
  initialMetadata,
  children
}: {
  campaignId: string;
  initialContacts: CampaignContact[];
  initialMetrics: CampaignMetrics;
  initialStageCounts: CampaignStageCount[];
  initialStatusLabel: string;
  initialMetadata: CampaignMetadata;
  children: ReactNode;
}) {
  const [contacts, setContacts] = useState(initialContacts);
  const [metrics, setMetrics] = useState(initialMetrics);
  const [stageCounts, setStageCounts] = useState(initialStageCounts);
  const [selectedLead, setSelectedLead] = useState<LeadOption | null>(null);
  const [addPending, setAddPending] = useState(false);
  const [removePendingIds, setRemovePendingIds] = useState<string[]>([]);
  const [resultPending, setResultPending] = useState(false);
  const [contactsPending, setContactsPending] = useState(false);
  const [campaignStatusLabel, setCampaignStatusLabel] = useState(initialStatusLabel);
  const [metadata, setMetadata] = useState(initialMetadata);
  const [metadataPending, setMetadataPending] = useState(false);
  const [notice, setNotice] = useState('');
  const [noticeError, setNoticeError] = useState(false);
  const pendingRef = useRef(false);

  async function addContact() {
    const option = selectedLead;
    if (!option || pendingRef.current || addPending || contactsPending || removePendingIds.length > 0) return;

    const previousContacts = contacts;
    const previousMetrics = metrics;
    const previousStageCounts = stageCounts;
    const draftContact = optimisticContact(option);

    pendingRef.current = true;
    setAddPending(true);
    setNotice('Добавляю контакт...');
    setNoticeError(false);
    setContacts((current) => [...current, draftContact]);
    setMetrics((current) => adjustMetrics(current, draftContact, 1));
    setStageCounts((current) => adjustStageCounts(current, draftContact.stage, 1));
    setSelectedLead(null);

    try {
      const result = await addLeadToCampaignMutationAction({
        campaignId,
        leadId: option.id
      });

      if (!result.ok) {
        setContacts(previousContacts);
        setMetrics(previousMetrics);
        setStageCounts(previousStageCounts);
        setSelectedLead(option);
        setNotice('Не удалось добавить контакт. Изменение отменено.');
        setNoticeError(true);
      } else {
        if (result.contact) {
          const savedContact = result.contact as CampaignContact;
          setContacts((current) => current.map((contact) => contact.id === option.id ? savedContact : contact));
          if (savedContact.stage !== draftContact.stage) {
            setMetrics((current) => adjustMetrics(adjustMetrics(current, draftContact, -1), savedContact, 1));
            setStageCounts((current) => adjustStageCounts(adjustStageCounts(current, draftContact.stage, -1), savedContact.stage, 1));
          }
        }
        setNotice('Контакт добавлен в кампанию.');
      }
    } catch {
      setContacts(previousContacts);
      setMetrics(previousMetrics);
      setStageCounts(previousStageCounts);
      setSelectedLead(option);
      setNotice('Связь с сервером прервалась. Изменение отменено.');
      setNoticeError(true);
    } finally {
      pendingRef.current = false;
      setAddPending(false);
    }
  }

  async function removeContact(contact: CampaignContact) {
    if (pendingRef.current || addPending || contactsPending || removePendingIds.length > 0 || !window.confirm(`Убрать «${contact.name}» из кампании?`)) return;

    const previousContacts = contacts;
    const previousMetrics = metrics;
    const previousStageCounts = stageCounts;
    pendingRef.current = true;
    setRemovePendingIds((current) => [...current, contact.id]);
    setNotice('Убираю контакт...');
    setNoticeError(false);
    setContacts((current) => current.filter((item) => item.id !== contact.id));
    setMetrics((current) => adjustMetrics(current, contact, -1));
    setStageCounts((current) => adjustStageCounts(current, contact.stage, -1));

    try {
      const result = await removeLeadFromCampaignMutationAction({
        campaignId,
        leadId: contact.id
      });

      if (!result.ok) {
        setContacts(previousContacts);
        setMetrics(previousMetrics);
        setStageCounts(previousStageCounts);
        setNotice('Не удалось убрать контакт. Изменение отменено.');
        setNoticeError(true);
      } else {
        setNotice('Контакт убран из кампании.');
      }
    } catch {
      setContacts(previousContacts);
      setMetrics(previousMetrics);
      setStageCounts(previousStageCounts);
      setNotice('Связь с сервером прервалась. Изменение отменено.');
      setNoticeError(true);
    } finally {
      pendingRef.current = false;
      setRemovePendingIds((current) => current.filter((id) => id !== contact.id));
    }
  }

  async function loadMoreContacts(visibleCount: number) {
    if (pendingRef.current || contactsPending || contacts.length >= metrics.contacts) return 0;

    pendingRef.current = true;
    setContactsPending(true);
    setNotice('');
    setNoticeError(false);

    try {
      const params = new URLSearchParams({
        offset: String(contacts.length),
        limit: '40'
      });
      const response = await fetch(`/api/campaigns/${campaignId}/contacts?${params.toString()}`, {
        cache: 'no-store'
      });
      const payload = response.ok
        ? await response.json() as { items?: CampaignContact[]; total?: number }
        : {};
      const items = Array.isArray(payload.items) ? payload.items : [];

      if (!response.ok) {
        setNotice('Не удалось загрузить следующую часть контактов.');
        setNoticeError(true);
        return 0;
      }

      setContacts((current) => {
        const knownIds = new Set(current.map((contact) => contact.id));
        return [...current, ...items.filter((contact) => !knownIds.has(contact.id))];
      });
      if (typeof payload.total === 'number' && payload.total !== metrics.contacts) {
        setMetrics((current) => withConversion({ ...current, contacts: payload.total as number }));
      }
      if (items.length === 0 && contacts.length < metrics.contacts) {
        setNotice('Новые контакты не получены. Обнови страницу после применения миграции Step 51.');
        setNoticeError(true);
      } else {
        setNotice(`Показано до ${Math.min(visibleCount + items.length, payload.total ?? metrics.contacts)} контактов.`);
      }
      return items.length;
    } catch {
      setNotice('Связь с сервером прервалась. Попробуй загрузить контакты ещё раз.');
      setNoticeError(true);
      return 0;
    } finally {
      pendingRef.current = false;
      setContactsPending(false);
    }
  }

  async function saveResult(input: { status: string; resultNotes: string; endDate: string }) {
    if (pendingRef.current || addPending || contactsPending || removePendingIds.length > 0 || resultPending) return;

    const previousStatus = campaignStatusLabel;
    const previousMetadata = metadata;
    pendingRef.current = true;
    setResultPending(true);
    setCampaignStatusLabel(input.status);
    setMetadata((current) => ({ ...current, endDate: input.endDate || undefined }));
    setNotice('Сохраняю вывод по кампании...');
    setNoticeError(false);

    try {
      const result = await updateCampaignResultMutationAction({
        campaignId,
        status: input.status,
        resultNotes: input.resultNotes,
        endDate: input.endDate
      });

      if (!result.ok) {
        setCampaignStatusLabel(previousStatus);
        setMetadata(previousMetadata);
        setNotice('Не удалось сохранить вывод. Изменение отменено.');
        setNoticeError(true);
      } else {
        setCampaignStatusLabel(campaignStatusLabels[result.status ?? ''] ?? input.status);
        setNotice('Вывод по кампании сохранен.');
      }
    } catch {
      setCampaignStatusLabel(previousStatus);
      setMetadata(previousMetadata);
      setNotice('Не удалось связаться с сервером. Изменение отменено.');
      setNoticeError(true);
    } finally {
      pendingRef.current = false;
      setResultPending(false);
    }
  }

  async function saveMetadata(input: CampaignMetadata) {
    if (pendingRef.current) return;
    const previous = metadata;
    pendingRef.current = true;
    setMetadataPending(true);
    setMetadata(input);
    setNotice('Сохраняю настройки кампании...');
    setNoticeError(false);
    try {
      const result = await updateCampaignMetadataMutation(input);
      if (!result.ok || !result.item) {
        setMetadata(previous);
        setNotice(result.error === 'name-required' ? 'Укажи название кампании.' : 'Не удалось сохранить настройки. Изменение отменено.');
        setNoticeError(true);
        return;
      }
      setMetadata((current) => ({ ...current, ...result.item }));
      setNotice('Настройки кампании сохранены.');
    } catch {
      setMetadata(previous);
      setNotice('Не удалось связаться с сервером. Изменение отменено.');
      setNoticeError(true);
    } finally {
      pendingRef.current = false;
      setMetadataPending(false);
    }
  }

  const busy = addPending || contactsPending || removePendingIds.length > 0 || resultPending || metadataPending;

  const value: CampaignContactsContextValue = {
    campaignId,
    contacts,
    metrics,
    stageCounts,
    selectedLead,
    setSelectedLead,
    addPending,
    contactsPending,
    removePendingIds,
    resultPending,
    campaignStatusLabel,
    metadata,
    metadataPending,
    busy,
    addContact,
    removeContact,
    loadMoreContacts,
    saveResult,
    saveMetadata
  };

  return (
    <CampaignContactsContext.Provider value={value}>
      {notice && (
        <div
          aria-live="polite"
          className={`flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold ${
            noticeError ? 'border-red-100 bg-red-50 text-red-700' : 'border-emerald-100 bg-emerald-50 text-emerald-700'
          }`}
        >
          {noticeError ? <Trash2 className="h-4 w-4 shrink-0" /> : <Check className="h-4 w-4 shrink-0" />}
          <span>{notice}</span>
        </div>
      )}
      {children}
    </CampaignContactsContext.Provider>
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

export function CampaignContactMetrics() {
  const { metrics } = useCampaignContacts();

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <Metric label="Добавлено контактов" value={metrics.contacts} />
      <Metric label="Ответили" value={metrics.responses} />
      <Metric label="Заинтересованы" value={metrics.surveys} />
      <Metric label="Тестируют" value={metrics.participants} />
      <Metric label="Отказались" value={metrics.refused} />
    </div>
  );
}

export function CampaignConversionBadge() {
  const { metrics } = useCampaignContacts();
  return <Badge tone="green">Конверсия: {metrics.conversion}</Badge>;
}

function displayDate(value?: string) {
  if (!value) return '—';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-');
    return `${day}.${month}.${year}`;
  }
  return value;
}

export function CampaignMetadataHeader() {
  const { metadata } = useCampaignContacts();
  return <PageHeader title={metadata.name} subtitle={metadata.goal || 'Кампания без описанной цели'} />;
}

export function CampaignOverview() {
  const { metadata } = useCampaignContacts();
  return (
    <Card>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <CampaignStatusBadge />
          <Badge tone="purple">{metadata.channel}</Badge>
          {metadata.city ? <Badge tone="gray">{metadata.city}</Badge> : null}
          {metadata.niche ? <Badge tone="pink">{metadata.niche}</Badge> : null}
          <CampaignConversionBadge />
        </div>
        <CampaignContactMetrics />
        <div className="grid gap-4 rounded-xl bg-slate-50 p-4 md:grid-cols-2">
          <div><p className="text-xs font-bold uppercase tracking-wide text-app-muted">Оффер</p><p className="mt-2 text-sm font-semibold leading-6 text-app-text">{metadata.offerText || 'Оффер не указан'}</p></div>
          <div><p className="text-xs font-bold uppercase tracking-wide text-app-muted">Период и бюджет</p><p className="mt-2 text-sm font-semibold leading-6 text-app-text">{displayDate(metadata.startDate)} — {displayDate(metadata.endDate)} · Бюджет: {metadata.budget || 0}</p></div>
        </div>
      </CardContent>
    </Card>
  );
}

export function CampaignMetadataForm() {
  const { metadata, metadataPending, busy, saveMetadata } = useCampaignContacts();
  const channels = ['Instagram', 'Telegram', 'TikTok', 'Рекомендации', 'Офлайн', 'Beauty-школа', 'Реклама'];
  const channelOptions = channels.includes(metadata.channel) ? channels : [metadata.channel, ...channels];

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const budget = Number(String(formData.get('budget') ?? 0));
    void saveMetadata({
      ...metadata,
      name: String(formData.get('name') ?? '').trim(),
      goal: String(formData.get('goal') ?? '').trim() || undefined,
      channel: String(formData.get('channel') ?? '').trim() || 'Не указан',
      city: String(formData.get('city') ?? '').trim() || undefined,
      niche: String(formData.get('niche') ?? '').trim() || undefined,
      budget: Number.isFinite(budget) ? Math.max(0, budget) : 0,
      offerText: String(formData.get('offer_text') ?? '').trim() || undefined,
      startDate: String(formData.get('start_date') ?? '').trim() || undefined
    });
  }

  const key = [metadata.name, metadata.goal ?? '', metadata.channel, metadata.city ?? '', metadata.niche ?? '', metadata.budget, metadata.offerText ?? '', metadata.startDate ?? ''].join(':');
  return (
    <form key={key} onSubmit={submit}>
      <FormSection title="Настройки кампании" subtitle="Кому пишем, где нашли и какой оффер используем.">
        <div className="space-y-4">
          <Field label="Название"><Input name="name" defaultValue={metadata.name} required /></Field>
          <Field label="Канал"><Select name="channel" defaultValue={metadata.channel}>{channelOptions.map((item) => <option key={item}>{item}</option>)}</Select></Field>
          <div className="grid gap-3 sm:grid-cols-2"><Field label="Город"><Input name="city" defaultValue={metadata.city ?? ''} /></Field><Field label="Ниша"><Input name="niche" defaultValue={metadata.niche ?? ''} /></Field></div>
          <div className="grid gap-3 sm:grid-cols-2"><Field label="Бюджет"><Input name="budget" type="number" min="0" step="0.01" defaultValue={String(metadata.budget)} /></Field><Field label="Дата старта"><Input name="start_date" type="date" defaultValue={toDateInput(metadata.startDate ?? '')} /></Field></div>
          <Field label="Цель"><Textarea name="goal" defaultValue={metadata.goal ?? ''} /></Field>
          <Field label="Оффер"><Textarea name="offer_text" defaultValue={metadata.offerText ?? ''} /></Field>
          <Button type="submit" className="w-full" disabled={busy}>{metadataPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Сохранить настройки</Button>
        </div>
      </FormSection>
    </form>
  );
}

export function CampaignDeleteForm() {
  const router = useRouter();
  const { campaignId, metadata, busy } = useCampaignContacts();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const pendingRef = useRef(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingRef.current || busy) return;
    const confirmation = String(new FormData(event.currentTarget).get('confirmation') ?? '').trim();
    if (confirmation !== 'УДАЛИТЬ') {
      setError('Чтобы удалить кампанию, введи УДАЛИТЬ.');
      return;
    }
    pendingRef.current = true;
    setPending(true);
    setError('');
    try {
      const result = await deleteCampaignMutation(campaignId, confirmation);
      if (!result.ok) {
        setError(result.error === 'campaign-not-found' ? 'Кампания больше не найдена.' : 'Не удалось удалить кампанию.');
        return;
      }
      router.replace('/campaigns?deleted=campaign');
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <FormSection title="Удалить кампанию" subtitle="Удалится кампания и связи с контактами. Контакты останутся в базе.">
        {error ? <div role="alert" className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
        <Input name="confirmation" placeholder="Напиши: УДАЛИТЬ" required />
        <Button type="submit" variant="danger" className="w-full" disabled={busy || pending}>{pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}Удалить кампанию</Button>
      </FormSection>
    </form>
  );
}

export function CampaignStatusBadge() {
  const { campaignStatusLabel } = useCampaignContacts();
  return <Badge tone={campaignStatusTone(campaignStatusLabel)}>{campaignStatusLabel}</Badge>;
}

export function CampaignFunnel() {
  const { campaignId, stageCounts } = useCampaignContacts();
  const stageValues = new Map(stageCounts.map((item) => [item.name, item.value]));

  return (
    <FormSection title="Воронка кампании" subtitle="Стадии контактов, которые пришли из этой кампании.">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {canonicalFunnelStageNames.map((stage) => (
          <div key={stage} className="rounded-2xl border border-app-line bg-white p-4">
            <p className="text-sm font-black text-app-text">{stage}</p>
            <p className="mt-2 text-2xl font-black text-app-text">{stageValues.get(stage) ?? 0}</p>
          </div>
        ))}
      </div>
      <Button asChild className="mt-4" variant="secondary">
        <Link prefetch={false} href={`/funnels?campaignId=${campaignId}`}>
          <BarChart3 className="h-4 w-4" />
          Открыть в воронке
        </Link>
      </Button>
    </FormSection>
  );
}

function scoreTone(score: number): 'red' | 'yellow' | 'gray' {
  if (score >= 75) return 'red';
  if (score >= 45) return 'yellow';
  return 'gray';
}

export function CampaignContactList({ canManageCampaigns }: { canManageCampaigns: boolean }) {
  const {
    contacts,
    metrics,
    addPending,
    removePendingIds,
    contactsPending,
    removeContact,
    loadMoreContacts
  } = useCampaignContacts();
  const [visibleCount, setVisibleCount] = useState(40);
  const visibleContacts = contacts.slice(0, visibleCount);
  const hiddenCount = Math.max(0, metrics.contacts - visibleContacts.length);
  const hasLocalContacts = visibleCount < contacts.length;

  return (
    <FormSection title="Контакты в кампании" subtitle="Список людей, которых ты добавил в эту маркетинговую активность.">
      <div className="space-y-3">
        {metrics.contacts === 0 && (
          <p className="rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-app-muted">
            {canManageCampaigns ? 'Пока контактов нет. Добавь первый контакт справа.' : 'Пока контактов нет.'}
          </p>
        )}
        {visibleContacts.map((contact) => {
          const pending = removePendingIds.includes(contact.id);
          return (
            <div key={contact.id} className="rounded-2xl border border-app-line bg-white p-4 transition hover:border-purple-200 hover:bg-purple-50/40">
              <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
                <Link prefetch={false} href={`/people/${contact.id}`} className="min-w-0">
                  <p className="font-black text-app-text">{contact.name}</p>
                  <p className="mt-1 text-sm text-app-muted">{contact.type} · {contact.niche} · {contact.city} · {contact.source}</p>
                </Link>
                <div className="flex flex-wrap gap-2">
                  <Badge tone="purple">{contact.stage}</Badge>
                  <Badge tone={scoreTone(contact.score)}>score {contact.score}</Badge>
                  {canManageCampaigns && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={contactsPending || addPending || removePendingIds.length > 0}
                      className="text-red-600 hover:bg-red-50 hover:text-red-700"
                      onClick={() => void removeContact(contact)}
                    >
                      {pending ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      Убрать
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {hiddenCount > 0 && (
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            disabled={contactsPending || addPending || removePendingIds.length > 0}
            onClick={() => {
              if (hasLocalContacts) {
                setVisibleCount((current) => current + 40);
                return;
              }
              void loadMoreContacts(visibleCount).then((loaded) => {
                if (loaded > 0) setVisibleCount((current) => current + loaded);
              });
            }}
          >
            {contactsPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            {contactsPending ? 'Загружаю...' : `Показать ещё ${Math.min(40, hiddenCount)}`}
          </Button>
        )}
      </div>
    </FormSection>
  );
}

export function CampaignAddContactForm() {
  const {
    campaignId,
    selectedLead,
    setSelectedLead,
    addPending,
    contactsPending,
    removePendingIds,
    addContact
  } = useCampaignContacts();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void addContact();
  }

  return (
    <form onSubmit={submit}>
      <FormSection title="Добавить контакт" subtitle="Привяжи существующий контакт к кампании.">
        <div className="space-y-4">
          <Field label="Контакт">
            <LeadCombobox
              name="lead_id"
              value={selectedLead}
              excludeCampaignId={campaignId}
              disabled={addPending || contactsPending || removePendingIds.length > 0}
              placeholder="Найти контакт для кампании..."
              onChange={setSelectedLead}
            />
          </Field>
          <Button type="submit" className="w-full" disabled={addPending || contactsPending || removePendingIds.length > 0 || !selectedLead}>
            {addPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Добавить в кампанию
          </Button>
        </div>
      </FormSection>
    </form>
  );
}

export function CampaignResultForm({
  initialResultNotes,
  initialEndDate
}: {
  initialResultNotes: string;
  initialEndDate: string;
}) {
  const {
    campaignStatusLabel,
    resultPending,
    addPending,
    contactsPending,
    removePendingIds,
    saveResult
  } = useCampaignContacts();
  const busy = resultPending || addPending || contactsPending || removePendingIds.length > 0;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    void saveResult({
      status: String(formData.get('status') ?? campaignStatusLabel),
      resultNotes: String(formData.get('result_notes') ?? ''),
      endDate: String(formData.get('end_date') ?? '')
    });
  }

  return (
    <form onSubmit={submit}>
      <FormSection title="Вывод по кампании" subtitle="Фиксируй, что сработало, а что нет.">
        <div className="space-y-4">
          <Field label="Статус">
            <Select name="status" defaultValue={campaignStatusLabel} disabled={busy}>
              <option>Планируется</option>
              <option>Активна</option>
              <option>На паузе</option>
              <option>Завершена</option>
            </Select>
          </Field>
          <Field label="Дата завершения">
            <Input name="end_date" type="date" defaultValue={toDateInput(initialEndDate)} disabled={busy} />
          </Field>
          <Field label="Вывод / заметки">
            <Textarea
              name="result_notes"
              defaultValue={initialResultNotes}
              disabled={busy}
              placeholder="Например: Telegram дал меньше контактов, но выше качество и готовность к тестированию."
            />
          </Field>
          <Button type="submit" className="w-full" disabled={busy}>
            {resultPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Сохранить вывод
          </Button>
        </div>
      </FormSection>
    </form>
  );
}
