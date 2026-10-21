import { cn } from './cn';

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'border-line border-t-accent inline-block size-6 animate-spin rounded-full border-2',
        className,
      )}
    />
  );
}

export function LoadingState({
  label = 'Loading…',
  fullScreen,
}: {
  label?: string;
  fullScreen?: boolean;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'text-muted flex flex-col items-center justify-center gap-3 p-8',
        fullScreen && 'min-h-dvh',
      )}
    >
      <Spinner />
      <span>{label}</span>
    </div>
  );
}
