import { Link, useSearchParams } from 'react-router';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { IconBack, IconChevronRight } from '@/components/icons';
import { LoadingState } from '@/components/LoadingState';
import {
  MEAL_TYPE_LABEL,
  formatDayLabel,
  formatTime,
  formatTotalsKcal,
  parseLocalDate,
  toLocalDateString,
} from '@/lib/format';
import { useDailyAnalytics } from './api';
import { TotalsTable } from './TotalsTable';

/**
 * M4 · Xiaochuan — daily dashboard (`/` and `/?date=YYYY-MM-DD` for drill-down).
 * Placeholder rendering: plain text/tables only, no chart library yet.
 * TODO(Xiaochuan): visual design per docs/03-design/m4-visualization.md.
 */
export function TodayPage() {
  const [params, setParams] = useSearchParams();
  const todayStr = toLocalDateString(new Date());
  const date = params.get('date') ?? todayStr;
  const isToday = date === todayStr;
  const q = useDailyAnalytics(isToday ? undefined : date);

  const shift = (days: number) => {
    const d = parseLocalDate(date);
    d.setDate(d.getDate() + days);
    const next = toLocalDateString(d);
    setParams(next === todayStr ? {} : { date: next });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => shift(-1)}
          className="size-touch hover:bg-surface-2 inline-flex items-center justify-center rounded-full"
          aria-label="Previous day"
        >
          <IconBack className="size-5" />
        </button>
        <h2 className="text-lg font-semibold">{isToday ? 'Today' : formatDayLabel(date)}</h2>
        <button
          type="button"
          onClick={() => shift(1)}
          disabled={isToday}
          className="size-touch hover:bg-surface-2 inline-flex items-center justify-center rounded-full disabled:opacity-30"
          aria-label="Next day"
        >
          <IconChevronRight className="size-5" />
        </button>
      </div>

      {q.isPending && <LoadingState />}
      {q.isError && <ErrorState error={q.error} onRetry={() => q.refetch()} />}

      {q.data && !q.data.logged && (
        <Card>
          {/* Unlogged day: unknown intake, never zero (ADR-0005). */}
          <EmptyState
            title="Not logged"
            description={
              isToday
                ? 'No meals confirmed yet today.'
                : 'No meals were logged for this day, so intake is unknown.'
            }
            action={
              <Link
                to={isToday ? '/log' : '/log?backfill=1'}
                className="min-h-touch bg-accent text-accent-fg flex items-center justify-center rounded-xl font-medium"
              >
                {isToday ? 'Log a meal' : 'Log a past meal'}
              </Link>
            }
          />
        </Card>
      )}

      {q.data?.logged && q.data.totals && (
        <>
          <Card>
            <TotalsTable totals={q.data.totals} goal={q.data.goal} />
            <p className="text-muted mt-2 text-xs">All values are estimates.</p>
          </Card>

          <section className="space-y-2" aria-labelledby="today-meals-h">
            <h2 id="today-meals-h" className="text-lg font-semibold">
              Meals
            </h2>
            {q.data.meals.map((m) => (
              <Link key={m.id} to={`/meals/${m.id}`} className="block">
                <Card className="flex items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {MEAL_TYPE_LABEL[m.meal_type]}{' '}
                      <span className="text-muted font-normal">· {formatTime(m.eaten_at)}</span>
                    </p>
                    <p className="text-muted truncate text-sm">{m.item_names.join(', ')}</p>
                  </div>
                  <div className="shrink-0 text-right text-sm tabular-nums">
                    <p className="font-medium">{formatTotalsKcal(m.totals)}</p>
                    <p className="text-muted">{Math.round(m.share.kcal * 100)}% of day</p>
                  </div>
                  <IconChevronRight className="text-muted size-4 shrink-0" />
                </Card>
              </Link>
            ))}
          </section>
        </>
      )}

      <Link
        to="/week"
        className="min-h-touch border-line bg-surface flex items-center justify-center gap-1 rounded-xl border font-medium"
      >
        View this week
        <IconChevronRight className="size-4" />
      </Link>
    </div>
  );
}
