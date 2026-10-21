import * as React from 'react';
import { cn } from '@/lib/utils';

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'rounded-control bg-muted text-body placeholder:text-subtle-foreground focus-visible:border-ring focus-visible:ring-ring focus-visible:ring-offset-background disabled:bg-input/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:bg-muted dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 flex field-sizing-content min-h-24 w-full border border-transparent px-3 py-3 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3',
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
