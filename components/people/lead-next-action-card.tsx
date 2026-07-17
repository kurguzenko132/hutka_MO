'use client';

import { useState } from 'react';
import { AlertTriangle, CalendarClock, Check, CheckCircle2, Flag, LoaderCircle, Sparkles, TimerReset } from 'lucide-react';
import { updateLeadFollowUpMutationAction } from '@/actions/leads.actions';
import { buildLeadNextAction } from '@/lib/lead-next-actions';
import type { Lead } from '@/lib/data';
import type { LeadTask } from '@/lib/leads';
import { can, type UserRole } from '@/lib/roles';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

function statusIcon(status: ReturnType<typeof buildLeadNextAction>['status']) {
  if (status === 'overdue' || status === 'refused') return <AlertTriangle className="h-5 w-5" />;
  if (status === 'today' || status === 'no_date') return <CalendarClock className="h-5 w-5" />;
  if (status === 'ready') return <Sparkles className="h-5 w-5" />;
  return <CheckCircle2 className="h-5 w-5" />;
}

function formatPlannedDate(value: string) {
  if (!value) return 'без даты';
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('ru-RU');
}

export function LeadNextActionCard({ lead, tasks, role = 'viewer' }: { lead: Lead; tasks: LeadTask[]; role?: UserRole }) {
  const initialAction = buildLeadNextAction(lead, tasks);
  const initialPlannedTask = tasks.find((task) => task.status !== 'Готово' && task.status !== 'Отменено');
  const [currentLead, setCurrentLead] = useState(lead);
  const [currentTasks, setCurrentTasks] = useState(tasks);
  const [nextStep, setNextStep] = useState(initialPlannedTask?.title || (lead.nextStep === '—' ? '' : lead.nextStep) || initialAction.recommendedStep);
  const [nextContactDate, setNextContactDate] = useState(lead.nextDateRaw || initialAction.recommendedDate);
  const [comment, setComment] = useState(initialPlannedTask?.description ?? '');
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState('');
  const [noticeError, setNoticeError] = useState(false);
  const action = buildLeadNextAction(currentLead, currentTasks);
  const canManageContacts = can(role, 'manageContacts');
  const canManageTasks = can(role, 'manageTasks');
  const canManageNextAction = canManageContacts || canManageTasks;
  const plannedTask = currentTasks.find((task) => task.status !== 'Готово' && task.status !== 'Отменено');
  const hasPlannedAction = Boolean((currentLead.nextStep && currentLead.nextStep !== '—') || plannedTask);

  async function planAction(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !nextStep.trim()) return;

    const previousLead = currentLead;
    const previousTasks = currentTasks;
    const optimisticTaskId = plannedTask?.id || 'optimistic-next-action';
    const optimisticTask: LeadTask = {
      id: optimisticTaskId,
      title: nextStep.trim(),
      description: comment.trim() || undefined,
      dueDate: formatPlannedDate(nextContactDate),
      priority: plannedTask?.priority ?? 'Без приоритета',
      status: plannedTask?.status ?? 'К выполнению'
    };

    setPending(true);
    setNotice('Сохраняю действие...');
    setNoticeError(false);
    setCurrentLead((current) => ({
      ...current,
      nextStep: nextStep.trim(),
      nextDateRaw: nextContactDate,
      nextDate: formatPlannedDate(nextContactDate)
    }));
    setCurrentTasks((current) => plannedTask
      ? current.map((task) => task.id === plannedTask.id ? optimisticTask : task)
      : [optimisticTask, ...current]);

    try {
      const result = await updateLeadFollowUpMutationAction({
        leadId: lead.id,
        nextStep,
        nextContactDate,
        comment
      });

      if (!result.ok) {
        setCurrentLead(previousLead);
        setCurrentTasks(previousTasks);
        setNotice('Не удалось запланировать действие. Изменение отменено.');
        setNoticeError(true);
      } else {
        if (result.taskId && result.taskId !== optimisticTaskId) {
          setCurrentTasks((current) => current.map((task) => task.id === optimisticTaskId ? { ...task, id: result.taskId as string } : task));
        }
        setNotice(result.created ? 'Действие запланировано, задача создана.' : 'Действие и задача обновлены.');
      }
    } catch {
      setCurrentLead(previousLead);
      setCurrentTasks(previousTasks);
      setNotice('Не удалось связаться с сервером. Изменение отменено.');
      setNoticeError(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="overflow-hidden border-purple-100 bg-gradient-to-br from-white via-white to-purple-50/60">
      <CardContent className="p-0">
        <div className={`grid gap-0 ${canManageNextAction ? 'xl:grid-cols-[1fr_360px]' : ''}`}>
          <div className="space-y-5 p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <Badge tone={action.tone}>{statusIcon(action.status)} {action.title}</Badge>
                  <Badge tone={action.riskTone}>{action.riskLabel}</Badge>
                  <Badge tone="gray">Открытых задач: {action.openTasks}</Badge>
                  {action.overdueTasks > 0 && <Badge tone="red">Просрочено задач: {action.overdueTasks}</Badge>}
                </div>
                <h2 className="text-xl font-black tracking-tight text-app-text sm:text-2xl">Что сделать дальше</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-app-muted">{action.subtitle}</p>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-app-line bg-white p-4">
                <p className="text-xs font-black uppercase tracking-wide text-app-faint">Рекомендуемый шаг</p>
                <p className="mt-2 text-sm font-bold leading-6 text-app-text">{action.recommendedStep}</p>
              </div>
              <div className="rounded-2xl border border-app-line bg-white p-4">
                <p className="text-xs font-black uppercase tracking-wide text-app-faint">
                  {hasPlannedAction ? 'Следующее действие запланировано' : 'Следующее действие'}
                </p>
                <p className="mt-2 text-sm font-bold leading-6 text-app-text">{plannedTask?.title || lead.nextStep || 'Не указано'} · {plannedTask?.dueDate || lead.nextDate || 'без даты'}</p>
                {plannedTask && <p className="mt-1 text-xs font-semibold text-app-green">Задача: создана</p>}
              </div>
            </div>

            <div className="rounded-2xl border border-app-line bg-white p-4">
              <p className="mb-3 text-sm font-black text-app-text">Почему это важно</p>
              <div className="grid gap-2">
                {action.reasons.map((reason) => (
                  <div key={reason} className="flex gap-3 text-sm leading-6 text-app-muted">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-app-purple" />
                    <span>{reason}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {canManageNextAction && (
            <div className="space-y-4 border-t border-app-line bg-white/70 p-5 sm:p-6 xl:border-l xl:border-t-0">
              {canManageContacts && (
                <form onSubmit={(event) => void planAction(event)} className="space-y-3 rounded-2xl border border-app-line bg-white p-4">
                  <p className="flex items-center gap-2 text-sm font-black text-app-text"><Flag className="h-4 w-4 text-app-purple" />Запланировать действие</p>
                  <label className="space-y-1.5">
                    <span className="text-xs font-bold uppercase tracking-wide text-app-faint">Действие</span>
                    <Input name="next_step" value={nextStep} onChange={(event) => setNextStep(event.target.value)} disabled={pending} required />
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-xs font-bold uppercase tracking-wide text-app-faint">Дата</span>
                    <Input name="next_contact_date" type="date" value={nextContactDate} onChange={(event) => setNextContactDate(event.target.value)} disabled={pending} />
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-xs font-bold uppercase tracking-wide text-app-faint">Комментарий</span>
                    <Textarea name="comment" rows={3} value={comment} onChange={(event) => setComment(event.target.value)} disabled={pending} placeholder="Например: отправить ссылку на вопросы" />
                  </label>
                  <Button type="submit" className="w-full" disabled={pending}>
                    {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <TimerReset className="h-4 w-4" />}
                    Запланировать действие
                  </Button>
                  {notice && (
                    <p
                      aria-live="polite"
                      className={`flex items-start gap-2 text-sm font-semibold ${noticeError ? 'text-red-700' : 'text-emerald-700'}`}
                    >
                      {noticeError ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> : <Check className="mt-0.5 h-4 w-4 shrink-0" />}
                      <span>{notice}</span>
                    </p>
                  )}
                </form>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
