import { Check } from 'lucide-react';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/**
 * Quick reply / filter chip (UI guidelines §5.2): pill, 40 px tall, `muted` fill.
 * Selected = `primary-soft` fill + check icon + `aria-pressed`, so selection never
 * relies on color alone. Wraps; never truncates an option.
 */
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
        'text-label inline-flex min-h-10 items-center gap-1.5 rounded-full px-4 py-2 text-left transition-colors duration-150',
        'focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2',
        'disabled:cursor-not-allowed disabled:not-aria-pressed:opacity-50',
        selected
          ? 'bg-primary-soft text-foreground ring-primary ring-1 ring-inset'
          : 'bg-muted text-foreground hover:bg-primary-soft/60 active:bg-primary-soft',
        className,
      )}
      {...rest}
    >
      {selected && (
        <Check className="text-primary size-4 shrink-0" strokeWidth={2.25} aria-hidden="true" />
      )}
      {children}
    </button>
  );
}
