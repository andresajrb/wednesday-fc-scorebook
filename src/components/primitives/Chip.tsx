import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type ChipTone = 'neutral' | 'accent' | 'success' | 'warning' | 'error' | 'team';

interface ChipProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: ChipTone;
  leading?: ReactNode;
  children?: ReactNode;
  teamColor?: string;
}

const toneClasses: Record<ChipTone, string> = {
  neutral: 'bg-bg-elev2 text-text-2 border border-border',
  accent: 'bg-accent-soft text-accent border border-accent/30',
  success: 'bg-success/15 text-success border border-success/30',
  warning: 'bg-warning/15 text-warning border border-warning/30',
  error: 'bg-error/15 text-error border border-error/30',
  team: 'border',
};

export function Chip({
  tone = 'neutral',
  leading,
  children,
  className,
  teamColor,
  style,
  ...rest
}: ChipProps) {
  const inlineStyle =
    tone === 'team' && teamColor
      ? {
          backgroundColor: `${teamColor}26`,
          borderColor: `${teamColor}66`,
          color: teamColor,
          ...style,
        }
      : style;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 h-6 px-2.5 text-caption font-medium rounded-full leading-none whitespace-nowrap',
        toneClasses[tone],
        className
      )}
      style={inlineStyle}
      {...rest}
    >
      {leading}
      {children}
    </span>
  );
}
