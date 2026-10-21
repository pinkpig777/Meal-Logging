import { useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from './cn';

export const inputClass =
  'block w-full min-h-touch rounded-xl border border-line bg-surface px-3 text-base text-text placeholder:text-muted focus:outline-2 focus:outline-accent';

/** Labeled input. Uses 16px text so iOS Safari doesn't zoom on focus. */
export function Field({
  label,
  hint,
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; hint?: ReactNode }) {
  const id = useId();
  return (
    <div className={cn('space-y-1', className)}>
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <input id={id} className={inputClass} {...rest} />
      {hint && <p className="text-muted text-xs">{hint}</p>}
    </div>
  );
}
