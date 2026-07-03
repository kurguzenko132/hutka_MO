import type { ReactNode } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

export function PageHeader({
  title,
  subtitle,
  actionLabel,
  actionHref,
  action,
  actions
}: {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  actionHref?: string;
  action?: ReactNode;
  actions?: ReactNode;
}) {
  const customAction = actions ?? action;

  return (
    <div className="mb-6 flex min-w-0 flex-col justify-between gap-4 rounded-3xl border border-app-line bg-white/70 p-4 shadow-sm backdrop-blur sm:p-5 lg:flex-row lg:items-center">
      <div className="min-w-0">
        <h1 className="break-words text-2xl font-black tracking-tight text-app-text sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-2 max-w-3xl text-sm leading-6 text-app-muted">{subtitle}</p>}
      </div>

      {customAction ? (
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">{customAction}</div>
      ) : actionLabel && actionHref ? (
        <Button asChild className="w-full sm:w-auto">
          <Link href={actionHref}>
            <Plus className="h-4 w-4" />
            {actionLabel}
          </Link>
        </Button>
      ) : actionLabel ? (
        <Button className="w-full sm:w-auto">
          <Plus className="h-4 w-4" />
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
