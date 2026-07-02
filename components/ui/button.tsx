import { cn } from '@/lib/utils';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const variantClass: Record<ButtonVariant, string> = {
  primary: 'bg-app-purple text-white shadow-sm hover:bg-purple-700',
  secondary: 'border border-app-line bg-white text-app-text hover:border-purple-200 hover:bg-purple-50',
  ghost: 'text-app-muted hover:bg-purple-50 hover:text-app-purple',
  danger: 'bg-app-red text-white hover:bg-red-600'
};

export function Button({ variant = 'primary', className, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      className={cn('inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60', variantClass[variant], className)}
      {...props}
    >
      {children}
    </button>
  );
}
