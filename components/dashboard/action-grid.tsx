import Link from 'next/link';
import { AlarmClockCheck, ArrowRight, BellRing, ClipboardList, Plus, Send, Sparkles, Target, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { can, type Permission, type UserRole } from '@/lib/roles';

const actions: Array<{ title: string; text: string; href: string; icon: typeof Users; permission: Permission }> = [
  { title: 'Добавить контакт', text: 'Мастер, салон, клиент или партнер', href: '/people/new', icon: Users, permission: 'manageContacts' },
  { title: 'Создать задачу', text: 'Действие, созвон или проверка', href: '/tasks/new', icon: Plus, permission: 'manageTasks' },
  { title: 'Что сделать', text: 'Авто-рекомендации по действиям', href: '/followups', icon: AlarmClockCheck, permission: 'manageTasks' },
  { title: 'Создать анкету', text: 'Собрать ответы рынка', href: '/surveys/new', icon: ClipboardList, permission: 'manageSurveys' },
  { title: 'Запустить кампанию', text: 'Проверить канал или оффер', href: '/campaigns/new', icon: Send, permission: 'manageCampaigns' },
  { title: 'Добавить вывод', text: 'Зафиксировать решение', href: '/insights/new', icon: Sparkles, permission: 'manageInsights' },
  { title: 'Telegram', text: 'Уведомления и дайджест', href: '/settings/telegram', icon: BellRing, permission: 'manageSettings' }
];

export function ActionGrid({ role }: { role: UserRole }) {
  const visibleActions = actions.filter((action) => can(role, action.permission));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Быстрые действия</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {visibleActions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-app-line p-4 text-sm text-app-muted sm:col-span-2 xl:col-span-3">
            У твоей роли доступ только на просмотр. Можно анализировать dashboard, отчеты, контакты и результаты, но нельзя создавать или изменять данные.
          </div>
        ) : (
          visibleActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.href}
                prefetch={false}
                href={action.href}
                className="group rounded-2xl border border-app-line bg-white p-4 transition hover:border-purple-200 hover:bg-purple-50/60 hover:shadow-card"
              >
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-purple-50 p-2 text-app-purple transition group-hover:bg-white">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-black text-app-text">{action.title}</p>
                      <ArrowRight className="h-4 w-4 text-app-faint transition group-hover:translate-x-0.5 group-hover:text-app-purple" />
                    </div>
                    <p className="mt-1 text-xs leading-5 text-app-muted">{action.text}</p>
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
