import { useEffect, useState } from 'react';
import { AlertTriangle, Download, History, RotateCcw, Wrench } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { Button } from '@/components/primitives/Button';
import { ConfirmDialog } from '@/components/primitives/ConfirmDialog';
import { ScreenShell } from '@/components/primitives/ScreenShell';
import { downloadBackupFile, downloadRawBlob } from '@/lib/backup';
import { repairAppState, RepairError, type RepairReport } from '@/lib/repair';
import { getLastReadRaw, type HydrateError } from '@/store/persistence';
import {
  getSnapshotBackup,
  listSnapshots,
  readSnapshot,
  snapshotReasonLabel,
  type SnapshotInfo,
} from '@/store/snapshots';
import type { AppState } from '@/types/domain';

interface RecoveryScreenProps {
  error: HydrateError;
}

/**
 * Pantalla de rescate. El orden de las opciones es deliberado: primero salvar
 * los bytes, después recuperar, y solo al final borrar.
 */
export function RecoveryScreen({ error }: RecoveryScreenProps) {
  const replaceState = useStore((s) => s.replaceState);
  const resetAll = useStore((s) => s.resetAll);
  const clearHydrateError = useStore((s) => s.clearHydrateError);

  // Estado vacío con respaldos disponibles: no hay nada dañado que salvar ni
  // reparar, solo hay que restaurar.
  const vacio = error.kind === 'empty';
  const raw = vacio ? null : getLastReadRaw();
  const [snapshots, setSnapshots] = useState<SnapshotInfo[] | null>(null);
  const [repair, setRepair] = useState<{ state: AppState; report: RepairReport } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');

  useEffect(() => {
    let cancelled = false;
    listSnapshots()
      .then((found) => {
        if (!cancelled) setSnapshots(found);
      })
      .catch(() => {
        if (!cancelled) setSnapshots([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const onRepair = () => {
    if (!raw) {
      setMessage('No quedó una copia legible de los datos dañados para reparar.');
      return;
    }
    try {
      setRepair(repairAppState(raw));
    } catch (err) {
      setMessage(
        err instanceof RepairError ? err.message : 'No se pudo reparar el archivo dañado.'
      );
    }
  };

  const confirmRepair = () => {
    if (!repair) return;
    replaceState(repair.state);
    setRepair(null);
    clearHydrateError();
  };

  const onRestore = async (snapshot: SnapshotInfo) => {
    try {
      const state = await readSnapshot(snapshot.key);
      replaceState(state);
      clearHydrateError();
    } catch {
      setMessage('Ese respaldo automático no se pudo leer.');
    }
  };

  const onDownloadSnapshot = async (snapshot: SnapshotInfo) => {
    try {
      downloadBackupFile(await getSnapshotBackup(snapshot.key), 'respaldo-automatico');
    } catch {
      setMessage('Ese respaldo automático no se pudo descargar.');
    }
  };

  const confirmReset = async () => {
    await resetAll();
    setResetOpen(false);
    setResetConfirmText('');
    clearHydrateError();
  };

  return (
    <ScreenShell>
      <div className="flex-1 px-5 py-8 space-y-6">
        <div className="flex flex-col items-center text-center gap-4">
          <span className="w-16 h-16 rounded-full bg-error/15 inline-flex items-center justify-center text-error">
            <AlertTriangle size={32} strokeWidth={1.75} />
          </span>
          <div>
            <h1 className="text-title font-semibold tracking-tight">
              {vacio ? 'Faltan tus datos' : 'Detectamos un problema con tus datos'}
            </h1>
            <p className="text-body text-text-2 mt-2 leading-relaxed">
              {vacio
                ? 'La app arrancó sin equipos ni jugadores, pero encontramos respaldos automáticos con tu información. Restaurá uno para seguir donde estabas.'
                : 'No pudimos cargar lo que había guardado. Tus datos siguen en el dispositivo y no fueron borrados: probá las opciones de abajo antes de empezar de cero.'}
            </p>
            <p className="text-caption text-text-3 mt-3 font-mono break-words">
              {error.kind === 'json'
                ? 'Archivo dañado al leer.'
                : error.kind === 'migration'
                  ? 'No se pudo actualizar el formato de los datos.'
                  : 'No había datos guardados al abrir.'}
            </p>
          </div>
        </div>

        {!vacio && (
          <section className="space-y-2">
            <SectionLabel>1 · Poné a salvo lo que hay</SectionLabel>
            <Button
              size="lg"
              fullWidth
              leading={<Download size={18} strokeWidth={1.75} />}
              disabled={!raw}
              onClick={() => raw && downloadRawBlob(raw)}
            >
              Descargar copia sin procesar
            </Button>
            <p className="text-caption text-text-3 leading-relaxed">
              {raw
                ? 'Descarga los datos tal como están en el disco, sin modificar. Guardalo antes de seguir.'
                : 'No quedó nada guardado en este dispositivo.'}
            </p>
          </section>
        )}

        <section className="space-y-2">
          <SectionLabel>{vacio ? 'Restaurá un respaldo' : '2 · Intentá recuperar'}</SectionLabel>
          {!vacio && (
            <Button
              variant="secondary"
              size="lg"
              fullWidth
              leading={<Wrench size={18} strokeWidth={1.75} />}
              disabled={!raw}
              onClick={onRepair}
            >
              Intentar reparar los datos
            </Button>
          )}

          {snapshots === null && (
            <p className="text-caption text-text-3">Buscando respaldos automáticos…</p>
          )}

          {snapshots?.length === 0 && (
            <p className="text-caption text-text-3 leading-relaxed">
              No hay respaldos automáticos guardados todavía.
            </p>
          )}

          {snapshots && snapshots.length > 0 && (
            <div className="bg-bg-elev border border-border rounded-card overflow-hidden">
              {snapshots.map((snapshot, idx) => (
                <div
                  key={snapshot.key}
                  className={`p-3 ${idx > 0 ? 'border-t border-border' : ''}`}
                >
                  <div className="flex items-center gap-2">
                    <History size={16} className="text-text-3" strokeWidth={1.75} />
                    <span className="text-body-em font-semibold flex-1 min-w-0 truncate">
                      {snapshotReasonLabel(snapshot.reason)}
                    </span>
                    <span className="text-caption text-text-3 font-mono">
                      {snapshot.savedAt.slice(0, 10)}
                    </span>
                  </div>
                  <div className="text-caption text-text-2 mt-1">
                    {snapshot.players} jugadores · {snapshot.teams} equipos · {snapshot.jornadas}{' '}
                    jornadas
                  </div>
                  <div className="flex gap-2 mt-2">
                    <Button size="sm" onClick={() => void onRestore(snapshot)}>
                      Restaurar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void onDownloadSnapshot(snapshot)}
                    >
                      Descargar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-2">
          <SectionLabel danger>{vacio ? 'O empezá de nuevo' : '3 · Último recurso'}</SectionLabel>
          <Button
            variant="danger"
            size="lg"
            fullWidth
            leading={<RotateCcw size={18} strokeWidth={1.75} />}
            onClick={() => setResetOpen(true)}
          >
            Empezar de cero
          </Button>
          <p className="text-caption text-text-3 leading-relaxed">
            Borra todo, incluidos los respaldos automáticos. No se puede deshacer.
          </p>
        </section>
      </div>

      <ConfirmDialog
        open={!!repair}
        title="Resultado de la reparación"
        description={repair ? describeRepair(repair.report) : undefined}
        confirmLabel="Usar estos datos"
        onConfirm={confirmRepair}
        onCancel={() => setRepair(null)}
      />

      <ConfirmDialog
        open={!!message}
        title="No se pudo completar"
        description={message ?? undefined}
        confirmLabel="Entendido"
        cancelLabel="Cerrar"
        onConfirm={() => setMessage(null)}
        onCancel={() => setMessage(null)}
      />

      {resetOpen && (
        <div
          className="fixed inset-0 z-[60] flex flex-col justify-end"
          role="dialog"
          aria-modal="true"
        >
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
            <div className="text-title font-semibold tracking-tight">Empezar de cero</div>
            <div className="text-body text-text-2 mt-2 leading-relaxed">
              Para confirmar, escribí <span className="font-mono font-bold text-error">BORRAR</span>.
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
                onClick={() => void confirmReset()}
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

function SectionLabel({ children, danger }: { children: string; danger?: boolean }) {
  return (
    <div
      className={`text-caption uppercase tracking-wider font-semibold ${
        danger ? 'text-error/80' : 'text-text-2'
      }`}
    >
      {children}
    </div>
  );
}

function describeRepair(report: RepairReport): string {
  const parts = [
    `Se recuperaron ${report.players} jugadores, ${report.teams} equipos, ${report.jornadas} jornadas, ${report.matches} partidas y ${report.goals} goles.`,
  ];
  if (report.reassignedPlayers > 0) {
    parts.push(
      `${report.reassignedPlayers} jugadores habían quedado sin equipo y se movieron al primer equipo; podés reubicarlos después.`
    );
  }
  const dropped = report.droppedPlayers + report.droppedMatches + report.droppedGoals;
  if (dropped > 0) {
    parts.push(`Se descartaron ${dropped} registros que estaban incompletos.`);
  }
  if (report.parsedWith === 'truncated') {
    parts.push('El archivo estaba cortado, así que puede faltar lo último que se guardó.');
  }
  return parts.join(' ');
}
