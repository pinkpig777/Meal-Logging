import { CalendarDays, ChevronLeft, ChevronRight, UtensilsCrossed } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
import { CalorieHero } from '@/components/CalorieHero';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { LoadingState } from '@/components/LoadingState';
import { MacroTile } from '@/components/MacroTile';
import { MealRow } from '@/components/MealRow';
import { Button } from '@/components/ui/button';
import { formatDayLabel, parseLocalDate, toLocalDateString } from '@/lib/format';
import { useDailyAnalytics } from './api';

/**
 * M4 · Xiaochuan — daily dashboard (`/` and `/?date=YYYY-MM-DD` for drill-down).
 * Numbers first: calorie hero, macro tiles, meals. No chart library yet.
 * TODO(Xiaochuan): visual design per docs/03-design/m4-visualization.md
 * (replace the hero/tiles with the chosen visualization if needed).
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
    <div className="space-y-6">
      <div className="-mx-2 flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => shift(-1)} aria-label="Previous day">
          <ChevronLeft strokeWidth={1.75} aria-hidden="true" />
        </Button>
        <h2 className="text-heading">{formatDayLabel(date)}</h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => shift(1)}
          disabled={isToday}
          aria-label="Next day"
        >
          <ChevronRight strokeWidth={1.75} aria-hidden="true" />
        </Button>
      </div>

      {q.isPending && <LoadingState layout="today" />}
      {q.isError && <ErrorState error={q.error} onRetry={() => q.refetch()} />}

      {q.data && !q.data.logged && (
        // Unlogged day: unknown intake, never zero (ADR-0005).
        <div className="rounded-card border-border border-2 border-dashed">
          <EmptyState
            icon={<UtensilsCrossed strokeWidth={1.75} />}
            title={isToday ? 'No meals yet today' : 'Not logged'}
            description={
              isToday
                ? 'Log a meal to see your totals.'
                : 'No meals were logged for this day, so intake is unknown.'
            }
            action={
              <Button asChild className="w-full">
                <Link to={isToday ? '/log' : '/log?backfill=1'}>
                  {isToday ? 'Log a meal' : 'Log a past meal'}
                </Link>
              </Button>
            }
          />
        </div>
      )}

      {q.data?.logged && q.data.totals && (
        <>
          <section className="space-y-3" aria-label="Totals">
            <CalorieHero totals={q.data.totals} goal={q.data.goal?.kcal ?? null} />
            <div className="grid grid-cols-3 gap-3">
              <MacroTile
                nutrient="protein"
                value={q.data.totals.protein_g}
                goal={q.data.goal?.protein_g ?? null}
              />
              <MacroTile
                nutrient="carbs"
                value={q.data.totals.carbs_g}
                goal={q.data.goal?.carbs_g ?? null}
              />
              <MacroTile
                nutrient="fat"
                value={q.data.totals.fat_g}
                goal={q.data.goal?.fat_g ?? null}
              />
            </div>
            <p className="text-caption text-muted-foreground">All values are estimates.</p>
          </section>

          <section className="space-y-3" aria-labelledby="today-meals-h">
            <h2 id="today-meals-h" className="text-heading">
              Meals
            </h2>
            {q.data.meals.map((m) => (
              <MealRow key={m.id} meal={m} />
            ))}
          </section>
        </>
      )}

      <Button asChild variant="secondary" className="w-full">
        <Link to="/week">
          <CalendarDays aria-hidden="true" strokeWidth={1.75} />
          View this week
        </Link>
      </Button>
    </div>
  );
}
