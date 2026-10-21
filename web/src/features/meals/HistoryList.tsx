import { CalendarPlus, UtensilsCrossed } from 'lucide-react';
import { Link } from 'react-router';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { LoadingState } from '@/components/LoadingState';
import { MealRow } from '@/components/MealRow';
import { Button } from '@/components/ui/button';
import { formatDayLabel, toLocalDateString } from '@/lib/format';
import { useMeals } from './api';
import { groupByDate } from './grouping';

const RANGE_DAYS = 30;

/**
 * M3 · Yi-Wei — confirmed meals grouped by local date, newest first, with a
 * backfill entry point.
 * TODO(Yi-Wei): "Load earlier" beyond 30 days (≤ 92-day ranges), search/filter,
 * show unfinished drafts.
 */
export function HistoryList() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - (RANGE_DAYS - 1));
  const q = useMeals({
    from: toLocalDateString(from),
    to: toLocalDateString(to),
    status: 'confirmed',
  });

  return (
    <div className="space-y-6">
      <Button asChild variant="secondary" className="w-full border-dashed">
        <Link to="/log?backfill=1">
          <CalendarPlus aria-hidden="true" strokeWidth={1.75} />
          Log a past meal
        </Link>
      </Button>

      {q.isPending && <LoadingState layout="list" />}
      {q.isError && <ErrorState error={q.error} onRetry={() => q.refetch()} />}
      {q.data && q.data.meals.length === 0 && (
        <EmptyState
          icon={<UtensilsCrossed strokeWidth={1.75} />}
          title="No meals in the last 30 days"
          description="Meals you confirm will show up here."
          action={
            <Button asChild className="w-full">
              <Link to="/log">Log a meal</Link>
            </Button>
          }
        />
      )}
      {q.data &&
        groupByDate(q.data.meals).map(([date, meals]) => (
          <section key={date} aria-labelledby={`h-${date}`} className="space-y-3">
            <h2 id={`h-${date}`} className="text-label text-muted-foreground">
              {formatDayLabel(date)}
            </h2>
            {meals.map((m) => (
              <MealRow key={m.id} meal={m} showThumbnail />
            ))}
          </section>
        ))}
    </div>
  );
}
