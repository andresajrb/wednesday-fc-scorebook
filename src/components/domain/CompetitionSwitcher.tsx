import { useState } from 'react';
import { Check, ChevronDown, Plus } from 'lucide-react';
import { BottomSheet } from '@/components/primitives/BottomSheet';
import { Button } from '@/components/primitives/Button';
import { useStore } from '@/store/useStore';
import { getActiveCompetition, getVisibleCompetitions } from '@/store/scope';
import type { AppState } from '@/types/domain';

/** ¿Ya existe una competición con ese nombre (archivadas incluidas)? */
export function competitionNameTaken(state: AppState, name: string, exceptId?: string): boolean {
  const wanted = name.trim().toLowerCase();
  return Object.values(state.competitions).some(
    (c) => c.id !== exceptId && c.name.trim().toLowerCase() === wanted
  );
}

/** Nombre de la competición activa en el inicio; al tocarlo se cambia o se crea otra. */
export function CompetitionSwitcher() {
  const state = useStore((s) => s.state);
  const setActiveCompetition = useStore((s) => s.setActiveCompetition);
  const navigate = useStore((s) => s.navigate);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');

  const active = getActiveCompetition(state);
  const competitions = getVisibleCompetitions(state);
  const trimmed = name.trim();
  const taken = trimmed.length > 0 && competitionNameTaken(state, trimmed);

  const close = () => {
    setOpen(false);
    setCreating(false);
    setName('');
  };

  const create = () => {
    if (!trimmed || taken) return;
    close();
    navigate({ name: 'onboarding', newCompetitionName: trimmed });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex-1 min-w-0 flex items-center gap-1.5 text-left active:opacity-70"
        aria-label="Cambiar de competición"
      >
        <span className="text-[22px] font-bold tracking-tight truncate">
          {active?.name ?? 'Miércoles'}
        </span>
        <ChevronDown size={20} strokeWidth={2} className="text-text-2 flex-shrink-0" />
      </button>

      <BottomSheet open={open} onClose={close} title="Competiciones">
        <div className="space-y-3 pb-2">
          <div className="bg-bg-elev border border-border rounded-card overflow-hidden">
            {competitions.map((c, idx) => {
              const selected = c.id === active?.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    if (!selected) setActiveCompetition(c.id);
                    close();
                  }}
                  className={`w-full flex items-center gap-3 px-3 h-14 text-left active:bg-bg-elev2 ${
                    idx > 0 ? 'border-t border-border' : ''
                  }`}
                >
                  <span className="flex-1 min-w-0 text-body-em font-semibold truncate">{c.name}</span>
                  {selected && <Check size={18} strokeWidth={2.25} className="text-accent" />}
                </button>
              );
            })}
          </div>

          {creating ? (
            <div className="space-y-2">
              <input
                autoFocus
                data-field="competition-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') create();
                }}
                placeholder="Nombre (p. ej. Sábados)"
                maxLength={32}
                className="w-full bg-bg-elev border border-border focus:border-accent rounded-btn outline-none px-3 h-12 text-body-em font-semibold"
              />
              {taken && (
                <div className="text-caption text-error">Ya hay una competición con ese nombre.</div>
              )}
              <Button size="lg" fullWidth disabled={!trimmed || taken} onClick={create}>
                Continuar con los equipos
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="w-full flex items-center justify-center gap-2 h-12 rounded-card border border-dashed border-border-strong text-text-2 active:bg-bg-elev"
            >
              <Plus size={16} strokeWidth={1.75} />
              <span className="text-body-em font-medium">Nueva competición</span>
            </button>
          )}
          <p className="text-caption text-text-3 leading-relaxed">
            Cada competición tiene sus propios equipos, jugadores y jornadas. La configuración es la
            misma para todas.
          </p>
        </div>
      </BottomSheet>
    </>
  );
}
