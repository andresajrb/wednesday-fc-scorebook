import { useEffect, useMemo, useState } from 'react';
import { Check, Download, Image as ImageIcon, MessageSquareText, Share2 } from 'lucide-react';
import { BottomSheet } from '@/components/primitives/BottomSheet';
import { Button } from '@/components/primitives/Button';
import { buildShareText, type JornadaReport, type ShareTextVariant } from '@/lib/jornadaReport';
import { renderJornadaImage } from '@/lib/jornadaImage';
import { cn } from '@/lib/cn';

type ShareMode = 'both' | 'image' | 'text';

interface ShareSheetProps {
  open: boolean;
  onClose: () => void;
  report: JornadaReport;
  fileStem: string;
}

type ShareNavigator = Navigator & {
  share?: (data: ShareData) => Promise<void>;
  canShare?: (data: ShareData) => boolean;
};

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ShareSheet({ open, onClose, report, fileStem }: ShareSheetProps) {
  const [mode, setMode] = useState<ShareMode>('both');
  const [variant, setVariant] = useState<ShareTextVariant>('short');
  const [image, setImage] = useState<Blob | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Con imagen, el texto corto va de pie de foto; solo texto, conviene el completo.
  useEffect(() => {
    setVariant(mode === 'text' ? 'full' : 'short');
  }, [mode]);

  useEffect(() => {
    if (!open) return;
    setNotice(null);
    let cancelled = false;
    let url: string | null = null;
    void renderJornadaImage(report)
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setImage(blob);
        setImageUrl(url);
      })
      .catch(() => {
        if (!cancelled) setNotice('No se pudo generar la imagen. Puedes compartir solo el texto.');
      });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
      setImage(null);
      setImageUrl(null);
    };
  }, [open, report]);

  const text = useMemo(() => buildShareText(report, variant), [report, variant]);
  const withImage = mode !== 'text';
  const withText = mode !== 'image';
  const fileName = `${fileStem}.png`;

  const onShare = async () => {
    setBusy(true);
    setNotice(null);
    const nav = navigator as ShareNavigator;
    try {
      if (!withImage) {
        if (typeof nav.share === 'function') {
          await nav.share({ text });
        } else if (await copyText(text)) {
          setNotice('Texto copiado. Pégalo en WhatsApp.');
        } else {
          setNotice('No se pudo copiar el texto.');
        }
        return;
      }

      if (!image) return;
      const file = new File([image], fileName, { type: 'image/png' });
      const canShareFile =
        typeof nav.share === 'function' &&
        (typeof nav.canShare !== 'function' || nav.canShare({ files: [file] }));

      // iOS a veces descarta el texto cuando se comparten archivos: queda copiado
      // para pegarlo como pie de foto. No se espera a la copia antes de `share`:
      // Safari exige que se llame mientras dura el gesto del usuario.
      const copying = withText ? copyText(text) : Promise.resolve(false);

      if (canShareFile) {
        const sharing = nav.share(withText ? { files: [file], text } : { files: [file] });
        const copied = await copying;
        await sharing;
        if (copied) setNotice('Texto copiado: pégalo como pie de foto si no aparece.');
      } else {
        const copied = await copying;
        downloadBlob(image, fileName);
        setNotice(
          copied
            ? 'Imagen descargada y texto copiado. Adjúntala en WhatsApp y pega el texto.'
            : 'Imagen descargada. Adjúntala en WhatsApp.'
        );
      }
    } catch (err) {
      // Cerrar la hoja de compartir del sistema no es un error.
      if (!(err instanceof DOMException && err.name === 'AbortError')) {
        setNotice('No se pudo compartir. Prueba descargando la imagen.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Compartir resumen">
      <div className="space-y-4 pb-2">
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Qué compartir">
          <ModeOption
            selected={mode === 'both'}
            onClick={() => setMode('both')}
            icon={<Share2 size={18} strokeWidth={1.75} />}
            label="Imagen + texto"
            hint="Recomendado"
          />
          <ModeOption
            selected={mode === 'image'}
            onClick={() => setMode('image')}
            icon={<ImageIcon size={18} strokeWidth={1.75} />}
            label="Solo imagen"
          />
          <ModeOption
            selected={mode === 'text'}
            onClick={() => setMode('text')}
            icon={<MessageSquareText size={18} strokeWidth={1.75} />}
            label="Solo texto"
          />
        </div>

        {withImage && (
          <div className="rounded-card overflow-hidden border border-border bg-bg-elev aspect-[4/5] max-h-[32vh] mx-auto">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt="Vista previa del resumen"
                className="w-full h-full object-contain"
                data-testid="share-image"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-caption text-text-3">
                Generando imagen…
              </div>
            )}
          </div>
        )}

        {withText && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-caption text-text-2 uppercase tracking-wide">Texto</span>
              <div className="inline-flex rounded-btn border border-border overflow-hidden">
                {(['short', 'full'] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setVariant(v)}
                    aria-pressed={variant === v}
                    className={cn(
                      'px-3 h-8 text-caption font-medium',
                      variant === v ? 'bg-accent text-text-inv' : 'bg-bg-elev2 text-text-2'
                    )}
                  >
                    {v === 'short' ? 'Corto' : 'Completo'}
                  </button>
                ))}
              </div>
            </div>
            <pre
              className="whitespace-pre-wrap break-words font-sans text-caption text-text-2 bg-bg-elev border border-border rounded-card p-3 max-h-40 overflow-auto"
              data-testid="share-text"
            >
              {text}
            </pre>
          </div>
        )}

        {notice && (
          <div className="flex items-start gap-2 text-caption text-accent" role="status">
            <Check size={14} strokeWidth={2} className="mt-0.5 flex-shrink-0" />
            <span>{notice}</span>
          </div>
        )}

        <div className="space-y-2">
          <Button
            size="xl"
            fullWidth
            disabled={busy || (withImage && !image)}
            leading={<Share2 size={18} strokeWidth={1.75} />}
            onClick={onShare}
          >
            Compartir
          </Button>
          {withImage && image && (
            <Button
              size="md"
              variant="ghost"
              fullWidth
              leading={<Download size={16} strokeWidth={1.75} />}
              onClick={() => downloadBlob(image, fileName)}
            >
              Descargar imagen
            </Button>
          )}
        </div>
      </div>
    </BottomSheet>
  );
}

function ModeOption({
  selected,
  onClick,
  icon,
  label,
  hint,
}: {
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  hint?: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={cn(
        'rounded-btn border px-2 py-2.5 flex flex-col items-center gap-1 text-center active:scale-[0.98]',
        selected ? 'border-accent bg-accent/10 text-text' : 'border-border bg-bg-elev2 text-text-2'
      )}
    >
      {icon}
      <span className="text-[12px] font-semibold leading-tight">{label}</span>
      {hint && <span className="text-[10px] text-accent leading-none">{hint}</span>}
    </button>
  );
}
