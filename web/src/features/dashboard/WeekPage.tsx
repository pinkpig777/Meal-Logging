import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { ErrorState } from '@/components/ErrorState';
import { LoadingState } from '@/components/LoadingState';
import { MacroLine } from '@/components/MacroLine';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { formatDayLabel, formatNumber, parseLocalDate, toLocalDateString } from '@/lib/format';
import { useWeeklyAnalytics } from './api';
import { WeekDayRow } from './WeekDayRow';

/**
 * M4 · Xiaochuan — weekly view (`/week?start=YYYY-MM-DD`, Monday).
 * Drill-down: week → day (`/?date=`) → meal (`/meals/:id`).
 * Styled rows with inline div bars (no chart library yet). Unlogged days read
 * "Not logged", never 0.
 * TODO(Xiaochuan): charts, goal comparison encoding, estimate ranges.
 */
export function WeekPage() {
  const [params, setParams] = useSearchParams();
  const start = params.get('start') ?? undefined;
  const q = useWeeklyAnalytics(start);
  const todayStr = toLocalDateString(new Date());

  const shift = (weeks: number) => {
    if (!q.data) return;
    const d = parseLocalDate(q.data.start);
    d.setDate(d.getDate() + weeks * 7);
    setParams({ start: toLocalDateString(d) });
  };
  const isCurrentWeek = !!q.data && q.data.start <= todayStr && todayStr <= q.data.end;

  // Shared scale: the largest logged value or goal, with headroom.
  const scaleMax = q.data
    ? Math.max(1, ...q.data.days.flatMap((d) => [d.totals?.kcal_high ?? 0, d.goal?.kcal ?? 0])) *
      1.1
    : 1;
  const hasGoal = !!q.data?.days.some((d) => d.goal);

  return (
    <div className="space-y-6">
      <div className="-mx-2 flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => shift(-1)} aria-label="Previous week">
          <ChevronLeft strokeWidth={1.75} aria-hidden="true" />
        </Button>
        <h2 className="text-heading">
          {q.data ? `${formatDayLabel(q.data.start)} – ${formatDayLabel(q.data.end)}` : 'This week'}
        </h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => shift(1)}
          disabled={isCurrentWeek}
          aria-label="Next week"
        >
          <ChevronRight strokeWidth={1.75} aria-hidden="true" />
        </Button>
      </div>

      {q.isPending && <LoadingState layout="list" />}
      {q.isError && <ErrorState error={q.error} onRetry={() => q.refetch()} />}

      {q.data && (
        <>
          <Card size="hero" className="gap-1">
            <p className="text-label text-muted-foreground">Daily average</p>
            {q.data.averages ? (
              <>
                <p className="flex items-baseline gap-1.5">
                  <span className="text-display">{formatNumber(q.data.averages.kcal)}</span>
                  <span className="text-heading text-muted-foreground font-normal">kcal</span>
                </p>
                <MacroLine nutrition={q.data.averages} className="text-label" />
                <p className="text-caption text-muted-foreground mt-2">
                  Over {q.data.logged_day_count} logged{' '}
                  {q.data.logged_day_count === 1 ? 'day' : 'days'}; days without meals are not
                  counted. All values are estimates.
                </p>
              </>
            ) : (
              <p className="text-muted-foreground">No logged days this week.</p>
            )}
          </Card>

          <section className="space-y-3" aria-labelledby="week-days-h">
            <div className="flex items-center justify-between gap-2">
              <h2 id="week-days-h" className="text-heading">
                Calories by day
              </h2>
              {hasGoal && (
                <span className="text-caption text-muted-foreground flex items-center gap-1.5">
                  <span
                    aria-hidden="true"
                    className="border-muted-foreground h-3 w-0 border-l-2 border-dashed"
                  />
                  Goal
                </span>
              )}
            </div>
            <Card className="gap-0 p-0">
              <ul className="divide-border divide-y">
                {q.data.days.map((d) => (
                  <WeekDayRow
                    key={d.date}
                    day={d}
                    scaleMax={scaleMax}
                    isFuture={d.date > todayStr}
                    isToday={d.date === todayStr}
                  />
                ))}
              </ul>
            </Card>
          </section>
        </>
      )}
    </div>
  );
}
