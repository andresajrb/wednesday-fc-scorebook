import type { ReactNode } from 'react';
import { AlertTriangle, Download, RotateCcw } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { Button } from '@/components/primitives/Button';
import { ScreenShell } from '@/components/primitives/ScreenShell';
import { downloadBackup } from '@/lib/backup';

interface HydrationBoundaryProps {
  children: ReactNode;
}

export function HydrationBoundary({ children }: HydrationBoundaryProps) {
  const hydrateError = useStore((s) => s.hydrateError);
  const state = useStore((s) => s.state);
  const resetAll = useStore((s) => s.resetAll);
  const clearHydrateError = useStore((s) => s.clearHydrateError);

  if (!hydrateError) return <>{children}</>;

  const onDownload = () => {
    try {
      downloadBackup(state);
    } catch {
      // ignoramos: el backup intenta lo que pueda con el state actual
    }
  };

  const onReset = async () => {
    await resetAll();
    clearHydrateError();
  };

  return (
    <ScreenShell>
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 text-center gap-5">
        <span className="w-16 h-16 rounded-full bg-error/15 inline-flex items-center justify-center text-error">
          <AlertTriangle size={32} strokeWidth={1.75} />
        </span>
        <div>
          <h1 className="text-title font-semibold tracking-tight">Detectamos un problema con tus datos</h1>
          <p className="text-body text-text-2 mt-2 leading-relaxed max-w-sm">
            Los datos guardados están dañados y no pudimos cargarlos. Podés descargar una copia de
            lo que queda intentando recuperarla, o reiniciar la app y empezar de cero.
          </p>
          <p className="text-caption text-text-3 mt-3 font-mono break-words">
            {hydrateError.kind === 'json'
              ? 'Archivo dañado al leer.'
              : 'No se pudo actualizar el formato de los datos.'}
          </p>
        </div>
        <div className="w-full max-w-sm flex flex-col gap-2">
          <Button
            size="lg"
            fullWidth
            leading={<Download size={18} strokeWidth={1.75} />}
            onClick={onDownload}
          >
            Descargar backup
          </Button>
          <Button
            size="lg"
            variant="danger"
            fullWidth
            leading={<RotateCcw size={18} strokeWidth={1.75} />}
            onClick={onReset}
          >
            Reiniciar app
          </Button>
        </div>
      </div>
    </ScreenShell>
  );
}
