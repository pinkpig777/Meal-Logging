import type { NutritionTotals } from '@/api/types';

/**
 * Chart colors come from the design tokens in `src/index.css` (UI guidelines
 * §2.3, §7). Marks reference them as `var(--token)` in an inline `style`, so the
 * browser resolves the current value at paint time and light/dark switch
 * without re-rendering. Never hard-code a hex value in a chart.
 */
export type ChartHue = 'kcal' | 'protein' | 'carbs' | 'fat';

export const cssVar = (token: string) => `var(--${token})`;

/** Text and reference ink (text tokens, never series colors). */
export const INK = {
  foreground: cssVar('foreground'),
  muted: cssVar('muted-foreground'),
  subtle: cssVar('subtle-foreground'),
  border: cssVar('border'),
  track: cssVar('muted'),
  surface: cssVar('card'),
} as const;

/** Split of a calorie total into user-checked kcal and AI-only estimate kcal. */
export interface KcalSplit {
  checked: number;
  aiOnly: number;
}

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

/**
 * `kcal_checked` + `kcal_ai_only` = `kcal`. If an older API omits the split,
 * treat the whole total as an AI estimate (the conservative reading).
 */
export function splitOf(
  t: Pick<NutritionTotals, 'kcal'> &
    Partial<Pick<NutritionTotals, 'kcal_checked' | 'kcal_ai_only'>>,
): KcalSplit {
  const checked = finite(t.kcal_checked) ? Math.max(0, t.kcal_checked) : 0;
  const aiOnly = finite(t.kcal_ai_only)
    ? Math.max(0, t.kcal_ai_only)
    : Math.max(0, t.kcal - checked);
  return { checked, aiOnly };
}

/** Item source → checked (the user answered, edited, or added it) vs AI-only. */
export function isCheckedSource(source: string): boolean {
  return source !== 'ai';
}
