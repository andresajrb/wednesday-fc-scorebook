import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  danger?: boolean;
  ariaLabel: string;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { children, danger, className, ariaLabel, type = 'button', ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={ariaLabel}
      className={cn(
        'inline-flex items-center justify-center w-10 h-10 rounded-btn transition-[background-color,transform] active:scale-90 active:bg-bg-elev2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60',
        danger ? 'text-error' : 'text-text',
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
});
