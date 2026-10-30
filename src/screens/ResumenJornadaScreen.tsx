import { useMemo, useState } from 'react';
import { ArrowLeft, Share2, Trophy, ArrowRight } from 'lucide-react';
import { ScreenShell } from '@/components/primitives/ScreenShell';
import { IconButton } from '@/components/primitives/IconButton';
import { Header } from '@/components/primitives/Header';
import { Button } from '@/components/primitives/Button';
import { Avatar } from '@/components/primitives/Avatar';
import { StandingsTable } from '@/components/domain/StandingsTable';
import { ShareSheet } from '@/components/domain/ShareSheet';
import { getJornadaReport } from '@/lib/jornadaReport';
import { useStore } from '@/store/useStore';
import { useScopedState } from '@/store/useScopedState';
import {
  getStandings,
  getJornadaWinnerTeam,
  getMatchesForJornada,
  getMatchScore,
} from '@/store/selectors';
import { formatDayShort } from '@/lib/format';
import { lightenForText, softColor } from '@/lib/colors';
import type { ID } from '@/types/domain';
import { cn } from '@/lib/cn';

interface ResumenJornadaScreenProps {
  jornadaId: ID;
}

export function ResumenJornadaScreen({ jornadaId }: ResumenJornadaScreenProps) {
  const back = useStore((s) => s.back);
  const navigate = useStore((s) => s.navigate);
  const state = useScopedState();
  const jornada = state.jornadas[jornadaId];
  const report = useMemo(() => getJornadaReport(state, jornadaId), [state, jornadaId]);
  const [shareOpen, setShareOpen] = useState(false);
  if (!jornada || !report) {
    return (
      <ScreenShell>
        <Header
          left={
            <IconButton ariaLabel="Volver" onClick={back}>
              <ArrowLeft size={20} strokeWidth={1.75} />
            </IconButton>
          }
          title="Resumen"
        />
        <div className="p-6 text-center text-text-2">Jornada no encontrada.</div>
      </ScreenShell>
    );
  }

  const matches = getMatchesForJornada(state, jornadaId).filter((m) => m.endedAt);
  const standings = getStandings(state, jornadaId);
  // Mismo ranking que el texto y la imagen: los empatados comparten medalla.
  const topScorers = report.scorers.slice(0, 3);
  const winner = getJornadaWinnerTeam(state, jornadaId);
  const winnerStanding = standings.find((s) => s.team.id === winner?.id);

  const onShare = () => setShareOpen(true);

  const isClosed = jornada.status === 'closed';

  return (
    <ScreenShell>
      <Header
        left={
          <IconButton ariaLabel="Volver" onClick={back}>
            <ArrowLeft size={20} strokeWidth={1.75} />
          </IconButton>
        }
        title="Resumen"
        subtitle={`${formatDayShort(jornada.date)} · ${matches.length} partidas`}
        right={
          <IconButton ariaLabel="Compartir" onClick={onShare}>
            <Share2 size={18} strokeWidth={1.75} />
          </IconButton>
        }
      />

      <div className="px-4 py-4 space-y-5 flex-1">
        {/* Winner card */}
        {winner && winnerStanding && winnerStanding.pj > 0 && (
          <div
            className="relative rounded-card p-5 border overflow-hidden"
            style={{
              background: `linear-gradient(135deg, ${softColor(winner.color, 0.28)} 0%, transparent 75%), #161616`,
              borderColor: softColor(winner.color, 0.4),
            }}
          >
            <Trophy
              size={140}
              strokeWidth={1.5}
              className="absolute -right-6 -top-6 pointer-events-none"
              style={{ color: winner.color, opacity: 0.08 }}
            />
            <div className="relative">
              <div className="inline-flex items-center gap-1.5 mb-2">
                <Trophy size={14} strokeWidth={2} style={{ color: lightenForText(winner.color) }} />
                <span
                  className="text-caption uppercase tracking-wider font-bold"
                  style={{ color: lightenForText(winner.color) }}
                >
                  Equipo del día
                </span>
              </div>
              <div
                className="text-[44px] font-bold leading-none tracking-tight"
                style={{ color: lightenForText(winner.color) }}
              >
                {winner.name}
              </div>
              <div className="text-body text-text-2 mt-2 font-medium">
                {winnerStanding.g} {winnerStanding.g === 1 ? 'victoria' : 'victorias'} ·{' '}
                {winnerStanding.gf} {winnerStanding.gf === 1 ? 'gol' : 'goles'} · {winnerStanding.pts} pts
              </div>
            </div>
          </div>
        )}

        {/* Standings */}
        <section>
          <div className="text-caption uppercase tracking-wider text-text-2 font-semibold mb-2">
            Tabla
          </div>
          <StandingsTable rows={standings} highlightTeamId={winner?.id} />
        </section>

        {/* Top scorers */}
        {topScorers.length > 0 && (
          <section>
            <div className="text-caption uppercase tracking-wider text-text-2 font-semibold mb-2">
              Goleadores
            </div>
            <div className="bg-bg-elev border border-border rounded-card divide-y divide-border">
              {topScorers.map((row) => {
                const medal = ['🥇', '🥈', '🥉'][row.rank - 1] ?? `#${row.rank}`;
                return (
                  <div key={row.player.id} className="flex items-center gap-3 p-3">
                    <div className="relative">
                      <Avatar name={row.player.name} color={row.team.color} size={48} />
                      <span
                        className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-[14px] bg-bg-elev2 border border-border"
                        aria-hidden="true"
                      >
                        {medal}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-body-em font-semibold truncate">{row.player.name}</div>
                      <div
                        className="text-caption font-medium truncate"
                        style={{ color: lightenForText(row.team.color) }}
                      >
                        {row.team.name}
                      </div>
                    </div>
                    <div className="font-mono tnum text-[28px] font-bold leading-none">
                      {row.goals}
                      <span className="text-caption text-text-3 font-normal ml-1">G</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Matches list */}
        {matches.length > 0 && (
          <section>
            <div className="text-caption uppercase tracking-wider text-text-2 font-semibold mb-2">
              Partidas
            </div>
            <div className="bg-bg-elev border border-border rounded-card overflow-hidden">
              {matches.map((m, idx) => {
                const tA = state.teams[m.teamAId];
                const tB = state.teams[m.teamBId];
                if (!tA || !tB) return null;
                const { goalsA, goalsB } = getMatchScore(state, m.id);
                const winLabel =
                  m.result === 'A'
                    ? tA.name
                    : m.result === 'B'
                      ? tB.name
                      : 'Empate';
                return (
                  <div
                    key={m.id}
                    className={cn(
                      'flex items-center gap-3 p-3 text-[13px]',
                      idx > 0 && 'border-t border-border'
                    )}
                  >
                    <span className="text-text-3 font-mono w-6">#{m.order}</span>
                    <span className="flex-1 truncate">
                      {tA.name}{' '}
                      <span className="font-bold tnum">{goalsA}</span>
                      <span className="text-text-3"> — </span>
                      <span className="font-bold tnum">{goalsB}</span> {tB.name}
                    </span>
                    <span
                      className="text-caption font-medium px-2 py-0.5 rounded"
                      style={{
                        backgroundColor:
                          m.result === 'A'
                            ? softColor(tA.color, 0.16)
                            : m.result === 'B'
                              ? softColor(tB.color, 0.16)
                              : '#1f1f1f',
                        color:
                          m.result === 'A'
                            ? lightenForText(tA.color)
                            : m.result === 'B'
                              ? lightenForText(tB.color)
                              : '#a1a1a1',
                      }}
                    >
                      {winLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {matches.length === 0 && (
          <div className="text-center py-12">
            <div className="text-body-em font-semibold">Sin partidas terminadas</div>
            <div className="text-caption text-text-2 mt-1">
              No hubo partidas finalizadas en esta jornada.
            </div>
          </div>
        )}
      </div>

      <div
        className="sticky bottom-0 left-0 right-0 px-4 pt-6 bg-gradient-to-t from-bg via-bg/90 to-transparent space-y-2"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        <Button
          size="xl"
          fullWidth
          leading={<Share2 size={18} strokeWidth={1.75} />}
          onClick={onShare}
        >
          Compartir resumen
        </Button>
        {!isClosed ? (
          <Button
            size="lg"
            variant="ghost"
            fullWidth
            trailing={<ArrowRight size={16} strokeWidth={1.75} />}
            onClick={() => navigate({ name: 'jornada-active', jornadaId })}
          >
            Volver a la jornada
          </Button>
        ) : (
          <Button
            size="lg"
            variant="ghost"
            fullWidth
            onClick={() => navigate({ name: 'home' })}
          >
            Volver al inicio
          </Button>
        )}
      </div>

      <ShareSheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        report={report}
        fileStem={`miercoles-${jornada.date}`}
      />
    </ScreenShell>
  );
}
