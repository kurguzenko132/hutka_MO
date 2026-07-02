import type { ElementType, ReactNode } from 'react';
import { SearchX } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export function EmptyState({
  icon: Icon = SearchX,
  title,
  text,
  action,
  className
}: {
  icon?: ElementType;
  title: string;
  text: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn('p-10 text-center', className)}>
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-50 text-app-purple">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="mt-5 text-lg font-black text-app-text">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-app-muted">{text}</p>
      {action ? <div className="mt-6 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </Card>
  );
}
