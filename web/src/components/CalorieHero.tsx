import { scaleLinear } from 'd3';
import type { NutritionTotals } from '@/api/types';
import { Card } from '@/components/ui/card';
import { splitOf } from '@/features/dashboard/charts/colors';
import { SplitBarLegend } from '@/features/dashboard/charts/Legend';
import { StripePattern } from '@/features/dashboard/charts/patterns';
import { usePatternId } from '@/features/dashboard/charts/usePatternId';
import { hasMeaningfulRange } from '@/features/dashboard/charts/layout';
import { SplitBar } from '@/features/dashboard/charts/SplitBar';
import { useElementWidth } from '@/features/dashboard/charts/useElementWidth';
import {
  formatGoalDelta,
  formatKcal,
  formatKcalRange,
  formatNumber,
  formatPercentOfGoal,
  hasKcalRange,
} from '@/lib/format';
import { cn } from '@/lib/utils';

export interface CalorieHeroProps {
  totals: Pick<NutritionTotals, 'kcal' | 'kcal_low' | 'kcal_high'> &
    Partial<Pick<NutritionTotals, 'kcal_checked' | 'kcal_ai_only'>>;
  /** That day's kcal goal, or null when no goal is set. */
  goal: number | null;
  label?: string;
  className?: string;
}

const BAR_Y = 6;
const BAR_H = 12;
const SVG_H = 32;

/**
 * Today's calories, numbers first (§1, §6.3): display-size kcal, "of 2,000 kcal",
 * and a D3 split bar toward the goal: checked kcal solid, AI-only kcal striped,
 * estimate range as a whisker, goal as a dashed tick. Over goal is information,
 * not an error: the bar runs past the tick and the text stays
 * `muted-foreground` ("120 kcal over goal"), never `destructive`.
 */
export function CalorieHero({ totals, goal, label = 'Calories', className }: CalorieHeroProps) {
  const hasGoal = goal !== null && goal > 0;
  const over = hasGoal && Math.round(totals.kcal) > Math.round(goal);
  const split = splitOf(totals);
  const [ref, width] = useElementWidth();
  const pid = usePatternId();
  const showRange = hasMeaningfulRange(totals.kcal_low, totals.kcal_high);
  const domainMax = Math.max(1, hasGoal ? goal : 0, totals.kcal, showRange ? totals.kcal_high : 0);
  // 2 px inset on the right so a goal tick at the end is not clipped.
  const x = scaleLinear()
    .domain([0, domainMax])
    .range([0, Math.max(0, width - 2)]);

  const summary = [
    `${formatKcal(totals.kcal)}${hasGoal ? ` of ${formatKcal(goal)}` : ''}`,
    split.checked > 0 ? `${formatKcal(split.checked)} checked by you` : null,
    split.aiOnly > 0 ? `${formatKcal(split.aiOnly)} AI estimate` : null,
    showRange ? `range ${formatKcalRange(totals.kcal_low, totals.kcal_high)}` : null,
  ]
    .filter(Boolean)
    .join('; ');

  return (
    <Card size="hero" className={cn('gap-0', className)}>
      <p className="text-label text-muted-foreground">{label}</p>
      <p className="mt-1 flex items-baseline gap-1.5">
        <span className="text-display">{formatNumber(totals.kcal)}</span>
        <span className="text-heading text-muted-foreground font-normal">kcal</span>
      </p>
      <p className="text-label text-muted-foreground font-normal tabular-nums">
        {hasGoal ? `of ${formatKcal(goal)}` : 'No goal set'}
        {hasKcalRange(totals) && (
          <span> · est. {formatKcalRange(totals.kcal_low, totals.kcal_high)}</span>
        )}
      </p>
      <div ref={ref} className="mt-3">
        <svg
          role="img"
          aria-label={`Calories toward goal: ${summary}`}
          width={width}
          height={SVG_H}
          className="block overflow-visible"
        >
          <defs>
            <StripePattern id={pid} />
          </defs>
          <SplitBar
            x={x}
            y={BAR_Y}
            height={BAR_H}
            checked={split.checked}
            aiOnly={split.aiOnly}
            low={totals.kcal_low}
            high={totals.kcal_high}
            goal={hasGoal ? goal : null}
            goalExtent={[0, BAR_Y + BAR_H + 4]}
            patternId={pid}
            track
          />
        </svg>
      </div>
      {hasGoal && (
        <div className="text-label text-muted-foreground mt-1 flex justify-between gap-2 font-normal tabular-nums">
          <span
            data-testid="goal-delta"
            className={over ? 'text-muted-foreground' : 'text-foreground font-medium'}
          >
            {formatGoalDelta(totals.kcal, goal)}
          </span>
          <span>{formatPercentOfGoal(totals.kcal, goal)}</span>
        </div>
      )}
      <SplitBarLegend
        className="mt-3"
        items={[
          ...(split.checked > 0 ? (['checked'] as const) : []),
          ...(split.aiOnly > 0 ? (['ai'] as const) : []),
          ...(showRange ? (['range'] as const) : []),
          ...(hasGoal ? (['goal'] as const) : []),
        ]}
      />
    </Card>
  );
}
