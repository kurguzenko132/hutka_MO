import type { ElementType, ReactNode } from 'react';
import Link from 'next/link';
import { SearchX } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function EmptyState({
  icon: Icon = SearchX,
  title = 'Пока ничего нет',
  text = 'Данные появятся здесь после первых действий в системе.',
  action,
  actionLabel,
  actionHref,
  className
}: {
  icon?: ElementType;
  title?: string;
  text?: string;
  action?: ReactNode;
  actionLabel?: string;
  actionHref?: string;
  className?: string;
}) {
  const defaultAction = actionLabel
    ? actionHref
      ? <Button asChild><Link prefetch={false} href={actionHref}>{actionLabel}</Link></Button>
      : <Button>{actionLabel}</Button>
    : null;

  return (
    <Card className={cn('p-10 text-center', className)}>
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-50 text-app-purple">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="mt-5 text-lg font-black text-app-text">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-app-muted">{text}</p>
      {action || defaultAction ? <div className="mt-6 flex flex-wrap justify-center gap-2">{action ?? defaultAction}</div> : null}
    </Card>
  );
}
