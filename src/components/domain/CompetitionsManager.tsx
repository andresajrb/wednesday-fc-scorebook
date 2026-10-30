import { useState } from 'react';
import { Archive, ArchiveRestore, Trash2 } from 'lucide-react';
import { BottomSheet } from '@/components/primitives/BottomSheet';
import { Button } from '@/components/primitives/Button';
import { competitionNameTaken } from '@/components/domain/CompetitionSwitcher';
import { competitionLockReason, useStore } from '@/store/useStore';
import { getArchivedCompetitions, getVisibleCompetitions } from '@/store/scope';
import type { Competition } from '@/types/domain';

/** Sección de Configuración: renombrar, archivar, restaurar y eliminar competiciones. */
export function CompetitionsManager() {
  const state = useStore((s) => s.state);
  const renameCompetition = useStore((s) => s.renameCompetition);
  const setCompetitionArchived = useStore((s) => s.setCompetitionArchived);
  const deleteCompetition = useStore((s) => s.deleteCompetition);
  const [toDelete, setToDelete] = useState<Competition | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  const visible = getVisibleCompetitions(state);
  const archived = getArchivedCompetitions(state);

  const counts = (id: string) => {
    const teams = Object.values(state.teams).filter((t) => t.competitionId === id).length;
    const jornadas = Object.values(state.jornadas).filter((j) => j.competitionId === id).length;
    return `${teams} ${teams === 1 ? 'equipo' : 'equipos'} · ${jornadas} ${jornadas === 1 ? 'jornada' : 'jornadas'}`;
  };

  const closeDelete = () => {
    setToDelete(null);
    setConfirmText('');
  };

  const confirmDelete = async () => {
    if (!toDelete || confirmText.trim() !== toDelete.name) return;
    setDeleting(true);
    await deleteCompetition(toDelete.id);
    setDeleting(false);
    closeDelete();
  };

  return (
    <section data-testid="competitions-manager">
      <div className="text-caption uppercase tracking-wider text-text-2 font-semibold mb-2">
        Competiciones
      </div>
      <div className="bg-bg-elev border border-border rounded-card overflow-hidden">
        {visible.map((c, idx) => (
          <CompetitionRow
            key={c.id}
            competition={c}
            detail={counts(c.id)}
            active={c.id === state.activeCompetitionId}
            lockReason={competitionLockReason(state, c.id)}
            bordered={idx > 0}
            onRename={(name) => {
              if (competitionNameTaken(state, name, c.id)) return false;
              renameCompetition(c.id, name);
              return true;
            }}
            onArchive={() => setCompetitionArchived(c.id, true)}
            onDelete={() => setToDelete(c)}
          />
        ))}
      </div>

      {archived.length > 0 && (
        <>
          <div className="text-caption uppercase tracking-wider text-text-3 font-semibold mt-4 mb-2">
            Archivadas
          </div>
          <div className="bg-bg-elev border border-border rounded-card overflow-hidden">
            {archived.map((c, idx) => (
              <div
                key={c.id}
                className={`flex items-center gap-2 p-3 ${idx > 0 ? 'border-t border-border' : ''}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-body-em text-text-2 truncate">{c.name}</div>
                  <div className="text-caption text-text-3">{counts(c.id)}</div>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  leading={<ArchiveRestore size={14} strokeWidth={1.75} />}
                  onClick={() => setCompetitionArchived(c.id, false)}
                >
                  Restaurar
                </Button>
                <button
                  type="button"
                  onClick={() => setToDelete(c)}
                  aria-label={`Eliminar ${c.name}`}
                  className="w-9 h-9 rounded-md flex items-center justify-center text-error active:bg-bg-elev2"
                >
                  <Trash2 size={16} strokeWidth={1.75} />
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      <BottomSheet open={!!toDelete} onClose={closeDelete} title={`Eliminar ${toDelete?.name ?? ''}`}>
        {toDelete && (
          <div className="space-y-3 pb-2">
            <p className="text-body text-text-2 leading-relaxed">
              Se borran para siempre sus equipos, jugadores, jornadas, partidas y goles (
              {counts(toDelete.id)}). Antes se guarda una copia en los respaldos automáticos.
            </p>
            <p className="text-body text-text-2">
              Para confirmar, escribe <span className="font-semibold text-text">{toDelete.name}</span>:
            </p>
            <input
              autoFocus
              data-field="delete-confirm"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="w-full bg-bg-elev border border-border focus:border-error rounded-btn outline-none px-3 h-12 text-body-em font-semibold"
            />
            <Button
              size="lg"
              variant="danger"
              fullWidth
              disabled={confirmText.trim() !== toDelete.name || deleting}
              leading={<Trash2 size={16} strokeWidth={1.75} />}
              onClick={confirmDelete}
            >
              Eliminar para siempre
            </Button>
            <Button size="lg" variant="ghost" fullWidth onClick={closeDelete}>
              Cancelar
            </Button>
          </div>
        )}
      </BottomSheet>
    </section>
  );
}

function CompetitionRow({
  competition,
  detail,
  active,
  lockReason,
  bordered,
  onRename,
  onArchive,
  onDelete,
}: {
  competition: Competition;
  detail: string;
  active: boolean;
  lockReason: string | null;
  bordered: boolean;
  /** Falso si el nombre ya lo usa otra competición. */
  onRename: (name: string) => boolean;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState(competition.name);
  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== competition.name && onRename(trimmed)) return;
    setDraft(competition.name);
  };

  return (
    <div className={`p-3 ${bordered ? 'border-t border-border' : ''}`}>
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <input
            aria-label={`Nombre de ${competition.name}`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            }}
            maxLength={32}
            className="w-full bg-transparent outline-none text-body-em font-bold"
          />
          <div className="text-caption text-text-3">
            {detail}
            {active && ' · en uso'}
          </div>
        </div>
        <button
          type="button"
          onClick={onArchive}
          disabled={!!lockReason}
          aria-label={`Archivar ${competition.name}`}
          className="w-9 h-9 rounded-md flex items-center justify-center text-text-2 active:bg-bg-elev2 disabled:opacity-30"
        >
          <Archive size={16} strokeWidth={1.75} />
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={!!lockReason}
          aria-label={`Eliminar ${competition.name}`}
          className="w-9 h-9 rounded-md flex items-center justify-center text-error active:bg-bg-elev2 disabled:opacity-30"
        >
          <Trash2 size={16} strokeWidth={1.75} />
        </button>
      </div>
      {lockReason && <div className="text-caption text-text-3 mt-1">{lockReason}</div>}
    </div>
  );
}
