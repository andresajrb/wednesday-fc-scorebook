import { useState } from 'react';
import { ChevronDown, Table2 } from 'lucide-react';
import { StandingsTable } from '@/components/domain/StandingsTable';
import { useScopedState } from '@/store/useScopedState';
import { getJornadaWinnerTeam, getStandings, getTopScorers } from '@/store/selectors';
import { cn } from '@/lib/cn';
import type { ID } from '@/types/domain';

const OPEN_KEY = 'miercoles-ui:live-table-open';

function readOpen(): boolean {
  try {
    return localStorage.getItem(OPEN_KEY) === '1';
  } catch {
    return false;
  }
}

function writeOpen(open: boolean): void {
  try {
    localStorage.setItem(OPEN_KEY, open ? '1' : '0');
  } catch {
    // Preferencia visual: si no se puede guardar, no pasa nada.
  }
}

/** Tabla y goleadores de la jornada en curso. Cerrada por defecto para no tapar la cancha. */
export function LiveStandings({ jornadaId }: { jornadaId: ID }) {
  const state = useScopedState();
  const [open, setOpen] = useState(readOpen);

  const standings = getStandings(state, jornadaId);
  const scorers = getTopScorers(state, jornadaId, 5);
  const leader = getJornadaWinnerTeam(state, jornadaId);

  const toggle = () => {
    setOpen((prev) => {
      writeOpen(!prev);
      return !prev;
    });
  };

  return (
    <section>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="w-full flex items-center gap-2 py-2 text-text-2"
      >
        <Table2 size={16} strokeWidth={1.75} />
        <span className="text-caption uppercase tracking-wider font-semibold flex-1 text-left">
          Tabla del día
        </span>
        {!open && leader && (
          <span className="text-caption truncate">
            Va ganando <span className="font-semibold text-text">{leader.name}</span>
          </span>
        )}
        <ChevronDown
          size={18}
          strokeWidth={1.75}
          className={cn('transition-transform flex-shrink-0', open && 'rotate-180')}
        />
      </button>
      {open && (
        <div className="space-y-3 animate-fade-in" data-testid="live-table">
          <StandingsTable rows={standings} highlightTeamId={leader?.id} />
          {scorers.length > 0 && (
            <div className="bg-bg-elev border border-border rounded-card divide-y divide-border">
              {scorers.map((row, idx) => (
                <div key={row.player.id} className="flex items-center gap-3 px-3 h-10 text-[13px]">
                  <span className="font-mono text-text-3 w-4">{idx + 1}</span>
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0 ring-1 ring-white/25"
                    style={{ backgroundColor: row.team.color }}
                  />
                  <span className="flex-1 truncate font-medium">{row.player.name}</span>
                  <span className="font-mono tnum font-bold">{row.goals}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
