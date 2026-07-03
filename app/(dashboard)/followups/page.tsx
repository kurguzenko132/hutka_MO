import Link from 'next/link';
import { AlertTriangle, CalendarClock, CheckCircle2, ClipboardList, Flame, RefreshCcw, Sparkles, Timer } from 'lucide-react';
import { createAllFollowUpTasksAction, createFollowUpTaskAction } from '@/actions/followups.actions';
import { PageHeader } from '@/components/layout/page-header';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { getFollowUpRecommendations } from '@/lib/followups';
import { getCurrentUserContext } from '@/lib/permissions';
import { can } from '@/lib/roles';

const reasonLabels = {
  overdue_followup: 'Просрочено',
  today_followup: 'Сегодня',
  missing_next_action: 'Нет шага',
  hot_without_task: 'Горячий',
  unanswered_questionnaire: 'Анкета',
  stale_stage: 'Завис'
} as const;

const reasonIcons = {
  overdue_followup: AlertTriangle,
  today_followup: CalendarClock,
  missing_next_action: Timer,
  hot_without_task: Flame,
  unanswered_questionnaire: ClipboardList,
  stale_stage: RefreshCcw
} as const;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function priorityTone(priority: string): BadgeTone {
  if (priority === 'urgent') return 'red';
  if (priority === 'high') return 'yellow';
  if (priority === 'medium') return 'purple';
  return 'gray';
}

export default async function FollowUpsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const reason = firstParam(params.reason);
  const created = firstParam(params.created);
  const error = firstParam(params.error);
  const data = await getFollowUpRecommendations();
  const user = await getCurrentUserContext();
  const role = user?.role ?? 'viewer';
  const canManageTasks = can(role, 'manageTasks');

  const filtered = reason ? data.recommendations.filter((item) => item.reason === reason) : data.recommendations;
  const filters = [
    { label: 'Все', href: '/followups', active: !reason, count: data.summary.total },
    { label: 'Просрочено', href: '/followups?reason=overdue_followup', active: reason === 'overdue_followup', count: data.summary.overdue },
    { label: 'Сегодня', href: '/followups?reason=today_followup', active: reason === 'today_followup', count: data.summary.today },
    { label: 'Горячие', href: '/followups?reason=hot_without_task', active: reason === 'hot_without_task', count: data.summary.hot },
    { label: 'Анкеты', href: '/followups?reason=unanswered_questionnaire', active: reason === 'unanswered_questionnaire', count: data.summary.questionnaires }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Follow-up центр"
        subtitle="Hutka сама находит контакты, которые могут выпасть из работы, и предлагает задачи для дожима."
        actionLabel="Открыть задачи"
        actionHref="/tasks"
      />

      {created ? (
        <Card className="border-green-100 bg-green-50/60">
          <CardContent className="flex items-center gap-3 p-4 text-sm font-bold text-green-700">
            <CheckCircle2 className="h-4 w-4" />
            {created === 'duplicate'
              ? 'Такая открытая задача уже есть — дубль не создан.'
              : created === 'none'
                ? 'Нет рекомендаций без открытых задач.'
                : `Создано follow-up задач: ${created}`}
          </CardContent>
        </Card>
      ) : null}

      {error ? (
        <Card className="border-red-100 bg-red-50/70">
          <CardContent className="flex items-center gap-3 p-4 text-sm font-bold text-red-700">
            <AlertTriangle className="h-4 w-4" />
            Не удалось создать follow-up задачу. Проверь права и Supabase.
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <Card><CardContent className="p-4"><p className="text-xs font-bold text-app-muted">Всего рекомендаций</p><p className="mt-2 text-3xl font-black text-app-text">{data.summary.total}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs font-bold text-app-muted">Срочно</p><p className="mt-2 text-3xl font-black text-app-red">{data.summary.urgent}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs font-bold text-app-muted">Просрочено</p><p className="mt-2 text-3xl font-black text-app-text">{data.summary.overdue}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs font-bold text-app-muted">Сегодня</p><p className="mt-2 text-3xl font-black text-app-text">{data.summary.today}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs font-bold text-app-muted">Анкеты без ответа</p><p className="mt-2 text-3xl font-black text-app-text">{data.summary.questionnaires}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs font-bold text-app-muted">Без задач</p><p className="mt-2 text-3xl font-black text-app-text">{data.summary.withoutTasks}</p></CardContent></Card>
      </div>

      <Card className="border-purple-100 bg-gradient-to-br from-white to-purple-50/70">
        <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-app-purple" />
              <h2 className="text-lg font-black text-app-text">Автоматические follow-up-задачи</h2>
              {data.demoMode ? <Badge tone="yellow">Demo fallback</Badge> : null}
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-app-muted">
              Создай задачи по всем рекомендациям без открытой задачи. Hutka не создаст дубль, если такая задача уже есть у контакта.
            </p>
          </div>
          {canManageTasks ? (
            <form action={createAllFollowUpTasksAction} className="flex flex-col gap-2 sm:flex-row">
              <input type="hidden" name="return_to" value="/followups" />
              <input type="hidden" name="limit" value="10" />
              <Button type="submit" size="lg">Создать до 10 задач</Button>
            </form>
          ) : (
            <Badge tone="gray">Только просмотр</Badge>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {filters.map((filter) => (
          <Link
            key={filter.href}
            href={filter.href}
            className={`shrink-0 rounded-2xl border px-4 py-2 text-sm font-black transition ${filter.active ? 'border-purple-200 bg-purple-50 text-app-purple' : 'border-app-line bg-white text-app-muted hover:border-purple-200 hover:text-app-purple'}`}
          >
            {filter.label} · {filter.count}
          </Link>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="Follow-up-рекомендаций нет"
          text="Сейчас все контакты под контролем: нет просроченных follow-up, горячих контактов без задачи и анкет без ответа."
          actionLabel="Открыть контакты"
          actionHref="/people"
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {filtered.map((item) => {
            const Icon = reasonIcons[item.reason];
            return (
              <Card key={item.id} className="overflow-hidden">
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
                      <Link href={item.href}>Открыть контакт</Link>
                    </Button>
                    {canManageTasks ? (
                      <form action={createFollowUpTaskAction}>
                        <input type="hidden" name="lead_id" value={item.leadId} />
                        <input type="hidden" name="title" value={item.suggestedTaskTitle} />
                        <input type="hidden" name="description" value={item.suggestedTaskDescription} />
                        <input type="hidden" name="due_date" value={item.suggestedDueDate} />
                        <input type="hidden" name="priority" value={item.priority} />
                        <input type="hidden" name="return_to" value={`/followups${reason ? `?reason=${reason}` : ''}`} />
                        <Button type="submit" disabled={item.hasOpenTask}>Создать задачу</Button>
                      </form>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
