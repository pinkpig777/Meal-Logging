import { Link } from 'react-router';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { IconChevronRight, IconPlus } from '@/components/icons';
import { LoadingState } from '@/components/LoadingState';
import {
  MEAL_TYPE_LABEL,
  formatDayLabel,
  formatTime,
  formatTotalsKcal,
  toLocalDateString,
} from '@/lib/format';
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
    <div className="space-y-4">
      <Link
        to="/log?backfill=1"
        className="min-h-touch border-line bg-surface flex items-center justify-center gap-2 rounded-xl border border-dashed font-medium"
      >
        <IconPlus className="size-5" />
        Log a past meal
      </Link>

      {q.isPending && <LoadingState />}
      {q.isError && <ErrorState error={q.error} onRetry={() => q.refetch()} />}
      {q.data && q.data.meals.length === 0 && (
        <EmptyState
          title="No meals in the last 30 days"
          description="Meals you confirm will show up here."
        />
      )}
      {q.data &&
        groupByDate(q.data.meals).map(([date, meals]) => (
          <section key={date} aria-labelledby={`h-${date}`} className="space-y-2">
            <h2 id={`h-${date}`} className="text-muted text-sm font-semibold">
              {formatDayLabel(date)}
            </h2>
            {meals.map((m) => (
              <Link key={m.id} to={`/meals/${m.id}`} className="block">
                <Card className="flex items-center gap-3 p-3">
                  {m.photo_url ? (
                    <img
                      src={m.photo_url}
                      alt=""
                      className="size-12 shrink-0 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="bg-surface-2 size-12 shrink-0 rounded-lg" aria-hidden="true" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {MEAL_TYPE_LABEL[m.meal_type]}{' '}
                      <span className="text-muted font-normal">· {formatTime(m.eaten_at)}</span>
                    </p>
                    <p className="text-muted truncate text-sm">{m.item_names.join(', ')}</p>
                  </div>
                  <p className="shrink-0 text-sm font-medium tabular-nums">
                    {formatTotalsKcal(m.totals)}
                  </p>
                  <IconChevronRight className="text-muted size-4 shrink-0" />
                </Card>
              </Link>
            ))}
          </section>
        ))}
    </div>
  );
}
