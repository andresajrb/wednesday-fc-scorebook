import { useState } from 'react';
import {
  ArrowLeft,
  ChevronDown,
  MoreHorizontal,
  Plus,
  Shield,
  ArrowLeftRight,
  User,
  Pencil,
  Check,
  Archive,
  ArchiveRestore,
} from 'lucide-react';
import { ScreenShell } from '@/components/primitives/ScreenShell';
import { Header } from '@/components/primitives/Header';
import { IconButton } from '@/components/primitives/IconButton';
import { BottomSheet } from '@/components/primitives/BottomSheet';
import { Avatar } from '@/components/primitives/Avatar';
import { TeamSwatch } from '@/components/domain/TeamSwatch';
import { KindOption } from '@/components/domain/TeamFormSheet';
import { Button } from '@/components/primitives/Button';
import { ConfirmDialog } from '@/components/primitives/ConfirmDialog';
import { useStore } from '@/store/useStore';
import { useScopedState } from '@/store/useScopedState';
import {
  getActivePlayersByTeam,
  getInactivePlayersByTeam,
  getOpenJornada,
} from '@/store/selectors';
import type { ID, Player } from '@/types/domain';
import { COLOR_SWATCHES, softColor, lightenForText, readableTextColor } from '@/lib/colors';
import { cn } from '@/lib/cn';

interface DetalleEquipoScreenProps {
  teamId: ID;
}

export function DetalleEquipoScreen({ teamId }: DetalleEquipoScreenProps) {
  const back = useStore((s) => s.back);
  const state = useScopedState();
  const team = state.teams[teamId];
  const teams = state.teams;
  const renameTeam = useStore((s) => s.renameTeam);
  const setTeamColor = useStore((s) => s.setTeamColor);
  const addPlayer = useStore((s) => s.addPlayer);
  const movePlayer = useStore((s) => s.movePlayer);
  const setPlayerActive = useStore((s) => s.setPlayerActive);
  const renamePlayer = useStore((s) => s.renamePlayer);
  const setTeamKind = useStore((s) => s.setTeamKind);
  const setTeamArchived = useStore((s) => s.setTeamArchived);
  const [archiveOpen, setArchiveOpen] = useState(false);

  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState(team?.name ?? '');
  const [showInactive, setShowInactive] = useState(false);
  const [actionPlayer, setActionPlayer] = useState<Player | null>(null);
  const [moveOpen, setMoveOpen] = useState<Player | null>(null);
  const [addingPlayer, setAddingPlayer] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [editingPlayerId, setEditingPlayerId] = useState<ID | null>(null);
  const [editingPlayerName, setEditingPlayerName] = useState('');

  if (!team) {
    return (
      <ScreenShell>
        <Header
          left={
            <IconButton ariaLabel="Volver" onClick={back}>
              <ArrowLeft size={20} strokeWidth={1.75} />
            </IconButton>
          }
          title="Equipo"
        />
        <div className="p-6 text-center text-text-2">Equipo no encontrado.</div>
      </ScreenShell>
    );
  }

  const active = getActivePlayersByTeam(state, teamId);
  const inactive = getInactivePlayersByTeam(state, teamId);
  const otherTeams = Object.values(teams).filter((t) => t.id !== teamId && !t.archived);
  const openJornada = getOpenJornada(state);
  const inOpenJornada = !!openJornada?.teamIds.includes(teamId);

  const commitName = () => {
    if (draftName.trim() && draftName.trim() !== team.name) {
      renameTeam(team.id, draftName.trim());
    } else {
      setDraftName(team.name);
    }
    setEditingName(false);
  };

  const handleAddPlayer = () => {
    if (!newPlayerName.trim()) {
      setAddingPlayer(false);
      return;
    }
    addPlayer(newPlayerName.trim(), teamId);
    setNewPlayerName('');
    setAddingPlayer(false);
  };

  const commitPlayerName = (id: ID) => {
    if (editingPlayerName.trim()) renamePlayer(id, editingPlayerName.trim());
    setEditingPlayerId(null);
    setEditingPlayerName('');
  };

  return (
    <ScreenShell>
      <Header
        left={
          <IconButton ariaLabel="Volver" onClick={back}>
            <ArrowLeft size={20} strokeWidth={1.75} />
          </IconButton>
        }
        title={
          editingName ? (
            <input
              autoFocus
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitName();
                if (e.key === 'Escape') {
                  setDraftName(team.name);
                  setEditingName(false);
                }
              }}
              className="bg-transparent border-b border-accent outline-none text-[15px] font-semibold w-full text-center"
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                setDraftName(team.name);
                setEditingName(true);
              }}
              className="inline-flex items-center gap-1.5"
            >
              {team.name}
              <Pencil size={13} className="text-text-3" strokeWidth={1.75} />
            </button>
          )
        }
      />

      <div className="px-4 py-4 space-y-5 flex-1">
        {/* Banner */}
        <div
          className="rounded-card p-4 border flex items-center gap-3"
          style={{
            background: `linear-gradient(135deg, ${softColor(team.color, 0.22)} 0%, transparent 100%), #161616`,
            borderColor: softColor(team.color, 0.35),
          }}
        >
          <span
            className="w-14 h-14 rounded-md flex items-center justify-center flex-shrink-0"
            style={{
              backgroundColor: team.color,
              color: readableTextColor(team.color),
            }}
          >
            <Shield size={26} strokeWidth={1.75} />
          </span>
          <div className="flex-1 min-w-0">
            <div
              className="text-caption uppercase tracking-wider font-semibold"
              style={{ color: lightenForText(team.color) }}
            >
              {team.archived ? 'Archivado' : team.kind === 'guest' ? 'Invitado' : 'Equipo'}
            </div>
            <div className="text-[20px] font-bold tracking-tight truncate">{team.name}</div>
            <div className="text-caption text-text-2">
              {active.length} {active.length === 1 ? 'jugador activo' : 'jugadores activos'}
            </div>
          </div>
        </div>

        {/* Color selector */}
        <section>
          <div className="text-caption uppercase tracking-wider text-text-2 font-semibold mb-2">
            Color
          </div>
          <div className="flex gap-2 overflow-x-auto noscrollbar pb-1">
            {COLOR_SWATCHES.map((c) => (
              <TeamSwatch
                key={c}
                color={c}
                size={36}
                selected={team.color.toLowerCase() === c.toLowerCase()}
                onClick={() => setTeamColor(team.id, c)}
                ariaLabel={`Color ${c}`}
              />
            ))}
          </div>
        </section>

        <section>
          <div className="text-caption uppercase tracking-wider text-text-2 font-semibold mb-2">
            Tipo
          </div>
          <div className="grid grid-cols-2 gap-2">
            <KindOption
              selected={team.kind === 'fixed'}
              onClick={() => setTeamKind(team.id, 'fixed')}
              title="Fijo"
              description="Juega todas las semanas"
            />
            <KindOption
              selected={team.kind === 'guest'}
              onClick={() => setTeamKind(team.id, 'guest')}
              title="Invitado"
              description="Cubre cuando falta uno"
            />
          </div>
        </section>

        {/* Active players */}
        <section>
          <div className="text-caption uppercase tracking-wider text-text-2 font-semibold mb-2">
            Jugadores activos
          </div>
          <div className="bg-bg-elev border border-border rounded-card overflow-hidden">
            {active.length === 0 && !addingPlayer && (
              <div className="px-4 py-5 text-text-3 text-caption italic">
                No hay jugadores. Agrega el primero.
              </div>
            )}
            {active.map((p, idx) => (
              <div
                key={p.id}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 min-h-14',
                  idx > 0 && 'border-t border-border'
                )}
              >
                <Avatar name={p.name} color={team.color} size={36} />
                {editingPlayerId === p.id ? (
                  <input
                    autoFocus
                    value={editingPlayerName}
                    onChange={(e) => setEditingPlayerName(e.target.value)}
                    onBlur={() => commitPlayerName(p.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitPlayerName(p.id);
                      if (e.key === 'Escape') {
                        setEditingPlayerId(null);
                        setEditingPlayerName('');
                      }
                    }}
                    className="flex-1 bg-transparent border-b border-accent outline-none text-body-em font-medium"
                  />
                ) : (
                  <button
                    type="button"
                    onDoubleClick={() => {
                      setEditingPlayerId(p.id);
                      setEditingPlayerName(p.name);
                    }}
                    className="flex-1 text-left text-body-em font-medium truncate"
                  >
                    {p.name}
                  </button>
                )}
                <IconButton ariaLabel="Acciones" onClick={() => setActionPlayer(p)}>
                  <MoreHorizontal size={18} strokeWidth={1.75} />
                </IconButton>
              </div>
            ))}
            {addingPlayer ? (
              <div
                className={cn(
                  'flex items-center gap-3 px-4 py-3 min-h-14',
                  active.length > 0 && 'border-t border-border'
                )}
              >
                <Avatar name={newPlayerName || '?'} color={team.color} size={36} />
                <input
                  autoFocus
                  placeholder="Nombre del jugador"
                  value={newPlayerName}
                  onChange={(e) => setNewPlayerName(e.target.value)}
                  onBlur={handleAddPlayer}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddPlayer();
                    if (e.key === 'Escape') {
                      setAddingPlayer(false);
                      setNewPlayerName('');
                    }
                  }}
                  className="flex-1 bg-transparent border-b border-accent outline-none text-body-em font-medium"
                />
                <IconButton ariaLabel="Confirmar" onClick={handleAddPlayer}>
                  <Check size={18} strokeWidth={1.75} />
                </IconButton>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAddingPlayer(true)}
                className={cn(
                  'w-full flex items-center justify-center gap-2 h-12 text-text-2 active:bg-bg-elev2 transition',
                  active.length > 0 && 'border-t border-dashed border-border-strong'
                )}
              >
                <Plus size={16} strokeWidth={1.75} />
                <span className="text-body-em font-medium">Agregar jugador</span>
              </button>
            )}
          </div>
        </section>

        {/* Inactive players */}
        {inactive.length > 0 && (
          <section>
            <button
              type="button"
              onClick={() => setShowInactive((s) => !s)}
              className="w-full flex items-center justify-between py-2 text-text-2"
            >
              <span className="text-caption uppercase tracking-wider font-semibold">
                Inactivos ({inactive.length})
              </span>
              <ChevronDown
                size={18}
                strokeWidth={1.75}
                className={cn('transition-transform', showInactive && 'rotate-180')}
              />
            </button>
            {showInactive && (
              <div className="bg-bg-elev border border-border rounded-card overflow-hidden opacity-80 animate-fade-in">
                {inactive.map((p, idx) => (
                  <div
                    key={p.id}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3 min-h-14',
                      idx > 0 && 'border-t border-border'
                    )}
                  >
                    <Avatar name={p.name} color={team.color} size={32} dimmed />
                    <span className="flex-1 text-body-em font-medium truncate text-text-2">
                      {p.name}
                    </span>
                    <IconButton ariaLabel="Acciones" onClick={() => setActionPlayer(p)}>
                      <MoreHorizontal size={18} strokeWidth={1.75} />
                    </IconButton>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        <section className="pt-2">
          {team.archived ? (
            <Button
              variant="secondary"
              size="lg"
              fullWidth
              leading={<ArchiveRestore size={18} strokeWidth={1.75} />}
              onClick={() => setTeamArchived(team.id, false)}
            >
              Restaurar equipo
            </Button>
          ) : (
            <>
              <Button
                variant="ghost"
                size="lg"
                fullWidth
                disabled={inOpenJornada}
                leading={<Archive size={18} strokeWidth={1.75} />}
                onClick={() => setArchiveOpen(true)}
              >
                Archivar equipo
              </Button>
              <p className="text-caption text-text-3 mt-1 text-center leading-relaxed">
                {inOpenJornada
                  ? 'Está jugando la jornada en curso: no se puede archivar ahora.'
                  : 'Deja de aparecer para jugar. Su historial y sus jugadores se conservan.'}
              </p>
            </>
          )}
        </section>
      </div>

      <ConfirmDialog
        open={archiveOpen}
        title={`Archivar ${team.name}`}
        description="No aparecerá al armar jornadas ni en el inicio. Puedes restaurarlo desde Configuración cuando quieras."
        confirmLabel="Archivar"
        onConfirm={() => {
          setTeamArchived(team.id, true);
          setArchiveOpen(false);
          back();
        }}
        onCancel={() => setArchiveOpen(false)}
      />

      <BottomSheet
        open={!!actionPlayer}
        onClose={() => setActionPlayer(null)}
        title={actionPlayer ? `Acciones · ${actionPlayer.name}` : ''}
      >
        {actionPlayer && (
          <div className="flex flex-col">
            <SheetAction
              icon={<Pencil size={18} strokeWidth={1.75} />}
              label="Renombrar"
              onClick={() => {
                setEditingPlayerId(actionPlayer.id);
                setEditingPlayerName(actionPlayer.name);
                setActionPlayer(null);
              }}
            />
            <SheetAction
              icon={<ArrowLeftRight size={18} strokeWidth={1.75} />}
              label="Mover de equipo"
              onClick={() => {
                setMoveOpen(actionPlayer);
                setActionPlayer(null);
              }}
            />
            {actionPlayer.active ? (
              <SheetAction
                icon={<User size={18} strokeWidth={1.75} />}
                label="Marcar como inactivo"
                onClick={() => {
                  setPlayerActive(actionPlayer.id, false);
                  setActionPlayer(null);
                }}
              />
            ) : (
              <SheetAction
                icon={<User size={18} strokeWidth={1.75} />}
                label="Reactivar"
                onClick={() => {
                  setPlayerActive(actionPlayer.id, true);
                  setActionPlayer(null);
                }}
              />
            )}
          </div>
        )}
      </BottomSheet>

      <BottomSheet
        open={!!moveOpen}
        onClose={() => setMoveOpen(null)}
        title={moveOpen ? `Mover ${moveOpen.name} a` : ''}
      >
        {moveOpen && (
          <div className="flex flex-col">
            {otherTeams.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  movePlayer(moveOpen.id, t.id);
                  setMoveOpen(null);
                }}
                className="flex items-center gap-3 px-2 py-3 active:bg-bg-elev rounded-md text-left"
              >
                <span
                  className="w-3.5 h-3.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: t.color }}
                />
                <span className="text-body-em font-medium">{t.name}</span>
              </button>
            ))}
          </div>
        )}
      </BottomSheet>
    </ScreenShell>
  );
}

function SheetAction({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 px-2 py-3 active:bg-bg-elev rounded-md text-left',
        danger ? 'text-error' : 'text-text'
      )}
    >
      <span className="w-9 h-9 rounded-md bg-bg-elev2 flex items-center justify-center flex-shrink-0">
        {icon}
      </span>
      <span className="text-body-em font-medium">{label}</span>
    </button>
  );
}
