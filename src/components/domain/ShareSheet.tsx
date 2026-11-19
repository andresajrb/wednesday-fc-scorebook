import { useEffect, useMemo, useState } from 'react';
import { Check, Download, Image as ImageIcon, MessageSquareText, Share2 } from 'lucide-react';
import { BottomSheet } from '@/components/primitives/BottomSheet';
import { Button } from '@/components/primitives/Button';
import type { ShareTextVariant } from '@/lib/jornadaReport';
import { cn } from '@/lib/cn';

type ShareMode = 'both' | 'image' | 'text';

export interface ShareImageOption {
  id: string;
  label: string;
  render: () => Promise<Blob>;
  /** Marcada al abrir la hoja. */
  defaultSelected?: boolean;
  /** Por qué no se puede generar; la opción queda deshabilitada. */
  unavailable?: string;
}

interface ShareSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Con más de una, se elige cuáles mandar; se comparten juntas, en este orden. */
  images: ShareImageOption[];
  buildText: (variant: ShareTextVariant) => string;
  fileStem: string;
}

interface RenderedImage {
  blob: Blob;
  url: string;
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

function downloadAll(files: File[]): void {
  // Varias descargas seguidas: algunos navegadores bloquean las que salen juntas.
  files.forEach((file, i) => setTimeout(() => downloadBlob(file, file.name), i * 400));
}

export function ShareSheet({ open, onClose, title, images, buildText, fileStem }: ShareSheetProps) {
  const [mode, setMode] = useState<ShareMode>('both');
  const [variant, setVariant] = useState<ShareTextVariant>('short');
  const [selected, setSelected] = useState<string[]>([]);
  const [rendered, setRendered] = useState<Record<string, RenderedImage>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Con imagen, el texto corto va de pie de foto; solo texto, conviene el completo.
  useEffect(() => {
    setVariant(mode === 'text' ? 'full' : 'short');
  }, [mode]);

  useEffect(() => {
    if (!open) return;
    setNotice(null);
    setSelected(images.filter((i) => !i.unavailable && (i.defaultSelected ?? true)).map((i) => i.id));
    let cancelled = false;
    const urls: string[] = [];
    for (const option of images) {
      if (option.unavailable) continue;
      void option
        .render()
        .then((blob) => {
          if (cancelled) return;
          const url = URL.createObjectURL(blob);
          urls.push(url);
          setRendered((prev) => ({ ...prev, [option.id]: { blob, url } }));
        })
        .catch(() => {
          if (!cancelled) setNotice('No se pudo generar alguna imagen. Puedes compartir solo el texto.');
        });
    }
    return () => {
      cancelled = true;
      urls.forEach((url) => URL.revokeObjectURL(url));
      setRendered({});
    };
  }, [open, images]);

  const text = useMemo(() => buildText(variant), [buildText, variant]);
  const withImage = mode !== 'text';
  const withText = mode !== 'image';
  const multiple = images.length > 1;
  const chosen = images.filter((i) => selected.includes(i.id) && !i.unavailable);
  const ready = chosen.length > 0 && chosen.every((i) => rendered[i.id]);
  const files = ready
    ? chosen.map(
        (i) =>
          new File([rendered[i.id].blob], multiple ? `${fileStem}-${i.id}.png` : `${fileStem}.png`, {
            type: 'image/png',
          })
      )
    : [];

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

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

      if (files.length === 0) return;
      const canShareFile =
        typeof nav.share === 'function' &&
        (typeof nav.canShare !== 'function' || nav.canShare({ files }));

      // iOS a veces descarta el texto cuando se comparten archivos: queda copiado
      // para pegarlo como pie de foto. No se espera a la copia antes de `share`:
      // Safari exige que se llame mientras dura el gesto del usuario.
      const copying = withText ? copyText(text) : Promise.resolve(false);

      if (canShareFile) {
        const sharing = nav.share(withText ? { files, text } : { files });
        const copied = await copying;
        await sharing;
        if (copied) setNotice('Texto copiado: pégalo como pie de foto si no aparece.');
      } else {
        const copied = await copying;
        downloadAll(files);
        const what = files.length === 1 ? 'Imagen descargada' : 'Imágenes descargadas';
        const attach = files.length === 1 ? 'Adjúntala' : 'Adjúntalas';
        setNotice(
          copied
            ? `${what} y texto copiado. ${attach} en WhatsApp y pega el texto.`
            : `${what}. ${attach} en WhatsApp.`
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
    <BottomSheet open={open} onClose={onClose} title={title}>
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

        {withImage && multiple && (
          <div>
            <span className="text-caption text-text-2 uppercase tracking-wide">Imágenes</span>
            <div className="flex flex-wrap gap-2 mt-2" role="group" aria-label="Imágenes a compartir">
              {images.map((option) => {
                const on = selected.includes(option.id) && !option.unavailable;
                return (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={on}
                    disabled={!!option.unavailable}
                    onClick={() => toggle(option.id)}
                    className={cn(
                      'h-9 px-3 rounded-btn border inline-flex items-center gap-1.5 text-caption font-semibold',
                      on ? 'border-accent bg-accent/10 text-text' : 'border-border bg-bg-elev2 text-text-2',
                      option.unavailable && 'opacity-40'
                    )}
                  >
                    {on && <Check size={14} strokeWidth={2.25} className="text-accent" />}
                    {option.label}
                  </button>
                );
              })}
            </div>
            {images
              .filter((i) => i.unavailable)
              .map((i) => (
                <p key={i.id} className="text-caption text-text-3 mt-1.5">
                  {i.label}: {i.unavailable}
                </p>
              ))}
          </div>
        )}

        {withImage && chosen.length === 0 && (
          <p className="text-caption text-text-2 text-center py-6">Elige al menos una imagen.</p>
        )}

        {withImage && chosen.length > 0 && (
          <div
            className={cn(
              'flex gap-2',
              chosen.length > 1 ? 'overflow-x-auto snap-x snap-mandatory -mx-1 px-1 pb-1' : 'justify-center'
            )}
          >
            {chosen.map((option) => (
              <div
                key={option.id}
                className="rounded-card overflow-hidden border border-border bg-bg-elev aspect-[4/5] h-[32vh] flex-shrink-0 snap-center"
              >
                {rendered[option.id] ? (
                  <img
                    src={rendered[option.id].url}
                    alt={`Vista previa: ${option.label}`}
                    className="w-full h-full object-contain"
                    data-testid="share-image"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-caption text-text-3">
                    Generando imagen…
                  </div>
                )}
              </div>
            ))}
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
            disabled={busy || (withImage && !ready)}
            leading={<Share2 size={18} strokeWidth={1.75} />}
            onClick={onShare}
          >
            Compartir
          </Button>
          {withImage && ready && (
            <Button
              size="md"
              variant="ghost"
              fullWidth
              leading={<Download size={16} strokeWidth={1.75} />}
              onClick={() => downloadAll(files)}
            >
              {files.length === 1 ? 'Descargar imagen' : `Descargar ${files.length} imágenes`}
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
