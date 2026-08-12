import { RefreshCw, X } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useStore } from '@/store/useStore';
import { flushWrites } from '@/store/persistence';

/**
 * Aviso de versión nueva. Nunca recarga solo: la app se usa en la cancha y
 * perder el hilo de una partida por una actualización sería peor que quedarse
 * con la versión vieja un rato más. Por eso tampoco aparece mientras hay una
 * partida en curso.
 */
export function UpdatePrompt() {
  const screen = useStore((s) => s.ui.currentScreen);
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh || screen.name === 'match-record') return null;

  const onUpdate = () => {
    // Vaciamos lo pendiente antes de que el navegador recargue.
    flushWrites();
    void updateServiceWorker(true);
  };

  return (
    <div
      role="status"
      className="fixed inset-x-0 z-[65] px-4 animate-slide-up"
      style={{ bottom: 'max(1rem, env(safe-area-inset-bottom))' }}
    >
      <div className="mx-auto w-full max-w-md bg-bg-elev2 border border-border-strong rounded-card px-4 py-3 flex items-center gap-3 shadow-lg">
        <div className="flex-1 min-w-0">
          <div className="text-body-em font-semibold leading-tight">Hay una versión nueva</div>
          <p className="text-caption text-text-2 mt-0.5">Tus datos no se tocan al actualizar.</p>
        </div>
        <button
          type="button"
          onClick={onUpdate}
          className="flex-shrink-0 inline-flex items-center gap-1.5 bg-accent text-text-inv rounded-btn px-3 h-9 text-[13px] font-semibold active:brightness-90"
        >
          <RefreshCw size={15} strokeWidth={2} />
          Actualizar
        </button>
        <button
          type="button"
          onClick={() => setNeedRefresh(false)}
          aria-label="Descartar"
          className="flex-shrink-0 w-9 h-9 inline-flex items-center justify-center text-text-3 active:bg-bg-elev rounded-btn"
        >
          <X size={16} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
