import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-[13px] rounded-btn',
  md: 'h-11 px-4 text-[14px] rounded-btn',
  lg: 'h-14 px-5 text-[15px] rounded-btn',
  xl: 'h-16 px-6 text-[17px] rounded-btn',
};

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-accent text-text-inv font-semibold tracking-tight active:brightness-90 hover:brightness-95',
  secondary:
    'bg-bg-elev2 border border-border text-text font-semibold active:bg-bg-elev',
  ghost:
    'bg-transparent text-text-2 font-medium active:bg-bg-elev2',
  danger:
    'bg-transparent border border-error/40 text-error font-semibold active:bg-error/10',
  outline:
    'bg-transparent border border-border-strong text-text font-semibold active:bg-bg-elev2',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    fullWidth = false,
    leading,
    trailing,
    className,
    children,
    type = 'button',
    ...rest
  },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 select-none transition-[transform,filter,background-color] duration-150 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100',
        sizeClasses[size],
        variantClasses[variant],
        fullWidth && 'w-full',
        className
      )}
      {...rest}
    >
      {leading}
      {children}
      {trailing}
    </button>
  );
});
