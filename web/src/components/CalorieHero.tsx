import type { NutritionTotals } from '@/api/types';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  formatGoalDelta,
  formatKcal,
  formatKcalRange,
  formatNumber,
  formatPercentOfGoal,
  goalProgress,
  hasKcalRange,
} from '@/lib/format';
import { cn } from '@/lib/utils';

export interface CalorieHeroProps {
  totals: Pick<NutritionTotals, 'kcal' | 'kcal_low' | 'kcal_high'>;
  /** That day's kcal goal, or null when no goal is set. */
  goal: number | null;
  label?: string;
  className?: string;
}

/**
 * Today's calories, numbers first (§1, §6.3): display-size kcal, "of 2,000 kcal",
 * progress in the kcal color, and neutral copy ("860 kcal left" /
 * "120 kcal over goal"). Over goal is information, not an error: the bar stays
 * full and the text stays `muted-foreground` (never `destructive`).
 */
export function CalorieHero({ totals, goal, label = 'Calories', className }: CalorieHeroProps) {
  const hasGoal = goal !== null && goal > 0;
  const over = hasGoal && Math.round(totals.kcal) > Math.round(goal);
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
      {hasGoal && (
        <>
          <Progress
            value={goalProgress(totals.kcal, goal)}
            aria-label="Calories toward goal"
            className="mt-4 h-2"
            indicatorClassName="bg-kcal"
          />
          <div className="text-label text-muted-foreground mt-2 flex justify-between gap-2 font-normal tabular-nums">
            <span
              data-testid="goal-delta"
              className={over ? 'text-muted-foreground' : 'text-foreground font-medium'}
            >
              {formatGoalDelta(totals.kcal, goal)}
            </span>
            <span>{formatPercentOfGoal(totals.kcal, goal)}</span>
          </div>
        </>
      )}
    </Card>
  );
}
