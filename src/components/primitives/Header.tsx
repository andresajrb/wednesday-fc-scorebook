import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface HeaderProps {
  left?: ReactNode;
  title?: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
  className?: string;
  centered?: boolean;
}

export function Header({ left, title, subtitle, right, className, centered = true }: HeaderProps) {
  return (
    <header
      className={cn(
        'sticky top-0 z-30 backdrop-blur-md bg-bg/85 border-b border-border min-h-14 px-4 py-2.5 flex items-center gap-2',
        className
      )}
    >
      <div className="w-9 flex items-center justify-start flex-shrink-0">{left}</div>
      <div
        className={cn(
          'flex-1 min-w-0',
          centered ? 'text-center' : 'text-left'
        )}
      >
        {title && (
          <div className="text-[15px] font-semibold leading-tight truncate">{title}</div>
        )}
        {subtitle && (
          <div className="text-caption text-text-2 leading-tight truncate">{subtitle}</div>
        )}
      </div>
      <div className="w-9 flex items-center justify-end flex-shrink-0">{right}</div>
    </header>
  );
}
