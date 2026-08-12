import { useState } from 'react';
import { ScreenShell } from '@/components/primitives/ScreenShell';
import { Button } from '@/components/primitives/Button';
import { TeamSwatch } from '@/components/domain/TeamSwatch';
import { Logo } from '@/components/primitives/Logo';
import { useStore } from '@/store/useStore';
import { DEFAULT_TEAMS, COLOR_SWATCHES } from '@/lib/colors';

export function OnboardingScreen() {
  const [teams, setTeams] = useState(() => DEFAULT_TEAMS.map((t) => ({ ...t })));
  const [openSwatch, setOpenSwatch] = useState<number | null>(null);
  const completeOnboarding = useStore((s) => s.completeOnboarding);

  const setName = (i: number, name: string) =>
    setTeams((prev) => prev.map((t, idx) => (idx === i ? { ...t, name } : t)));

  const setColor = (i: number, color: string) =>
    setTeams((prev) => prev.map((t, idx) => (idx === i ? { ...t, color } : t)));

  const valid = teams.every((t) => t.name.trim().length > 0);

  return (
    <ScreenShell>
      <div className="flex-1 px-5 pt-12 pb-6">
        <div className="flex items-center gap-3 mb-6">
          <Logo size={48} className="text-accent flex-shrink-0" />
          <div>
            <h1 className="text-title font-bold tracking-tight">Miércoles de Fútbol</h1>
            <p className="text-caption text-text-2">Configura tus 4 equipos</p>
          </div>
        </div>
        <p className="text-body text-text-2 mb-6">
          Estos son los nombres y colores de tus equipos. Puedes cambiarlos ahora o después.
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
            </div>
          ))}
        </div>
        {openSwatch !== null && (
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
        <Button
          size="xl"
          fullWidth
          disabled={!valid}
          onClick={() => completeOnboarding(teams.map((t) => ({ name: t.name.trim(), color: t.color })))}
        >
          Empezar
        </Button>
      </div>
    </ScreenShell>
  );
}
