import { Progress } from '@/components/ui/progress';
import { formatGrams, goalProgress } from '@/lib/format';
import { cn } from '@/lib/utils';
import { NutrientDot } from './NutrientDot';
import { NUTRIENT, type Nutrient } from './nutrients';

export interface MacroTileProps {
  nutrient: Exclude<Nutrient, 'kcal'>;
  /** Grams eaten (estimate). null = unknown (shown as —, never 0). */
  value: number | null;
  /** That day's goal in grams, or null when no goal is set. */
  goal: number | null;
  className?: string;
}

/**
 * Nutrient label + value + goal + thin progress in the nutrient color (§5.2, §2.3).
 * Labeled with text, so the color never carries meaning alone.
 */
export function MacroTile({ nutrient, value, goal, className }: MacroTileProps) {
  const meta = NUTRIENT[nutrient];
  return (
    <div
      className={cn(
        'bg-card border-card-edge shadow-card rounded-card flex min-w-0 flex-col gap-1 border p-3',
        className,
      )}
    >
      <p className="text-caption text-muted-foreground flex items-center gap-1.5 font-medium">
        <NutrientDot nutrient={nutrient} />
        {meta.label}
      </p>
      <p className="text-heading tabular-nums">{formatGrams(value)}</p>
      <p className="text-caption text-muted-foreground tabular-nums">
        {goal !== null ? `of ${formatGrams(goal)}` : 'No goal set'}
      </p>
      {goal !== null && (
        <Progress
          value={goalProgress(value, goal)}
          aria-label={`${meta.label} toward goal`}
          className="mt-1 h-1.5"
          indicatorClassName={meta.fill}
        />
      )}
    </div>
  );
}
