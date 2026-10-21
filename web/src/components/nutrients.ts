/**
 * One color per nutrient everywhere (UI guidelines §2.3). Class names are
 * spelled out in full so Tailwind can detect them.
 */
export type Nutrient = 'kcal' | 'protein' | 'carbs' | 'fat';

export const NUTRIENT: Record<
  Nutrient,
  { label: string; initial: string; fill: string; text: string }
> = {
  kcal: { label: 'Calories', initial: 'kcal', fill: 'bg-kcal', text: 'text-kcal-text' },
  protein: { label: 'Protein', initial: 'P', fill: 'bg-protein', text: 'text-protein-text' },
  carbs: { label: 'Carbs', initial: 'C', fill: 'bg-carbs', text: 'text-carbs-text' },
  fat: { label: 'Fat', initial: 'F', fill: 'bg-fat', text: 'text-fat-text' },
};
