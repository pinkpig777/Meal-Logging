import { useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

/** Labeled input built on shadcn Input + Label. Text is 16 px so iOS Safari doesn't zoom. */
export function Field({
  label,
  hint,
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; hint?: ReactNode }) {
  const id = useId();
  const hintId = `${id}-hint`;
  return (
    <div className={cn('space-y-2', className)}>
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} aria-describedby={hint ? hintId : undefined} {...rest} />
      {hint && (
        <p id={hintId} className="text-caption text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}

/** Native <select> styled like Input. */
export const selectClass =
  'h-12 w-full rounded-control bg-muted px-3 text-body text-foreground disabled:opacity-50';
