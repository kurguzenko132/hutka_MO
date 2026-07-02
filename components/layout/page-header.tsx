import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

export function PageHeader({
  title,
  subtitle,
  actionLabel,
  actionHref
}: {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
      <div>
        <h1 className="text-3xl font-black tracking-tight text-app-text">{title}</h1>
        {subtitle && <p className="mt-2 text-sm text-app-muted">{subtitle}</p>}
      </div>
      {actionLabel && actionHref && (
        <Button asChild>
          <Link href={actionHref}>
            <Plus className="h-4 w-4" />
            {actionLabel}
          </Link>
        </Button>
      )}
      {actionLabel && !actionHref && (
        <Button>
          <Plus className="h-4 w-4" />
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
