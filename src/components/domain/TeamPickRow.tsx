import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { Team } from '@/types/domain';

interface TeamPickRowProps {
  team: Team;
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
  bordered?: boolean;
  trailing?: ReactNode;
}

export function TeamPickRow({ team, selected, disabled, onClick, bordered, trailing }: TeamPickRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={cn(
        'w-full flex items-center gap-3 px-3 h-14 text-left active:bg-bg-elev2 disabled:opacity-40',
        bordered && 'border-t border-border'
      )}
    >
      <span
        className="w-4 h-4 rounded-full flex-shrink-0 ring-1 ring-white/25"
        style={{ backgroundColor: team.color }}
      />
      <span className="flex-1 min-w-0 flex items-center gap-2">
        <span className="text-body-em font-semibold truncate">{team.name}</span>
        {team.kind === 'guest' && <GuestBadge />}
      </span>
      {trailing}
      <span
        className={cn(
          'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 border',
          selected ? 'bg-accent text-text-inv border-accent' : 'border-border-strong text-transparent'
        )}
        aria-hidden="true"
      >
        <Check size={16} strokeWidth={2.5} />
      </span>
    </button>
  );
}

export function GuestBadge() {
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wide bg-bg-elev2 border border-border text-text-2 flex-shrink-0">
      Invitado
    </span>
  );
}
