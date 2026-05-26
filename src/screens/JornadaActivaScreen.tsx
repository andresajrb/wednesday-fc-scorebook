import { useState } from 'react';
import { ArrowLeft, Plus, Sparkles, Pencil, Trash2 } from 'lucide-react';
import { ScreenShell } from '@/components/primitives/ScreenShell';
import { Header } from '@/components/primitives/Header';
import { IconButton } from '@/components/primitives/IconButton';
import { Button } from '@/components/primitives/Button';
import { BottomSheet } from '@/components/primitives/BottomSheet';
import { ConfirmDialog } from '@/components/primitives/ConfirmDialog';
import { BallIcon } from '@/components/primitives/BallIcon';
import { StickyBottomCTA } from '@/components/primitives/StickyBottomCTA';
import { MatchCard } from '@/components/domain/MatchCard';
import { useStore } from '@/store/useStore';
import {
  getMatchesForJornada,
  getMatchScore,
  getGoalsByPlayerForMatch,
  getUnassignedGoalsForMatch,
  predictNextMatch,
} from '@/store/selectors';
import { formatDayShort } from '@/lib/format';
import { lightenForText } from '@/lib/colors';
import type { ID } from '@/types/domain';

interface JornadaActivaScreenProps {
  jornadaId: ID;
}

export function JornadaActivaScreen({ jornadaId }: JornadaActivaScreenProps) {
  const back = useStore((s) => s.back);
  const navigate = useStore((s) => s.navigate);
  const state = useStore((s) => s.state);
  const startMatch = useStore((s) => s.startMatch);
  const closeJornada = useStore((s) => s.closeJornada);
  const cancelMatch = useStore((s) => s.cancelMatch);

  const jornada = state.jornadas[jornadaId];
  const matches = jornada ? getMatchesForJornada(state, jornadaId) : [];
  const teams = Object.values(state.teams);
  const inProgress = matches.find((m) => m.result === null);

  const autoAssign = useStore((s) => s.state.config.autoAssignNextMatch);
  const reopenMatch = useStore((s) => s.reopenMatch);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [predictionOpen, setPredictionOpen] = useState(false);
  const [teamA, setTeamA] = useState<ID | null>(null);
  const [teamB, setTeamB] = useState<ID | null>(null);
  const [closeOpen, setCloseOpen] = useState(false);
  const [closeWithInProgressOpen, setCloseWithInProgressOpen] = useState(false);
  const [matchMenuId, setMatchMenuId] = useState<ID | null>(null);
  const [confirmDeleteMatchId, setConfirmDeleteMatchId] = useState<ID | null>(null);
  const [confirmReopenMatchId, setConfirmReopenMatchId] = useState<ID | null>(null);

  const menuMatch = matchMenuId ? state.matches[matchMenuId] : null;

  const prediction = jornada ? predictNextMatch(state, jornadaId) : null;

  if (!jornada) {
    return (
      <ScreenShell>
        <Header
          left={
            <IconButton ariaLabel="Volver" onClick={back}>
              <ArrowLeft size={20} strokeWidth={1.75} />
            </IconButton>
          }
          title="Jornada"
        />
        <div className="p-6 text-center text-text-2">Jornada no encontrada.</div>
      </ScreenShell>
    );
  }

  const closed = jornada.status === 'closed';

  const onNewMatch = () => {
    if (inProgress) {
      navigate({ name: 'match-record', matchId: inProgress.id });
      return;
    }
    if (autoAssign && prediction) {
      setPredictionOpen(true);
      return;
    }
    setTeamA(null);
    setTeamB(null);
    setPickerOpen(true);
  };

  const startNewMatch = () => {
    if (!teamA || !teamB || teamA === teamB) return;
    const id = startMatch(jornadaId, teamA, teamB);
    setPickerOpen(false);
    navigate({ name: 'match-record', matchId: id });
  };

  const startPredictedMatch = () => {
    if (!prediction) return;
    const id = startMatch(jornadaId, prediction.teamAId, prediction.teamBId);
    setPredictionOpen(false);
    navigate({ name: 'match-record', matchId: id });
  };

  const switchToManualPicker = () => {
    setPredictionOpen(false);
    setTeamA(prediction?.teamAId ?? null);
    setTeamB(prediction?.teamBId ?? null);
    setPickerOpen(true);
  };

  const onClose = () => {
    if (inProgress) {
      setCloseWithInProgressOpen(true);
    } else {
      setCloseOpen(true);
    }
  };

  const confirmClose = () => {
    closeJornada(jornadaId);
    setCloseOpen(false);
    navigate({ name: 'summary', jornadaId });
  };

  const discardAndClose = () => {
    if (inProgress) cancelMatch(inProgress.id);
    closeJornada(jornadaId);
    setCloseWithInProgressOpen(false);
    navigate({ name: 'summary', jornadaId });
  };

  const playedCount = matches.filter((m) => m.result !== null).length;

  return (
    <ScreenShell>
      <Header
        left={
          <IconButton ariaLabel="Volver" onClick={back}>
            <ArrowLeft size={20} strokeWidth={1.75} />
          </IconButton>
        }
        title={
          <div className="leading-tight">
            <div className="text-caption text-text-3 uppercase tracking-wide">Hoy</div>
            <div className="text-[15px] font-semibold">{formatDayShort(jornada.date)}</div>
          </div>
        }
        right={
          !closed && (
            <button
              type="button"
              onClick={onClose}
              className="text-caption font-medium px-2.5 h-9 rounded-btn bg-bg-elev2 border border-border active:bg-bg-elev"
            >
              Cerrar
            </button>
          )
        }
        centered={false}
      />

      <div className="px-4 pt-3 pb-2">
        <div className="text-[28px] font-bold tracking-tight leading-none">
          {playedCount} <span className="text-text-2 text-body font-normal">partidas jugadas</span>
        </div>
      </div>

      <div className="flex-1 px-4 pb-4 space-y-2.5 overflow-auto">
        {matches.length === 0 ? (
          <div className="flex flex-col items-center text-center pt-20 px-6">
            <span className="w-24 h-24 rounded-full bg-bg-elev border border-border inline-flex items-center justify-center text-text-2 mb-4">
              <BallIcon size={44} strokeWidth={1.5} />
            </span>
            <div className="text-body-em font-semibold">Sin partidas todavía</div>
            <div className="text-caption text-text-2 mt-1 max-w-[20rem]">
              Toca "Nueva partida" para registrar la primera del día.
            </div>
          </div>
        ) : (
          [...matches].reverse().map((m) => {
            const tA = state.teams[m.teamAId];
            const tB = state.teams[m.teamBId];
            if (!tA || !tB) return null;
            const { goalsA, goalsB } = getMatchScore(state, m.id);
            const playerGoals = getGoalsByPlayerForMatch(state, m.id);
            const unassigned = getUnassignedGoalsForMatch(state, m.id);
            const scorers: string[] = [];
            for (const [pid, count] of playerGoals) {
              const player = state.players[pid];
              if (player) scorers.push(`${player.name}${count > 1 ? ` (${count})` : ''}`);
            }
            for (const [tid, count] of unassigned) {
              const team = state.teams[tid];
              if (team) scorers.push(`${team.name}${count > 1 ? ` (${count})` : ''} sin asignar`);
            }
            return (
              <MatchCard
                key={m.id}
                match={m}
                teamA={tA}
                teamB={tB}
                goalsA={goalsA}
                goalsB={goalsB}
                scorersText={scorers.join(', ')}
                onClick={
                  m.result === null
                    ? () => navigate({ name: 'match-record', matchId: m.id })
                    : !closed
                      ? () => setMatchMenuId(m.id)
                      : undefined
                }
                onMore={!closed && m.result !== null ? () => setMatchMenuId(m.id) : undefined}
              />
            );
          })
        )}
      </div>

      {!closed && (
        <StickyBottomCTA>
          <Button
            size="xl"
            fullWidth
            leading={<Plus size={20} strokeWidth={2} />}
            onClick={onNewMatch}
          >
            {inProgress ? 'Continuar partida' : 'Nueva partida'}
          </Button>
        </StickyBottomCTA>
      )}

      <BottomSheet
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="Equipos en cancha"
      >
        <div className="space-y-4 pb-2">
          <div>
            <div className="text-caption text-text-2 uppercase tracking-wide mb-2">Equipo A</div>
            <div className="grid grid-cols-2 gap-2">
              {teams.map((t) => {
                const selected = teamA === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    disabled={teamB === t.id}
                    onClick={() => setTeamA(t.id)}
                    className={`flex items-center gap-2 px-3 h-12 rounded-btn border text-left active:scale-[0.98] disabled:opacity-30 ${
                      selected
                        ? 'border-accent bg-accent/10'
                        : 'border-border bg-bg-elev2'
                    }`}
                  >
                    <span
                      className="w-3.5 h-3.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: t.color }}
                    />
                    <span className="font-semibold text-body-em truncate">{t.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <div className="text-caption text-text-2 uppercase tracking-wide mb-2">Equipo B</div>
            <div className="grid grid-cols-2 gap-2">
              {teams.map((t) => {
                const selected = teamB === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    disabled={teamA === t.id}
                    onClick={() => setTeamB(t.id)}
                    className={`flex items-center gap-2 px-3 h-12 rounded-btn border text-left active:scale-[0.98] disabled:opacity-30 ${
                      selected
                        ? 'border-accent bg-accent/10'
                        : 'border-border bg-bg-elev2'
                    }`}
                  >
                    <span
                      className="w-3.5 h-3.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: t.color }}
                    />
                    <span className="font-semibold text-body-em truncate">{t.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <Button
            size="xl"
            fullWidth
            disabled={!teamA || !teamB || teamA === teamB}
            onClick={startNewMatch}
            leading={<Plus size={18} strokeWidth={2} />}
          >
            Empezar partida
          </Button>
        </div>
      </BottomSheet>

      <BottomSheet
        open={predictionOpen}
        onClose={() => setPredictionOpen(false)}
        title={
          <span className="inline-flex items-center gap-1.5">
            <Sparkles size={16} strokeWidth={1.75} className="text-accent" />
            Próximo enfrentamiento
          </span>
        }
      >
        {prediction && (
          <div className="space-y-4 pb-2">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <PredictedTeamCard
                color={state.teams[prediction.teamAId]?.color ?? '#525252'}
                name={state.teams[prediction.teamAId]?.name ?? '?'}
              />
              <span className="text-text-3 text-[18px] font-mono">vs</span>
              <PredictedTeamCard
                color={state.teams[prediction.teamBId]?.color ?? '#525252'}
                name={state.teams[prediction.teamBId]?.name ?? '?'}
              />
            </div>
            <p className="text-caption text-text-2 leading-relaxed">
              {prediction.reason}
              {!prediction.certain && ' Confirma o cambia manualmente si no es correcto.'}
            </p>
            <div className="space-y-2">
              <Button
                size="xl"
                fullWidth
                leading={<Plus size={18} strokeWidth={2} />}
                onClick={startPredictedMatch}
              >
                Empezar partida
              </Button>
              <Button
                size="lg"
                variant="ghost"
                fullWidth
                leading={<Pencil size={16} strokeWidth={1.75} />}
                onClick={switchToManualPicker}
              >
                Cambiar manualmente
              </Button>
            </div>
          </div>
        )}
      </BottomSheet>

      <BottomSheet
        open={!!menuMatch}
        onClose={() => setMatchMenuId(null)}
        title={menuMatch ? `Partida #${menuMatch.order}` : ''}
      >
        {menuMatch && (
          <div className="flex flex-col">
            <button
              type="button"
              onClick={() => {
                setConfirmReopenMatchId(menuMatch.id);
                setMatchMenuId(null);
              }}
              className="flex items-center gap-3 px-2 py-3 active:bg-bg-elev rounded-md text-left"
            >
              <span className="w-9 h-9 rounded-md bg-bg-elev2 flex items-center justify-center flex-shrink-0">
                <Pencil size={18} strokeWidth={1.75} />
              </span>
              <span className="text-body-em font-medium">Editar partida</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirmDeleteMatchId(menuMatch.id);
                setMatchMenuId(null);
              }}
              className="flex items-center gap-3 px-2 py-3 active:bg-bg-elev rounded-md text-left text-error"
            >
              <span className="w-9 h-9 rounded-md bg-bg-elev2 flex items-center justify-center flex-shrink-0">
                <Trash2 size={18} strokeWidth={1.75} />
              </span>
              <span className="text-body-em font-medium">Eliminar partida</span>
            </button>
          </div>
        )}
      </BottomSheet>

      <ConfirmDialog
        open={!!confirmDeleteMatchId}
        title="Eliminar partida"
        description="Se borrará la partida y sus goles. Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        danger
        onConfirm={() => {
          if (confirmDeleteMatchId) cancelMatch(confirmDeleteMatchId);
          setConfirmDeleteMatchId(null);
        }}
        onCancel={() => setConfirmDeleteMatchId(null)}
      />

      <ConfirmDialog
        open={!!confirmReopenMatchId}
        title="Reabrir partida"
        description="Se borrará el resultado y los puntos se recalcularán al finalizar de nuevo. ¿Continuar?"
        confirmLabel="Reabrir"
        danger
        onConfirm={() => {
          if (confirmReopenMatchId) {
            const id = confirmReopenMatchId;
            reopenMatch(id);
            setConfirmReopenMatchId(null);
            navigate({ name: 'match-record', matchId: id });
          } else {
            setConfirmReopenMatchId(null);
          }
        }}
        onCancel={() => setConfirmReopenMatchId(null)}
      />

      <ConfirmDialog
        open={closeOpen}
        title="Cerrar jornada"
        description="Una vez cerrada, no podrás registrar más partidas en esta jornada (pero podrás verla siempre)."
        confirmLabel="Cerrar y ver resumen"
        onConfirm={confirmClose}
        onCancel={() => setCloseOpen(false)}
      />

      <ConfirmDialog
        open={closeWithInProgressOpen}
        title="Hay una partida sin terminar"
        description="¿Quieres descartarla y cerrar la jornada de todas formas?"
        confirmLabel="Descartar y cerrar"
        cancelLabel="Volver"
        danger
        onConfirm={discardAndClose}
        onCancel={() => setCloseWithInProgressOpen(false)}
      />

    </ScreenShell>
  );
}

function PredictedTeamCard({ color, name }: { color: string; name: string }) {
  const txt = lightenForText(color);
  return (
    <div
      className="rounded-card border p-3 text-center"
      style={{ borderColor: `${color}55`, backgroundColor: `${color}1f` }}
    >
      <span
        className="inline-block w-3 h-3 rounded-full mb-1.5"
        style={{ backgroundColor: color }}
      />
      <div className="text-body-em font-bold leading-tight truncate" style={{ color: txt }}>
        {name}
      </div>
    </div>
  );
}
