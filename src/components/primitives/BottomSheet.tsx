import { useEffect, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  className?: string;
  /**
   * Si es false, no se puede cerrar el sheet con backdrop ni con Escape.
   * Útil para sheets bloqueantes que requieren elegir una opción. Default: true.
   */
  dismissable?: boolean;
}

export function BottomSheet({ open, onClose, title, children, className, dismissable = true }: BottomSheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dismissable) onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose, dismissable]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" role="dialog" aria-modal="true">
      {dismissable ? (
        <button
          className="absolute inset-0 bg-black/60 animate-fade-in"
          onClick={onClose}
          aria-label="Cerrar"
          tabIndex={-1}
        />
      ) : (
        <div className="absolute inset-0 bg-black/60 animate-fade-in" aria-hidden="true" />
      )}
      <div
        className={cn(
          'relative bg-bg-sheet rounded-t-sheet px-4 pt-3 pb-8 border-t border-border max-h-[85%] overflow-auto noscrollbar animate-sheet-up',
          className
        )}
        style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}
      >
        {dismissable && <div className="w-9 h-1 bg-white/20 rounded mx-auto mb-3" />}
        {title && <div className="text-body-em font-semibold mb-3">{title}</div>}
        {children}
      </div>
    </div>
  );
}
