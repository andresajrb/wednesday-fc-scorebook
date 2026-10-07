import { Users } from 'lucide-react';
import type { JornadaQueue, NextMatchPrediction } from '@/store/selectors';
import type { ID, Team } from '@/types/domain';

interface JornadaQueueCardProps {
  queue: JornadaQueue;
  prediction: NextMatchPrediction | null;
  /** Con la predicción apagada no se muestra la cola: solo quiénes vinieron hoy. */
  showQueue: boolean;
  jornadaTeams: Team[];
  teams: Record<ID, Team>;
  teamCount: number;
  onManageTeams?: () => void;
}

const LABEL =
  'text-caption uppercase tracking-wider text-text-3 font-semibold w-[5.5rem] whitespace-nowrap flex-shrink-0';

/** La seguidilla: quién está en cancha, quién entra después y el resto de la cola. */
export function JornadaQueueCard({
  queue,
  prediction,
  showQueue,
  jornadaTeams,
  teams,
  teamCount,
  onManageTeams,
}: JornadaQueueCardProps) {
  const manage = onManageTeams && <ManageButton count={teamCount} onClick={onManageTeams} />;

  if (!showQueue) {
    return (
      <div className="bg-bg-elev border border-border rounded-card p-3" data-testid="queue-card">
        <div className="flex items-center gap-2">
          <span className={LABEL}>Equipos</span>
          <div className="flex-1 min-w-0 flex flex-wrap gap-x-3 gap-y-1 text-caption text-text-2">
            {jornadaTeams.map((t) => (
              <TeamName key={t.id} team={t} />
            ))}
          </div>
          {manage}
        </div>
      </div>
    );
  }

  const { inProgress, unseen, queue: known, finishedCount } = queue;
  // Orden conocido: un único equipo sin ver va adelante; si son varios, no se sabe cuál.
  const ordered = [...(unseen.length === 1 ? unseen : []), ...known];
  const undecided = unseen.length > 1 ? unseen : [];

  let headline: { label: string; a: ID; b: ID } | null = null;
  let entering: ID | null = null;
  if (inProgress) {
    headline = { label: 'En cancha', a: inProgress.teamAId, b: inProgress.teamBId };
    entering = undecided.length > 0 ? null : (ordered[0] ?? null);
  } else if (prediction) {
    headline = { label: 'Próxima', a: prediction.teamAId, b: prediction.teamBId };
  }
  const shown = new Set([headline?.a, headline?.b, entering]);
  const restOrdered = ordered.filter((t) => !shown.has(t));
  const restUndecided = undecided.filter((t) => !shown.has(t));

  return (
    <div className="bg-bg-elev border border-border rounded-card p-3" data-testid="queue-card">
      <div className="flex items-center gap-2">
        <span className={LABEL}>{headline?.label ?? 'Próxima'}</span>
        <div className="flex-1 min-w-0 flex items-center gap-1.5 text-[14px] font-semibold">
          {headline ? (
            <>
              <TeamName team={teams[headline.a]} />
              <span className="text-text-3 font-normal">vs</span>
              <TeamName team={teams[headline.b]} />
            </>
          ) : (
            <span className="text-text-2 font-normal text-caption">
              {finishedCount === 0
                ? 'Elige la primera partida a mano.'
                : 'Elige a mano: aún no se puede predecir.'}
            </span>
          )}
        </div>
        {manage}
      </div>
      {prediction && !inProgress && (
        <p className="mt-2 text-[11px] text-text-3 leading-snug">
          Confirma o cambia manualmente si no es correcto.
        </p>
      )}
      {entering && (
        <div className="mt-2 flex items-center gap-2 text-caption">
          <span className={LABEL}>Entra</span>
          <span className="text-text-2">
            Ganador vs <TeamName team={teams[entering]} />
          </span>
        </div>
      )}
      {restOrdered.length > 0 && (
        <div className="mt-2 flex items-start gap-2 text-caption">
          <span className={`${LABEL} pt-px`}>En cola</span>
          <ol className="flex-1 min-w-0 flex flex-wrap gap-x-3 gap-y-1" data-testid="queue-list">
            {restOrdered.map((t, i) => (
              <li key={t} className="inline-flex items-center gap-1 text-text-2">
                <span className="font-mono text-text-3">{i + 1}.</span>
                <TeamName team={teams[t]} />
              </li>
            ))}
          </ol>
        </div>
      )}
      {restUndecided.length > 0 && (
        <div className="mt-2 flex items-start gap-2 text-caption">
          <span className={`${LABEL} pt-px`}>Sin orden</span>
          <div className="flex-1 min-w-0 flex flex-wrap gap-x-3 gap-y-1 text-text-2">
            {restUndecided.map((t) => (
              <TeamName key={t} team={teams[t]} />
            ))}
          </div>
        </div>
      )}
      {inProgress && (
        <p className="mt-2 text-[11px] text-text-3 leading-snug">
          El que pierde va al final de la cola.
        </p>
      )}
    </div>
  );
}

function ManageButton({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Equipos de la jornada"
      className="inline-flex items-center gap-1 h-8 px-2.5 rounded-btn bg-bg-elev2 border border-border text-caption font-medium active:bg-bg flex-shrink-0"
    >
      <Users size={14} strokeWidth={1.75} />
      {count}
    </button>
  );
}

function TeamName({ team }: { team: Team | undefined }) {
  if (!team) return <span className="text-text-3">?</span>;
  return (
    <span className="inline-flex items-center gap-1 min-w-0">
      <span
        className="w-2.5 h-2.5 rounded-full flex-shrink-0 ring-1 ring-white/25"
        style={{ backgroundColor: team.color }}
      />
      <span className="truncate">{team.name}</span>
    </span>
  );
}
