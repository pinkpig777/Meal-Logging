import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * The page's primary action, pinned just above the bottom nav (UI guidelines §4):
 * never under the nav, reachable with a thumb on short viewports.
 */
export function StickyActionBar({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'bottom-nav-offset bg-background/95 sticky z-20 -mx-4 mt-6 px-4 pt-3 pb-6 backdrop-blur',
        'shadow-[0_-1px_0_var(--border)]',
        className,
      )}
    >
      {children}
    </div>
  );
}
