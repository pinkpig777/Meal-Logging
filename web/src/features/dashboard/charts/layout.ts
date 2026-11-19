import { cumsum, descending } from 'd3';
import type { MealContribution, MealItem } from '@/api/types';
import { roundKcal } from '@/lib/format';
import { splitOf } from './colors';
import { SEGMENT_GAP } from './geometry';

/** True when the range differs after rounding (otherwise no whisker). */
export function hasMeaningfulRange(low?: number | null, high?: number | null) {
  return low != null && high != null && roundKcal(low) !== roundKcal(high);
}

/** Items sorted by kcal, largest first (ties keep the meal's item order). */
export function sortItemsByKcal(items: MealItem[]): MealItem[] {
  return [...items].sort(
    (a, b) => descending(a.nutrition.kcal, b.nutrition.kcal) || a.position - b.position,
  );
}

export interface ContributionSegment {
  meal: MealContribution;
  x0: number;
  x1: number;
  checked: number;
  aiOnly: number;
}

/** Lay meals end to end on the kcal scale (time order), with 2 px gaps. */
export function layoutSegments(
  meals: MealContribution[],
  x: (v: number) => number,
): ContributionSegment[] {
  const ends = Array.from(cumsum(meals, (m) => m.totals.kcal));
  return meals.map((meal, i) => {
    const start = i === 0 ? 0 : ends[i - 1];
    const { checked, aiOnly } = splitOf(meal.totals);
    return {
      meal,
      x0: x(start) + (i === 0 ? 0 : SEGMENT_GAP / 2),
      x1: x(ends[i]) - (i === meals.length - 1 ? 0 : SEGMENT_GAP / 2),
      checked,
      aiOnly,
    };
  });
}
