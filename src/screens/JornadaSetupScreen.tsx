import { useState } from 'react';
import { ArrowLeft, Play, Plus } from 'lucide-react';
import { ScreenShell } from '@/components/primitives/ScreenShell';
import { Header } from '@/components/primitives/Header';
import { IconButton } from '@/components/primitives/IconButton';
import { Button } from '@/components/primitives/Button';
import { StickyBottomCTA } from '@/components/primitives/StickyBottomCTA';
import { TeamFormSheet } from '@/components/domain/TeamFormSheet';
import { TeamPickRow } from '@/components/domain/TeamPickRow';
import { useStore } from '@/store/useStore';
import { getOpenJornada, getSortedTeams } from '@/store/selectors';
import { MAX_JORNADA_TEAMS, MIN_JORNADA_TEAMS, type ID } from '@/types/domain';

export function JornadaSetupScreen() {
  const back = useStore((s) => s.back);
  const navigate = useStore((s) => s.navigate);
  const state = useStore((s) => s.state);
  const startJornada = useStore((s) => s.startJornada);

  const teams = getSortedTeams(state);
  // Lo habitual es que vengan los fijos: quedan marcados para empezar con un toque.
  const [selected, setSelected] = useState<ID[]>(() =>
    teams
      .filter((t) => t.kind === 'fixed')
      .slice(0, MAX_JORNADA_TEAMS)
      .map((t) => t.id)
  );
  const [creating, setCreating] = useState(false);

  const toggle = (id: ID) =>
    setSelected((prev) =>
      prev.includes(id)
        ? prev.filter((t) => t !== id)
        : prev.length >= MAX_JORNADA_TEAMS
          ? prev
          : [...prev, id]
    );

  const valid = selected.length >= MIN_JORNADA_TEAMS && selected.length <= MAX_JORNADA_TEAMS;
  const full = selected.length >= MAX_JORNADA_TEAMS;

  const onStart = () => {
    if (!valid) return;
    // Nunca dos jornadas abiertas: si ya hay una (otra pestaña), se continúa esa.
    const open = getOpenJornada(useStore.getState().state);
    const id = open ? open.id : startJornada(selected);
    navigate({ name: 'jornada-active', jornadaId: id }, { replace: true });
  };

  return (
    <ScreenShell>
      <Header
        left={
          <IconButton ariaLabel="Volver" onClick={back}>
            <ArrowLeft size={20} strokeWidth={1.75} />
          </IconButton>
        }
        title="Nueva jornada"
      />

      <div className="px-4 py-4 space-y-4 flex-1">
        <div>
          <div className="text-title font-bold tracking-tight">¿Quiénes juegan hoy?</div>
          <p className="text-caption text-text-2 mt-1 leading-relaxed">
            Marca los equipos que vinieron. Entre {MIN_JORNADA_TEAMS} y {MAX_JORNADA_TEAMS}.
          </p>
        </div>

        <div className="bg-bg-elev border border-border rounded-card overflow-hidden">
          {teams.map((t, idx) => {
            const isSelected = selected.includes(t.id);
            return (
              <TeamPickRow
                key={t.id}
                team={t}
                selected={isSelected}
                disabled={!isSelected && full}
                onClick={() => toggle(t.id)}
                bordered={idx > 0}
              />
            );
          })}
          <button
            type="button"
            onClick={() => setCreating(true)}
            disabled={full}
            className={`w-full flex items-center justify-center gap-2 h-12 text-text-2 active:bg-bg-elev2 disabled:opacity-40 ${
              teams.length > 0 ? 'border-t border-dashed border-border-strong' : ''
            }`}
          >
            <Plus size={16} strokeWidth={1.75} />
            <span className="text-body-em font-medium">Nuevo equipo</span>
          </button>
        </div>

        <div className="text-caption text-text-2" data-testid="setup-count">
          {selected.length} {selected.length === 1 ? 'equipo' : 'equipos'}
          {selected.length < MIN_JORNADA_TEAMS &&
            ` · faltan ${MIN_JORNADA_TEAMS - selected.length} para empezar`}
          {full && ' · máximo alcanzado'}
        </div>
      </div>

      <StickyBottomCTA>
        <Button
          size="xl"
          fullWidth
          disabled={!valid}
          leading={<Play size={18} strokeWidth={1.75} fill="currentColor" />}
          onClick={onStart}
        >
          Empezar jornada
        </Button>
      </StickyBottomCTA>

      <TeamFormSheet
        open={creating}
        onClose={() => setCreating(false)}
        defaultKind="guest"
        onCreated={(id) =>
          setSelected((prev) => (prev.length >= MAX_JORNADA_TEAMS ? prev : [...prev, id]))
        }
      />
    </ScreenShell>
  );
}
