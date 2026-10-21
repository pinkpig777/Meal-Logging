import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router';
import type { DayPoint } from '@/api/types';
import { formatDayLabel, formatTotalsKcal } from '@/lib/format';
import { cn } from '@/lib/utils';

export interface WeekDayRowProps {
  day: DayPoint;
  /** kcal value that maps to the full bar width (shared across the week). */
  scaleMax: number;
  isFuture: boolean;
  isToday: boolean;
}

/**
 * One day in the week list: label, kcal, and a thin inline bar in the kcal color
 * with the goal as a dashed reference mark (UI guidelines §7). Plain divs only;
 * the M4 owner picks the chart library later.
 * - Unlogged past day: dashed-outline "Not logged" slot, never a zero bar (ADR-0005).
 * - Future day: "Upcoming", quieter than unlogged days (§6.4).
 */
export function WeekDayRow({ day: d, scaleMax, isFuture, isToday }: WeekDayRowProps) {
  const label = isToday ? `Today · ${formatDayLabel(d.date)}` : formatDayLabel(d.date);
  const pct = (v: number) => `${Math.max(0, Math.min(100, (v / scaleMax) * 100))}%`;
  const goal = d.goal?.kcal ?? null;

  if (isFuture) {
    return (
      <li className="min-h-touch flex items-center justify-between gap-3 px-4 py-3 opacity-70">
        <span className="text-label text-subtle-foreground font-normal">{label}</span>
        <span className="text-caption text-subtle-foreground">Upcoming</span>
      </li>
    );
  }

  const href = isToday ? '/' : `/?date=${d.date}`;
  return (
    <li>
      <Link
        to={href}
        className="hover:bg-muted/50 active:bg-muted flex items-center gap-3 px-4 py-3 transition-colors duration-150"
      >
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-label">{label}</span>
            {d.logged && d.totals && (
              <span className="text-label tabular-nums">{formatTotalsKcal(d.totals)}</span>
            )}
          </div>
          {d.logged && d.totals ? (
            <div className="relative h-2" aria-hidden="true">
              <div className="bg-muted absolute inset-0 rounded-full" />
              <div
                data-testid="kcal-bar"
                className="bg-kcal absolute inset-y-0 left-0 rounded-full"
                style={{ width: pct(d.totals.kcal) }}
              />
              {goal !== null && (
                <div
                  className="border-muted-foreground absolute -inset-y-1 w-0 border-l-2 border-dashed"
                  style={{ left: pct(goal) }}
                />
              )}
            </div>
          ) : (
            <div
              data-testid="not-logged-slot"
              className="border-border text-caption text-muted-foreground flex h-7 items-center justify-center rounded-full border-2 border-dashed"
            >
              Not logged
            </div>
          )}
        </div>
        <ChevronRight
          className={cn('text-muted-foreground size-5 shrink-0')}
          strokeWidth={1.75}
          aria-hidden="true"
        />
      </Link>
    </li>
  );
}
