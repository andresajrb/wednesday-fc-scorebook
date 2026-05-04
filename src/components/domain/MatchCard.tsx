import type { Match, Team } from '@/types/domain';
import { cn } from '@/lib/cn';
import { lightenForText } from '@/lib/colors';

interface MatchCardProps {
  match: Match;
  teamA: Team;
  teamB: Team;
  goalsA: number;
  goalsB: number;
  scorersText?: string;
  onClick?: () => void;
}

export function MatchCard({
  match,
  teamA,
  teamB,
  goalsA,
  goalsB,
  scorersText,
  onClick,
}: MatchCardProps) {
  const winner = match.result;
  const isDraw = winner === 'draw';
  const dimA = winner === 'B';
  const dimB = winner === 'A';
  const live = match.result === null;

  const winnerLabel = isDraw
    ? 'Empate'
    : winner === 'A'
      ? `Ganó ${teamA.name}`
      : winner === 'B'
        ? `Ganó ${teamB.name}`
        : 'En curso';

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full text-left bg-bg-elev border border-border rounded-card p-3.5 active:bg-bg-elev2 transition relative'
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-caption text-text-3 uppercase tracking-wide">#{match.order}</span>
        {live && (
          <span className="inline-flex items-center gap-1.5 text-caption text-accent">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse-dot" />
            En curso
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <div className={cn('flex-1 min-w-0', dimA && 'opacity-45')}>
          <div className="flex items-center gap-2">
            <span
              className="w-2.5 h-7 rounded-[3px] flex-shrink-0"
              style={{ backgroundColor: teamA.color }}
            />
            <div className="min-w-0">
              <div className="text-caption text-text-3 uppercase tracking-wide leading-none">
                Equipo
              </div>
              <div className="text-[14px] font-semibold leading-tight truncate">{teamA.name}</div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 font-mono tnum text-[26px] font-bold leading-none">
          <span style={{ color: lightenForText(teamA.color), opacity: dimA ? 0.45 : 1 }}>
            {goalsA}
          </span>
          <span className="text-text-3 text-[18px]">—</span>
          <span style={{ color: lightenForText(teamB.color), opacity: dimB ? 0.45 : 1 }}>
            {goalsB}
          </span>
        </div>
        <div className={cn('flex-1 min-w-0 text-right', dimB && 'opacity-45')}>
          <div className="flex items-center gap-2 justify-end">
            <div className="min-w-0">
              <div className="text-caption text-text-3 uppercase tracking-wide leading-none">
                Equipo
              </div>
              <div className="text-[14px] font-semibold leading-tight truncate">{teamB.name}</div>
            </div>
            <span
              className="w-2.5 h-7 rounded-[3px] flex-shrink-0"
              style={{ backgroundColor: teamB.color }}
            />
          </div>
        </div>
      </div>
      <div className="mt-3 pt-2.5 border-t border-border flex items-center justify-between gap-3">
        <span className="text-caption text-text-2 truncate">{scorersText || '—'}</span>
        <span className="text-caption text-text-2 flex-shrink-0">{winnerLabel}</span>
      </div>
    </button>
  );
}
