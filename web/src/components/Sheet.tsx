import { useEffect, useId, useRef, type ReactNode } from 'react';
import { IconClose } from './icons';

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

/**
 * Bottom sheet for mobile editing (portion editor, quick forms).
 * Closes on backdrop tap and Escape. Respects the bottom safe area.
 */
export function Sheet({ open, onClose, title, children }: SheetProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="pb-safe max-w-app bg-surface relative max-h-[85dvh] w-full overflow-y-auto rounded-t-3xl shadow-lg outline-none"
      >
        <div className="flex items-center justify-between px-4 pt-3">
          <h2 id={titleId} className="text-lg font-semibold">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="size-touch hover:bg-surface-2 -mr-2 inline-flex items-center justify-center rounded-full"
            aria-label="Close"
          >
            <IconClose className="size-5" />
          </button>
        </div>
        <div className="px-4 pt-2 pb-4">{children}</div>
      </div>
    </div>
  );
}

/** Alias matching repo-structure naming. */
export const BottomSheet = Sheet;
