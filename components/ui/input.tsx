import { cn } from '@/lib/utils';

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn('h-10 w-full rounded-xl min-w-0 max-w-full border border-app-line bg-white px-3 text-sm outline-none placeholder:text-app-faint focus:border-purple-300 focus:ring-2 focus:ring-purple-100', className)}
      {...props}
    />
  );
}
