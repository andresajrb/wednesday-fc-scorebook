import { cn } from '@/lib/cn';

interface TeamSwatchProps {
  color: string;
  size?: number;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
  ariaLabel?: string;
}

export function TeamSwatch({
  color,
  size = 36,
  selected,
  onClick,
  className,
  ariaLabel,
}: TeamSwatchProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      aria-pressed={selected}
      className={cn(
        'relative rounded-full transition-transform active:scale-90 flex-shrink-0',
        selected && 'ring-2 ring-accent ring-offset-2 ring-offset-bg',
        className
      )}
      style={{ width: size, height: size, backgroundColor: color }}
    />
  );
}
