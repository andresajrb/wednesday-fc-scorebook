import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';
import { lightenForText, softColor } from '@/lib/colors';

interface TeamCardProps {
  name: string;
  color: string;
  playerCount: number;
  guest?: boolean;
  onClick?: () => void;
  className?: string;
}

export function TeamCard({ name, color, playerCount, guest, onClick, className }: TeamCardProps) {
  const textColor = lightenForText(color);
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'aspect-[1.05/1] flex flex-col justify-between p-3.5 rounded-card border text-left active:scale-[0.98] transition-transform',
        className
      )}
      style={{
        backgroundColor: softColor(color, 0.16),
        borderColor: softColor(color, 0.3),
      }}
    >
      <div className="flex items-start justify-between">
        <span
          className="w-3.5 h-3.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: color }}
        />
        <ChevronRight size={16} className="text-text-3" strokeWidth={1.75} />
      </div>
      <div>
        <div
          className="text-caption uppercase tracking-wide font-semibold mb-1"
          style={{ color: textColor }}
        >
          {guest ? 'Invitado' : 'Equipo'}
        </div>
        <div className="text-[18px] font-bold leading-tight truncate" style={{ color: textColor }}>
          {name}
        </div>
        <div className="text-caption text-text-2 mt-1">
          {playerCount} {playerCount === 1 ? 'jugador' : 'jugadores'}
        </div>
      </div>
    </button>
  );
}
