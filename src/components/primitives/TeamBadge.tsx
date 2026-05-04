import { cn } from '@/lib/cn';

interface TeamBadgeProps {
  color: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  label?: string;
}

const sizes = {
  sm: 'w-2.5 h-2.5',
  md: 'w-3.5 h-3.5',
  lg: 'w-4 h-4',
};

export function TeamBadge({ color, size = 'md', className, label }: TeamBadgeProps) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <span
        className={cn('rounded-full flex-shrink-0 ring-1 ring-white/10', sizes[size])}
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
      {label && <span className="text-text-2 text-caption uppercase tracking-wide">{label}</span>}
    </span>
  );
}
