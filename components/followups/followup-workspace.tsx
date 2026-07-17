'use client';

import { useState, type ElementType } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Heart,
  LoaderCircle,
  RefreshCcw,
  Sparkles,
  Timer
} from 'lucide-react';
import {
  createAllFollowUpTasksMutationAction,
  createFollowUpTaskMutationAction,
  type FollowUpTaskMutationInput
} from '@/actions/followups.actions';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import type {
  FollowUpReason,
  FollowUpRecommendation,
  FollowUpSummary
} from '@/lib/followups';

const PAGE_SIZE = 40;

const reasonLabels: Record<FollowUpReason, string> = {
  overdue_followup: 'Просрочено',
  today_followup: 'Сегодня',
  missing_next_action: 'Нет шага',
  hot_without_task: 'Высокий интерес',
  unanswered_questionnaire: 'Анкета',
  stale_stage: 'Завис'
};

const reasonIcons: Record<FollowUpReason, ElementType> = {
  overdue_followup: AlertTriangle,
  today_followup: CalendarClock,
  missing_next_action: Timer,
  hot_without_task: Heart,
  unanswered_questionnaire: ClipboardList,
  stale_stage: RefreshCcw
};

function priorityTone(priority: string): BadgeTone {
  if (priority === 'urgent') return 'red';
  if (priority === 'high') return 'yellow';
  if (priority === 'medium') return 'purple';
  return 'gray';
}

function pageHref(reason: string | undefined, page: number) {
  const query = new URLSearchParams();
  if (reason) query.set('reason', reason);
  if (page > 1) query.set('page', String(page));
  const value = query.toString();
  return value ? `/followups?${value}` : '/followups';
}

function toMutationInput(item: FollowUpRecommendation): FollowUpTaskMutationInput {
  return {
    id: item.id,
    leadId: item.leadId,
    title: item.suggestedTaskTitle,
    description: item.suggestedTaskDescription,
    dueDate: item.suggestedDueDate,
    priority: item.priority,
    reasonTitle: item.title
  };
}

function remainsVisibleAfterTask(item: FollowUpRecommendation) {
  return item.reason === 'overdue_followup' || item.reason === 'today_followup';
}

function decrement(value: number) {
  return Math.max(0, value - 1);
}

function summaryAfterAddressed(summary: FollowUpSummary, item: FollowUpRecommendation) {
  const next = {
    ...summary,
    withoutTasks: item.hasOpenTask ? summary.withoutTasks : decrement(summary.withoutTasks)
  };
  if (remainsVisibleAfterTask(item)) return next;

  next.total = decrement(next.total);
  if (item.priority === 'urgent') next.urgent = decrement(next.urgent);
  if (item.reason === 'overdue_followup') next.overdue = decrement(next.overdue);
  if (item.reason === 'today_followup') next.today = decrement(next.today);
  if (item.reason === 'hot_without_task') next.hot = decrement(next.hot);
  if (item.reason === 'unanswered_questionnaire') next.questionnaires = decrement(next.questionnaires);
  return next;
}

function recommendationsAfterAddressed(items: FollowUpRecommendation[], addressed: FollowUpRecommendation[]) {
  const addressedById = new Map(addressed.map((item) => [item.id, item]));
  return items
    .filter((item) => {
      const addressedItem = addressedById.get(item.id);
      return !addressedItem || remainsVisibleAfterTask(addressedItem);
    })
    .map((item) => addressedById.has(item.id) ? { ...item, hasOpenTask: true } : item);
}

function Notice({ text, error }: { text: string; error: boolean }) {
  return (
    <div
      aria-live="polite"
      className={`flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold ${
        error ? 'border-red-100 bg-red-50 text-red-700' : 'border-emerald-100 bg-emerald-50 text-emerald-700'
      }`}
    >
      {error ? <AlertTriangle className="h-4 w-4 shrink-0" /> : <Check className="h-4 w-4 shrink-0" />}
      <span>{text}</span>
    </div>
  );
}

export function FollowUpWorkspace({
  initialRecommendations,
  initialBulkCandidates,
  initialSummary,
  initialFilteredTotal,
  reason,
  currentPage,
  demoMode,
  canManageTasks,
  initialCreated,
  initialError
}: {
  initialRecommendations: FollowUpRecommendation[];
  initialBulkCandidates: FollowUpRecommendation[];
  initialSummary: FollowUpSummary;
  initialFilteredTotal: number;
  reason?: string;
  currentPage: number;
  demoMode: boolean;
  canManageTasks: boolean;
  initialCreated?: string;
  initialError?: string;
}) {
  const [recommendations, setRecommendations] = useState(initialRecommendations);
  const [bulkCandidates, setBulkCandidates] = useState(initialBulkCandidates);
  const [summary, setSummary] = useState(initialSummary);
  const [filteredTotal, setFilteredTotal] = useState(initialFilteredTotal);
  const [pendingIds, setPendingIds] = useState<string[]>([]);
  const [bulkPending, setBulkPending] = useState(false);
  const [notice, setNotice] = useState(
    initialError
      ? 'Не удалось создать задачу. Проверь права и Supabase.'
      : initialCreated === 'duplicate'
        ? 'Такая открытая задача уже есть — дубль не создан.'
        : initialCreated === 'none'
          ? 'Нет рекомендаций без открытых задач.'
          : initialCreated
            ? `Создано задач: ${initialCreated}`
            : ''
  );
  const [noticeError, setNoticeError] = useState(Boolean(initialError));
  const pageCount = Math.max(1, Math.ceil(filteredTotal / PAGE_SIZE));
  const busy = bulkPending || pendingIds.length > 0;

  function applyAddressed(items: FollowUpRecommendation[]) {
    if (items.length === 0) return;
    setRecommendations((current) => recommendationsAfterAddressed(current, items));
    setBulkCandidates((current) => current.filter((candidate) => !items.some((item) => item.id === candidate.id)));
    setSummary((current) => items.reduce(summaryAfterAddressed, current));
    const removedFromCurrentFilter = items.filter((item) =>
      !remainsVisibleAfterTask(item) && (!reason || item.reason === reason)
    ).length;
    if (removedFromCurrentFilter > 0) {
      setFilteredTotal((current) => Math.max(0, current - removedFromCurrentFilter));
    }
  }

  async function createTask(item: FollowUpRecommendation) {
    if (busy || item.hasOpenTask) return;

    const previousRecommendations = recommendations;
    const previousBulkCandidates = bulkCandidates;
    const previousSummary = summary;
    const previousFilteredTotal = filteredTotal;
    setPendingIds([item.id]);
    setNotice('Создаю задачу...');
    setNoticeError(false);
    applyAddressed([item]);

    try {
      const result = await createFollowUpTaskMutationAction(toMutationInput(item));
      if (!result.ok) {
        setRecommendations(previousRecommendations);
        setBulkCandidates(previousBulkCandidates);
        setSummary(previousSummary);
        setFilteredTotal(previousFilteredTotal);
        setNotice('Не удалось создать задачу. Изменение отменено.');
        setNoticeError(true);
      } else {
        setNotice(result.created ? 'Задача создана.' : 'Открытая задача уже существовала. Рекомендация обновлена.');
      }
    } catch {
      setRecommendations(previousRecommendations);
      setBulkCandidates(previousBulkCandidates);
      setSummary(previousSummary);
      setFilteredTotal(previousFilteredTotal);
      setNotice('Не удалось связаться с сервером. Изменение отменено.');
      setNoticeError(true);
    } finally {
      setPendingIds([]);
    }
  }

  async function createBulk() {
    const candidates = bulkCandidates.slice(0, 10);
    if (busy || candidates.length === 0) return;

    const previousRecommendations = recommendations;
    const previousBulkCandidates = bulkCandidates;
    const previousSummary = summary;
    const previousFilteredTotal = filteredTotal;
    setBulkPending(true);
    setNotice(`Создаю задачи: ${candidates.length}...`);
    setNoticeError(false);
    applyAddressed(candidates);

    try {
      const result = await createAllFollowUpTasksMutationAction({
        items: candidates.map(toMutationInput)
      });
      const addressedSet = new Set(result.addressedIds);
      const addressed = candidates.filter((item) => addressedSet.has(item.id));

      setRecommendations(recommendationsAfterAddressed(previousRecommendations, addressed));
      setBulkCandidates(previousBulkCandidates.filter((item) => !addressedSet.has(item.id)));
      setSummary(addressed.reduce(summaryAfterAddressed, previousSummary));
      const removedFromCurrentFilter = addressed.filter((item) =>
        !remainsVisibleAfterTask(item) && (!reason || item.reason === reason)
      ).length;
      setFilteredTotal(Math.max(0, previousFilteredTotal - removedFromCurrentFilter));

      if (result.failedIds.length > 0) {
        setNotice(`Создано задач: ${result.createdCount}. Не удалось обработать: ${result.failedIds.length}.`);
        setNoticeError(true);
      } else if (result.createdCount === 0) {
        setNotice('Все выбранные задачи уже существовали.');
      } else {
        setNotice(`Создано задач: ${result.createdCount}.`);
      }
    } catch {
      setRecommendations(previousRecommendations);
      setBulkCandidates(previousBulkCandidates);
      setSummary(previousSummary);
      setFilteredTotal(previousFilteredTotal);
      setNotice('Не удалось связаться с сервером. Массовое изменение отменено.');
      setNoticeError(true);
    } finally {
      setBulkPending(false);
    }
  }

  const filters = [
    { label: 'Все', href: '/followups', active: !reason, count: summary.total },
    { label: 'Просрочено', href: '/followups?reason=overdue_followup', active: reason === 'overdue_followup', count: summary.overdue },
    { label: 'Сегодня', href: '/followups?reason=today_followup', active: reason === 'today_followup', count: summary.today },
    { label: 'Высокий интерес', href: '/followups?reason=hot_without_task', active: reason === 'hot_without_task', count: summary.hot },
    { label: 'Анкеты', href: '/followups?reason=unanswered_questionnaire', active: reason === 'unanswered_questionnaire', count: summary.questionnaires }
  ];

  return (
    <>
      {notice ? <Notice text={notice} error={noticeError} /> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <Card><CardContent className="p-4"><p className="text-xs font-bold text-app-muted">Всего рекомендаций</p><p className="mt-2 text-3xl font-black text-app-text">{summary.total}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs font-bold text-app-muted">Срочно</p><p className="mt-2 text-3xl font-black text-app-red">{summary.urgent}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs font-bold text-app-muted">Просрочено</p><p className="mt-2 text-3xl font-black text-app-text">{summary.overdue}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs font-bold text-app-muted">Сегодня</p><p className="mt-2 text-3xl font-black text-app-text">{summary.today}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs font-bold text-app-muted">Анкеты без ответа</p><p className="mt-2 text-3xl font-black text-app-text">{summary.questionnaires}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs font-bold text-app-muted">Без задач</p><p className="mt-2 text-3xl font-black text-app-text">{summary.withoutTasks}</p></CardContent></Card>
      </div>

      <Card className="border-purple-100 bg-gradient-to-br from-white to-purple-50/70">
        <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-app-purple" />
              <h2 className="text-lg font-black text-app-text">Автоматические задачи</h2>
              {demoMode ? <Badge tone="yellow">Demo fallback</Badge> : null}
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-app-muted">
              Создай задачи по всем рекомендациям без открытой задачи. Hutka не создаст дубль, если такая задача уже есть у контакта.
            </p>
          </div>
          {canManageTasks ? (
            <Button type="button" size="lg" disabled={busy || bulkCandidates.length === 0} onClick={() => void createBulk()}>
              {bulkPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
              {bulkCandidates.length > 0 ? `Создать до ${Math.min(10, bulkCandidates.length)} задач` : 'Все задачи созданы'}
            </Button>
          ) : (
            <Badge tone="gray">Только просмотр</Badge>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {filters.map((filter) => (
          <Link
            key={filter.href}
            prefetch={false}
            href={filter.href}
            className={`shrink-0 rounded-2xl border px-4 py-2 text-sm font-black transition ${filter.active ? 'border-purple-200 bg-purple-50 text-app-purple' : 'border-app-line bg-white text-app-muted hover:border-purple-200 hover:text-app-purple'}`}
          >
            {filter.label} · {filter.count}
          </Link>
        ))}
      </div>

      {recommendations.length === 0 ? (
        <EmptyState
          title="Рекомендаций нет"
          text="Сейчас все контакты под контролем: нет просроченных действий, заинтересованных контактов без задачи и анкет без ответа."
          action={
            <Button asChild variant="secondary">
              <Link prefetch={false} href="/people">Открыть контакты</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {recommendations.map((item) => {
            const Icon = reasonIcons[item.reason];
            const pending = pendingIds.includes(item.id);
            return (
              <Card key={item.id} className="performance-contain overflow-hidden">
                <CardHeader className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={item.tone}>{reasonLabels[item.reason]}</Badge>
                    <Badge tone={priorityTone(item.priority)}>{item.priorityLabel}</Badge>
                    <Badge tone="gray">{item.stage}</Badge>
                    {item.hasOpenTask ? <Badge tone="green">Есть открытая задача</Badge> : <Badge tone="yellow">Задачи нет</Badge>}
                  </div>
                  <CardTitle className="flex items-start gap-3">
                    <span className="rounded-2xl bg-purple-50 p-2 text-app-purple"><Icon className="h-5 w-5" /></span>
                    <span className="min-w-0">
                      <span className="block break-words">{item.leadName}</span>
                      <span className="mt-1 block text-xs font-semibold text-app-muted">{item.meta} · последняя активность: {item.lastActivityLabel}</span>
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-2xl border border-app-line bg-slate-50/60 p-4">
                    <p className="text-sm font-black text-app-text">{item.title}</p>
                    <p className="mt-2 text-sm leading-6 text-app-muted">{item.description}</p>
                    {item.questionnaireTitle ? <p className="mt-2 text-xs font-bold text-app-purple">Анкета: {item.questionnaireTitle}</p> : null}
                  </div>

                  <div className="rounded-2xl border border-purple-100 bg-purple-50/50 p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-app-muted">Будущая задача</p>
                    <p className="mt-2 text-sm font-black text-app-text">{item.suggestedTaskTitle}</p>
                    <p className="mt-1 text-xs leading-5 text-app-muted">Срок: {item.suggestedDueDate} · приоритет: {item.priorityLabel}</p>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    <Button asChild variant="secondary">
                      <Link prefetch={false} href={item.href}>Открыть контакт</Link>
                    </Button>
                    {canManageTasks ? (
                      <Button
                        type="button"
                        disabled={busy || item.hasOpenTask}
                        onClick={() => void createTask(item)}
                      >
                        {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                        {item.hasOpenTask ? 'Задача создана' : 'Создать задачу'}
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {filteredTotal > PAGE_SIZE && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-app-line bg-white p-4">
          <p className="text-sm text-app-muted">
            Показано {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min((currentPage - 1) * PAGE_SIZE + recommendations.length, filteredTotal)} из {filteredTotal}
          </p>
          <div className="flex items-center gap-2">
            {currentPage === 1 ? (
              <Button type="button" size="sm" variant="secondary" disabled><ChevronLeft className="h-4 w-4" /> Предыдущая</Button>
            ) : (
              <Button asChild size="sm" variant="secondary">
                <Link prefetch={false} href={pageHref(reason, currentPage - 1)}><ChevronLeft className="h-4 w-4" /> Предыдущая</Link>
              </Button>
            )}
            <span className="px-2 text-sm font-bold text-app-text">{Math.min(currentPage, pageCount)} / {pageCount}</span>
            {currentPage >= pageCount ? (
              <Button type="button" size="sm" variant="secondary" disabled>Следующая <ChevronRight className="h-4 w-4" /></Button>
            ) : (
              <Button asChild size="sm" variant="secondary">
                <Link prefetch={false} href={pageHref(reason, currentPage + 1)}>Следующая <ChevronRight className="h-4 w-4" /></Link>
              </Button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
