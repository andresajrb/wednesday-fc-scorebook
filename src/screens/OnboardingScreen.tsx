import { useState } from 'react';
import { ArrowLeft, Download, Plus, X } from 'lucide-react';
import { ScreenShell } from '@/components/primitives/ScreenShell';
import { Button } from '@/components/primitives/Button';
import { IconButton } from '@/components/primitives/IconButton';
import { TeamSwatch } from '@/components/domain/TeamSwatch';
import { ImportTeamsSheet } from '@/components/domain/ImportTeamsSheet';
import { competitionNameTaken } from '@/components/domain/CompetitionSwitcher';
import { Logo } from '@/components/primitives/Logo';
import { useStore, type TeamImport } from '@/store/useStore';
import { DEFAULT_TEAMS, COLOR_SWATCHES, nextFreeColor } from '@/lib/colors';
import { DEFAULT_COMPETITION_NAME, MIN_JORNADA_TEAMS } from '@/types/domain';

const MAX_ONBOARDING_TEAMS = 8;

interface OnboardingScreenProps {
  /** Viene del selector de competiciones: se está creando una competición nueva. */
  newCompetitionName?: string;
}

export function OnboardingScreen({ newCompetitionName }: OnboardingScreenProps) {
  const state = useStore((s) => s.state);
  const back = useStore((s) => s.back);
  const completeOnboarding = useStore((s) => s.completeOnboarding);
  const renameCompetition = useStore((s) => s.renameCompetition);
  const isNew = newCompetitionName !== undefined;
  // Competición activa sin equipos (caso raro): se completa esa en vez de crear otra.
  const existing =
    !isNew && state.activeCompetitionId ? state.competitions[state.activeCompetitionId] : undefined;
  const hasOtherCompetitions = Object.keys(state.competitions).length > 0;

  const [competitionName, setCompetitionName] = useState(
    newCompetitionName ?? existing?.name ?? DEFAULT_COMPETITION_NAME
  );
  const [teams, setTeams] = useState(() => DEFAULT_TEAMS.map((t) => ({ ...t })));
  const [imports, setImports] = useState<TeamImport[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [openSwatch, setOpenSwatch] = useState<number | null>(null);

  const setName = (i: number, name: string) =>
    setTeams((prev) => prev.map((t, idx) => (idx === i ? { ...t, name } : t)));

  const setColor = (i: number, color: string) =>
    setTeams((prev) => prev.map((t, idx) => (idx === i ? { ...t, color } : t)));

  const addTeam = () =>
    setTeams((prev) => [
      ...prev,
      { name: `Equipo ${prev.length + 1}`, color: nextFreeColor(prev.map((t) => t.color)) },
    ]);

  const removeTeam = (i: number) => {
    setOpenSwatch(null);
    setTeams((prev) => prev.filter((_, idx) => idx !== i));
  };

  const total = teams.length + imports.length;
  const trimmedName = competitionName.trim();
  const nameTaken =
    trimmedName.length > 0 && competitionNameTaken(state, trimmedName, existing?.id);
  const allNames = [...teams.map((t) => t.name), ...imports.map((i) => i.name)].map((n) =>
    n.trim().toLowerCase()
  );
  const duplicatedNames = new Set(allNames).size !== allNames.length;
  const valid =
    trimmedName.length > 0 &&
    !nameTaken &&
    !duplicatedNames &&
    total >= MIN_JORNADA_TEAMS &&
    teams.every((t) => t.name.trim().length > 0);

  const submit = () => {
    if (!valid) return;
    if (existing) renameCompetition(existing.id, trimmedName);
    completeOnboarding(
      teams.map((t) => ({ name: t.name.trim(), color: t.color })),
      { competitionName: existing ? undefined : trimmedName, imports }
    );
  };

  return (
    <ScreenShell>
      <div className="flex-1 px-5 pt-12 pb-6">
        {isNew && (
          <div className="-mt-8 mb-4 -ml-2">
            <IconButton ariaLabel="Volver" onClick={back}>
              <ArrowLeft size={20} strokeWidth={1.75} />
            </IconButton>
          </div>
        )}
        <div className="flex items-center gap-3 mb-6">
          <Logo size={48} className="text-accent flex-shrink-0" />
          <div>
            <h1 className="text-title font-bold tracking-tight">
              {isNew ? 'Nueva competición' : 'Miércoles de Fútbol'}
            </h1>
            <p className="text-caption text-text-2">Configura tus equipos</p>
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-caption text-text-3 uppercase tracking-wide mb-1">
            Competición
          </label>
          <input
            data-field="competition-name"
            className="w-full bg-transparent border-b border-border focus:border-accent outline-none text-body-em font-semibold py-1"
            value={competitionName}
            onChange={(e) => setCompetitionName(e.target.value)}
            placeholder="Nombre de la competición"
            maxLength={32}
          />
          {nameTaken && (
            <div className="text-caption text-error mt-1">Ya hay una competición con ese nombre.</div>
          )}
        </div>

        <p className="text-body text-text-2 mb-6">
          Estos son los nombres y colores de tus equipos. Puedes cambiarlos ahora o después, y
          sumar equipos invitados cuando haga falta. Se juega con 3 a 6 equipos por jornada.
        </p>
        <div className="space-y-3">
          {teams.map((team, i) => (
            <div
              key={i}
              className="bg-bg-elev border border-border rounded-card p-3 flex items-center gap-3"
            >
              <button
                type="button"
                onClick={() => setOpenSwatch((s) => (s === i ? null : i))}
                aria-label="Cambiar color"
                className="w-12 h-12 rounded-full flex-shrink-0 active:scale-90 transition-transform ring-1 ring-white/10"
                style={{ backgroundColor: team.color }}
              />
              <div className="flex-1 min-w-0">
                <label className="block text-caption text-text-3 uppercase tracking-wide mb-1">
                  Equipo {i + 1}
                </label>
                <input
                  className="w-full bg-transparent border-b border-border focus:border-accent outline-none text-body-em font-semibold py-1"
                  value={team.name}
                  onChange={(e) => setName(i, e.target.value)}
                  placeholder="Nombre del equipo"
                  maxLength={32}
                />
              </div>
              {total > MIN_JORNADA_TEAMS && (
                <button
                  type="button"
                  onClick={() => removeTeam(i)}
                  aria-label={`Quitar ${team.name || 'equipo'}`}
                  className="w-9 h-9 rounded-md flex items-center justify-center text-text-3 active:bg-bg-elev2 flex-shrink-0"
                >
                  <X size={18} strokeWidth={1.75} />
                </button>
              )}
            </div>
          ))}

          {imports.map((imp) => {
            const source = state.teams[imp.teamId];
            const players = Object.values(state.players).filter(
              (p) => p.teamId === imp.teamId && p.active
            ).length;
            return (
              <div
                key={imp.teamId}
                className="bg-bg-elev border border-border rounded-card p-3 flex items-center gap-3"
              >
                <span
                  className="w-12 h-12 rounded-full flex-shrink-0 ring-1 ring-white/10"
                  style={{ backgroundColor: source?.color }}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-caption text-text-3 uppercase tracking-wide mb-1">
                    Importado · {players} {players === 1 ? 'jugador' : 'jugadores'}
                  </div>
                  <div className="text-body-em font-semibold truncate">{imp.name}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setImports((prev) => prev.filter((x) => x.teamId !== imp.teamId))}
                  aria-label={`Quitar ${imp.name}`}
                  className="w-9 h-9 rounded-md flex items-center justify-center text-text-3 active:bg-bg-elev2 flex-shrink-0"
                >
                  <X size={18} strokeWidth={1.75} />
                </button>
              </div>
            );
          })}

          {total < MAX_ONBOARDING_TEAMS && (
            <button
              type="button"
              onClick={addTeam}
              className="w-full flex items-center justify-center gap-2 h-12 rounded-card border border-dashed border-border-strong text-text-2 active:bg-bg-elev"
            >
              <Plus size={16} strokeWidth={1.75} />
              <span className="text-body-em font-medium">Agregar equipo</span>
            </button>
          )}
          {hasOtherCompetitions && (
            <button
              type="button"
              onClick={() => setImportOpen(true)}
              className="w-full flex items-center justify-center gap-2 h-12 rounded-card border border-dashed border-border-strong text-text-2 active:bg-bg-elev"
            >
              <Download size={16} strokeWidth={1.75} />
              <span className="text-body-em font-medium">Importar de otra competición</span>
            </button>
          )}
          {duplicatedNames && (
            <div className="text-caption text-error">Hay dos equipos con el mismo nombre.</div>
          )}
        </div>
        {openSwatch !== null && teams[openSwatch] && (
          <div className="mt-3 bg-bg-elev border border-border rounded-card p-4">
            <div className="text-caption text-text-2 uppercase tracking-wide mb-2">
              Color de {teams[openSwatch].name || 'equipo'}
            </div>
            <div className="flex flex-wrap gap-2">
              {COLOR_SWATCHES.map((c) => (
                <TeamSwatch
                  key={c}
                  color={c}
                  size={36}
                  selected={teams[openSwatch].color === c}
                  onClick={() => {
                    setColor(openSwatch, c);
                  }}
                  ariaLabel={`Color ${c}`}
                />
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="px-5 pb-6" style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
        <Button size="xl" fullWidth disabled={!valid} onClick={submit}>
          {isNew ? 'Crear competición' : 'Empezar'}
        </Button>
      </div>

      <ImportTeamsSheet
        open={importOpen}
        onClose={() => setImportOpen(false)}
        targetCompetitionId={null}
        takenNames={[...teams.map((t) => t.name), ...imports.map((i) => i.name)]}
        onConfirm={(picked) => {
          const nextImports = [
            ...imports,
            ...picked.filter((p) => !imports.some((x) => x.teamId === p.teamId)),
          ];
          setImports(nextImports);
          // Los importados traen su color: los equipos nuevos que choquen toman uno libre.
          const used = nextImports
            .map((i) => state.teams[i.teamId]?.color)
            .filter((c): c is string => !!c);
          setTeams((prev) =>
            prev.map((t) => {
              if (!used.includes(t.color)) {
                used.push(t.color);
                return t;
              }
              const color = nextFreeColor(used);
              used.push(color);
              return { ...t, color };
            })
          );
        }}
      />
    </ScreenShell>
  );
}
