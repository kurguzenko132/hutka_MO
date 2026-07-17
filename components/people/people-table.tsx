'use client';

import Link from 'next/link';
import { AlertTriangle, Check, CheckSquare, ChevronLeft, ChevronRight, LoaderCircle, MoreVertical, Square, Tag, UsersRound } from 'lucide-react';
import {
  bulkAddToCampaignMutationAction,
  bulkAssignTagMutationAction,
  bulkChangeStageMutationAction,
  bulkCreateTaskMutationAction
} from '@/actions/leads.actions';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import type { Lead } from '@/lib/data';
import type { CampaignOption } from '@/lib/campaigns';
import { can, type UserRole } from '@/lib/roles';
import { stageTone as getStageTone } from '@/lib/stages';
import { cn } from '@/lib/utils';
import { useState, type FormEvent } from 'react';

type PeopleTableProps = {
  items: Lead[];
  totalItems: number;
  pageSize: number;
  currentPage: number;
  pageCount: number;
  previousHref?: string;
  nextHref?: string;
  role?: UserRole;
  stages?: string[];
  tags?: string[];
  campaigns?: CampaignOption[];
};

function stageTone(stage: string): BadgeTone {
  return getStageTone(stage);
}

function initials(name: string) {
  return name
    .split(' ')
    .map((word) => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function PeopleTable({
  items,
  totalItems,
  pageSize,
  currentPage,
  pageCount,
  previousHref,
  nextHref,
  role = 'viewer',
  stages = [],
  tags = [],
  campaigns = []
}: PeopleTableProps) {
  const [rows, setRows] = useState(items);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [notice, setNotice] = useState('');
  const [noticeError, setNoticeError] = useState(false);
  const [pendingAction, setPendingAction] = useState('');
  const canManageContacts = can(role, 'manageContacts');
  const canManageTasks = can(role, 'manageTasks');
  const canManageCampaigns = can(role, 'manageCampaigns');

  const visibleIds = rows.map((item) => item.id);
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
  const hasSelection = selectedIds.length > 0;

  function toggleAll() {
    setSelectedIds((current) => {
      if (allSelected) {
        return current.filter((id) => !visibleIds.includes(id));
      }

      return Array.from(new Set([...current, ...visibleIds]));
    });
  }

  function toggleOne(id: string) {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  async function changeStage(stage: string) {
    if (!stage || pendingAction || selectedIds.length === 0) return false;
    const previousRows = rows;
    const selectedSet = new Set(selectedIds);
    setPendingAction('stage');
    setNotice('Обновляю стадию...');
    setNoticeError(false);
    setRows((current) => current.map((lead) => selectedSet.has(lead.id) ? { ...lead, stage } : lead));

    try {
      const result = await bulkChangeStageMutationAction({ leadIds: selectedIds, stage });
      if (!result.ok) {
        setRows(previousRows);
        setNotice('Не удалось изменить стадию. Изменение отменено.');
        setNoticeError(true);
        return false;
      }
      setNotice(`Стадия обновлена для контактов: ${result.count}.`);
      setSelectedIds([]);
      return true;
    } catch {
      setRows(previousRows);
      setNotice('Не удалось связаться с сервером. Изменение отменено.');
      setNoticeError(true);
      return false;
    } finally {
      setPendingAction('');
    }
  }

  async function assignTag(tag: string) {
    if (!tag || pendingAction || selectedIds.length === 0) return false;
    setPendingAction('tag');
    setNotice('Добавляю тег...');
    setNoticeError(false);
    try {
      const result = await bulkAssignTagMutationAction({ leadIds: selectedIds, tag });
      if (!result.ok) {
        setNotice('Не удалось добавить тег.');
        setNoticeError(true);
        return false;
      }
      setNotice(`Тег добавлен контактам: ${result.count}.`);
      setSelectedIds([]);
      return true;
    } catch {
      setNotice('Не удалось связаться с сервером.');
      setNoticeError(true);
      return false;
    } finally {
      setPendingAction('');
    }
  }

  async function createTasks(title: string) {
    if (!title || pendingAction || selectedIds.length === 0) return false;
    setPendingAction('task');
    setNotice('Создаю задачи...');
    setNoticeError(false);
    try {
      const result = await bulkCreateTaskMutationAction({ leadIds: selectedIds, title });
      if (!result.ok) {
        setNotice('Не удалось создать задачи.');
        setNoticeError(true);
        return false;
      }
      setNotice(`Создано задач: ${result.count}.`);
      setSelectedIds([]);
      return true;
    } catch {
      setNotice('Не удалось связаться с сервером.');
      setNoticeError(true);
      return false;
    } finally {
      setPendingAction('');
    }
  }

  async function addToCampaign(campaignId: string) {
    if (!campaignId || pendingAction || selectedIds.length === 0) return false;
    setPendingAction('campaign');
    setNotice('Добавляю контакты в кампанию...');
    setNoticeError(false);
    try {
      const result = await bulkAddToCampaignMutationAction({ leadIds: selectedIds, campaignId });
      if (!result.ok) {
        setNotice('Не удалось добавить контакты в кампанию.');
        setNoticeError(true);
        return false;
      }
      setNotice(`Добавлено контактов в кампанию: ${result.count}.`);
      setSelectedIds([]);
      return true;
    } catch {
      setNotice('Не удалось связаться с сервером.');
      setNoticeError(true);
      return false;
    } finally {
      setPendingAction('');
    }
  }

  if (rows.length === 0) {
    return (
      <Card className="p-10 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-50 text-app-purple">
          <MoreVertical className="h-6 w-6" />
        </div>
        <h3 className="mt-5 text-lg font-black text-app-text">Контакты не найдены</h3>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-app-muted">
          Измени фильтры или добавь новый контакт. Когда появятся мастера, салоны или партнеры, они будут отображаться в этой таблице.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Button asChild variant="secondary">
            <Link prefetch={false} href="/people">Сбросить фильтры</Link>
          </Button>
          {canManageContacts && (
            <Button asChild>
              <Link prefetch={false} href="/people/new">Добавить контакт</Link>
            </Button>
          )}
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {notice && (
        <div
          aria-live="polite"
          className={`flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold ${
            noticeError ? 'border-red-100 bg-red-50 text-red-700' : 'border-emerald-100 bg-emerald-50 text-emerald-700'
          }`}
        >
          {noticeError ? <AlertTriangle className="h-4 w-4 shrink-0" /> : <Check className="h-4 w-4 shrink-0" />}
          <span>{notice}</span>
        </div>
      )}
      {canManageContacts && (
        <BulkActionsBar
          selectedIds={selectedIds}
          stages={stages}
          tags={tags}
          campaigns={campaigns}
          canManageTasks={canManageTasks}
          canManageCampaigns={canManageCampaigns}
          pendingAction={pendingAction}
          onClear={() => setSelectedIds([])}
          onChangeStage={changeStage}
          onAssignTag={assignTag}
          onCreateTasks={createTasks}
          onAddToCampaign={addToCampaign}
        />
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead className="border-b border-app-line bg-slate-50/70 text-xs uppercase tracking-wide text-app-faint">
              <tr>
                <th className="px-5 py-4">
                  {canManageContacts ? (
                    <button type="button" onClick={toggleAll} className="flex items-center text-app-muted transition hover:text-app-purple" aria-label="Выбрать все контакты на странице">
                      {allSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                    </button>
                  ) : null}
                </th>
                <th className="px-5 py-4">Контакт</th>
                <th className="px-5 py-4">Тип</th>
                <th className="px-5 py-4">Ниша</th>
                <th className="px-5 py-4">Город</th>
                <th className="px-5 py-4">Статус</th>
                <th className="px-5 py-4">Источник</th>
                <th className="px-5 py-4">Следующий шаг</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-line">
              {rows.map((lead) => {
                const checked = selectedIds.includes(lead.id);

                return (
                  <tr key={lead.id} className={cn('transition hover:bg-purple-50/40', checked && 'bg-purple-50/50')}>
                    <td className="px-5 py-4">
                      {canManageContacts ? (
                        <button type="button" onClick={() => toggleOne(lead.id)} className="flex items-center text-app-muted transition hover:text-app-purple" aria-label={`Выбрать ${lead.name}`}>
                          {checked ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                        </button>
                      ) : null}
                    </td>
                    <td className="px-5 py-4">
                      <Link prefetch={false} href={`/people/${lead.id}`} className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-pink-200 to-purple-200 text-xs font-black text-purple-800">
                          {initials(lead.name)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-app-text">{lead.name}</p>
                          <p className="truncate text-xs text-app-muted">
                            {lead.instagram || lead.telegram || lead.phone || lead.email || lead.source}
                          </p>
                        </div>
                      </Link>
                    </td>
                    <td className="px-5 py-4 text-app-muted">{lead.type}</td>
                    <td className="px-5 py-4 text-app-muted">{lead.niche}</td>
                    <td className="px-5 py-4 text-app-muted">{lead.city}</td>
                    <td className="px-5 py-4"><Badge tone={stageTone(lead.stage)}>{lead.stage}</Badge></td>
                    <td className="px-5 py-4 text-app-muted">{lead.source}</td>
                    <td className="px-5 py-4">
                      <p className="font-semibold text-app-text">{lead.nextStep}</p>
                      <p className="text-xs text-app-muted">{lead.nextDate}</p>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-app-line px-5 py-4 text-sm text-app-muted">
          <span>
            Показано {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, totalItems)} из {totalItems}
          </span>
          <div className="flex items-center gap-2">
            <span className="mr-2 text-xs">{hasSelection ? `Выбрано: ${selectedIds.length}` : `Страница ${currentPage} из ${pageCount}`}</span>
            {previousHref ? (
              <Button asChild size="sm" variant="secondary">
                <Link prefetch={false} href={previousHref} aria-label="Предыдущая страница"><ChevronLeft className="h-4 w-4" /></Link>
              </Button>
            ) : (
              <Button type="button" size="sm" variant="secondary" disabled aria-label="Предыдущая страница"><ChevronLeft className="h-4 w-4" /></Button>
            )}
            {nextHref ? (
              <Button asChild size="sm" variant="secondary">
                <Link prefetch={false} href={nextHref} aria-label="Следующая страница"><ChevronRight className="h-4 w-4" /></Link>
              </Button>
            ) : (
              <Button type="button" size="sm" variant="secondary" disabled aria-label="Следующая страница"><ChevronRight className="h-4 w-4" /></Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

function BulkActionsBar({
  selectedIds,
  stages,
  tags,
  campaigns,
  canManageTasks,
  canManageCampaigns,
  pendingAction,
  onClear,
  onChangeStage,
  onAssignTag,
  onCreateTasks,
  onAddToCampaign
}: {
  selectedIds: string[];
  stages: string[];
  tags: string[];
  campaigns: CampaignOption[];
  canManageTasks: boolean;
  canManageCampaigns: boolean;
  pendingAction: string;
  onClear: () => void;
  onChangeStage: (stage: string) => Promise<boolean>;
  onAssignTag: (tag: string) => Promise<boolean>;
  onCreateTasks: (title: string) => Promise<boolean>;
  onAddToCampaign: (campaignId: string) => Promise<boolean>;
}) {
  const [stage, setStage] = useState('');
  const [tag, setTag] = useState('');
  const [title, setTitle] = useState('');
  const [campaignId, setCampaignId] = useState('');
  const disabled = selectedIds.length === 0;
  const busy = Boolean(pendingAction);

  async function submitStage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (await onChangeStage(stage)) setStage('');
  }

  async function submitTag(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (await onAssignTag(tag)) setTag('');
  }

  async function submitTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (await onCreateTasks(title)) setTitle('');
  }

  async function submitCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (await onAddToCampaign(campaignId)) setCampaignId('');
  }

  return (
    <Card className={cn('p-4 transition', disabled ? 'border-dashed bg-slate-50/70' : 'border-purple-200 bg-purple-50/40')}>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-app-purple shadow-sm">
              <UsersRound className="h-5 w-5" />
            </div>
            <div>
              <p className="font-black text-app-text">Массовые действия</p>
              <p className="text-sm text-app-muted">Выбрано контактов: <span className="font-bold text-app-text">{selectedIds.length}</span></p>
            </div>
          </div>
        </div>

        <div className="grid min-w-0 flex-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <form onSubmit={(event) => void submitStage(event)} className="flex flex-col gap-2 sm:flex-row">
            <Select value={stage} onChange={(event) => setStage(event.target.value)} disabled={disabled || busy}>
              <option value="">Сменить стадию</option>
              {stages.map((stage) => <option key={stage} value={stage}>{stage}</option>)}
            </Select>
            <Button type="submit" variant="secondary" disabled={disabled || busy || !stage} className="w-full sm:w-auto">
              {pendingAction === 'stage' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
              Применить
            </Button>
          </form>

          <form onSubmit={(event) => void submitTag(event)} className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Tag className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-app-faint" />
              <Input value={tag} onChange={(event) => setTag(event.target.value)} list="bulk-tags" placeholder="Добавить тег" disabled={disabled || busy} className="pl-9" />
              <datalist id="bulk-tags">
                {tags.map((tagName) => <option key={tagName} value={tagName} />)}
              </datalist>
            </div>
            <Button type="submit" variant="secondary" disabled={disabled || busy || !tag.trim()} className="w-full sm:w-auto">
              {pendingAction === 'tag' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
              Тег
            </Button>
          </form>

          {canManageTasks && (
            <form onSubmit={(event) => void submitTask(event)} className="flex flex-col gap-2 sm:flex-row">
              <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Задача для выбранных" disabled={disabled || busy} />
              <Button type="submit" variant="secondary" disabled={disabled || busy || !title.trim()} className="w-full sm:w-auto">
                {pendingAction === 'task' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                Создать
              </Button>
            </form>
          )}

          {canManageCampaigns && (
            <form onSubmit={(event) => void submitCampaign(event)} className="flex flex-col gap-2 sm:flex-row">
              <Select value={campaignId} onChange={(event) => setCampaignId(event.target.value)} disabled={disabled || busy}>
                <option value="">Добавить в кампанию</option>
                {campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}
              </Select>
              <Button type="submit" variant="secondary" disabled={disabled || busy || !campaignId} className="w-full sm:w-auto">
                {pendingAction === 'campaign' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                Добавить
              </Button>
            </form>
          )}
        </div>

        <Button type="button" variant="ghost" disabled={disabled || busy} onClick={onClear}>Очистить</Button>
      </div>
    </Card>
  );
}
