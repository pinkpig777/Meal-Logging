import { LoaderCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/** Spinner: only for actions (e.g. analyzing a meal), not for page loads (§5.2). */
export function Spinner({ className }: { className?: string }) {
  return (
    <LoaderCircle
      aria-hidden="true"
      strokeWidth={1.75}
      className={cn('text-primary size-6 animate-spin', className)}
    />
  );
}

type Layout = 'cards' | 'list' | 'today' | 'detail' | 'form';

function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn('bg-card border-card-edge shadow-card rounded-card border p-4', className)}>
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="mt-3 h-6 w-2/3" />
      <Skeleton className="mt-3 h-3 w-full" />
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="bg-card border-card-edge shadow-card rounded-card flex items-center gap-3 border p-4">
      <Skeleton className="size-12 shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-3 w-3/4" />
      </div>
      <Skeleton className="h-4 w-14" />
    </div>
  );
}

/**
 * Loading state (§6.5): skeletons that match the page layout. `fullScreen`
 * (session check, shape unknown) shows a centered spinner instead.
 */
export function LoadingState({
  label = 'Loading…',
  layout = 'cards',
  fullScreen,
}: {
  label?: string;
  layout?: Layout;
  fullScreen?: boolean;
}) {
  if (fullScreen) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="text-muted-foreground flex min-h-dvh flex-col items-center justify-center gap-3 p-8"
      >
        <Spinner />
        <span>{label}</span>
      </div>
    );
  }
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="space-y-3">
      <span className="sr-only">{label}</span>
      {layout === 'today' && (
        <>
          <div className="bg-card border-card-edge shadow-card rounded-card border p-5">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="mt-3 h-10 w-40" />
            <Skeleton className="mt-4 h-2 w-full rounded-full" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="bg-card border-card-edge shadow-card rounded-card border p-3">
                <Skeleton className="h-3 w-12" />
                <Skeleton className="mt-2 h-5 w-10" />
                <Skeleton className="mt-3 h-1.5 w-full rounded-full" />
              </div>
            ))}
          </div>
          <SkeletonRow />
          <SkeletonRow />
        </>
      )}
      {layout === 'list' && [0, 1, 2, 3].map((i) => <SkeletonRow key={i} />)}
      {layout === 'detail' && (
        <>
          <Skeleton className="rounded-card h-48 w-full" />
          <SkeletonCard />
          <SkeletonCard />
        </>
      )}
      {layout === 'form' && (
        <div className="space-y-3">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="rounded-control h-12 w-full" />
          <Skeleton className="rounded-control h-12 w-full" />
        </div>
      )}
      {layout === 'cards' && [0, 1, 2].map((i) => <SkeletonCard key={i} />)}
    </div>
  );
}
