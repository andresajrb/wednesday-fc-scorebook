import { ArrowLeft, Share2, Trophy, ArrowRight } from 'lucide-react';
import { ScreenShell } from '@/components/primitives/ScreenShell';
import { IconButton } from '@/components/primitives/IconButton';
import { Header } from '@/components/primitives/Header';
import { Button } from '@/components/primitives/Button';
import { Avatar } from '@/components/primitives/Avatar';
import { useStore } from '@/store/useStore';
import {
  getStandings,
  getTopScorers,
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
  const state = useStore((s) => s.state);
  const jornada = state.jornadas[jornadaId];
  if (!jornada) {
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
  const topScorers = getTopScorers(state, jornadaId, 3);
  const winner = getJornadaWinnerTeam(state, jornadaId);
  const winnerStanding = standings.find((s) => s.team.id === winner?.id);

  const buildShareText = () => {
    const lines: string[] = [];
    lines.push(`⚽ Miércoles de Fútbol — ${formatDayShort(jornada.date)}`);
    lines.push('');
    if (winner && winnerStanding) {
      lines.push(`🏆 Equipo del día: ${winner.name} (${winnerStanding.pts} pts)`);
      lines.push('');
    }
    lines.push('Tabla:');
    for (const r of standings) {
      lines.push(`${r.team.name}: ${r.g}V ${r.e}E ${r.p}D · ${r.gf}-${r.gc} (${r.dif >= 0 ? '+' : ''}${r.dif}) · ${r.pts} pts`);
    }
    if (topScorers.length > 0) {
      lines.push('');
      lines.push('Goleadores:');
      for (let i = 0; i < topScorers.length; i++) {
        const s = topScorers[i];
        const medal = ['🥇', '🥈', '🥉'][i] ?? '•';
        lines.push(`${medal} ${s.player.name} (${s.team.name}) — ${s.goals}G`);
      }
    }
    return lines.join('\n');
  };

  const onShare = async () => {
    const text = buildShareText();
    const nav = navigator as Navigator & {
      share?: (data: ShareData) => Promise<void>;
    };
    if (typeof nav.share === 'function') {
      try {
        await nav.share({ title: 'Miércoles de Fútbol', text });
      } catch {
        // user cancelled
      }
      return;
    }
    if (nav.clipboard?.writeText) {
      try {
        await nav.clipboard.writeText(text);
        alert('Resumen copiado al portapapeles');
      } catch {
        // ignore
      }
    }
  };

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
                {winnerStanding.gf} goles · {winnerStanding.pts} pts
              </div>
            </div>
          </div>
        )}

        {/* Standings */}
        <section>
          <div className="text-caption uppercase tracking-wider text-text-2 font-semibold mb-2">
            Tabla
          </div>
          <div className="bg-bg-elev border border-border rounded-card overflow-hidden">
            <div
              className="grid items-center px-3 h-9 text-caption font-mono uppercase text-text-3 tracking-wider border-b border-border"
              style={{ gridTemplateColumns: '1.6fr repeat(6, 1fr)' }}
            >
              <span>Equipo</span>
              <span className="text-center">PJ</span>
              <span className="text-center">G</span>
              <span className="text-center">E</span>
              <span className="text-center">P</span>
              <span className="text-center">Dif</span>
              <span className="text-center">Pts</span>
            </div>
            {standings.map((row, idx) => {
              const isWinner = winner?.id === row.team.id && row.pj > 0;
              return (
                <div
                  key={row.team.id}
                  className={cn(
                    'grid items-center px-3 h-12 text-[13px] font-medium tnum border-t border-border',
                    idx === 0 && 'border-t-0'
                  )}
                  style={{
                    gridTemplateColumns: '1.6fr repeat(6, 1fr)',
                    backgroundColor: isWinner ? softColor(row.team.color, 0.12) : undefined,
                  }}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
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
                  <span className="text-center font-bold">{row.pts}</span>
                </div>
              );
            })}
          </div>
        </section>

        {/* Top scorers */}
        {topScorers.length > 0 && (
          <section>
            <div className="text-caption uppercase tracking-wider text-text-2 font-semibold mb-2">
              Goleadores
            </div>
            <div className="bg-bg-elev border border-border rounded-card divide-y divide-border">
              {topScorers.map((row, idx) => {
                const medal = ['🥇', '🥈', '🥉'][idx] ?? `#${idx + 1}`;
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

    </ScreenShell>
  );
}
