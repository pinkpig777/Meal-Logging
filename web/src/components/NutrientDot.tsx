import { cn } from '@/lib/utils';
import { NUTRIENT, type Nutrient } from './nutrients';

/** Small colored mark beside a nutrient label. Decorative: the label carries meaning. */
export function NutrientDot({ nutrient, className }: { nutrient: Nutrient; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-block size-2 shrink-0 rounded-full',
        NUTRIENT[nutrient].fill,
        className,
      )}
    />
  );
}
