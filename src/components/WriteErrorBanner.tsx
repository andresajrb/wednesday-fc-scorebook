import { AlertTriangle, Download } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { downloadBackup } from '@/lib/backup';

/**
 * Una escritura fallida (cuota llena, IndexedDB abortado, modo privado) era
 * hasta ahora invisible: la app seguía mostrando en pantalla datos que nunca
 * llegaron al disco. No se puede descartar a propósito — mientras no se pueda
 * guardar, exportar es la única red de seguridad.
 */
export function WriteErrorBanner() {
  const writeError = useStore((s) => s.writeError);
  const state = useStore((s) => s.state);

  if (!writeError) return null;

  return (
    // `sticky` y no `fixed`: ocupa su espacio en el flujo, así no tapa el header
    // ni el botón de volver de la pantalla que haya debajo.
    <div
      role="alert"
      className="sticky top-0 z-[70] w-full max-w-md mx-auto bg-error text-white px-4 py-3 flex items-start gap-3 animate-slide-up"
      style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
    >
      <AlertTriangle size={18} strokeWidth={2} className="flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="text-body-em font-semibold leading-tight">No se pudo guardar</div>
        <p className="text-caption mt-1 leading-relaxed opacity-90">
          Los cambios de esta sesión pueden perderse. Exportá un respaldo ahora.
        </p>
      </div>
      <button
        type="button"
        onClick={() => downloadBackup(state)}
        className="flex-shrink-0 inline-flex items-center gap-1.5 bg-white/20 active:bg-white/30 rounded-btn px-3 h-9 text-[13px] font-semibold"
      >
        <Download size={15} strokeWidth={2} />
        Exportar
      </button>
    </div>
  );
}
