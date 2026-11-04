import { CloudUpload, X } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { cloudEnabled } from '@/sync/client';
import { useCloud } from '@/sync/useCloud';

/** Aviso del inicio mientras la competición activa siga solo en el teléfono. */
export function CloudBanner() {
  const navigate = useStore((s) => s.navigate);
  const activeId = useStore((s) => s.state.activeCompetitionId);
  const linked = useCloud((s) => (activeId ? Boolean(s.links[activeId]) : false));
  const dismissed = useCloud((s) => s.bannerDismissed);
  const dismiss = useCloud((s) => s.dismissBanner);

  if (!cloudEnabled || !activeId || linked || dismissed) return null;

  return (
    <div className="flex items-center gap-3 rounded-card p-3.5 border border-accent/40 bg-accent-soft">
      <button
        type="button"
        onClick={() => navigate({ name: 'settings', section: 'cloud' })}
        className="flex-1 min-w-0 flex items-center gap-3 text-left"
      >
        <span className="w-9 h-9 rounded-md bg-bg-elev2 flex items-center justify-center flex-shrink-0 text-accent">
          <CloudUpload size={18} strokeWidth={1.75} />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-body-em font-semibold">Respalda tus datos en la nube</span>
          <span className="block text-caption text-text-2">
            Si pierdes o cambias el teléfono, los recuperas.
          </span>
        </span>
      </button>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Ocultar aviso"
        className="w-9 h-9 -mr-1 rounded-md flex items-center justify-center text-text-3 active:bg-bg-elev2 flex-shrink-0"
      >
        <X size={16} strokeWidth={1.75} />
      </button>
    </div>
  );
}
