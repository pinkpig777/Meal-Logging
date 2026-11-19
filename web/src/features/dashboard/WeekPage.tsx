import { scaleLinear } from 'd3';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { ErrorState } from '@/components/ErrorState';
import { LoadingState } from '@/components/LoadingState';
import { MacroLine } from '@/components/MacroLine';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { formatDayLabel, formatNumber, toLocalDateString } from '@/lib/format';
import { useWeeklyAnalytics } from './api';
import { SplitBarLegend } from './charts/Legend';
import { hasMeaningfulRange } from './charts/layout';
import { WeekAxis, WeekDayRow } from './WeekDayRow';
import { addDays, weekTitle } from './dates';

/**
 * M4 · Xiaochuan — weekly view (`/week?start=YYYY-MM-DD`, Monday).
 * Drill-down: week → day (`/?date=`) → meal (`/meals/:id`).
 * One D3-scaled horizontal bar per day on a shared x domain (goals and range
 * highs included), split into checked (solid) and AI-only (stripes) kcal, with
 * a range whisker and that day's goal tick. Unlogged days read "Not logged".
 */
export function WeekPage() {
  const [params, setParams] = useSearchParams();
  const start = params.get('start') ?? undefined;
  const q = useWeeklyAnalytics(start);
  const todayStr = toLocalDateString(new Date());

  const shift = (weeks: number) => {
    if (!q.data) return;
    setParams({ start: addDays(q.data.start, weeks * 7) });
  };
  const isCurrentWeek = !!q.data && q.data.start <= todayStr && todayStr <= q.data.end;
  const title = weekTitle(q.data?.start ?? start, todayStr);

  // Shared scale: the largest range high or goal of the week, with headroom.
  const rawMax = q.data
    ? Math.max(1, ...q.data.days.flatMap((d) => [d.totals?.kcal_high ?? 0, d.goal?.kcal ?? 0]))
    : 1;
  const x = scaleLinear()
    .domain([0, rawMax * 1.08])
    .nice(4);
  const scaleMax = x.domain()[1];
  // Interior ticks only: no 0 (unlogged ≠ 0) and no tick on the right edge.
  const ticks = x.ticks(3).filter((v) => v > 0 && v < scaleMax);
  const hasGoal = !!q.data?.days.some((d) => d.goal);
  const hasRange = !!q.data?.days.some(
    (d) => d.totals && hasMeaningfulRange(d.totals.kcal_low, d.totals.kcal_high),
  );
  const anyLogged = !!q.data?.days.some((d) => d.logged && d.totals);

  return (
    <div className="space-y-6">
      <div className="-mx-2 flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => shift(-1)} aria-label="Previous week">
          <ChevronLeft strokeWidth={1.75} aria-hidden="true" />
        </Button>
        <div className="min-w-0 text-center">
          <h2 className="text-heading">{title}</h2>
          {q.data && (
            <p className="text-caption text-muted-foreground tabular-nums">
              {formatDayLabel(q.data.start)} – {formatDayLabel(q.data.end)}
            </p>
          )}
        </div>
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
            <div className="space-y-2">
              <h2 id="week-days-h" className="text-heading">
                Calories by day
              </h2>
              {anyLogged && (
                <SplitBarLegend
                  items={[
                    'checked',
                    'ai',
                    ...(hasRange ? (['range'] as const) : []),
                    ...(hasGoal ? (['goal'] as const) : []),
                  ]}
                />
              )}
            </div>
            <Card className="gap-0 p-0">
              <ul className="divide-border divide-y">
                {q.data.days.map((d) => (
                  <WeekDayRow
                    key={d.date}
                    day={d}
                    scaleMax={scaleMax}
                    ticks={ticks}
                    isFuture={d.date > todayStr}
                    isToday={d.date === todayStr}
                  />
                ))}
              </ul>
              {anyLogged && <WeekAxis scaleMax={scaleMax} ticks={ticks} />}
            </Card>
            <p className="text-caption text-muted-foreground">
              Tap a day to see its meals. All values are estimates.
            </p>
          </section>
        </>
      )}
    </div>
  );
}
