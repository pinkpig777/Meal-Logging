'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Checkbox as CheckboxPrimitive } from 'radix-ui';
import { CheckIcon } from 'lucide-react';

function Checkbox({ className, ...props }: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        'peer border-muted-foreground group-has-[:focus-visible]/field-label:not-data-checked:border-input focus-visible:border-ring focus-visible:ring-ring focus-visible:ring-offset-background aria-invalid:border-destructive aria-invalid:ring-destructive/20 aria-invalid:aria-checked:border-primary dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground group-has-[:focus-visible]/field-label:data-checked:border-primary dark:data-checked:bg-primary relative flex size-5 shrink-0 items-center justify-center rounded-[6px] border-2 transition-colors outline-none group-has-disabled/field:opacity-50 group-has-[:focus-visible]/field-label:ring-0 after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-content-center text-current transition-none [&>svg]:size-4"
      >
        <CheckIcon />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
