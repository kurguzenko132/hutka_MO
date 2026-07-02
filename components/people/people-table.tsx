'use client';

import Link from 'next/link';
import { CalendarPlus, CheckSquare, Edit3, Eye, MoreVertical, Square, Tag, UsersRound } from 'lucide-react';
import { bulkAddToCampaignAction, bulkAssignTagAction, bulkChangeStageAction, bulkCreateTaskAction } from '@/actions/leads.actions';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import type { Lead, Priority } from '@/lib/data';
import type { CampaignOption } from '@/lib/campaigns';
import { can, type UserRole } from '@/lib/roles';
import { cn } from '@/lib/utils';
import { useMemo, useState } from 'react';

type PeopleTableProps = {
  items: Lead[];
  role?: UserRole;
  stages?: string[];
  tags?: string[];
  campaigns?: CampaignOption[];
};

function priorityTone(priority: Priority): BadgeTone {
  if (priority === 'Высокий') return 'red';
  if (priority === 'Средний') return 'yellow';
  return 'green';
}

function stageTone(stage: string): BadgeTone {
  if (stage === 'Тест' || stage === 'Активен') return 'green';
  if (stage === 'Опрос' || stage === 'Заинтересован') return 'yellow';
  if (stage === 'Ответил') return 'blue';
  if (stage === 'Отказ') return 'red';
  return 'purple';
}

function initials(name: string) {
  return name
    .split(' ')
    .map((word) => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function selectedValue(ids: string[]) {
  return ids.join(',');
}

export function PeopleTable({ items, role = 'viewer', stages = [], tags = [], campaigns = [] }: PeopleTableProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const canManageContacts = can(role, 'manageContacts');
  const canManageTasks = can(role, 'manageTasks');
  const canManageCampaigns = can(role, 'manageCampaigns');

  const visibleIds = useMemo(() => items.map((item) => item.id), [items]);
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

  if (items.length === 0) {
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
            <Link href="/people">Сбросить фильтры</Link>
          </Button>
          {canManageContacts && (
            <Button asChild>
              <Link href="/people/new">Добавить контакт</Link>
            </Button>
          )}
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {canManageContacts && (
        <BulkActionsBar
          selectedIds={selectedIds}
          stages={stages}
          tags={tags}
          campaigns={campaigns}
          canManageTasks={canManageTasks}
          canManageCampaigns={canManageCampaigns}
          onClear={() => setSelectedIds([])}
        />
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] text-left text-sm">
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
                <th className="px-5 py-4">Стадия</th>
                <th className="px-5 py-4">Приоритет</th>
                <th className="px-5 py-4">Теги</th>
                <th className="px-5 py-4">Следующий шаг</th>
                <th className="px-5 py-4 text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-line">
              {items.map((lead) => {
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
                      <Link href={`/people/${lead.id}`} className="flex items-center gap-3">
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
                    <td className="px-5 py-4"><Badge tone={priorityTone(lead.priority)}>● {lead.priority}</Badge></td>
                    <td className="px-5 py-4">
                      <div className="flex max-w-[220px] flex-wrap gap-1.5">
                        {lead.tags.slice(0, 2).map((tagName) => (
                          <Badge key={tagName} tone="purple">{tagName}</Badge>
                        ))}
                        {lead.tags.length > 2 ? <Badge tone="blue">+{lead.tags.length - 2}</Badge> : null}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-semibold text-app-text">{lead.nextStep}</p>
                      <p className="text-xs text-app-muted">{lead.nextDate}</p>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-1.5">
                        <Link href={`/people/${lead.id}`} className="rounded-lg p-2 text-app-muted transition hover:bg-purple-50 hover:text-app-purple" title="Открыть карточку">
                          <Eye className="h-4 w-4" />
                        </Link>
                        {canManageContacts && (
                          <Link href={`/people/${lead.id}/edit`} className="rounded-lg p-2 text-app-muted transition hover:bg-purple-50 hover:text-app-purple" title="Редактировать">
                            <Edit3 className="h-4 w-4" />
                          </Link>
                        )}
                        {canManageTasks && (
                          <Link href={`/tasks/new?leadId=${lead.id}`} className="rounded-lg p-2 text-app-muted transition hover:bg-purple-50 hover:text-app-purple" title="Создать задачу">
                            <CalendarPlus className="h-4 w-4" />
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-app-line px-5 py-4 text-sm text-app-muted">
          <span>Показано: {items.length}</span>
          <span className="text-xs">{hasSelection ? `Выбрано: ${selectedIds.length}` : 'Выбери контакты, чтобы применить массовые действия.'}</span>
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
  onClear
}: {
  selectedIds: string[];
  stages: string[];
  tags: string[];
  campaigns: CampaignOption[];
  canManageTasks: boolean;
  canManageCampaigns: boolean;
  onClear: () => void;
}) {
  const ids = selectedValue(selectedIds);
  const disabled = selectedIds.length === 0;

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

        <div className="grid flex-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <form action={bulkChangeStageAction} className="flex gap-2">
            <input type="hidden" name="lead_ids" value={ids} />
            <Select name="stage" disabled={disabled} defaultValue="">
              <option value="">Сменить стадию</option>
              {stages.map((stage) => <option key={stage} value={stage}>{stage}</option>)}
            </Select>
            <Button type="submit" variant="secondary" disabled={disabled}>Применить</Button>
          </form>

          <form action={bulkAssignTagAction} className="flex gap-2">
            <input type="hidden" name="lead_ids" value={ids} />
            <div className="relative flex-1">
              <Tag className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-app-faint" />
              <Input name="tag" list="bulk-tags" placeholder="Добавить тег" disabled={disabled} className="pl-9" />
              <datalist id="bulk-tags">
                {tags.map((tagName) => <option key={tagName} value={tagName} />)}
              </datalist>
            </div>
            <Button type="submit" variant="secondary" disabled={disabled}>Тег</Button>
          </form>

          {canManageTasks && (
            <form action={bulkCreateTaskAction} className="flex gap-2">
              <input type="hidden" name="lead_ids" value={ids} />
              <Input name="title" placeholder="Задача для выбранных" disabled={disabled} />
              <Button type="submit" variant="secondary" disabled={disabled}>Создать</Button>
            </form>
          )}

          {canManageCampaigns && (
            <form action={bulkAddToCampaignAction} className="flex gap-2">
              <input type="hidden" name="lead_ids" value={ids} />
              <Select name="campaign_id" disabled={disabled} defaultValue="">
                <option value="">Добавить в кампанию</option>
                {campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}
              </Select>
              <Button type="submit" variant="secondary" disabled={disabled}>Добавить</Button>
            </form>
          )}
        </div>

        <Button type="button" variant="ghost" disabled={disabled} onClick={onClear}>Очистить</Button>
      </div>
    </Card>
  );
}
