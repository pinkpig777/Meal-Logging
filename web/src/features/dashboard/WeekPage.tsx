import { Link, useSearchParams } from 'react-router';
import { Card } from '@/components/Card';
import { ErrorState } from '@/components/ErrorState';
import { IconBack, IconChevronRight } from '@/components/icons';
import { LoadingState } from '@/components/LoadingState';
import {
  formatDayLabel,
  formatGrams,
  formatKcal,
  formatTotalsKcal,
  parseLocalDate,
  toLocalDateString,
} from '@/lib/format';
import { useWeeklyAnalytics } from './api';

/**
 * M4 · Xiaochuan — weekly view (`/week?start=YYYY-MM-DD`, Monday).
 * Drill-down: week → day (`/?date=`) → meal (`/meals/:id`).
 * Placeholder rendering: a table. Unlogged days read "Not logged", never 0.
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => shift(-1)}
          className="size-touch hover:bg-surface-2 inline-flex items-center justify-center rounded-full"
          aria-label="Previous week"
        >
          <IconBack className="size-5" />
        </button>
        <h2 className="text-base font-semibold">
          {q.data ? `${formatDayLabel(q.data.start)} – ${formatDayLabel(q.data.end)}` : 'This week'}
        </h2>
        <button
          type="button"
          onClick={() => shift(1)}
          disabled={isCurrentWeek}
          className="size-touch hover:bg-surface-2 inline-flex items-center justify-center rounded-full disabled:opacity-30"
          aria-label="Next week"
        >
          <IconChevronRight className="size-5" />
        </button>
      </div>

      {q.isPending && <LoadingState />}
      {q.isError && <ErrorState error={q.error} onRetry={() => q.refetch()} />}

      {q.data && (
        <>
          <Card>
            <h3 className="font-semibold">Daily average</h3>
            {q.data.averages ? (
              <>
                <p className="mt-1 text-2xl font-semibold tabular-nums">
                  {formatKcal(q.data.averages.kcal)}
                </p>
                <p className="text-muted text-sm tabular-nums">
                  P {formatGrams(q.data.averages.protein_g)} · C{' '}
                  {formatGrams(q.data.averages.carbs_g)} · F {formatGrams(q.data.averages.fat_g)}
                </p>
                <p className="text-muted mt-1 text-xs">
                  Over {q.data.logged_day_count} logged{' '}
                  {q.data.logged_day_count === 1 ? 'day' : 'days'}; days without meals are not
                  counted.
                </p>
              </>
            ) : (
              <p className="text-muted mt-1">No logged days this week.</p>
            )}
          </Card>

          <Card className="p-0">
            <table className="w-full text-sm tabular-nums">
              <caption className="sr-only">Calories and protein by day</caption>
              <thead>
                <tr className="text-muted text-left">
                  <th scope="col" className="px-3 py-2 font-medium">
                    Day
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    Calories
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    Protein
                  </th>
                  <th scope="col" className="w-6" />
                </tr>
              </thead>
              <tbody>
                {q.data.days.map((d) => {
                  const future = d.date > todayStr;
                  const href = d.date === todayStr ? '/' : `/?date=${d.date}`;
                  return (
                    <tr key={d.date} className="border-line border-t">
                      <th scope="row" className="px-3 py-0 text-left font-medium">
                        {future ? (
                          <span className="text-muted block py-3">{formatDayLabel(d.date)}</span>
                        ) : (
                          <Link to={href} className="block py-3">
                            {formatDayLabel(d.date)}
                          </Link>
                        )}
                      </th>
                      {d.logged && d.totals ? (
                        <>
                          <td className="px-3 text-right">{formatTotalsKcal(d.totals)}</td>
                          <td className="px-3 text-right">{formatGrams(d.totals.protein_g)}</td>
                        </>
                      ) : (
                        <td colSpan={2} className="text-muted px-3 text-right italic">
                          {future ? 'Upcoming' : 'Not logged'}
                        </td>
                      )}
                      <td className="text-muted pr-2">
                        {!future && <IconChevronRight className="size-4" />}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}
