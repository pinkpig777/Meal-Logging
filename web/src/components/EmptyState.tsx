import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Empty state (§6.5): short sentence + one action. */
export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center gap-2 px-4 py-8 text-center', className)}>
      {icon && (
        <div
          className="bg-muted text-muted-foreground mb-2 flex size-14 items-center justify-center rounded-full [&_svg]:size-6"
          aria-hidden="true"
        >
          {icon}
        </div>
      )}
      <h2 className="text-heading">{title}</h2>
      {description && <p className="text-muted-foreground max-w-xs">{description}</p>}
      {action && <div className="mt-4 w-full">{action}</div>}
    </div>
  );
}
