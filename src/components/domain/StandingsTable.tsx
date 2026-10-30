import type { TeamStandingRow } from '@/store/selectors';
import { softColor } from '@/lib/colors';
import { cn } from '@/lib/cn';
import type { ID } from '@/types/domain';

interface StandingsTableProps {
  rows: Array<TeamStandingRow & { jornadasWon?: number }>;
  highlightTeamId?: ID | null;
  /** Columna JG: jornadas en las que fue "equipo del día" (tabla de mes o temporada). */
  showJornadasWon?: boolean;
}

export function StandingsTable({ rows, highlightTeamId, showJornadasWon }: StandingsTableProps) {
  const COLUMNS = showJornadasWon ? '1.4fr repeat(7, 1fr)' : '1.6fr repeat(6, 1fr)';
  return (
    <div className="bg-bg-elev border border-border rounded-card overflow-hidden">
      <div
        className="grid items-center px-3 h-9 text-caption font-mono uppercase text-text-3 tracking-wider border-b border-border"
        style={{ gridTemplateColumns: COLUMNS }}
      >
        <span>Equipo</span>
        <span className="text-center">PJ</span>
        <span className="text-center">G</span>
        <span className="text-center">E</span>
        <span className="text-center">P</span>
        <span className="text-center">Dif</span>
        {showJornadasWon && (
          <span className="text-center" title="Jornadas ganadas">
            JG
          </span>
        )}
        <span className="text-center">Pts</span>
      </div>
      {rows.map((row, idx) => {
        const highlighted = highlightTeamId === row.team.id && row.pj > 0;
        return (
          <div
            key={row.team.id}
            className={cn(
              'grid items-center px-3 h-12 text-[13px] font-medium tnum border-t border-border',
              idx === 0 && 'border-t-0'
            )}
            style={{
              gridTemplateColumns: COLUMNS,
              backgroundColor: highlighted ? softColor(row.team.color, 0.12) : undefined,
            }}
          >
            <span className="flex items-center gap-2 min-w-0">
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0 ring-1 ring-white/25"
                style={{ backgroundColor: row.team.color }}
              />
              <span className="truncate">{row.team.name}</span>
            </span>
            <span className="text-center">{row.pj}</span>
            <span className="text-center">{row.g}</span>
            <span className="text-center">{row.e}</span>
            <span className="text-center">{row.p}</span>
            <span
              className={cn(
                'text-center',
                row.dif > 0 && 'text-success',
                row.dif < 0 && 'text-error',
                row.dif === 0 && 'text-text-2'
              )}
            >
              {row.dif > 0 ? '+' : ''}
              {row.dif}
            </span>
            {showJornadasWon && <span className="text-center">{row.jornadasWon ?? 0}</span>}
            <span className="text-center font-bold">{row.pts}</span>
          </div>
        );
      })}
    </div>
  );
}
