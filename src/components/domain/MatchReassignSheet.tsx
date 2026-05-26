import { ShieldPlus } from 'lucide-react';
import { BottomSheet } from '@/components/primitives/BottomSheet';
import { Avatar } from '@/components/primitives/Avatar';
import { softColor, readableTextColor } from '@/lib/colors';
import type { ID, MatchRosterEntry, Player, Team } from '@/types/domain';

export type ReassignPick =
  | { kind: 'team'; scoringForTeamId: ID }
  | { kind: 'player'; playerId: ID; scoringForTeamId: ID; isLoaned: boolean };

interface MatchReassignSheetProps {
  open: boolean;
  onClose: () => void;
  teamA: Team;
  teamB: Team;
  rosterA: Array<{ entry: MatchRosterEntry; player: Player }>;
  rosterB: Array<{ entry: MatchRosterEntry; player: Player }>;
  onPick: (pick: ReassignPick) => void;
}

export function MatchReassignSheet({
  open,
  onClose,
  teamA,
  teamB,
  rosterA,
  rosterB,
  onPick,
}: MatchReassignSheetProps) {
  return (
    <BottomSheet open={open} onClose={onClose} title="Reasignar gol a...">
      <div className="space-y-4 pb-2">
        <TeamSection
          team={teamA}
          roster={rosterA}
          onPickTeam={() => onPick({ kind: 'team', scoringForTeamId: teamA.id })}
          onPickPlayer={(player, entry) =>
            onPick({
              kind: 'player',
              playerId: player.id,
              scoringForTeamId: teamA.id,
              isLoaned: !!entry.borrowedFromTeamId,
            })
          }
        />
        <TeamSection
          team={teamB}
          roster={rosterB}
          onPickTeam={() => onPick({ kind: 'team', scoringForTeamId: teamB.id })}
          onPickPlayer={(player, entry) =>
            onPick({
              kind: 'player',
              playerId: player.id,
              scoringForTeamId: teamB.id,
              isLoaned: !!entry.borrowedFromTeamId,
            })
          }
        />
      </div>
    </BottomSheet>
  );
}

function TeamSection({
  team,
  roster,
  onPickTeam,
  onPickPlayer,
}: {
  team: Team;
  roster: Array<{ entry: MatchRosterEntry; player: Player }>;
  onPickTeam: () => void;
  onPickPlayer: (player: Player, entry: MatchRosterEntry) => void;
}) {
  return (
    <div>
      <div className="text-caption text-text-2 uppercase tracking-wide mb-2">{team.name}</div>
      <button
        type="button"
        onClick={onPickTeam}
        className="w-full flex items-center gap-2 px-2 py-2.5 active:bg-bg-elev rounded-md text-left"
      >
        <span
          className="inline-flex items-center justify-center w-7 h-7 rounded-full flex-shrink-0"
          style={{
            backgroundColor: softColor(team.color, 0.25),
            color: readableTextColor(team.color),
          }}
        >
          <ShieldPlus size={14} strokeWidth={1.75} />
        </span>
        <span className="text-body-em font-medium">Sin asignar al equipo</span>
      </button>
      {roster.map(({ entry, player }) => {
        const isLoaned = !!entry.borrowedFromTeamId;
        return (
          <button
            key={player.id}
            type="button"
            onClick={() => onPickPlayer(player, entry)}
            className="w-full flex items-center gap-2 px-2 py-2.5 active:bg-bg-elev rounded-md text-left"
          >
            <Avatar name={player.name} color={isLoaned ? '#525252' : team.color} size={28} />
            <div className="flex-1 min-w-0">
              <div className="text-body-em font-semibold truncate">{player.name}</div>
              {isLoaned && (
                <div className="text-caption text-text-3 truncate">Prestado</div>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
