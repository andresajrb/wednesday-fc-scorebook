import { useMemo, useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Trophy } from 'lucide-react';
import { ScreenShell } from '@/components/primitives/ScreenShell';
import { Header } from '@/components/primitives/Header';
import { IconButton } from '@/components/primitives/IconButton';
import { Avatar } from '@/components/primitives/Avatar';
import { StandingsTable } from '@/components/domain/StandingsTable';
import { useStore } from '@/store/useStore';
import { useScopedState } from '@/store/useScopedState';
import {
  firstJornadaDate,
  getPeriodTable,
  monthPeriod,
  seasonPeriod,
  shiftPeriod,
  type Period,
  type PeriodKind,
} from '@/store/season';
import { todayISODate } from '@/lib/format';
import { lightenForText, softColor } from '@/lib/colors';
import { cn } from '@/lib/cn';

const MEDALS = ['🥇', '🥈', '🥉'];
const MAX_SCORERS = 10;

/** Tabla acumulada de la competición activa: por mes y por temporada. */
export function TablaScreen() {
  const back = useStore((s) => s.back);
  const state = useScopedState();
  const competitionName = state.activeCompetitionId
    ? state.competitions[state.activeCompetitionId]?.name
    : undefined;
  const startMonth = state.config.seasonStartMonth ?? 1;
  const today = todayISODate();

  const [kind, setKind] = useState<PeriodKind>('month');
  const [offset, setOffset] = useState(0);

  const current: Period =
    kind === 'month' ? monthPeriod(today) : seasonPeriod(today, startMonth);
  const period = shiftPeriod(current, offset, startMonth);
  const table = useMemo(() => getPeriodTable(state, period, today), [state, period.start, period.end, today]);

  const first = firstJornadaDate(state);
  const canGoBack = first !== null && first < period.start;
  const canGoForward = offset < 0;

  const leader = table.standings[0];
  const hasLeader = !!leader && leader.pj > 0;
  const scorers = table.scorers.slice(0, MAX_SCORERS);

  const switchKind = (next: PeriodKind) => {
    setKind(next);
    setOffset(0);
  };

  return (
    <ScreenShell>
      <Header
        left={
          <IconButton ariaLabel="Volver" onClick={back}>
            <ArrowLeft size={20} strokeWidth={1.75} />
          </IconButton>
        }
        title="Tabla"
        subtitle={competitionName}
      />

      <div className="px-4 py-4 space-y-4 flex-1">
        <div className="grid grid-cols-2 rounded-btn border border-border overflow-hidden" role="tablist">
          {(['month', 'season'] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={kind === k}
              onClick={() => switchKind(k)}
              className={cn(
                'h-10 text-body-em font-semibold',
                kind === k ? 'bg-accent text-text-inv' : 'bg-bg-elev2 text-text-2'
              )}
            >
              {k === 'month' ? 'Mes' : 'Año'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <IconButton
            ariaLabel="Período anterior"
            onClick={() => setOffset((o) => o - 1)}
            disabled={!canGoBack}
            className="disabled:opacity-30"
          >
            <ChevronLeft size={20} strokeWidth={1.75} />
          </IconButton>
          <div className="flex-1 text-center">
            <div className="text-title font-bold tracking-tight" data-testid="period-label">
              {period.label}
            </div>
            <div className="text-caption text-text-2">
              {table.jornadas} {table.jornadas === 1 ? 'jornada' : 'jornadas'} · {table.matches}{' '}
              {table.matches === 1 ? 'partida' : 'partidas'}
            </div>
          </div>
          <IconButton
            ariaLabel="Período siguiente"
            onClick={() => setOffset((o) => o + 1)}
            disabled={!canGoForward}
            className="disabled:opacity-30"
          >
            <ChevronRight size={20} strokeWidth={1.75} />
          </IconButton>
        </div>

        {!hasLeader ? (
          <div className="text-center py-12">
            <div className="text-body-em font-semibold">Sin partidas en este período</div>
            <div className="text-caption text-text-2 mt-1">
              Las partidas terminadas de cada jornada se suman aquí.
            </div>
          </div>
        ) : (
          <>
            <div
              className="rounded-card p-4 border flex items-center gap-3"
              data-testid="period-leader"
              style={{
                background: `linear-gradient(135deg, ${softColor(leader.team.color, 0.26)} 0%, transparent 80%), #161616`,
                borderColor: softColor(leader.team.color, 0.4),
              }}
            >
              <Trophy size={28} strokeWidth={1.75} style={{ color: lightenForText(leader.team.color) }} />
              <div className="flex-1 min-w-0">
                <div
                  className="text-caption uppercase tracking-wider font-bold"
                  style={{ color: lightenForText(leader.team.color) }}
                >
                  {table.finished
                    ? kind === 'month'
                      ? 'Campeón del mes'
                      : 'Campeón de la temporada'
                    : 'Va ganando'}
                </div>
                <div className="text-[26px] font-bold leading-tight truncate">{leader.team.name}</div>
                <div className="text-caption text-text-2">
                  {leader.pts} pts · {leader.g} {leader.g === 1 ? 'victoria' : 'victorias'} ·{' '}
                  {leader.jornadasWon} {leader.jornadasWon === 1 ? 'jornada ganada' : 'jornadas ganadas'}
                </div>
              </div>
            </div>

            <section>
              <div className="text-caption uppercase tracking-wider text-text-2 font-semibold mb-2">
                Equipos
              </div>
              <StandingsTable rows={table.standings} highlightTeamId={leader.team.id} showJornadasWon />
              <p className="text-caption text-text-3 mt-2">
                JG: jornadas ganadas. Desempate: diferencia de gol y después jornadas ganadas.
              </p>
            </section>

            {scorers.length > 0 && (
              <section>
                <div className="text-caption uppercase tracking-wider text-text-2 font-semibold mb-2">
                  Goleadores
                </div>
                <div
                  className="bg-bg-elev border border-border rounded-card divide-y divide-border"
                  data-testid="period-scorers"
                >
                  {scorers.map((row) => (
                    <div key={row.player.id} className="flex items-center gap-3 px-3 py-2.5">
                      <span className="w-6 text-center text-[16px]" aria-hidden="true">
                        {MEDALS[row.rank - 1] ?? <span className="font-mono text-caption text-text-3">{row.rank}</span>}
                      </span>
                      <Avatar
                        name={row.player.name}
                        color={row.team.color}
                        size={32}
                        dimmed={!row.player.active}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-body-em font-semibold truncate">{row.player.name}</div>
                        <div
                          className="text-caption truncate"
                          style={{ color: lightenForText(row.team.color) }}
                        >
                          {row.team.name}
                          {!row.player.active && <span className="text-text-3"> · inactivo</span>}
                        </div>
                      </div>
                      <div className="font-mono tnum text-[22px] font-bold">{row.goals}</div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </ScreenShell>
  );
}
