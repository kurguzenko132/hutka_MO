import { cn } from '@/lib/utils';

export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn('h-10 w-full rounded-xl border border-app-line bg-white px-3 text-sm outline-none transition focus:border-purple-300 focus:ring-4 focus:ring-purple-100', className)}
      {...props}
    >
      {children}
    </select>
  );
}
