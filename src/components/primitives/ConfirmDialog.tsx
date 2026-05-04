import { type ReactNode, useEffect } from 'react';
import { Button } from './Button';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end sm:items-center sm:justify-center" role="dialog" aria-modal="true">
      <button
        className="absolute inset-0 bg-black/65 animate-fade-in"
        onClick={onCancel}
        aria-label="Cerrar"
        tabIndex={-1}
      />
      <div
        className="relative bg-bg-sheet rounded-t-sheet sm:rounded-sheet px-5 pt-5 pb-6 border-t border-border w-full sm:max-w-sm sm:mx-auto animate-sheet-up"
        style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
      >
        <div className="text-title font-semibold tracking-tight">{title}</div>
        {description && <div className="text-body text-text-2 mt-2 leading-relaxed">{description}</div>}
        <div className="flex flex-col gap-2 mt-5">
          <Button
            variant={danger ? 'danger' : 'primary'}
            size="lg"
            fullWidth
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
          <Button variant="ghost" size="lg" fullWidth onClick={onCancel}>
            {cancelLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
