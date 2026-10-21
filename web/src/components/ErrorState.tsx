import { CircleAlert, RotateCw } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { isApiError } from '@/lib/api';
import { cn } from '@/lib/utils';

export interface ErrorStateProps {
  error: unknown;
  title?: string;
  onRetry?: () => void;
  /** Extra actions, e.g. "Describe instead". */
  children?: ReactNode;
  className?: string;
}

/**
 * Error state (§6.5): the envelope's user-safe message (api-conventions §4) + Retry.
 * Never a raw code or stack trace.
 */
export function ErrorState({
  error,
  title = 'Something went wrong',
  onRetry,
  children,
  className,
}: ErrorStateProps) {
  const message = isApiError(error)
    ? error.message
    : 'An unexpected error occurred. Please try again.';
  const requestId = isApiError(error) ? error.requestId : null;
  return (
    <div
      role="alert"
      className={cn('flex flex-col items-center gap-2 px-4 py-6 text-center', className)}
    >
      <div className="bg-muted text-destructive mb-1 flex size-12 items-center justify-center rounded-full">
        <CircleAlert className="size-6" strokeWidth={1.75} aria-hidden="true" />
      </div>
      <h2 className="text-heading">{title}</h2>
      <p className="text-muted-foreground max-w-xs">{message}</p>
      {requestId && <p className="text-caption text-muted-foreground">Reference: {requestId}</p>}
      {(onRetry || children) && (
        <div className="mt-3 flex w-full flex-col gap-2">
          {onRetry && (
            <Button onClick={onRetry} className="w-full">
              <RotateCw aria-hidden="true" />
              Retry
            </Button>
          )}
          {children}
        </div>
      )}
    </div>
  );
}
