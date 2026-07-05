import { AlertTriangle, CalendarClock, CheckCircle2, Flag, Sparkles, TimerReset } from 'lucide-react';
import { updateLeadFollowUpAction } from '@/actions/leads.actions';
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

export function LeadNextActionCard({ lead, tasks, role = 'viewer' }: { lead: Lead; tasks: LeadTask[]; role?: UserRole }) {
  const action = buildLeadNextAction(lead, tasks);
  const canManageContacts = can(role, 'manageContacts');
  const canManageTasks = can(role, 'manageTasks');
  const canManageNextAction = canManageContacts || canManageTasks;
  const plannedTask = tasks.find((task) => task.status !== 'Готово' && task.status !== 'Отменено');
  const hasPlannedAction = Boolean((lead.nextStep && lead.nextStep !== '—') || plannedTask);

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
                <form action={updateLeadFollowUpAction} className="space-y-3 rounded-2xl border border-app-line bg-white p-4">
                  <input type="hidden" name="lead_id" value={lead.id} />
                  <p className="flex items-center gap-2 text-sm font-black text-app-text"><Flag className="h-4 w-4 text-app-purple" />Запланировать действие</p>
                  <label className="space-y-1.5">
                    <span className="text-xs font-bold uppercase tracking-wide text-app-faint">Действие</span>
                    <Input name="next_step" defaultValue={plannedTask?.title || (lead.nextStep === '—' ? '' : lead.nextStep) || action.recommendedStep} required />
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-xs font-bold uppercase tracking-wide text-app-faint">Дата</span>
                    <Input name="next_contact_date" type="date" defaultValue={lead.nextDateRaw || action.recommendedDate} />
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-xs font-bold uppercase tracking-wide text-app-faint">Комментарий</span>
                    <Textarea name="comment" rows={3} defaultValue={plannedTask?.description ?? ''} placeholder="Например: отправить ссылку на вопросы" />
                  </label>
                  <div>
                    <Button type="submit" className="w-full"><TimerReset className="h-4 w-4" />Запланировать действие</Button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
