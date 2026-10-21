import { UserPen } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Provenance (§6.2): items changed by the user show a small "Adjusted by you"
 * label. AI values have no badge, because that is the default.
 */
export function ProvenanceBadge({
  label = 'Adjusted by you',
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'text-caption text-muted-foreground inline-flex items-center gap-1 font-medium',
        className,
      )}
    >
      <UserPen className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
      {label}
    </span>
  );
}
