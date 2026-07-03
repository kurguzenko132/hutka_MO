import { cn } from '@/lib/utils';

export function Card({ className, children }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('min-w-0 rounded-2xl border border-app-line bg-white shadow-card', className)}>
      {children}
    </div>
  );
}

export function CardHeader({ className, children }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('min-w-0 border-b border-app-line px-5 py-4', className)}>{children}</div>;
}

export function CardTitle({ className, children }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('min-w-0 break-words text-base font-semibold text-app-text', className)}>{children}</h3>;
}

export function CardContent({ className, children }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('min-w-0 p-5', className)}>{children}</div>;
}
