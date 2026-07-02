import { cloneElement, isValidElement, type ButtonHTMLAttributes, type ReactElement, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

const variantClass: Record<ButtonVariant, string> = {
  primary: 'bg-app-purple text-white shadow-sm hover:bg-purple-700',
  secondary: 'border border-app-line bg-white text-app-text hover:border-purple-200 hover:bg-purple-50',
  ghost: 'text-app-muted hover:bg-purple-50 hover:text-app-purple',
  danger: 'bg-app-red text-white hover:bg-red-600'
};

const sizeClass: Record<ButtonSize, string> = {
  sm: 'h-9 rounded-xl px-3 text-xs',
  md: 'h-10 rounded-xl px-4 text-sm',
  lg: 'h-12 rounded-2xl px-5 text-sm'
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  asChild?: boolean;
  children: ReactNode;
};

type ChildWithClassName = ReactElement<{ className?: string }>;

export function Button({
  variant = 'primary',
  size = 'md',
  asChild = false,
  className,
  children,
  ...props
}: ButtonProps) {
  const classes = cn(
    'inline-flex items-center justify-center gap-2 font-semibold transition disabled:cursor-not-allowed disabled:opacity-60',
    variantClass[variant],
    sizeClass[size],
    className
  );

  if (asChild) {
    if (!isValidElement(children)) {
      return null;
    }

    const child = children as ChildWithClassName;

    return cloneElement(child, {
      className: cn(classes, child.props.className)
    });
  }

  return (
    <button className={classes} {...props}>
      {children}
    </button>
  );
}
