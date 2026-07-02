import { cn } from '@/lib/utils';

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn('min-h-28 w-full rounded-xl border border-app-line bg-white px-3 py-2 text-sm outline-none transition placeholder:text-app-faint focus:border-purple-300 focus:ring-4 focus:ring-purple-100', className)}
      {...props}
    />
  );
}
