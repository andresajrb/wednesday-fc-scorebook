import { useState } from 'react';
import { Settings, Play, ArrowRight, Trophy, ChevronRight, Plus } from 'lucide-react';
import { ScreenShell } from '@/components/primitives/ScreenShell';
import { Button } from '@/components/primitives/Button';
import { IconButton } from '@/components/primitives/IconButton';
import { Logo } from '@/components/primitives/Logo';
import { TeamCard } from '@/components/domain/TeamCard';
import { TeamFormSheet } from '@/components/domain/TeamFormSheet';
import { useStore } from '@/store/useStore';
import {
  getOpenJornada,
  getActivePlayersByTeam,
  getClosedJornadasDesc,
  getJornadaWinnerTeam,
  getMatchesForJornada,
  getSortedTeams,
} from '@/store/selectors';
import { formatDayShort, formatRelative } from '@/lib/format';
import { softColor, lightenForText } from '@/lib/colors';

export function HomeScreen() {
  const state = useStore((s) => s.state);
  const navigate = useStore((s) => s.navigate);
  const open = getOpenJornada(state);
  const teams = getSortedTeams(state);
  const [creatingTeam, setCreatingTeam] = useState(false);
  const closed = getClosedJornadasDesc(state).slice(0, 5);

  const onStartOrContinue = () => {
    if (open) {
      navigate({ name: 'jornada-active', jornadaId: open.id });
    } else {
      navigate({ name: 'jornada-setup' });
    }
  };

  return (
    <ScreenShell>
      <header className="sticky top-0 z-30 backdrop-blur-md bg-bg/85 border-b border-border px-4 py-2.5 flex items-center gap-3">
        <Logo size={32} className="text-accent flex-shrink-0" />
        <h1 className="text-[22px] font-bold tracking-tight flex-1">Miércoles</h1>
        <IconButton ariaLabel="Configuración" onClick={() => navigate({ name: 'settings' })}>
          <Settings size={20} strokeWidth={1.75} />
        </IconButton>
      </header>

      <div className="px-4 py-4 space-y-6 flex-1">
        {open ? (
          <button
            type="button"
            onClick={onStartOrContinue}
            className="w-full text-left rounded-card p-4 border border-accent/40 bg-accent-soft active:scale-[0.99] transition"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full bg-accent animate-pulse-dot shadow-[0_0_8px_rgba(190,242,100,0.6)]" />
              <span className="text-caption uppercase tracking-wider font-semibold text-accent">
                En curso
              </span>
            </div>
            <div className="text-title font-bold tracking-tight">Jornada de hoy</div>
            <div className="text-caption text-text-2 mt-1">
              {getMatchesForJornada(state, open.id).length} partidas · iniciada hace{' '}
              {formatRelative(open.createdAt)}
            </div>
            <div className="mt-4">
              <Button size="lg" fullWidth trailing={<ArrowRight size={18} strokeWidth={1.75} />}>
                Continuar
              </Button>
            </div>
          </button>
        ) : (
          <div className="rounded-card p-4 border border-border bg-bg-elev">
            <div className="text-title font-bold tracking-tight">¿Listo para jugar?</div>
            <div className="text-caption text-text-2 mt-1">Inicia una nueva jornada para hoy.</div>
            <div className="mt-4">
              <Button
                size="xl"
                fullWidth
                leading={<Play size={18} strokeWidth={1.75} fill="currentColor" />}
                onClick={onStartOrContinue}
              >
                Iniciar jornada de hoy
              </Button>
            </div>
          </div>
        )}

        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-caption uppercase tracking-wider text-text-2 font-semibold">
              Equipos
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {teams.map((t) => (
              <TeamCard
                key={t.id}
                name={t.name}
                color={t.color}
                playerCount={getActivePlayersByTeam(state, t.id).length}
                guest={t.kind === 'guest'}
                onClick={() => navigate({ name: 'team-detail', teamId: t.id })}
              />
            ))}
            <button
              type="button"
              onClick={() => setCreatingTeam(true)}
              className="aspect-[1.05/1] flex flex-col items-center justify-center gap-2 p-3.5 rounded-card border border-dashed border-border-strong text-text-2 active:scale-[0.98] transition-transform"
            >
              <Plus size={22} strokeWidth={1.75} />
              <span className="text-body-em font-medium">Nuevo equipo</span>
            </button>
          </div>
        </section>

        <section>
          <h2 className="text-caption uppercase tracking-wider text-text-2 font-semibold mb-2">
            Últimas jornadas
          </h2>
          {closed.length === 0 ? (
            <div className="text-caption text-text-3 italic py-3">Aún no hay jornadas cerradas.</div>
          ) : (
            <div className="bg-bg-elev border border-border rounded-card overflow-hidden">
              {closed.map((j, idx) => {
                const winner = getJornadaWinnerTeam(state, j.id);
                const matches = getMatchesForJornada(state, j.id);
                return (
                  <button
                    type="button"
                    key={j.id}
                    onClick={() => navigate({ name: 'summary', jornadaId: j.id })}
                    className={`w-full flex items-center gap-3 p-3 active:bg-bg-elev2 ${idx > 0 ? 'border-t border-border' : ''}`}
                  >
                    <span
                      className="w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0"
                      style={{
                        backgroundColor: winner ? softColor(winner.color, 0.18) : '#1f1f1f',
                        color: winner ? lightenForText(winner.color) : '#a1a1a1',
                      }}
                    >
                      <Trophy size={18} strokeWidth={1.75} />
                    </span>
                    <div className="flex-1 min-w-0 text-left">
                      <div className="text-[14px] font-semibold">{formatDayShort(j.date)}</div>
                      <div className="text-caption text-text-2 truncate">
                        {winner ? `Ganó ${winner.name}` : 'Sin ganador'} · {matches.length} partidas
                      </div>
                    </div>
                    <ChevronRight size={18} className="text-text-3" strokeWidth={1.75} />
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>
      <TeamFormSheet open={creatingTeam} onClose={() => setCreatingTeam(false)} />
    </ScreenShell>
  );
}
