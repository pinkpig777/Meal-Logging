import type { Nutrition } from '@/api/types';
import { formatGrams } from '@/lib/format';
import { cn } from '@/lib/utils';
import { NutrientDot } from './NutrientDot';
import { NUTRIENT } from './nutrients';

const KEYS = [
  ['protein', 'protein_g'],
  ['carbs', 'carbs_g'],
  ['fat', 'fat_g'],
] as const;

/** "● P 32 g  ● C 60 g  ● F 18 g": macros with a colored mark and a text initial. */
export function MacroLine({
  nutrition,
  className,
}: {
  nutrition: Pick<Nutrition, 'protein_g' | 'carbs_g' | 'fat_g'>;
  className?: string;
}) {
  return (
    <p
      className={cn(
        'text-caption text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 tabular-nums',
        className,
      )}
    >
      {KEYS.map(([n, key]) => (
        <span key={n} className="inline-flex items-center gap-1.5">
          <NutrientDot nutrient={n} />
          <span>
            <span className="sr-only">{NUTRIENT[n].label} </span>
            <span aria-hidden="true">{NUTRIENT[n].initial} </span>
            {formatGrams(nutrition[key])}
          </span>
        </span>
      ))}
    </p>
  );
}
