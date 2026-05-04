import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padded?: boolean;
  accent?: string;
  children?: ReactNode;
}

export function Card({ padded = true, accent, className, style, children, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        'bg-bg-elev rounded-card border border-border',
        padded && 'p-4',
        className
      )}
      style={accent ? { borderColor: accent, ...style } : style}
      {...rest}
    >
      {children}
    </div>
  );
}
