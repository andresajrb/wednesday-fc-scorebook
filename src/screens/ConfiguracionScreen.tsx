import { useRef, useState } from 'react';
import { ArrowLeft, Download, Upload, Trash2, ChevronRight } from 'lucide-react';
import { ScreenShell } from '@/components/primitives/ScreenShell';
import { Header } from '@/components/primitives/Header';
import { IconButton } from '@/components/primitives/IconButton';
import { Button } from '@/components/primitives/Button';
import { ConfirmDialog } from '@/components/primitives/ConfirmDialog';
import { BottomSheet } from '@/components/primitives/BottomSheet';
import { ToggleSwitch } from '@/components/primitives/ToggleSwitch';
import { TeamSwatch } from '@/components/domain/TeamSwatch';
import { useStore } from '@/store/useStore';
import { downloadBackup, readBackupFile, BackupError } from '@/lib/backup';
import { COLOR_SWATCHES } from '@/lib/colors';
import { SCHEMA_VERSION } from '@/types/domain';

export function ConfiguracionScreen() {
  const back = useStore((s) => s.back);
  const state = useStore((s) => s.state);
  const renameTeam = useStore((s) => s.renameTeam);
  const setTeamColor = useStore((s) => s.setTeamColor);
  const setAutoAssignNextMatch = useStore((s) => s.setAutoAssignNextMatch);
  const setMatchDurationSeconds = useStore((s) => s.setMatchDurationSeconds);
  const replaceState = useStore((s) => s.replaceState);
  const resetAll = useStore((s) => s.resetAll);

  const durationMinutes = Math.round(state.config.matchDurationSeconds / 60);
  const [durationInput, setDurationInput] = useState(String(durationMinutes));
  const commitDuration = () => {
    const n = parseInt(durationInput, 10);
    if (!Number.isFinite(n) || n < 1) {
      setDurationInput(String(durationMinutes));
      return;
    }
    const clamped = Math.min(90, Math.max(1, n));
    setMatchDurationSeconds(clamped * 60);
    setDurationInput(String(clamped));
  };

  const [colorPicker, setColorPicker] = useState<string | null>(null);
  const [importBackup, setImportBackup] = useState<{ message: string; data: typeof state } | null>(
    null
  );
  const [importError, setImportError] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const teams = Object.values(state.teams);

  const onPickFile = async (file: File | null) => {
    if (!file) return;
    try {
      const backup = await readBackupFile(file);
      setImportBackup({
        message: `Esto reemplazará todos tus datos actuales con el respaldo del ${backup.exportedAt.slice(0, 10)}. ¿Continuar?`,
        data: backup.data,
      });
    } catch (err) {
      const msg = err instanceof BackupError ? err.message : 'No se pudo leer el archivo.';
      setImportError(msg);
    }
  };

  const confirmImport = () => {
    if (!importBackup) return;
    replaceState(importBackup.data);
    setImportBackup(null);
  };

  const confirmReset = async () => {
    await resetAll();
    setResetOpen(false);
    setResetConfirmText('');
  };

  return (
    <ScreenShell>
      <Header
        left={
          <IconButton ariaLabel="Volver" onClick={back}>
            <ArrowLeft size={20} strokeWidth={1.75} />
          </IconButton>
        }
        title="Configuración"
      />

      <div className="px-4 py-4 space-y-6 flex-1">
        <section>
          <div className="text-caption uppercase tracking-wider text-text-2 font-semibold mb-2">
            Equipos
          </div>
          <div className="bg-bg-elev border border-border rounded-card overflow-hidden">
            {teams.map((t, idx) => (
              <div
                key={t.id}
                className={`flex items-center gap-3 p-3 ${idx > 0 ? 'border-t border-border' : ''}`}
              >
                <button
                  type="button"
                  onClick={() => setColorPicker(t.id)}
                  className="relative w-9 h-9 rounded-full active:scale-90 transition-transform flex-shrink-0 ring-1 ring-white/10"
                  style={{ backgroundColor: t.color }}
                  aria-label="Cambiar color"
                />
                <div className="flex-1 min-w-0">
                  <label className="block text-caption text-text-3 uppercase tracking-wide leading-none mb-1">
                    Equipo {idx + 1}
                  </label>
                  <input
                    className="w-full bg-transparent outline-none text-body-em font-bold"
                    value={t.name}
                    onChange={(e) => renameTeam(t.id, e.target.value)}
                    maxLength={32}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="text-caption uppercase tracking-wider text-text-2 font-semibold mb-2">
            Reglas
          </div>
          <div className="bg-bg-elev border border-border rounded-card overflow-hidden">
            <div className="p-3 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-body-em font-semibold">Asignación automática de encuentros</div>
                <div className="text-caption text-text-2 mt-1 leading-relaxed">
                  La app predice el próximo enfrentamiento siguiendo la regla "el que pierde sale".
                  Usa los últimos 3 partidos para mantenerse fresca.
                </div>
              </div>
              <ToggleSwitch
                checked={state.config.autoAssignNextMatch}
                onChange={(v) => setAutoAssignNextMatch(v)}
                ariaLabel="Activar asignación automática"
              />
            </div>
            <div className="p-3 border-t border-border flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-body-em font-semibold">Duración de partida</div>
                <div className="text-caption text-text-2 mt-1">Minutos por partida (1–90).</div>
              </div>
              <div className="flex items-center gap-1">
                <input
                  data-field="duration"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={90}
                  value={durationInput}
                  onChange={(e) => setDurationInput(e.target.value)}
                  onBlur={commitDuration}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                  }}
                  className="w-16 h-11 text-center bg-bg-elev2 border border-border rounded-btn outline-none focus:border-accent font-mono text-body-em font-semibold"
                  aria-label="Duración en minutos"
                />
                <span className="text-caption text-text-2">min</span>
              </div>
            </div>
          </div>
        </section>

        <section>
          <div className="text-caption uppercase tracking-wider text-text-2 font-semibold mb-2">
            Respaldos
          </div>
          <div className="space-y-2">
            <Button
              variant="secondary"
              size="lg"
              fullWidth
              leading={<Download size={18} strokeWidth={1.75} />}
              onClick={() => downloadBackup(state)}
            >
              Exportar respaldo
            </Button>
            <Button
              variant="secondary"
              size="lg"
              fullWidth
              leading={<Upload size={18} strokeWidth={1.75} />}
              onClick={() => fileInputRef.current?.click()}
            >
              Importar respaldo
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                onPickFile(file);
                if (e.target) e.target.value = '';
              }}
            />
            <p className="text-caption text-text-3 leading-relaxed">
              Los respaldos son archivos JSON. Guárdalos en la nube para no perder tu historial.
            </p>
          </div>
        </section>

        <section>
          <div className="text-caption uppercase tracking-wider text-text-2 font-semibold mb-2">
            Acerca de
          </div>
          <div className="bg-bg-elev border border-border rounded-card overflow-hidden">
            <InfoRow label="Versión" value="0.1.0 — MVP" />
            <InfoRow label="Schema" value={`v${SCHEMA_VERSION}`} />
            <button
              type="button"
              onClick={() =>
                window.open('https://github.com', '_blank', 'noreferrer')
              }
              className="w-full flex items-center gap-3 p-3 border-t border-border active:bg-bg-elev2"
            >
              <span className="flex-1 text-left text-body font-medium">Ver código fuente</span>
              <ChevronRight size={18} className="text-text-3" strokeWidth={1.75} />
            </button>
          </div>
        </section>

        <section>
          <div className="text-caption uppercase tracking-wider text-error/80 font-semibold mb-2">
            Zona peligrosa
          </div>
          <div className="rounded-card border border-error/25 bg-error/[0.04] p-4 space-y-3">
            <p className="text-body text-text-2 leading-relaxed">
              Borra todos los equipos, jugadores, jornadas y goles. Esta acción no se puede deshacer.
            </p>
            <Button
              variant="danger"
              size="md"
              fullWidth
              leading={<Trash2 size={16} strokeWidth={1.75} />}
              onClick={() => setResetOpen(true)}
            >
              Resetear todo
            </Button>
          </div>
        </section>

        <p className="text-center text-caption text-text-3 pt-4 pb-6">
          Hecho con ⚽ por amigos
        </p>
      </div>

      <BottomSheet
        open={!!colorPicker}
        onClose={() => setColorPicker(null)}
        title="Color del equipo"
      >
        {colorPicker && (
          <div className="flex flex-wrap gap-3 py-2">
            {COLOR_SWATCHES.map((c) => {
              const team = state.teams[colorPicker];
              return (
                <TeamSwatch
                  key={c}
                  color={c}
                  size={44}
                  selected={team?.color.toLowerCase() === c.toLowerCase()}
                  onClick={() => {
                    setTeamColor(colorPicker, c);
                    setColorPicker(null);
                  }}
                  ariaLabel={`Color ${c}`}
                />
              );
            })}
          </div>
        )}
      </BottomSheet>

      <ConfirmDialog
        open={!!importBackup}
        title="Importar respaldo"
        description={importBackup?.message}
        confirmLabel="Reemplazar datos"
        danger
        onConfirm={confirmImport}
        onCancel={() => setImportBackup(null)}
      />

      <ConfirmDialog
        open={!!importError}
        title="No se pudo importar"
        description={importError}
        confirmLabel="Entendido"
        cancelLabel="Cerrar"
        onConfirm={() => setImportError(null)}
        onCancel={() => setImportError(null)}
      />

      {resetOpen && (
        <div className="fixed inset-0 z-[60] flex flex-col justify-end" role="dialog" aria-modal="true">
          <button
            className="absolute inset-0 bg-black/65 animate-fade-in"
            onClick={() => {
              setResetOpen(false);
              setResetConfirmText('');
            }}
            aria-label="Cerrar"
            tabIndex={-1}
          />
          <div
            className="relative bg-bg-sheet rounded-t-sheet px-5 pt-5 pb-6 border-t border-border w-full animate-sheet-up"
            style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
          >
            <div className="text-title font-semibold tracking-tight">Resetear todo</div>
            <div className="text-body text-text-2 mt-2 leading-relaxed">
              Para confirmar, escribe <span className="font-mono font-bold text-error">BORRAR</span>.
            </div>
            <input
              autoFocus
              value={resetConfirmText}
              onChange={(e) => setResetConfirmText(e.target.value)}
              placeholder="BORRAR"
              className="mt-3 w-full bg-bg-elev2 border border-border rounded-btn px-3 py-3 outline-none focus:border-error font-mono"
            />
            <div className="flex flex-col gap-2 mt-4">
              <Button
                variant="danger"
                size="lg"
                fullWidth
                disabled={resetConfirmText !== 'BORRAR'}
                leading={<Trash2 size={16} strokeWidth={1.75} />}
                onClick={confirmReset}
              >
                Borrar todo
              </Button>
              <Button
                variant="ghost"
                size="lg"
                fullWidth
                onClick={() => {
                  setResetOpen(false);
                  setResetConfirmText('');
                }}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}
    </ScreenShell>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 p-3 border-t border-border first:border-t-0">
      <span className="flex-1 text-body text-text-2">{label}</span>
      <span className="text-body font-mono text-text font-medium">{value}</span>
    </div>
  );
}
