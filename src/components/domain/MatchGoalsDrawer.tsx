import { Trash2, ShieldPlus } from 'lucide-react';
import { BottomSheet } from '@/components/primitives/BottomSheet';
import { Avatar } from '@/components/primitives/Avatar';
import { softColor, readableTextColor } from '@/lib/colors';
import type { Goal, ID, Match, Player, Team } from '@/types/domain';

interface MatchGoalsDrawerProps {
  open: boolean;
  onClose: () => void;
  match: Match;
  goals: Goal[];
  teamA: Team;
  teamB: Team;
  players: Record<ID, Player>;
  onStartReassign: (goalId: ID) => void;
  onRemove: (goalId: ID) => void;
}

function formatMatchTime(goalCreatedAt: string, matchStartedAt: string): string {
  const elapsedMs = new Date(goalCreatedAt).getTime() - new Date(matchStartedAt).getTime();
  const totalSec = Math.max(0, Math.floor(elapsedMs / 1000));
  const m = Math.floor(totalSec / 60).toString().padStart(2, '0');
  const s = (totalSec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export function MatchGoalsDrawer({
  open,
  onClose,
  match,
  goals,
  teamA,
  teamB,
  players,
  onStartReassign,
  onRemove,
}: MatchGoalsDrawerProps) {
  const orderedDesc = [...goals].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  // El minuto del gol se calcula desde el arranque del reloj. Si no está, fallback a startedAt.
  const clockStart = match.clockStartedAt ?? match.startedAt;

  return (
    <BottomSheet open={open} onClose={onClose} title="Historial de goles">
      {orderedDesc.length === 0 ? (
        <div className="py-8 text-center text-caption text-text-3">
          Aún no hay goles registrados en este partido.
        </div>
      ) : (
        <ul className="flex flex-col">
          {orderedDesc.map((goal) => {
            const isTeamA = goal.scoringForTeamId === teamA.id;
            const team = isTeamA ? teamA : teamB;
            const player = goal.playerId ? players[goal.playerId] : undefined;
            const minute = formatMatchTime(goal.createdAt, clockStart);
            return (
              <li key={goal.id} className="flex items-center gap-2 py-2 border-b border-border last:border-0">
                <span className="text-caption text-text-3 font-mono tnum w-12 flex-shrink-0">
                  {minute}
                </span>
                <button
                  type="button"
                  onClick={() => onStartReassign(goal.id)}
                  className="flex-1 min-w-0 flex items-center gap-2 active:bg-bg-elev rounded-md px-1 py-1 text-left"
                >
                  {player ? (
                    <Avatar
                      name={player.name}
                      color={goal.isLoaned ? '#525252' : team.color}
                      size={28}
                    />
                  ) : (
                    <span
                      className="inline-flex items-center justify-center w-7 h-7 rounded-full flex-shrink-0"
                      style={{
                        backgroundColor: softColor(team.color, 0.25),
                        color: readableTextColor(team.color),
                      }}
                    >
                      <ShieldPlus size={14} strokeWidth={1.75} />
                    </span>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-body-em font-semibold truncate">
                      {player ? player.name : `${team.name} (sin asignar)`}
                    </div>
                    <div className="text-caption text-text-3 truncate">
                      {team.name}
                      {goal.isLoaned && ' · prestado'}
                    </div>
                  </div>
                  <span className="text-caption text-accent">Reasignar</span>
                </button>
                <button
                  type="button"
                  onClick={() => onRemove(goal.id)}
                  aria-label="Eliminar gol"
                  className="w-9 h-9 rounded-md flex items-center justify-center text-error active:bg-error/15 flex-shrink-0"
                >
                  <Trash2 size={16} strokeWidth={1.75} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </BottomSheet>
  );
}
