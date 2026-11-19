import type { ScaleLinear } from 'd3';
import { cssVar, INK, type ChartHue } from './colors';
import { barPath, SEGMENT_GAP } from './geometry';
import { hasMeaningfulRange } from './layout';

export interface SplitBarProps {
  /** Shared x scale (kcal → px). Rows that are compared must share it. */
  x: ScaleLinear<number, number>;
  /** Top of the bar. */
  y: number;
  /** Bar thickness (thin marks: 8–12 px). */
  height: number;
  /** kcal the user checked: solid fill. */
  checked: number;
  /** kcal that are AI-only estimates: stripes in the same hue. */
  aiOnly: number;
  /** Estimate range; drawn as a whisker below the bar when it is meaningful. */
  low?: number | null;
  high?: number | null;
  /** That day's goal: dashed tick in muted ink (never a colored zone). */
  goal?: number | null;
  /** Vertical extent of the goal tick; defaults to the bar ± 4 px. */
  goalExtent?: [number, number];
  /** id of a <StripePattern> defined in the same <svg>. */
  patternId: string;
  hue?: ChartHue;
  /** Draw a muted track across the full scale (progress bars). */
  track?: boolean;
}

/**
 * One horizontal calorie bar (shared M4 encoding):
 * - checked kcal = solid hue, AI-only kcal = diagonal stripes of the same hue,
 *   separated by a 2 px surface gap; the far end is rounded;
 * - estimate range = thin whisker with end caps just below the bar;
 * - goal = dashed tick in `muted-foreground`.
 * Over goal needs no special color: the bar simply passes the tick.
 */
export function SplitBar({
  x,
  y,
  height,
  checked,
  aiOnly,
  low,
  high,
  goal,
  goalExtent,
  patternId,
  hue = 'kcal',
  track,
}: SplitBarProps) {
  const [r0, r1] = x.range();
  const x0 = x(0);
  const xChecked = x(checked);
  const xTotal = x(checked + aiOnly);
  const aiStart = checked > 0 ? Math.min(xChecked + SEGMENT_GAP, xTotal) : x0;
  const showRange = hasMeaningfulRange(low, high);
  const wy = y + height + 5;
  const [gy0, gy1] = goalExtent ?? [y - 4, y + height + 4];

  return (
    <g aria-hidden="true">
      {track && <path d={barPath(r0, r1, y, height)} style={{ fill: INK.track }} />}
      {checked > 0 && (
        <path
          data-testid="bar-checked"
          data-x0={x0}
          data-x1={xChecked}
          d={barPath(x0, xChecked, y, height, aiOnly <= 0)}
          style={{ fill: cssVar(hue) }}
        />
      )}
      {aiOnly > 0 && xTotal > aiStart && (
        <path
          data-testid="bar-ai"
          data-x0={aiStart}
          data-x1={xTotal}
          d={barPath(aiStart, xTotal, y, height)}
          style={{ fill: `url(#${patternId})`, stroke: cssVar(hue), strokeWidth: 1 }}
        />
      )}
      {showRange && (
        <g data-testid="bar-range" style={{ stroke: INK.muted, strokeWidth: 1.5 }}>
          <line x1={x(low!)} x2={x(high!)} y1={wy} y2={wy} />
          <line x1={x(low!)} x2={x(low!)} y1={wy - 3} y2={wy + 3} />
          <line x1={x(high!)} x2={x(high!)} y1={wy - 3} y2={wy + 3} />
        </g>
      )}
      {goal != null && goal > 0 && (
        <line
          data-testid="bar-goal"
          x1={x(goal)}
          x2={x(goal)}
          y1={gy0}
          y2={gy1}
          style={{ stroke: INK.muted, strokeWidth: 1.5, strokeDasharray: '3 2' }}
        />
      )}
    </g>
  );
}
