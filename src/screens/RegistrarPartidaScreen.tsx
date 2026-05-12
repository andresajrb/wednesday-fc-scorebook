import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Undo2, Flag, UserPlus, Trophy, Plus, Check, ShieldPlus } from 'lucide-react';
import { ScreenShell } from '@/components/primitives/ScreenShell';
import { IconButton } from '@/components/primitives/IconButton';
import { Button } from '@/components/primitives/Button';
import { BottomSheet } from '@/components/primitives/BottomSheet';
import { ConfirmDialog } from '@/components/primitives/ConfirmDialog';
import { Avatar } from '@/components/primitives/Avatar';
import { Chip } from '@/components/primitives/Chip';
import { StickyBottomCTA } from '@/components/primitives/StickyBottomCTA';
import { MatchClock } from '@/components/domain/MatchClock';
import { useStore } from '@/store/useStore';
import {
  getMatchScore,
  getGoalsByPlayerForMatch,
  getMatchGoalsOrdered,
} from '@/store/selectors';
import { lightenForText, readableTextColor, softColor } from '@/lib/colors';
import { cn } from '@/lib/cn';
import type { ID, MatchRosterEntry, Player } from '@/types/domain';

interface RegistrarPartidaScreenProps {
  matchId: ID;
}

export function RegistrarPartidaScreen({ matchId }: RegistrarPartidaScreenProps) {
  const back = useStore((s) => s.back);
  const navigate = useStore((s) => s.navigate);
  const state = useStore((s) => s.state);
  const addGoal = useStore((s) => s.addGoal);
  const removeGoal = useStore((s) => s.removeGoal);
  const finishMatch = useStore((s) => s.finishMatch);
  const cancelMatch = useStore((s) => s.cancelMatch);
  const addToRoster = useStore((s) => s.addToRoster);
  const addPlayer = useStore((s) => s.addPlayer);

  const autoAssign = useStore((s) => s.state.config.autoAssignNextMatch);
  const matchDuration = useStore((s) => s.state.config.matchDurationSeconds);

  const match = state.matches[matchId];
  const teamA = match ? state.teams[match.teamAId] : undefined;
  const teamB = match ? state.teams[match.teamBId] : undefined;

  const [borrowFor, setBorrowFor] = useState<'A' | 'B' | null>(null);
  const [addingPlayerSide, setAddingPlayerSide] = useState<'A' | 'B' | null>(null);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [drawDialog, setDrawDialog] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [popKeyA, setPopKeyA] = useState(0);
  const [popKeyB, setPopKeyB] = useState(0);
  const [undoStack, setUndoStack] = useState<ID[]>([]);
  const undoTimerRef = useRef<number | null>(null);
  const [undoVisible, setUndoVisible] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  // Timer
  useEffect(() => {
    if (!match || match.endedAt) return;
    const start = new Date(match.startedAt).getTime();
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [match]);

  // Defensa: si entras a una partida ya finalizada, redirigir a la jornada.
  useEffect(() => {
    if (match && match.endedAt) {
      navigate({ name: 'jornada-active', jornadaId: match.jornadaId }, { replace: true });
    }
  }, [match, navigate]);

  useEffect(() => {
    return () => {
      if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
    };
  }, []);

  const score = useMemo(() => (match ? getMatchScore(state, match.id) : { goalsA: 0, goalsB: 0 }), [state, match]);
  const goalsByPlayer = useMemo(
    () => (match ? getGoalsByPlayerForMatch(state, match.id) : new Map<ID, number>()),
    [state, match]
  );

  if (!match || !teamA || !teamB) {
    return (
      <ScreenShell>
        <div className="p-6 text-center text-text-2">Partida no encontrada.</div>
        <div className="px-4 pb-6">
          <Button fullWidth onClick={back}>
            Volver
          </Button>
        </div>
      </ScreenShell>
    );
  }

  const isClosed = match.endedAt;
  const isFirst = match.type === 'first';
  const goalLimit = match.goalLimit;
  const limitHit =
    !isClosed && (score.goalsA >= goalLimit || score.goalsB >= goalLimit) && score.goalsA !== score.goalsB;

  const teamAPlayers = match.rosterA
    .map((entry) => ({ entry, player: state.players[entry.playerId] }))
    .filter((x): x is { entry: MatchRosterEntry; player: Player } => !!x.player);
  const teamBPlayers = match.rosterB
    .map((entry) => ({ entry, player: state.players[entry.playerId] }))
    .filter((x): x is { entry: MatchRosterEntry; player: Player } => !!x.player);

  const onAddGoal = (
    side: 'A' | 'B',
    playerId: ID | null,
    borrowedFromTeamId?: ID
  ) => {
    if (isClosed) return;
    const scoringForTeamId = side === 'A' ? teamA.id : teamB.id;
    const goalId = addGoal(match.id, playerId, scoringForTeamId, !!borrowedFromTeamId);
    if (side === 'A') setPopKeyA((k) => k + 1);
    else setPopKeyB((k) => k + 1);
    setUndoStack((s) => [...s, goalId]);
    setUndoVisible(true);
    if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
    undoTimerRef.current = window.setTimeout(() => {
      setUndoVisible(false);
    }, 5000);
  };

  const onAddPlayerInMatch = () => {
    if (!addingPlayerSide || !newPlayerName.trim()) {
      setAddingPlayerSide(null);
      setNewPlayerName('');
      return;
    }
    const teamId = addingPlayerSide === 'A' ? teamA.id : teamB.id;
    const newId = addPlayer(newPlayerName.trim(), teamId);
    addToRoster(match.id, addingPlayerSide, { playerId: newId });
    setAddingPlayerSide(null);
    setNewPlayerName('');
  };

  const onUndo = () => {
    setUndoStack((stack) => {
      if (stack.length === 0) return stack;
      const next = stack.slice(0, -1);
      const last = stack[stack.length - 1];
      removeGoal(last);
      return next;
    });
    setUndoVisible(false);
  };

  const playersOfOthers = (excludeTeamId: ID, currentRosterIds: Set<ID>): Player[] => {
    return Object.values(state.players)
      .filter(
        (p) =>
          p.active &&
          p.teamId !== excludeTeamId &&
          !currentRosterIds.has(p.id)
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  };

  const onFinish = () => {
    const isDraw = score.goalsA === score.goalsB;
    if (isDraw && (isFirst || autoAssign)) {
      setDrawDialog(true);
      return;
    }
    finishMatch(match.id);
    navigate({ name: 'jornada-active', jornadaId: match.jornadaId }, { replace: true });
  };

  const onPickDrawWinner = (teamId: ID) => {
    finishMatch(match.id, teamId);
    setDrawDialog(false);
    navigate({ name: 'jornada-active', jornadaId: match.jornadaId }, { replace: true });
  };

  const onCancel = () => {
    const goals = getMatchGoalsOrdered(state, match.id);
    if (goals.length === 0) {
      cancelMatch(match.id);
      back();
    } else {
      setCancelOpen(true);
    }
  };

  const confirmCancel = () => {
    cancelMatch(match.id);
    setCancelOpen(false);
    navigate({ name: 'jornada-active', jornadaId: match.jornadaId }, { replace: true });
  };

  return (
    <ScreenShell>
      <header className="sticky top-0 z-30 backdrop-blur-md bg-bg/85 border-b border-border px-4 py-2.5 flex items-center gap-2">
        <IconButton ariaLabel="Volver" onClick={back}>
          <ArrowLeft size={20} strokeWidth={1.75} />
        </IconButton>
        <div className="flex-1 flex flex-col items-center min-w-0">
          <div className="text-caption text-text-2 uppercase tracking-wide leading-none mb-1">
            Partida #{match.order}
          </div>
          <MatchClock
            elapsedSeconds={elapsed}
            durationSeconds={matchDuration}
            isRunning={!isClosed}
          />
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="text-caption font-medium px-2.5 h-9 rounded-btn text-text-2 active:bg-bg-elev2"
        >
          Cancelar
        </button>
      </header>

      {/* Scoreboard */}
      <div className="px-4 pt-4 pb-3 border-b border-border">
        <div className="flex items-center gap-3">
          <ScoreSide
            popKey={popKeyA}
            label={teamA.name}
            color={teamA.color}
            score={score.goalsA}
            limit={goalLimit}
          />
          <span className="text-text-3 text-[18px]">—</span>
          <ScoreSide
            popKey={popKeyB}
            label={teamB.name}
            color={teamB.color}
            score={score.goalsB}
            limit={goalLimit}
          />
        </div>
        {isFirst && (
          <div className="mt-3 flex justify-center">
            <Chip tone="warning" leading={<Trophy size={12} strokeWidth={2} />}>
              Primera partida · a {goalLimit} {goalLimit === 1 ? 'gol' : 'goles'}
            </Chip>
          </div>
        )}
        {!isFirst && (
          <div className="mt-3 flex justify-center">
            <Chip tone="neutral">Partida a {goalLimit} {goalLimit === 1 ? 'gol' : 'goles'}</Chip>
          </div>
        )}
        {limitHit && (
          <div className="mt-2 text-center text-caption text-accent">
            Límite alcanzado. Toca "Finalizar partida".
          </div>
        )}
      </div>

      {/* Rosters */}
      <div className="grid grid-cols-2 flex-1 min-h-0 overflow-auto">
        <RosterColumn
          side="A"
          color={teamA.color}
          teamName={teamA.name}
          players={teamAPlayers}
          goalsByPlayer={goalsByPlayer}
          onAddGoal={(playerId, borrowed) => onAddGoal('A', playerId, borrowed)}
          onAddTeamGoal={() => onAddGoal('A', null)}
          onBorrow={() => setBorrowFor('A')}
          onStartAddPlayer={() => {
            setNewPlayerName('');
            setAddingPlayerSide('A');
          }}
          isAddingPlayer={addingPlayerSide === 'A'}
          newPlayerName={newPlayerName}
          onNewPlayerNameChange={setNewPlayerName}
          onCancelAddPlayer={() => {
            setAddingPlayerSide(null);
            setNewPlayerName('');
          }}
          onConfirmAddPlayer={onAddPlayerInMatch}
          dividerRight
          getPlayerTeam={(teamId) => state.teams[teamId]?.name ?? ''}
          isClosed={!!isClosed}
        />
        <RosterColumn
          side="B"
          color={teamB.color}
          teamName={teamB.name}
          players={teamBPlayers}
          goalsByPlayer={goalsByPlayer}
          onAddGoal={(playerId, borrowed) => onAddGoal('B', playerId, borrowed)}
          onAddTeamGoal={() => onAddGoal('B', null)}
          onBorrow={() => setBorrowFor('B')}
          onStartAddPlayer={() => {
            setNewPlayerName('');
            setAddingPlayerSide('B');
          }}
          isAddingPlayer={addingPlayerSide === 'B'}
          newPlayerName={newPlayerName}
          onNewPlayerNameChange={setNewPlayerName}
          onCancelAddPlayer={() => {
            setAddingPlayerSide(null);
            setNewPlayerName('');
          }}
          onConfirmAddPlayer={onAddPlayerInMatch}
          getPlayerTeam={(teamId) => state.teams[teamId]?.name ?? ''}
          isClosed={!!isClosed}
        />
      </div>

      {/* Undo chip */}
      {undoVisible && undoStack.length > 0 && (
        <div className="fixed left-1/2 -translate-x-1/2 z-40" style={{ bottom: 'calc(96px + env(safe-area-inset-bottom))' }}>
          <button
            type="button"
            onClick={onUndo}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-full bg-bg-elev2 border border-border-strong shadow-[0_8px_24px_rgba(0,0,0,0.5)] text-body-em font-medium animate-slide-up"
          >
            <Undo2 size={16} strokeWidth={1.75} />
            Deshacer último gol
          </button>
        </div>
      )}

      <StickyBottomCTA>
        <Button
          size="xl"
          fullWidth
          leading={<Flag size={18} strokeWidth={1.75} />}
          onClick={onFinish}
        >
          Finalizar partida
        </Button>
      </StickyBottomCTA>

      <BottomSheet
        open={!!borrowFor}
        onClose={() => setBorrowFor(null)}
        title={`Prestar jugador a ${borrowFor === 'A' ? teamA.name : teamB.name}`}
      >
        {borrowFor && (
          <BorrowList
            excludeTeamId={borrowFor === 'A' ? teamA.id : teamB.id}
            currentRoster={
              new Set(
                (borrowFor === 'A' ? match.rosterA : match.rosterB).map((e) => e.playerId)
              )
            }
            getTeamColor={(teamId) => state.teams[teamId]?.color ?? '#525252'}
            getTeamName={(teamId) => state.teams[teamId]?.name ?? ''}
            onPick={(playerId, fromTeamId) => {
              addToRoster(match.id, borrowFor, {
                playerId,
                borrowedFromTeamId: fromTeamId,
              });
              setBorrowFor(null);
            }}
            otherPlayers={playersOfOthers(
              borrowFor === 'A' ? teamA.id : teamB.id,
              new Set(
                (borrowFor === 'A' ? match.rosterA : match.rosterB).map((e) => e.playerId)
              )
            )}
          />
        )}
      </BottomSheet>

      <BottomSheet
        open={drawDialog}
        onClose={() => setDrawDialog(false)}
        title={isFirst ? 'Empate en la primera partida' : 'Empate'}
      >
        <p className="text-body text-text-2 mb-4 leading-relaxed">
          Los dos equipos salen. ¿Quién entra primero la próxima vez?
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onPickDrawWinner(teamA.id)}
            className="flex items-center gap-2 px-3 h-14 rounded-btn border border-border bg-bg-elev2 active:scale-[0.98]"
          >
            <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: teamA.color }} />
            <span className="font-semibold text-body-em truncate">{teamA.name}</span>
          </button>
          <button
            type="button"
            onClick={() => onPickDrawWinner(teamB.id)}
            className="flex items-center gap-2 px-3 h-14 rounded-btn border border-border bg-bg-elev2 active:scale-[0.98]"
          >
            <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: teamB.color }} />
            <span className="font-semibold text-body-em truncate">{teamB.name}</span>
          </button>
        </div>
      </BottomSheet>

      <ConfirmDialog
        open={cancelOpen}
        title="Cancelar partida"
        description="Se descartará la partida y todos los goles registrados. ¿Continuar?"
        confirmLabel="Descartar partida"
        danger
        onConfirm={confirmCancel}
        onCancel={() => setCancelOpen(false)}
      />
    </ScreenShell>
  );
}

function ScoreSide({
  popKey,
  label,
  color,
  score,
  limit,
}: {
  popKey: number;
  label: string;
  color: string;
  score: number;
  limit: number;
}) {
  const txt = lightenForText(color);
  return (
    <div className="flex-1 text-center min-w-0">
      <div
        className="text-caption uppercase tracking-wider font-semibold mb-1 truncate"
        style={{ color: txt }}
      >
        {label}
      </div>
      <div
        key={popKey}
        className="font-mono tnum font-bold leading-none animate-pop"
        style={{ color: txt, fontSize: '64px' }}
      >
        {score}
      </div>
      <div className="text-caption text-text-3 mt-1">/ {limit}</div>
    </div>
  );
}

function RosterColumn({
  side,
  color,
  teamName,
  players,
  goalsByPlayer,
  onAddGoal,
  onAddTeamGoal,
  onBorrow,
  onStartAddPlayer,
  isAddingPlayer,
  newPlayerName,
  onNewPlayerNameChange,
  onCancelAddPlayer,
  onConfirmAddPlayer,
  dividerRight,
  getPlayerTeam,
  isClosed,
}: {
  side: 'A' | 'B';
  color: string;
  teamName: string;
  players: Array<{ entry: MatchRosterEntry; player: Player }>;
  goalsByPlayer: Map<ID, number>;
  onAddGoal: (playerId: ID, borrowedFromTeamId?: ID) => void;
  onAddTeamGoal: () => void;
  onBorrow: () => void;
  onStartAddPlayer: () => void;
  isAddingPlayer: boolean;
  newPlayerName: string;
  onNewPlayerNameChange: (v: string) => void;
  onCancelAddPlayer: () => void;
  onConfirmAddPlayer: () => void;
  dividerRight?: boolean;
  getPlayerTeam: (teamId: ID) => string;
  isClosed: boolean;
}) {
  return (
    <div
      className={cn(
        'flex flex-col p-3 gap-2',
        dividerRight && 'border-r border-border'
      )}
    >
      <div className="text-caption text-text-3 uppercase tracking-wide pl-1">Equipo {side}</div>
      <div className="flex flex-col gap-2 flex-1">
        {/* Botón de gol "del equipo" sin jugador asignado */}
        <button
          type="button"
          onClick={onAddTeamGoal}
          disabled={isClosed}
          className="flex items-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-40"
        >
          <span
            className="inline-flex items-center justify-center w-7 h-7 rounded-full flex-shrink-0"
            style={{ backgroundColor: softColor(color, 0.25), color: readableTextColor(color) }}
          >
            <ShieldPlus size={14} strokeWidth={1.75} />
          </span>
          <div className="flex-1 min-w-0 text-left">
            <div className="text-[12px] font-semibold leading-tight uppercase tracking-wide" style={{ color: lightenForText(color) }}>
              {teamName}
            </div>
            <div className="text-[10px] text-text-3 leading-tight">+1 sin asignar jugador</div>
          </div>
          <span
            className="w-14 h-11 rounded-lg font-bold text-[13px] flex items-center justify-center"
            style={{
              backgroundColor: color,
              color: readableTextColor(color),
            }}
          >
            +1
          </span>
        </button>

        {players.length === 0 && (
          <div className="text-caption text-text-3 italic px-1 py-2">Sin jugadores aún.</div>
        )}
        {players.map(({ entry, player }) => {
          const goals = goalsByPlayer.get(player.id) ?? 0;
          const borrowed = !!entry.borrowedFromTeamId;
          return (
            <div key={player.id} className="flex items-center gap-2">
              <Avatar name={player.name} color={borrowed ? '#525252' : color} size={28} />
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold leading-tight truncate flex items-center gap-1">
                  {player.name.split(' ')[0]}
                  {borrowed && (
                    <span
                      className="text-[9px] px-1 py-px rounded font-bold uppercase"
                      style={{ backgroundColor: softColor('#a1a1a1', 0.2), color: '#a1a1a1' }}
                      title={`Prestado de ${getPlayerTeam(entry.borrowedFromTeamId!)}`}
                    >
                      P
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-text-3 leading-tight">{goals} goles</div>
              </div>
              <button
                type="button"
                disabled={isClosed}
                onClick={() => onAddGoal(player.id, entry.borrowedFromTeamId)}
                className="w-14 h-11 rounded-lg font-bold text-[13px] active:scale-90 transition-transform disabled:opacity-40"
                style={{
                  backgroundColor: color,
                  color: readableTextColor(color),
                }}
              >
                +1
              </button>
            </div>
          );
        })}
      </div>
      {isAddingPlayer ? (
        <div className="flex items-center gap-2 mt-1 p-2 rounded-btn border border-accent/40 bg-accent-soft">
          <Avatar name={newPlayerName || '?'} color={color} size={28} />
          <input
            autoFocus
            placeholder="Nombre"
            value={newPlayerName}
            onChange={(e) => onNewPlayerNameChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onConfirmAddPlayer();
              if (e.key === 'Escape') onCancelAddPlayer();
            }}
            className="flex-1 min-w-0 bg-transparent border-b border-accent outline-none text-body font-medium py-1"
          />
          <button
            type="button"
            onClick={onConfirmAddPlayer}
            aria-label="Confirmar"
            className="w-9 h-9 rounded-md bg-accent text-text-inv flex items-center justify-center active:scale-90"
          >
            <Check size={16} strokeWidth={2} />
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-1 mt-1">
          <button
            type="button"
            onClick={onStartAddPlayer}
            disabled={isClosed}
            className="inline-flex items-center justify-center gap-2 h-10 rounded-btn border border-dashed border-border-strong text-text-2 active:bg-bg-elev disabled:opacity-40"
          >
            <Plus size={14} strokeWidth={2} />
            <span className="text-caption font-medium">Agregar jugador</span>
          </button>
          <button
            type="button"
            onClick={onBorrow}
            disabled={isClosed}
            className="inline-flex items-center justify-center gap-2 h-10 rounded-btn border border-dashed border-border-strong text-text-2 active:bg-bg-elev disabled:opacity-40"
          >
            <UserPlus size={14} strokeWidth={1.75} />
            <span className="text-caption font-medium">Prestar jugador</span>
          </button>
        </div>
      )}
    </div>
  );
}

function BorrowList({
  otherPlayers,
  getTeamColor,
  getTeamName,
  onPick,
}: {
  excludeTeamId: ID;
  currentRoster: Set<ID>;
  otherPlayers: Player[];
  getTeamColor: (teamId: ID) => string;
  getTeamName: (teamId: ID) => string;
  onPick: (playerId: ID, fromTeamId: ID) => void;
}) {
  if (otherPlayers.length === 0) {
    return (
      <div className="py-6 text-center text-caption text-text-3">
        No hay jugadores disponibles para prestar.
      </div>
    );
  }
  return (
    <div className="flex flex-col">
      {otherPlayers.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onPick(p.id, p.teamId)}
          className="flex items-center gap-3 px-2 py-3 active:bg-bg-elev rounded-md text-left"
        >
          <Avatar name={p.name} color={getTeamColor(p.teamId)} size={32} />
          <div className="flex-1 min-w-0">
            <div className="text-body-em font-semibold truncate">{p.name}</div>
            <div className="text-caption text-text-2 truncate">{getTeamName(p.teamId)}</div>
          </div>
          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: getTeamColor(p.teamId) }} />
        </button>
      ))}
    </div>
  );
}
