import type { ButtonHTMLAttributes } from 'react';
import { cn } from './cn';

/** Selectable pill (quick replies, filters). Selection shown by check + border, not color alone. */
export function Chip({
  selected,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        'min-h-touch inline-flex items-center gap-1 rounded-full border px-4 text-sm font-medium',
        'focus-visible:outline-accent focus-visible:outline-2 focus-visible:outline-offset-2',
        'disabled:opacity-50',
        selected
          ? 'border-accent bg-accent-soft text-text ring-accent ring-1'
          : 'border-line bg-surface text-text hover:bg-surface-2',
        className,
      )}
      {...rest}
    >
      {selected && <span aria-hidden="true">✓</span>}
      {children}
    </button>
  );
}
