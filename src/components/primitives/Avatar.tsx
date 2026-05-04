import { readableTextColor } from '@/lib/colors';
import { cn } from '@/lib/cn';

interface AvatarProps {
  name: string;
  color?: string;
  size?: number;
  className?: string;
  dimmed?: boolean;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({ name, color, size = 36, className, dimmed }: AvatarProps) {
  const bg = color ?? '#333';
  const textColor = readableTextColor(bg);
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-full font-semibold flex-shrink-0',
        dimmed && 'opacity-50',
        className
      )}
      style={{
        width: size,
        height: size,
        backgroundColor: bg,
        color: textColor,
        fontSize: Math.round(size * 0.4),
        lineHeight: 1,
      }}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}
