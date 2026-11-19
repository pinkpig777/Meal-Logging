import { scaleBand } from 'd3';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ErrorState } from '@/components/ErrorState';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { formatMonthDay, parseLocalDate, toLocalDateString } from '@/lib/format';
import { useHistoryAnalytics } from './api';
import { cssVar, INK } from './charts/colors';
import {
  buildHeatmapWeeks,
  HEAT_LABELS,
  HEAT_STEPS,
  summarizeHeatmap,
  type HeatCell,
} from './charts/heatmap';
import { useElementWidth } from './charts/useElementWidth';
import { addDays, mondayOf } from './dates';

export const HEATMAP_WEEKS = 4;
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const GAP = 2; // surface gap between cells
const HEADER_H = 20;
const MAX_CELL_H = 48;

/** Ink for the day number on a colored cell (steps 1–2 vs 3–5; works in both themes). */
const onStep = (step: number) => (step <= 2 ? INK.foreground : INK.surface);

/**
 * M4 V5 — calendar heatmap at the top of History. Columns Mon–Sun, rows =
 * weeks (current week last), 4 weeks per page. Color = % of that day's kcal
 * goal in 5 steps of one warm hue (`--heat-1..5`). Unlogged = dashed empty
 * cell (not a color); future = faint, no outline, not tappable; today = ring.
 * Tap a day to open it in Today (`/?date=`).
 */
export function HistoryHeatmap() {
  const navigate = useNavigate();
  const [page, setPage] = useState(0); // 0 = the 4 weeks ending this week
  const [focused, setFocused] = useState<string | null>(null);
  const [ref, width] = useElementWidth();

  const today = toLocalDateString(new Date());
  const firstMonday = addDays(mondayOf(today), -7 * (HEATMAP_WEEKS - 1 + page * HEATMAP_WEEKS));
  const lastDay = addDays(firstMonday, 7 * HEATMAP_WEEKS - 1);
  // Never ask for future days; they are filled in on the client.
  const q = useHistoryAnalytics(firstMonday, lastDay < today ? lastDay : today);
  const weeks = buildHeatmapWeeks(q.data?.days ?? [], firstMonday, HEATMAP_WEEKS, today);
  const cells = weeks.flat();
  const hasNoGoal = cells.some((c) => c.state === 'no-goal');

  const col = scaleBand<number>()
    .domain([0, 1, 2, 3, 4, 5, 6])
    .range([0, width])
    .paddingInner(GAP / (width / 7 || 1));
  const cellW = col.bandwidth();
  const cellH = Math.min(cellW, MAX_CELL_H);
  const rowY = (w: number) => HEADER_H + w * (cellH + GAP);
  const svgH = rowY(HEATMAP_WEEKS) - GAP;

  const open = (c: HeatCell) => navigate(c.date === today ? '/' : `/?date=${c.date}`);
  const rangeText = `${formatMonthDay(firstMonday)} – ${formatMonthDay(lastDay)}`;

  return (
    <Card className="gap-3" role="region" aria-labelledby="heatmap-h">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="heatmap-h" className="text-heading">
          Daily calories
        </h2>
        <p className="text-caption text-muted-foreground tabular-nums" aria-live="polite">
          {rangeText}
        </p>
      </div>

      {q.isError && !q.data ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : (
        <div ref={ref}>
          {q.isPending ? (
            <div className="bg-muted rounded-small h-48 animate-pulse" />
          ) : (
            <svg
              width={width}
              height={svgH}
              className="block overflow-visible"
              role="grid"
              aria-label={`Calendar, ${rangeText}`}
            >
              {WEEKDAYS.map((d, i) => (
                <text
                  key={i}
                  x={(col(i) ?? 0) + cellW / 2}
                  y={13}
                  textAnchor="middle"
                  className="text-caption"
                  style={{ fill: INK.muted }}
                  aria-hidden="true"
                >
                  {d}
                </text>
              ))}
              {weeks.map((week, w) => (
                <g key={week[0].date} role="row">
                  {week.map((c, i) => (
                    <HeatmapCell
                      key={c.date}
                      cell={c}
                      x={col(i) ?? 0}
                      y={rowY(w)}
                      w={cellW}
                      h={cellH}
                      focused={focused === c.date}
                      onFocus={() => setFocused(c.date)}
                      onBlur={() => setFocused(null)}
                      onOpen={() => open(c)}
                    />
                  ))}
                </g>
              ))}
            </svg>
          )}
        </div>
      )}

      <p className="sr-only">
        {rangeText}: {summarizeHeatmap(cells)}
      </p>

      <HeatmapLegend showNoGoal={hasNoGoal} />

      <div className="-mx-2 flex items-center justify-between">
        <Button variant="ghost" size="sm" className="min-h-touch" onClick={() => setPage(page + 1)}>
          <ChevronLeft aria-hidden="true" strokeWidth={1.75} />
          Previous 4 weeks
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="min-h-touch"
          onClick={() => setPage(page - 1)}
          disabled={page === 0}
        >
          Next
          <ChevronRight aria-hidden="true" strokeWidth={1.75} />
        </Button>
      </div>
    </Card>
  );
}

interface HeatmapCellProps {
  cell: HeatCell;
  x: number;
  y: number;
  w: number;
  h: number;
  focused: boolean;
  onFocus: () => void;
  onBlur: () => void;
  onOpen: () => void;
}

function HeatmapCell({ cell: c, x, y, w, h, focused, onFocus, onBlur, onOpen }: HeatmapCellProps) {
  const dayNum = parseLocalDate(c.date).getDate();
  const r = 6;
  const text = (fill: string) => (
    <text
      x={x + 5}
      y={y + 15}
      className="text-caption tabular-nums"
      style={{ fill, fontWeight: 500 }}
      aria-hidden="true"
    >
      {dayNum}
    </text>
  );

  if (c.state === 'future') {
    // Upcoming: faint, no outline, not interactive.
    return (
      <g role="gridcell" aria-label={c.label} data-state="future" data-date={c.date}>
        <rect x={x} y={y} width={w} height={h} rx={r} style={{ fill: INK.track, opacity: 0.45 }} />
        {text(INK.subtle)}
      </g>
    );
  }

  let fill = 'none';
  let ink: string = INK.muted;
  if (c.state === 'logged' && c.step) {
    fill = cssVar(`heat-${c.step}`);
    ink = onStep(c.step);
  } else if (c.state === 'no-goal') {
    fill = cssVar('heat-none');
    ink = INK.foreground;
  }

  return (
    <g
      role="gridcell"
      tabIndex={0}
      aria-label={c.label}
      data-state={c.state}
      data-step={c.step ?? undefined}
      data-date={c.date}
      className="cursor-pointer outline-none"
      onClick={onOpen}
      onFocus={onFocus}
      onBlur={onBlur}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      {c.state === 'not-logged' ? (
        <rect
          data-testid="heat-not-logged"
          x={x + 1}
          y={y + 1}
          width={w - 2}
          height={h - 2}
          rx={r}
          style={{ fill: 'none', stroke: INK.muted, strokeWidth: 1.5, strokeDasharray: '3 3' }}
        />
      ) : (
        <rect x={x} y={y} width={w} height={h} rx={r} style={{ fill }} />
      )}
      {text(ink)}
      {c.isToday && (
        // In progress: a subtle ring just inside the cell.
        <rect
          data-testid="heat-today"
          x={x + 2.5}
          y={y + 2.5}
          width={w - 5}
          height={h - 5}
          rx={r - 2}
          style={{ fill: 'none', stroke: INK.foreground, strokeWidth: 2 }}
        />
      )}
      {focused && (
        <rect
          x={x - 2}
          y={y - 2}
          width={w + 4}
          height={h + 4}
          rx={r + 2}
          style={{ fill: 'none', stroke: cssVar('ring'), strokeWidth: 2 }}
        />
      )}
    </g>
  );
}

function HeatmapLegend({ showNoGoal }: { showNoGoal: boolean }) {
  return (
    <div className="space-y-1.5">
      <p className="text-caption text-muted-foreground">% of that day’s goal</p>
      <ul className="text-caption text-muted-foreground grid grid-cols-5 gap-0.5">
        {HEAT_STEPS.map((s) => (
          <li key={s} className="min-w-0 space-y-1">
            <span
              aria-hidden="true"
              className="block h-3 rounded-[3px]"
              style={{ background: cssVar(`heat-${s}`) }}
            />
            <span className="block text-center whitespace-nowrap tabular-nums">
              {HEAT_LABELS[s].replace('%', '')}
            </span>
          </li>
        ))}
      </ul>
      <ul className="text-caption text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 pt-1">
        <li className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="border-muted-foreground block size-3.5 rounded-[3px] border-[1.5px] border-dashed"
          />
          Not logged
        </li>
        <li className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="border-foreground block size-3.5 rounded-[3px] border-2"
          />
          Today
        </li>
        {showNoGoal && (
          <li className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="block size-3.5 rounded-[3px]"
              style={{ background: cssVar('heat-none') }}
            />
            No goal set
          </li>
        )}
      </ul>
    </div>
  );
}
