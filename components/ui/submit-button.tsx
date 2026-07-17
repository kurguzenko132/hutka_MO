'use client';

import { LoaderCircle } from 'lucide-react';
import type { MouseEventHandler } from 'react';
import { useFormStatus } from 'react-dom';
import { Button, type ButtonProps } from './button';

type SubmitButtonProps = Omit<ButtonProps, 'asChild' | 'type'> & {
  confirmMessage?: string;
};

export function SubmitButton({
  children,
  confirmMessage,
  disabled,
  onClick,
  ...props
}: SubmitButtonProps) {
  const { pending } = useFormStatus();
  const handleClick: MouseEventHandler<HTMLButtonElement> = (event) => {
    if (confirmMessage && !window.confirm(confirmMessage)) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  };

  return (
    <Button
      type="submit"
      {...props}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      onClick={handleClick}
    >
      {pending ? <LoaderCircle className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" /> : null}
      {children}
    </Button>
  );
}
