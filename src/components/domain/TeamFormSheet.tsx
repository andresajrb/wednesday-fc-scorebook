import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { BottomSheet } from '@/components/primitives/BottomSheet';
import { Button } from '@/components/primitives/Button';
import { TeamSwatch } from '@/components/domain/TeamSwatch';
import { useStore } from '@/store/useStore';
import { useScopedState } from '@/store/useScopedState';
import { COLOR_SWATCHES, nextFreeColor } from '@/lib/colors';
import { cn } from '@/lib/cn';
import type { ID, TeamKind } from '@/types/domain';

interface TeamFormSheetProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (teamId: ID) => void;
  defaultKind?: TeamKind;
}

export function TeamFormSheet({ open, onClose, onCreated, defaultKind = 'fixed' }: TeamFormSheetProps) {
  const teams = useScopedState().teams;
  const createTeam = useStore((s) => s.createTeam);
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLOR_SWATCHES[0]);
  const [kind, setKind] = useState<TeamKind>(defaultKind);

  useEffect(() => {
    if (!open) return;
    setName('');
    setKind(defaultKind);
    setColor(
      nextFreeColor(
        Object.values(teams)
          .filter((t) => !t.archived)
          .map((t) => t.color)
      )
    );
    // Solo al abrir: recalcular con cada cambio de equipos pisaría la elección del usuario.
  }, [open, defaultKind]);

  const trimmed = name.trim();
  const duplicate = Object.values(teams).some(
    (t) => !t.archived && t.name.trim().toLowerCase() === trimmed.toLowerCase()
  );
  const valid = trimmed.length > 0 && !duplicate;

  const submit = () => {
    if (!valid) return;
    const id = createTeam({ name: trimmed, color, kind });
    onCreated?.(id);
    onClose();
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Nuevo equipo">
      <div className="space-y-4 pb-2">
        <div className="flex items-center gap-3">
          <span
            className="w-11 h-11 rounded-full flex-shrink-0 ring-1 ring-white/10"
            style={{ backgroundColor: color }}
          />
          <input
            autoFocus
            data-field="team-name"
            className="flex-1 min-w-0 bg-transparent border-b border-border focus:border-accent outline-none text-body-em font-semibold py-1"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
            }}
            placeholder="Nombre del equipo"
            maxLength={32}
          />
        </div>
        {duplicate && (
          <div className="text-caption text-error">Ya hay un equipo con ese nombre.</div>
        )}

        <div>
          <div className="text-caption text-text-2 uppercase tracking-wide mb-2">Color</div>
          <div className="flex flex-wrap gap-2">
            {COLOR_SWATCHES.map((c) => (
              <TeamSwatch
                key={c}
                color={c}
                size={34}
                selected={color === c}
                onClick={() => setColor(c)}
                ariaLabel={`Color ${c}`}
              />
            ))}
          </div>
        </div>

        <div>
          <div className="text-caption text-text-2 uppercase tracking-wide mb-2">Tipo</div>
          <div className="grid grid-cols-2 gap-2">
            <KindOption
              selected={kind === 'fixed'}
              onClick={() => setKind('fixed')}
              title="Fijo"
              description="Juega todas las semanas"
            />
            <KindOption
              selected={kind === 'guest'}
              onClick={() => setKind('guest')}
              title="Invitado"
              description="Cubre cuando falta uno"
            />
          </div>
        </div>

        <Button
          size="xl"
          fullWidth
          disabled={!valid}
          onClick={submit}
          leading={<Plus size={18} strokeWidth={2} />}
        >
          Crear equipo
        </Button>
      </div>
    </BottomSheet>
  );
}

export function KindOption({
  selected,
  onClick,
  title,
  description,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'rounded-btn border px-3 py-2.5 text-left active:scale-[0.98]',
        selected ? 'border-accent bg-accent/10' : 'border-border bg-bg-elev2'
      )}
    >
      <div className="text-body-em font-semibold">{title}</div>
      <div className="text-caption text-text-2 leading-tight mt-0.5">{description}</div>
    </button>
  );
}
