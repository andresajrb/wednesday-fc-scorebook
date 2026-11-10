import { AlertTriangle, X } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { useCloud } from '@/sync/useCloud';

/** Aviso de la nube que no depende de la pantalla (p. ej. "Te sacaron de Miércoles"). */
export function CloudNoticeToast() {
  const notice = useCloud((s) => s.notice);
  const clearNotice = useCloud((s) => s.clearNotice);
  // La partida ya lo muestra dentro de su pantalla.
  const onMatch = useStore((s) => s.ui.currentScreen.name === 'match-record');
  if (!notice || onMatch) return null;
  return (
    <div className="fixed inset-x-0 top-3 z-[70] px-4" role="status" data-cloud-notice>
      <div className="mx-auto w-full max-w-md bg-bg-elev2 border border-warning/40 rounded-card px-4 py-3 flex items-start gap-3 shadow-lg">
        <AlertTriangle size={16} className="text-warning mt-0.5 flex-shrink-0" strokeWidth={1.75} />
        <p className="flex-1 text-caption leading-relaxed">{notice}</p>
        <button
          type="button"
          aria-label="Cerrar aviso"
          onClick={clearNotice}
          className="w-8 h-8 -mr-2 -mt-1 rounded-md flex items-center justify-center text-text-3 active:bg-bg-elev"
        >
          <X size={16} strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
}
