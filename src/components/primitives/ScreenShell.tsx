import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface ScreenShellProps {
  children: ReactNode;
  className?: string;
}

export function ScreenShell({ children, className }: ScreenShellProps) {
  return (
    <div
      className={cn(
        'min-h-dvh bg-bg flex flex-col w-full max-w-md mx-auto relative',
        className
      )}
    >
      {children}
    </div>
  );
}
