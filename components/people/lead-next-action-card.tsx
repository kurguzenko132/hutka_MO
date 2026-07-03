import Link from 'next/link';
import { AlertTriangle, CalendarClock, CheckCircle2, ClipboardList, Flag, Sparkles, TimerReset } from 'lucide-react';
import { updateLeadFollowUpAction } from '@/actions/leads.actions';
import { createTaskAction } from '@/actions/tasks.actions';
import { buildLeadNextAction, quickFollowUpDates } from '@/lib/lead-next-actions';
import type { Lead } from '@/lib/data';
import type { LeadTask } from '@/lib/leads';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

function statusIcon(status: ReturnType<typeof buildLeadNextAction>['status']) {
  if (status === 'overdue' || status === 'refused') return <AlertTriangle className="h-5 w-5" />;
  if (status === 'today' || status === 'no_date') return <CalendarClock className="h-5 w-5" />;
  if (status === 'ready') return <Sparkles className="h-5 w-5" />;
  return <CheckCircle2 className="h-5 w-5" />;
}

export function LeadNextActionCard({ lead, tasks }: { lead: Lead; tasks: LeadTask[] }) {
  const action = buildLeadNextAction(lead, tasks);
  const dates = quickFollowUpDates();

  return (
    <Card className="overflow-hidden border-purple-100 bg-gradient-to-br from-white via-white to-purple-50/60">
      <CardContent className="p-0">
        <div className="grid gap-0 xl:grid-cols-[1fr_360px]">
          <div className="space-y-5 p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <Badge tone={action.tone}>{statusIcon(action.status)} {action.title}</Badge>
                  <Badge tone={action.riskTone}>{action.riskLabel}</Badge>
                  <Badge tone="gray">Открытых задач: {action.openTasks}</Badge>
                  {action.overdueTasks > 0 && <Badge tone="red">Просрочено задач: {action.overdueTasks}</Badge>}
                </div>
                <h2 className="text-xl font-black tracking-tight text-app-text sm:text-2xl">Что делать дальше</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-app-muted">{action.subtitle}</p>
              </div>
              <Button asChild variant="secondary" className="shrink-0">
                <Link href={`/tasks/new?leadId=${lead.id}`}>
                  <ClipboardList className="h-4 w-4" />
                  Создать задачу
                </Link>
              </Button>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-app-line bg-white p-4">
                <p className="text-xs font-black uppercase tracking-wide text-app-faint">Рекомендуемый шаг</p>
                <p className="mt-2 text-sm font-bold leading-6 text-app-text">{action.recommendedStep}</p>
              </div>
              <div className="rounded-2xl border border-app-line bg-white p-4">
                <p className="text-xs font-black uppercase tracking-wide text-app-faint">Текущий follow-up</p>
                <p className="mt-2 text-sm font-bold leading-6 text-app-text">{lead.nextStep || 'Не указан'} · {lead.nextDate || 'без даты'}</p>
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

          <div className="space-y-4 border-t border-app-line bg-white/70 p-5 sm:p-6 xl:border-l xl:border-t-0">
            <form action={updateLeadFollowUpAction} className="space-y-3 rounded-2xl border border-app-line bg-white p-4">
              <input type="hidden" name="lead_id" value={lead.id} />
              <p className="flex items-center gap-2 text-sm font-black text-app-text"><Flag className="h-4 w-4 text-app-purple" />Быстро поставить следующий шаг</p>
              <Textarea name="next_step" defaultValue={action.recommendedStep} rows={3} placeholder="Что нужно сделать дальше" />
              <div className="grid gap-2 sm:grid-cols-[1fr_auto] xl:grid-cols-1">
                <Input name="next_contact_date" type="date" defaultValue={action.recommendedDate} />
                <Button type="submit" className="w-full"><TimerReset className="h-4 w-4" />Сохранить</Button>
              </div>
            </form>

            <div className="rounded-2xl border border-app-line bg-white p-4">
              <p className="mb-3 text-xs font-black uppercase tracking-wide text-app-faint">Быстрые даты</p>
              <div className="flex flex-wrap gap-2">
                {dates.map((date) => (
                  <form key={date.value} action={updateLeadFollowUpAction}>
                    <input type="hidden" name="lead_id" value={lead.id} />
                    <input type="hidden" name="next_step" value={action.recommendedStep} />
                    <input type="hidden" name="next_contact_date" value={date.value} />
                    <Button type="submit" variant="ghost" size="sm">{date.label}</Button>
                  </form>
                ))}
              </div>
            </div>

            <form action={createTaskAction} className="space-y-3 rounded-2xl border border-dashed border-purple-200 bg-purple-50/50 p-4">
              <input type="hidden" name="lead_id" value={lead.id} />
              <input type="hidden" name="return_to" value={`/people/${lead.id}`} />
              <p className="flex items-center gap-2 text-sm font-black text-app-text"><ClipboardList className="h-4 w-4 text-app-pink" />Создать задачу из рекомендации</p>
              <Input name="title" defaultValue={action.recommendedStep} required />
              <Input name="due_date" type="date" defaultValue={action.recommendedDate} />
              <Select name="priority" defaultValue={lead.score >= 75 || action.status === 'overdue' ? 'Высокий' : 'Средний'}>
                <option>Низкий</option>
                <option>Средний</option>
                <option>Высокий</option>
                <option>Срочно</option>
              </Select>
              <Textarea name="description" rows={3} placeholder="Комментарий к задаче" />
              <Button type="submit" variant="secondary" className="w-full">Создать задачу</Button>
            </form>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
