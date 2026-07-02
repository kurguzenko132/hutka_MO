import Link from 'next/link';
import { CheckCircle2, ClipboardList, Sparkles, Upload, Users } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { can, type UserRole } from '@/lib/roles';

const steps = [
  {
    title: 'Добавить первые контакты',
    text: 'Внеси мастеров, салоны или партнеров вручную либо через CSV.',
    href: '/people/new',
    altHref: '/people/import',
    icon: Users,
    permission: 'manageContacts' as const
  },
  {
    title: 'Запустить опрос',
    text: 'Создай короткий опрос для мастеров и отправь публичную ссылку.',
    href: '/surveys/new',
    icon: ClipboardList,
    permission: 'manageSurveys' as const
  },
  {
    title: 'Зафиксировать инсайт',
    text: 'Сохрани повторяющуюся боль, возражение или вывод по рынку.',
    href: '/insights/new',
    icon: Sparkles,
    permission: 'manageInsights' as const
  },
  {
    title: 'Проверить отчет',
    text: 'Открой недельную сводку и скопируй ее для команды.',
    href: '/reports',
    icon: CheckCircle2,
    permission: null
  }
];

export function GettingStartedCard({ role }: { role: UserRole }) {
  const visibleSteps = steps.filter((step) => !step.permission || can(role, step.permission));

  if (visibleSteps.length === 0) return null;

  return (
    <Card className="border-purple-100 bg-white/85">
      <CardContent className="p-5">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-app-faint">Быстрый старт</p>
            <h2 className="mt-1 text-lg font-black text-app-text">Что сделать, чтобы Hutka начала приносить пользу</h2>
          </div>
          {can(role, 'manageContacts') ? (
            <Link href="/people/import" className="inline-flex items-center gap-2 text-sm font-bold text-app-purple">
              <Upload className="h-4 w-4" />
              Импорт CSV
            </Link>
          ) : null}
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {visibleSteps.map((step, index) => {
            const Icon = step.icon;
            return (
              <Link
                key={step.title}
                href={step.href}
                className="group rounded-2xl border border-app-line bg-gradient-to-br from-white to-slate-50 p-4 transition hover:border-purple-200 hover:shadow-card"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-purple-50 text-app-purple transition group-hover:bg-app-purple group-hover:text-white">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-wide text-app-faint">Шаг {index + 1}</p>
                    <h3 className="mt-1 text-sm font-black leading-5 text-app-text">{step.title}</h3>
                    <p className="mt-1 text-xs leading-5 text-app-muted">{step.text}</p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
