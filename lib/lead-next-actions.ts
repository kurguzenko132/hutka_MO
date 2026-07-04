import type { Lead } from '@/lib/data';
import type { LeadTask } from '@/lib/leads';
import type { BadgeTone } from '@/components/ui/badge';
import { normalizeStageName } from '@/lib/stages';

export type LeadNextActionStatus = 'refused' | 'overdue' | 'today' | 'no_date' | 'ready' | 'scheduled';

export type LeadNextAction = {
  status: LeadNextActionStatus;
  tone: BadgeTone;
  title: string;
  subtitle: string;
  recommendedStep: string;
  recommendedDate: string;
  riskLabel: string;
  riskTone: BadgeTone;
  reasons: string[];
  openTasks: number;
  overdueTasks: number;
  daysUntilFollowUp?: number;
};

function todayStart() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function addDays(days: number) {
  const date = todayStart();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function parseDateInput(value?: string) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function dayDiff(date: Date) {
  const diff = date.getTime() - todayStart().getTime();
  return Math.round(diff / 86_400_000);
}

function isTaskOpen(task: LeadTask) {
  return !['Готово', 'Отменено'].includes(task.status);
}

function taskIsOverdue(task: LeadTask) {
  if (!isTaskOpen(task)) return false;
  if (!task.dueDate || task.dueDate === '—') return false;

  const [day, month, year] = task.dueDate.split('.');
  if (!day || !month || !year) return false;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  if (Number.isNaN(date.getTime())) return false;
  return date < todayStart();
}

function defaultStepByStage(lead: Lead) {
  const stage = normalizeStageName(lead.stage).toLowerCase();

  if (stage.includes('новый')) return 'Отправить первое сообщение и зафиксировать реакцию';
  if (stage.includes('напис')) return 'Сделать follow-up и уточнить интерес';
  if (stage.includes('ответ')) return 'Отправить диагностическую анкету из готового пака';
  if (stage.includes('заинтерес')) return 'Назначить короткий созвон или следующий шаг';
  if (stage.includes('тест')) return 'Помочь пройти тестирование и собрать фидбек';
  if (stage.includes('пауза')) return 'Назначить дату возврата к контакту';
  if (stage.includes('отказ')) return 'Зафиксировать причину и дату возврата';

  if (lead.score >= 75) return 'Закрепить следующий шаг: отправить персональную ссылку или назначить созвон';
  return 'Уточнить статус и следующий шаг';
}

export function buildLeadNextAction(lead: Lead, tasks: LeadTask[]): LeadNextAction {
  const nextDate = parseDateInput(lead.nextDateRaw);
  const diff = nextDate ? dayDiff(nextDate) : undefined;
  const openTasks = tasks.filter(isTaskOpen).length;
  const overdueTasks = tasks.filter(taskIsOverdue).length;
  const reasons: string[] = [];
  const currentStep = lead.nextStep && lead.nextStep !== '—' ? lead.nextStep : '';
  const recommendedStep = currentStep || defaultStepByStage(lead);
  const recommendedDate = lead.nextDateRaw || addDays(1);

  if (lead.refusalReason || lead.stage === 'Отказ') {
    return {
      status: 'refused',
      tone: 'red',
      title: 'Контакт в отказе',
      subtitle: lead.refusalReason ? `Причина: ${lead.refusalReason}` : 'Причина отказа не указана',
      recommendedStep: currentStep || 'Вернуться позже с новым оффером или уточнить причину отказа',
      recommendedDate: lead.nextDateRaw || addDays(14),
      riskLabel: 'Потерян / пауза',
      riskTone: 'red',
      reasons: [lead.refusalComment || 'Проверь причину отказа и реши, когда возвращаться к контакту.'],
      openTasks,
      overdueTasks,
      daysUntilFollowUp: diff
    };
  }

  if (!currentStep) reasons.push('Не указан следующий шаг. Контакт легко потерять.');
  if (!nextDate) reasons.push('Не указана дата следующего контакта.');
  if (overdueTasks > 0) reasons.push(`Есть просроченные задачи: ${overdueTasks}.`);
  if (lead.score >= 75) reasons.push('Высокий приоритет — лучше обработать раньше остальных.');
  if (['Ответил', 'Заинтересован'].includes(normalizeStageName(lead.stage))) reasons.push('Контакт уже проявил интерес — важно не затянуть follow-up.');

  if (typeof diff === 'number' && diff < 0) {
    return {
      status: 'overdue',
      tone: 'red',
      title: 'Follow-up просрочен',
      subtitle: `Нужно было вернуться ${Math.abs(diff)} дн. назад`,
      recommendedStep,
      recommendedDate: addDays(0),
      riskLabel: 'Срочно',
      riskTone: 'red',
      reasons: reasons.length ? reasons : ['Дата следующего контакта уже прошла.'],
      openTasks,
      overdueTasks,
      daysUntilFollowUp: diff
    };
  }

  if (typeof diff === 'number' && diff === 0) {
    return {
      status: 'today',
      tone: 'yellow',
      title: 'Follow-up сегодня',
      subtitle: 'Контакт нужно обработать сегодня',
      recommendedStep,
      recommendedDate: addDays(0),
      riskLabel: lead.score >= 75 ? 'Высокий фокус' : 'Сегодня',
      riskTone: lead.score >= 75 ? 'red' : 'yellow',
      reasons: reasons.length ? reasons : ['Сегодня назначено следующее действие.'],
      openTasks,
      overdueTasks,
      daysUntilFollowUp: diff
    };
  }

  if (!nextDate) {
    return {
      status: 'no_date',
      tone: 'yellow',
      title: 'Нет даты следующего контакта',
      subtitle: 'Поставь дату, чтобы контакт не выпал из работы',
      recommendedStep,
      recommendedDate,
      riskLabel: 'Риск потерять',
      riskTone: 'yellow',
      reasons,
      openTasks,
      overdueTasks,
      daysUntilFollowUp: diff
    };
  }

  if (lead.score >= 75 && (!currentStep || openTasks === 0)) {
    return {
      status: 'ready',
      tone: 'purple',
      title: 'Заинтересованный контакт без закрепленного действия',
      subtitle: 'Лучше сразу создать задачу или отправить анкету',
      recommendedStep,
      recommendedDate,
      riskLabel: 'Высокий интерес',
      riskTone: 'red',
      reasons,
      openTasks,
      overdueTasks,
      daysUntilFollowUp: diff
    };
  }

  return {
    status: 'scheduled',
    tone: 'green',
    title: 'Контакт под контролем',
    subtitle: typeof diff === 'number' ? `Следующий контакт через ${diff} дн.` : 'Следующее действие запланировано',
    recommendedStep,
    recommendedDate,
    riskLabel: lead.score >= 75 ? 'Важный' : 'Норма',
    riskTone: lead.score >= 75 ? 'yellow' : 'green',
    reasons: reasons.length ? reasons : ['Есть следующий шаг и дата follow-up.'],
    openTasks,
    overdueTasks,
    daysUntilFollowUp: diff
  };
}

export function quickFollowUpDates() {
  return [
    { label: 'Сегодня', value: addDays(0) },
    { label: 'Завтра', value: addDays(1) },
    { label: 'Через 3 дня', value: addDays(3) },
    { label: 'Через неделю', value: addDays(7) },
    { label: 'Через 2 недели', value: addDays(14) }
  ];
}
