import * as React from 'react';
import { cn } from '@/lib/utils';
import { Progress as ProgressPrimitive } from 'radix-ui';

function Progress({
  className,
  value,
  indicatorClassName,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root> & {
  /** Fill color, e.g. "bg-protein" (§5.2: fill = nutrient color). */
  indicatorClassName?: string;
}) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn(
        'bg-muted relative flex h-1 w-full items-center overflow-x-hidden rounded-full',
        className,
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className={cn(
          'bg-primary size-full flex-1 rounded-full transition-transform duration-[400ms] ease-out',
          indicatorClassName,
        )}
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      />
    </ProgressPrimitive.Root>
  );
}

export { Progress };
