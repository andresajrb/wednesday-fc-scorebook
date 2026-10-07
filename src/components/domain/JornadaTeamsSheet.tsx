import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { BottomSheet } from '@/components/primitives/BottomSheet';
import { TeamFormSheet } from '@/components/domain/TeamFormSheet';
import { GuestBadge } from '@/components/domain/TeamPickRow';
import { useStore } from '@/store/useStore';
import { getJornadaTeams, getMatchesForJornada, getSortedTeams } from '@/store/selectors';
import { MAX_JORNADA_TEAMS, MIN_JORNADA_TEAMS, type ID, type Team } from '@/types/domain';

interface JornadaTeamsSheetProps {
  open: boolean;
  onClose: () => void;
  jornadaId: ID;
}

/** Equipos de la jornada en curso: sumar a uno que llegó tarde o quitar a uno que no vino. */
export function JornadaTeamsSheet({ open, onClose, jornadaId }: JornadaTeamsSheetProps) {
  const state = useStore((s) => s.state);
  const addTeamToJornada = useStore((s) => s.addTeamToJornada);
  const removeTeamFromJornada = useStore((s) => s.removeTeamFromJornada);
  const [creating, setCreating] = useState(false);

  const jornadaTeams = getJornadaTeams(state, jornadaId);
  const matches = getMatchesForJornada(state, jornadaId);
  const hasPlayed = (id: ID) => matches.some((m) => m.teamAId === id || m.teamBId === id);
  const available = getSortedTeams(state).filter((t) => !jornadaTeams.some((j) => j.id === t.id));
  const full = jornadaTeams.length >= MAX_JORNADA_TEAMS;
  const atMinimum = jornadaTeams.length <= MIN_JORNADA_TEAMS;
  const started = matches.length > 0;

  return (
    <>
      <BottomSheet open={open && !creating} onClose={onClose} title="Equipos de la jornada">
        <div className="space-y-4 pb-2">
          <div className="bg-bg-elev border border-border rounded-card overflow-hidden">
            {jornadaTeams.map((t, idx) => (
              <Row key={t.id} team={t} bordered={idx > 0}>
                {hasPlayed(t.id) ? (
                  <span className="text-caption text-text-3">Ya jugó</span>
                ) : (
                  <button
                    type="button"
                    disabled={atMinimum}
                    onClick={() => removeTeamFromJornada(jornadaId, t.id)}
                    aria-label={`Quitar ${t.name} de la jornada`}
                    className="w-9 h-9 rounded-md flex items-center justify-center text-text-2 active:bg-bg-elev2 disabled:opacity-30"
                  >
                    <X size={18} strokeWidth={1.75} />
                  </button>
                )}
              </Row>
            ))}
          </div>
          <p className="text-caption text-text-3 leading-relaxed">
            {atMinimum
              ? `Se necesitan al menos ${MIN_JORNADA_TEAMS} equipos.`
              : 'Solo se puede quitar a un equipo que todavía no jugó.'}
          </p>

          <div>
            <div className="text-caption text-text-2 uppercase tracking-wide mb-2">
              {started ? 'Llegó otro equipo' : 'Sumar equipo'}
            </div>
            {full ? (
              <p className="text-caption text-text-3">
                Ya hay {MAX_JORNADA_TEAMS} equipos, el máximo por jornada.
              </p>
            ) : (
              <div className="bg-bg-elev border border-border rounded-card overflow-hidden">
                {available.map((t, idx) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => addTeamToJornada(jornadaId, t.id)}
                    className={`w-full text-left active:bg-bg-elev2 ${idx > 0 ? 'border-t border-border' : ''}`}
                  >
                    <Row team={t}>
                      <Plus size={18} strokeWidth={1.75} className="text-accent" />
                    </Row>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setCreating(true)}
                  className={`w-full flex items-center justify-center gap-2 h-12 text-text-2 active:bg-bg-elev2 ${
                    available.length > 0 ? 'border-t border-dashed border-border-strong' : ''
                  }`}
                >
                  <Plus size={16} strokeWidth={1.75} />
                  <span className="text-body-em font-medium">Nuevo equipo invitado</span>
                </button>
              </div>
            )}
            {started && !full && (
              <p className="text-caption text-text-3 mt-2 leading-relaxed">
                El que llega entra al final de la cola.
              </p>
            )}
          </div>
        </div>
      </BottomSheet>
      <TeamFormSheet
        open={open && creating}
        onClose={() => setCreating(false)}
        defaultKind="guest"
        onCreated={(id) => addTeamToJornada(jornadaId, id)}
      />
    </>
  );
}

function Row({
  team,
  bordered,
  children,
}: {
  team: Team;
  bordered?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className={`flex items-center gap-3 px-3 h-14 ${bordered ? 'border-t border-border' : ''}`}>
      <span
        className="w-4 h-4 rounded-full flex-shrink-0 ring-1 ring-white/25"
        style={{ backgroundColor: team.color }}
      />
      <span className="flex-1 min-w-0 flex items-center gap-2">
        <span className="text-body-em font-semibold truncate">{team.name}</span>
        {team.kind === 'guest' && <GuestBadge />}
      </span>
      {children}
    </div>
  );
}
