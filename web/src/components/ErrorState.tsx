import type { ReactNode } from 'react';
import { isApiError } from '@/lib/api';
import { Button } from './Button';
import { IconAlert } from './icons';

export interface ErrorStateProps {
  error: unknown;
  title?: string;
  onRetry?: () => void;
  /** Extra actions, e.g. "Describe instead". */
  children?: ReactNode;
}

/** Shows the envelope's user-safe message (api-conventions §4) plus Retry. */
export function ErrorState({
  error,
  title = 'Something went wrong',
  onRetry,
  children,
}: ErrorStateProps) {
  const message = isApiError(error)
    ? error.message
    : 'An unexpected error occurred. Please try again.';
  const requestId = isApiError(error) ? error.requestId : null;
  return (
    <div role="alert" className="flex flex-col items-center gap-3 p-6 text-center">
      <IconAlert className="text-danger size-8" />
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="text-muted">{message}</p>
      {requestId && <p className="text-muted text-xs">Reference: {requestId}</p>}
      <div className="flex w-full flex-col gap-2">
        {onRetry && (
          <Button onClick={onRetry} className="w-full">
            Retry
          </Button>
        )}
        {children}
      </div>
    </div>
  );
}
