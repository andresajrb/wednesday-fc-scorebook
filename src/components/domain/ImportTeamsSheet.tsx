import { useEffect, useState } from 'react';
import { Check, Download } from 'lucide-react';
import { BottomSheet } from '@/components/primitives/BottomSheet';
import { Button } from '@/components/primitives/Button';
import { useStore, type TeamImport } from '@/store/useStore';
import { cn } from '@/lib/cn';
import type { ID } from '@/types/domain';

interface ImportTeamsSheetProps {
  open: boolean;
  onClose: () => void;
  /** Competición destino (no aparece como origen). Null si todavía no existe. */
  targetCompetitionId: ID | null;
  /** Nombres que ya usa la competición destino: un equipo importado no puede repetirlos. */
  takenNames: string[];
  onConfirm: (imports: TeamImport[]) => void;
}

/**
 * Elegir equipos de otra competición para copiarlos con sus jugadores activos. La copia
 * es independiente: no trae historial y lo que pase después no toca al original.
 */
export function ImportTeamsSheet({
  open,
  onClose,
  targetCompetitionId,
  takenNames,
  onConfirm,
}: ImportTeamsSheetProps) {
  const state = useStore((s) => s.state);
  const sources = Object.values(state.competitions)
    .filter((c) => c.id !== targetCompetitionId)
    .sort((a, b) => Number(a.archived) - Number(b.archived) || a.createdAt.localeCompare(b.createdAt));
  const [sourceId, setSourceId] = useState<ID | null>(null);
  const [picked, setPicked] = useState<Record<ID, string>>({});

  useEffect(() => {
    if (!open) return;
    setSourceId(sources[0]?.id ?? null);
    setPicked({});
    // Solo al abrir.
  }, [open]);

  const teams = Object.values(state.teams)
    .filter((t) => t.competitionId === sourceId && !t.archived)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const activePlayers = (teamId: ID) =>
    Object.values(state.players).filter((p) => p.teamId === teamId && p.active).length;

  const normalized = (name: string) => name.trim().toLowerCase();
  const pickedEntries = Object.entries(picked);
  const conflict = (teamId: ID): string | null => {
    const name = normalized(picked[teamId] ?? '');
    if (!name) return 'Ponle un nombre.';
    if (takenNames.some((n) => normalized(n) === name)) return 'Ya hay un equipo con ese nombre.';
    if (pickedEntries.some(([id, n]) => id !== teamId && normalized(n) === name)) {
      return 'Repetido entre los que vas a importar.';
    }
    return null;
  };
  const valid = pickedEntries.length > 0 && pickedEntries.every(([id]) => !conflict(id));

  const toggle = (teamId: ID, name: string) =>
    setPicked((prev) => {
      const next = { ...prev };
      if (teamId in next) delete next[teamId];
      else next[teamId] = name;
      return next;
    });

  const confirm = () => {
    if (!valid) return;
    onConfirm(pickedEntries.map(([teamId, name]) => ({ teamId, name: name.trim() })));
    onClose();
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Importar equipos">
      {sources.length === 0 ? (
        <p className="text-caption text-text-3 py-4">No hay otras competiciones de donde importar.</p>
      ) : (
        <div className="space-y-4 pb-2">
          <p className="text-caption text-text-2 leading-relaxed">
            Se copian con sus jugadores activos, sin historial. La copia queda independiente del
            original.
          </p>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Competición de origen">
            {sources.map((c) => (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={c.id === sourceId}
                onClick={() => {
                  setSourceId(c.id);
                  setPicked({});
                }}
                className={cn(
                  'h-9 px-3 rounded-full border text-caption font-semibold',
                  c.id === sourceId
                    ? 'border-accent bg-accent/10 text-text'
                    : 'border-border bg-bg-elev2 text-text-2'
                )}
              >
                {c.name}
                {c.archived && ' (archivada)'}
              </button>
            ))}
          </div>

          {teams.length === 0 ? (
            <p className="text-caption text-text-3">Esa competición no tiene equipos.</p>
          ) : (
            <div className="bg-bg-elev border border-border rounded-card overflow-hidden">
              {teams.map((t, idx) => {
                const selected = t.id in picked;
                const error = selected ? conflict(t.id) : null;
                const count = activePlayers(t.id);
                return (
                  <div key={t.id} className={idx > 0 ? 'border-t border-border' : ''}>
                    <button
                      type="button"
                      aria-pressed={selected}
                      onClick={() => toggle(t.id, t.name)}
                      className="w-full flex items-center gap-3 px-3 h-14 text-left active:bg-bg-elev2"
                    >
                      <span
                        className="w-4 h-4 rounded-full flex-shrink-0 ring-1 ring-white/25"
                        style={{ backgroundColor: t.color }}
                      />
                      <span className="flex-1 min-w-0">
                        <span className="block text-body-em font-semibold truncate">{t.name}</span>
                        <span className="block text-caption text-text-3">
                          {count} {count === 1 ? 'jugador' : 'jugadores'}
                        </span>
                      </span>
                      <span
                        className={cn(
                          'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 border',
                          selected
                            ? 'bg-accent text-text-inv border-accent'
                            : 'border-border-strong text-transparent'
                        )}
                        aria-hidden="true"
                      >
                        <Check size={16} strokeWidth={2.5} />
                      </span>
                    </button>
                    {/* Visible mientras choque o mientras se esté renombrando. */}
                    {selected && (error || picked[t.id] !== t.name) && (
                      <div className="px-3 pb-3 space-y-1">
                        <input
                          aria-label={`Nuevo nombre para ${t.name}`}
                          value={picked[t.id]}
                          onChange={(e) => setPicked((prev) => ({ ...prev, [t.id]: e.target.value }))}
                          maxLength={32}
                          className={cn(
                            'w-full bg-bg-elev2 border focus:border-accent rounded-btn outline-none px-3 h-10 text-body font-semibold',
                            error ? 'border-error/50' : 'border-border'
                          )}
                        />
                        {error && (
                          <div className="text-caption text-error">{error} Cámbiale el nombre.</div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <Button
            size="xl"
            fullWidth
            disabled={!valid}
            onClick={confirm}
            leading={<Download size={18} strokeWidth={1.75} />}
          >
            {pickedEntries.length > 1
              ? `Importar ${pickedEntries.length} equipos`
              : 'Importar equipo'}
          </Button>
        </div>
      )}
    </BottomSheet>
  );
}
