import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface StickyBottomCTAProps {
  children: ReactNode;
  className?: string;
}

export function StickyBottomCTA({ children, className }: StickyBottomCTAProps) {
  return (
    <div
      className={cn(
        'sticky bottom-0 left-0 right-0 z-20 px-4 pt-6 bg-gradient-to-t from-bg via-bg/90 to-transparent pointer-events-none',
        className
      )}
      style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
    >
      <div className="pointer-events-auto">{children}</div>
    </div>
  );
}
