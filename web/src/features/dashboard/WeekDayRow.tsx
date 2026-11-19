import { scaleLinear } from 'd3';
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router';
import type { DayPoint } from '@/api/types';
import { formatDayLabel, formatGoalDelta, formatKcal, formatTotalsKcal } from '@/lib/format';
import { INK, splitOf } from './charts/colors';
import { StripePattern } from './charts/patterns';
import { usePatternId } from './charts/usePatternId';
import { SplitBar } from './charts/SplitBar';
import { useElementWidth } from './charts/useElementWidth';

export interface WeekDayRowProps {
  day: DayPoint;
  /** kcal value that maps to the full bar width (shared across the week). */
  scaleMax: number;
  /** Gridline values (shared across the week); optional. */
  ticks?: number[];
  isFuture: boolean;
  isToday: boolean;
}

/** Height of the bar area in every row, so rows and the axis line up. */
export const WEEK_BAR_HEIGHT = 24;
const BAR_Y = 5;
const BAR_H = 10;

/**
 * One day of the week chart (D3 scale, React-rendered SVG). Every row uses the
 * same x domain, so lengths compare across days:
 * - solid = checked kcal, stripes = AI-only kcal, whisker = estimate range,
 *   dashed tick = that day's goal;
 * - unlogged past day: dashed "Not logged" slot, never a zero bar (ADR-0005);
 * - future day: "Upcoming", quieter and not tappable (§6.4).
 * Tapping a logged or unlogged day opens it in Today (`/?date=`).
 */
export function WeekDayRow({ day: d, scaleMax, ticks = [], isFuture, isToday }: WeekDayRowProps) {
  const label = isToday ? `Today · ${formatDayLabel(d.date)}` : formatDayLabel(d.date);
  const [ref, width] = useElementWidth();
  const pid = usePatternId();
  const goal = d.goal?.kcal ?? null;

  if (isFuture) {
    return (
      <li className="min-h-touch flex items-center justify-between gap-3 px-4 py-3 opacity-70">
        <span className="text-label text-subtle-foreground font-normal">{label}</span>
        <span className="text-caption text-subtle-foreground">Upcoming</span>
      </li>
    );
  }

  const x = scaleLinear().domain([0, scaleMax]).range([0, width]);
  const t = d.logged ? d.totals : null;
  const split = t ? splitOf(t) : null;
  const href = isToday ? '/' : `/?date=${d.date}`;

  // Screen-reader summary of the marks (the bar itself is decorative).
  const srDetail = t
    ? [
        split && split.checked > 0 ? `${formatKcal(split.checked)} checked` : null,
        split && split.aiOnly > 0 ? `${formatKcal(split.aiOnly)} AI estimate` : null,
        goal ? `goal ${formatKcal(goal)}, ${formatGoalDelta(t.kcal, goal)}` : 'no goal set',
      ]
        .filter(Boolean)
        .join('; ')
    : 'intake unknown';

  return (
    <li>
      <Link
        to={href}
        className="min-h-touch hover:bg-muted/50 active:bg-muted flex items-center gap-3 px-4 py-3 transition-colors duration-150"
      >
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-label truncate">{label}</span>
            {t && <span className="text-label shrink-0 tabular-nums">{formatTotalsKcal(t)}</span>}
          </div>
          <span className="sr-only">{srDetail}</span>
          <div ref={ref}>
            {t && split ? (
              <svg
                data-testid="kcal-bar"
                width={width}
                height={WEEK_BAR_HEIGHT}
                aria-hidden="true"
                className="block overflow-visible"
              >
                <defs>
                  <StripePattern id={pid} />
                </defs>
                {ticks.map((v) => (
                  <line
                    key={v}
                    x1={x(v)}
                    x2={x(v)}
                    y1={0}
                    y2={WEEK_BAR_HEIGHT}
                    style={{ stroke: INK.border, strokeWidth: 1 }}
                  />
                ))}
                <SplitBar
                  x={x}
                  y={BAR_Y}
                  height={BAR_H}
                  checked={split.checked}
                  aiOnly={split.aiOnly}
                  low={t.kcal_low}
                  high={t.kcal_high}
                  goal={goal}
                  goalExtent={[0, WEEK_BAR_HEIGHT]}
                  patternId={pid}
                />
              </svg>
            ) : (
              <div
                data-testid="not-logged-slot"
                className="border-border text-caption text-muted-foreground flex h-6 items-center justify-center rounded-full border-2 border-dashed"
              >
                Not logged
              </div>
            )}
          </div>
        </div>
        <ChevronRight
          className="text-muted-foreground size-5 shrink-0"
          strokeWidth={1.75}
          aria-hidden="true"
        />
      </Link>
    </li>
  );
}

/** Tick labels under the week rows, aligned with the rows' bar area. */
export function WeekAxis({ scaleMax, ticks }: { scaleMax: number; ticks: number[] }) {
  const [ref, width] = useElementWidth();
  const x = scaleLinear().domain([0, scaleMax]).range([0, width]);
  return (
    <div className="flex items-center gap-3 px-4 pt-1 pb-3" aria-hidden="true">
      <div ref={ref} className="min-w-0 flex-1">
        <svg width={width} height={16} className="block overflow-visible">
          {axisLabels(ticks, x, width).map(({ v, px, anchor }) => (
            <text
              key={v}
              x={px}
              y={12}
              textAnchor={anchor}
              className="text-caption tabular-nums"
              style={{ fill: INK.muted }}
            >
              {new Intl.NumberFormat('en-US').format(v)}
            </text>
          ))}
        </svg>
      </div>
      <span className="size-5 shrink-0" />
    </div>
  );
}

const LABEL_CHAR_PX = 7.5;

/** Place tick labels left to right, dropping any that would collide (≥ 8 px apart). */
function axisLabels(ticks: number[], x: (v: number) => number, width: number) {
  const out: { v: number; px: number; anchor: 'start' | 'middle' | 'end' }[] = [];
  let lastRight = -Infinity;
  for (const v of ticks) {
    const px = x(v);
    const w = new Intl.NumberFormat('en-US').format(v).length * LABEL_CHAR_PX;
    const anchor = px - w / 2 < 0 ? 'start' : px + w / 2 > width ? 'end' : 'middle';
    const left = anchor === 'start' ? px : anchor === 'end' ? px - w : px - w / 2;
    if (left < lastRight + 8) continue;
    out.push({ v, px, anchor });
    lastRight = left + w;
  }
  return out;
}
