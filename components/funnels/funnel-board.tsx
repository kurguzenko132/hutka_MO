'use client';

import Link from 'next/link';
import { AlertTriangle, BarChart3, CheckCircle2, Heart, LoaderCircle, PieChart, Users, Zap } from 'lucide-react';
import { memo, useMemo, useState, useTransition } from 'react';
import { moveLeadToStageMutationAction } from '@/actions/funnels.actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { FunnelBoard as FunnelBoardData, FunnelColumn, FunnelLead } from '@/lib/funnels';
import { isInterestedStage, isRefusedStage, isTestingStage } from '@/lib/stages';
import { cn } from '@/lib/utils';

type DragState = {
  leadId: string;
  fromStage: string;
} | null;

function stageProgress(column: FunnelColumn, totalContacts: number) {
  if (!totalContacts) return 0;
  return Math.round((column.contacts / totalContacts) * 100);
}

function nextConversion(current: FunnelColumn, next?: FunnelColumn) {
  if (!next || current.contacts === 0) return '—';
  return `${Math.round((next.contacts / current.contacts) * 100)}%`;
}

function graphWidth(value: number, max: number) {
  if (value <= 0 || max <= 0) return '0%';
  return `${Math.max(8, Math.round((value / max) * 100))}%`;
}

function chartItems(entries: Array<[string, number]>) {
  const sorted = entries.filter(([, value]) => value > 0).sort((a, b) => b[1] - a[1]);
  const max = sorted[0]?.[1] ?? 1;
  return sorted.map(([name, value]) => ({
    name,
    value,
    width: graphWidth(value, max)
  }));
}

function GraphBars({ items, empty = 'Данных пока нет.' }: { items: Array<{ name: string; value: number; width?: string }>; empty?: string }) {
  if (!items.length) {
    return <p className="rounded-2xl bg-slate-50 p-4 text-sm text-app-muted">{empty}</p>;
  }

  const max = Math.max(...items.map((item) => item.value), 1);

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.name}>
          <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
            <span className="min-w-0 truncate font-bold text-app-text">{item.name}</span>
            <span className="shrink-0 font-black text-app-muted">{item.value}</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-app-purple" style={{ width: item.width ?? graphWidth(item.value, max) }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function boardMetrics(columns: FunnelColumn[], refusalReasons: Array<{ name: string; value: number }>) {
  const statusGroups = new Map<string, number>([
    ['Новые и без ответа', 0],
    ['Ответили', 0],
    ['Заинтересованы', 0],
    ['Тестируют', 0],
    ['Пауза', 0],
    ['Отказы', 0]
  ]);

  for (const column of columns) {
    const contacts = column.contacts;
    if (['Новый', 'Написали'].includes(column.name)) statusGroups.set('Новые и без ответа', (statusGroups.get('Новые и без ответа') ?? 0) + contacts);
    else if (column.name === 'Ответил') statusGroups.set('Ответили', (statusGroups.get('Ответили') ?? 0) + contacts);
    else if (isInterestedStage(column.name)) statusGroups.set('Заинтересованы', (statusGroups.get('Заинтересованы') ?? 0) + contacts);
    else if (isTestingStage(column.name)) statusGroups.set('Тестируют', (statusGroups.get('Тестируют') ?? 0) + contacts);
    else if (isRefusedStage(column.name)) statusGroups.set('Отказы', (statusGroups.get('Отказы') ?? 0) + contacts);
    else statusGroups.set('Пауза', (statusGroups.get('Пауза') ?? 0) + contacts);
  }

  return {
    totalContacts: columns.reduce((sum, column) => sum + column.contacts, 0),
    repliedContacts: columns
      .filter((column) => ['Ответил', 'Заинтересован', 'Тестирует'].includes(column.name))
      .reduce((sum, column) => sum + column.contacts, 0),
    interestedContacts: columns
      .filter((column) => isInterestedStage(column.name))
      .reduce((sum, column) => sum + column.contacts, 0),
    testingContacts: columns
      .filter((column) => isTestingStage(column.name))
      .reduce((sum, column) => sum + column.contacts, 0),
    refusedContacts: columns
      .filter((column) => isRefusedStage(column.name))
      .reduce((sum, column) => sum + column.contacts, 0),
    stageItems: columns.map((column) => ({ name: column.name, value: column.contacts })),
    statusItems: chartItems(Array.from(statusGroups.entries())),
    refusalReasons
  };
}

function isHotForStage(lead: FunnelLead, stageName: string) {
  return lead.score >= 75 || isInterestedStage(stageName);
}

function moveLead(columns: FunnelColumn[], leadId: string, fromStage: string, toStage: string, refusalReason = '') {
  if (fromStage === toStage) return columns;

  let movedLead: FunnelLead | undefined;
  const withoutLead = columns.map((column) => {
    if (column.name !== fromStage) return column;
    movedLead = column.leads.find((lead) => lead.id === leadId);
    const leads = column.leads.filter((lead) => lead.id !== leadId);
    if (!movedLead) return column;
    return {
      ...column,
      leads,
      contacts: Math.max(0, column.contacts - 1),
      hotContacts: Math.max(0, column.hotContacts - (isHotForStage(movedLead, fromStage) ? 1 : 0)),
      readyContacts: Math.max(0, column.readyContacts - (isTestingStage(fromStage) ? 1 : 0))
    };
  });

  if (!movedLead) return columns;
  const nextLead = {
    ...movedLead,
    refusalReason: toStage === 'Отказ' ? refusalReason : undefined
  };

  return withoutLead.map((column) => {
    if (column.name !== toStage) return column;
    const leads = [nextLead, ...column.leads];
    return {
      ...column,
      leads,
      contacts: column.contacts + 1,
      hotContacts: column.hotContacts + (isHotForStage(nextLead, toStage) ? 1 : 0),
      readyContacts: column.readyContacts + (isTestingStage(toStage) ? 1 : 0)
    };
  });
}

function adjustChartItem(items: Array<{ name: string; value: number }>, name: string, delta: number) {
  const values = new Map(items.map((item) => [item.name, item.value]));
  values.set(name, Math.max(0, (values.get(name) ?? 0) + delta));
  return chartItems(Array.from(values.entries()));
}

const LeadCard = memo(function LeadCard({ lead, canDrag }: { lead: FunnelLead; canDrag: boolean }) {
  return (
    <div
      draggable={canDrag}
      data-lead-id={lead.id}
      className={cn(
        'rounded-xl border border-app-line bg-white p-3 shadow-sm transition hover:border-purple-200',
        canDrag && 'cursor-grab active:cursor-grabbing'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link prefetch={false} href={`/people/${lead.id}`} className="font-black text-app-text hover:text-app-purple">
            {lead.name}
          </Link>
          <p className="mt-1 truncate text-xs text-app-muted">{lead.niche}</p>
        </div>
        <Badge tone="gray">{lead.type}</Badge>
      </div>
      <div className="mt-3 grid gap-1.5 text-xs text-app-muted">
        <p>{lead.source}</p>
        <p>{lead.city}</p>
      </div>
    </div>
  );
});

const COLUMN_BATCH_SIZE = 40;

export function FunnelBoard({ board, canManageFunnels, campaignId }: { board: FunnelBoardData; canManageFunnels: boolean; campaignId?: string }) {
  const [columns, setColumns] = useState(board.columns);
  const [refusalReasons, setRefusalReasons] = useState(board.refusalReasons);
  const [dragState, setDragState] = useState<DragState>(null);
  const [visibleCounts, setVisibleCounts] = useState<Record<string, number>>({});
  const [loadingStage, setLoadingStage] = useState('');
  const [notice, setNotice] = useState('');
  const [noticeError, setNoticeError] = useState(false);
  const [isPending, startTransition] = useTransition();
  const totalContacts = useMemo(() => columns.reduce((sum, column) => sum + column.contacts, 0), [columns]);
  const metrics = useMemo(() => boardMetrics(columns, refusalReasons), [columns, refusalReasons]);

  async function loadMore(column: FunnelColumn, visibleCount: number) {
    if (loadingStage || column.leads.length >= column.contacts) return;

    setLoadingStage(column.name);
    setNotice('');
    setNoticeError(false);

    try {
      const params = new URLSearchParams({
        stage: column.name,
        offset: String(column.leads.length),
        limit: String(COLUMN_BATCH_SIZE)
      });
      if (campaignId) params.set('campaignId', campaignId);

      const response = await fetch(`/api/funnels/leads?${params.toString()}`, {
        cache: 'no-store'
      });
      const payload = response.ok
        ? await response.json() as { items?: FunnelLead[]; total?: number }
        : {};
      const items = Array.isArray(payload.items) ? payload.items : [];

      if (!response.ok) {
        setNotice('Не удалось загрузить следующую часть воронки.');
        setNoticeError(true);
        return;
      }

      setColumns((current) => current.map((item) => {
        if (item.name !== column.name) return item;
        const knownIds = new Set(item.leads.map((lead) => lead.id));
        const nextLeads = [...item.leads, ...items.filter((lead) => !knownIds.has(lead.id))];
        return {
          ...item,
          leads: nextLeads,
          contacts: typeof payload.total === 'number' ? payload.total : item.contacts
        };
      }));
      setVisibleCounts((current) => ({
        ...current,
        [column.name]: visibleCount + items.length
      }));

      if (items.length === 0 && column.leads.length < column.contacts) {
        setNotice('Новые карточки не получены. Обнови страницу после применения миграции Step 48.');
        setNoticeError(true);
      }
    } catch {
      setNotice('Связь с сервером прервалась. Попробуй загрузить карточки ещё раз.');
      setNoticeError(true);
    } finally {
      setLoadingStage('');
    }
  }

  function handleDrop(targetColumn: FunnelColumn) {
    const targetStage = targetColumn.name;
    if (isPending || !dragState || dragState.fromStage === targetStage) return;

    let refusalReason = '';
    if (targetStage === 'Отказ') {
      refusalReason = window.prompt('Укажи причину отказа')?.trim() ?? '';
      if (!refusalReason) {
        setNotice('Причина отказа обязательна.');
        setNoticeError(true);
        setDragState(null);
        return;
      }
    }

    const movedLead = columns
      .find((column) => column.name === dragState.fromStage)
      ?.leads.find((lead) => lead.id === dragState.leadId);
    if (!movedLead) {
      setDragState(null);
      return;
    }

    const previousColumns = columns;
    const previousRefusalReasons = refusalReasons;
    setColumns((current) => moveLead(current, dragState.leadId, dragState.fromStage, targetStage, refusalReason));
    if (isRefusedStage(dragState.fromStage)) {
      setRefusalReasons((current) => adjustChartItem(current, movedLead.refusalReason || 'Причина не указана', -1));
    }
    if (isRefusedStage(targetStage)) {
      setRefusalReasons((current) => adjustChartItem(current, refusalReason || 'Причина не указана', 1));
    }
    setNotice('Сохраняю стадию...');
    setNoticeError(false);
    const movedLeadId = dragState.leadId;

    startTransition(async () => {
      try {
        const result = await moveLeadToStageMutationAction({
          leadId: movedLeadId,
          stageId: targetColumn.id,
          stageName: targetStage,
          campaignId,
          refusalReason
        });

        if (!result.ok) {
          setColumns(previousColumns);
          setRefusalReasons(previousRefusalReasons);
          setNotice('Не удалось сохранить стадию. Попробуй еще раз.');
          setNoticeError(true);
          return;
        }

        setNotice(targetStage === 'Тестирует' ? 'Контакт переведен в тестирование.' : 'Стадия контакта обновлена.');
        setNoticeError(false);
      } catch {
        setColumns(previousColumns);
        setRefusalReasons(previousRefusalReasons);
        setNotice('Не удалось связаться с сервером. Изменение отменено.');
        setNoticeError(true);
      }
    });

    setDragState(null);
  }

  return (
    <div className="space-y-4">
      {notice && (
        <div className={cn(
          'rounded-2xl border px-4 py-3 text-sm font-semibold',
          noticeError
            ? 'border-red-100 bg-red-50 text-red-700'
            : isPending
              ? 'border-blue-100 bg-blue-50 text-blue-700'
              : 'border-emerald-100 bg-emerald-50 text-emerald-700'
        )}>
          {notice}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-50 text-app-purple">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-app-muted">Всего контактов</p>
              <p className="text-2xl font-black text-app-text">{metrics.totalContacts}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
              <Heart className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-app-muted">Ответили</p>
              <p className="text-2xl font-black text-app-text">{metrics.repliedContacts}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
              <Heart className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-app-muted">Заинтересованы</p>
              <p className="text-2xl font-black text-app-text">{metrics.interestedContacts}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-app-green">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-app-muted">Тестируют</p>
              <p className="text-2xl font-black text-app-text">{metrics.testingContacts}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-app-red">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-app-muted">Отказы</p>
              <p className="text-2xl font-black text-app-text">{metrics.refusedContacts}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card>
          <CardContent className="space-y-4 p-5">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-app-purple" />
              <h2 className="font-black text-app-text">Воронка по стадиям</h2>
            </div>
            <GraphBars items={metrics.stageItems} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-4 p-5">
            <div className="flex items-center gap-2">
              <PieChart className="h-4 w-4 text-app-purple" />
              <h2 className="font-black text-app-text">Распределение контактов по статусам</h2>
            </div>
            <GraphBars items={metrics.statusItems} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-4 p-5">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-app-red" />
              <h2 className="font-black text-app-text">Причины отказов</h2>
            </div>
            <GraphBars items={metrics.refusalReasons} empty="Причины отказов пока не зафиксированы." />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 rounded-3xl border border-app-line bg-white p-4 shadow-card md:grid-cols-2 xl:grid-cols-7">
        {columns.map((column, index) => {
          const progress = stageProgress(column, totalContacts);
          return (
            <div key={column.id} className="rounded-2xl bg-app-soft p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-black text-app-text">{column.name}</p>
                <Badge tone={column.color}>{column.contacts}</Badge>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
                <div className="h-full rounded-full bg-app-purple" style={{ width: `${progress}%` }} />
              </div>
              <p className="mt-2 text-xs font-semibold text-app-muted">
                {progress}% от базы · переход дальше: {nextConversion(column, columns[index + 1])}
              </p>
            </div>
          );
        })}
      </div>

      <div className="scrollbar-thin overflow-x-auto pb-3">
        <div className="flex min-w-max gap-4">
          {columns.map((column) => {
            const visibleCount = visibleCounts[column.name] ?? COLUMN_BATCH_SIZE;
            const visibleLeads = column.leads.slice(0, visibleCount);
            const hiddenCount = Math.max(0, column.contacts - visibleLeads.length);
            const hasLocalItems = visibleCount < column.leads.length;
            const loading = loadingStage === column.name;
            return (
            <section
              key={column.id}
              onDragOver={(event) => {
                if (canManageFunnels && !isPending) event.preventDefault();
              }}
              onDrop={() => handleDrop(column)}
              className={cn(
                'performance-contain min-h-[420px] w-[260px] shrink-0 rounded-2xl border border-app-line bg-slate-50/70 p-3',
                dragState && 'border-purple-200 bg-purple-50/40'
              )}
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-black text-app-text">{column.name}</h2>
                  <p className="mt-1 text-xs font-semibold text-app-muted">{column.contacts} контактов</p>
                </div>
                <Badge tone={column.color}>{column.contacts}</Badge>
              </div>
              <div className="space-y-2">
                {visibleLeads.map((lead) => (
                  <div
                    key={lead.id}
                    onDragStart={() => {
                      if (!isPending) setDragState({ leadId: lead.id, fromStage: column.name });
                    }}
                    onDragEnd={() => setDragState(null)}
                  >
                    <LeadCard lead={lead} canDrag={canManageFunnels && !isPending} />
                  </div>
                ))}
                {column.contacts === 0 && (
                  <div className="rounded-2xl border border-dashed border-app-line bg-white p-4 text-sm text-app-muted">
                    Пока нет контактов на этой стадии.
                  </div>
                )}
                {hiddenCount > 0 && (
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full"
                    disabled={Boolean(loadingStage)}
                    onClick={() => {
                      if (hasLocalItems) {
                        setVisibleCounts((current) => ({ ...current, [column.name]: visibleCount + COLUMN_BATCH_SIZE }));
                      } else {
                        void loadMore(column, visibleCount);
                      }
                    }}
                  >
                    {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                    {loading ? 'Загружаю...' : `Показать ещё ${Math.min(COLUMN_BATCH_SIZE, hiddenCount)}`}
                  </Button>
                )}
              </div>
            </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
