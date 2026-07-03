import { cn } from '@/lib/utils';

export type BadgeTone = 'purple' | 'pink' | 'green' | 'yellow' | 'red' | 'blue' | 'gray';

const toneClass: Record<BadgeTone, string> = {
  purple: 'bg-purple-50 text-purple-700 ring-purple-100',
  pink: 'bg-pink-50 text-pink-700 ring-pink-100',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  yellow: 'bg-amber-50 text-amber-700 ring-amber-100',
  red: 'bg-red-50 text-red-700 ring-red-100',
  blue: 'bg-blue-50 text-blue-700 ring-blue-100',
  gray: 'bg-slate-100 text-slate-700 ring-slate-200'
};

export function Badge({ tone = 'gray', className, children }: React.HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span className={cn('inline-flex max-w-full items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium leading-5 ring-1', toneClass[tone], className)}>
      {children}
    </span>
  );
}
