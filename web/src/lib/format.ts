import type { KcalRange, Nutrition, NutritionTotals } from '@/api/types';

/**
 * Display helpers (UI guidelines §6.1). The API sends unrounded floats
 * (api-conventions §1); round only here. Never format a missing value as 0 —
 * callers pass null and get the em-dash placeholder (ADR-0005).
 *
 * | Value       | Format                             | Example       |
 * | ----------- | ---------------------------------- | ------------- |
 * | Calories    | Integer with thousands separator   | 1,240 kcal    |
 * | Macros      | Integer grams                      | 82 g          |
 * | Range       | En dash, unit once                 | 520–680 kcal  |
 * | Unknown     | Em dash, never 0                   | —             |
 * | Percentages | Only goal progress, never confidence | 62% of goal |
 */

const EN_DASH = '–';
export const UNKNOWN = '—';

function isMissing(n: number | null | undefined): n is null | undefined {
  return n === null || n === undefined || Number.isNaN(n);
}

function roundInt(n: number): number {
  const r = Math.round(n);
  return Object.is(r, -0) ? 0 : r;
}

/** 523.6 → "524" */
export function roundKcal(n: number): number {
  return roundInt(n);
}

/** 31.6 → 32 */
export function roundGrams(n: number): number {
  return roundInt(n);
}

const nf = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

/** 1240.4 → "1,240" (no unit; for hero numbers where the unit is styled separately). */
export function formatNumber(n: number | null | undefined, placeholder = UNKNOWN): string {
  if (isMissing(n)) return placeholder;
  return nf.format(roundInt(n));
}

/** 1523.4 → "1,523 kcal" */
export function formatKcal(n: number | null | undefined, placeholder = UNKNOWN): string {
  if (isMissing(n)) return placeholder;
  return `${nf.format(roundKcal(n))} kcal`;
}

/** 31.6 → "32 g" */
export function formatGrams(n: number | null | undefined, placeholder = UNKNOWN): string {
  if (isMissing(n)) return placeholder;
  return `${nf.format(roundGrams(n))} g`;
}

/** (520.2, 679.9) → "520–680 kcal". Collapses to a single value when equal after rounding. */
export function formatKcalRange(low: number, high: number): string {
  const lo = roundKcal(Math.min(low, high));
  const hi = roundKcal(Math.max(low, high));
  if (lo === hi) return formatKcal(lo);
  return `${nf.format(lo)}${EN_DASH}${nf.format(hi)} kcal`;
}

/** Item kcal with its estimate range when one exists. */
export function formatItemKcal(nutrition: Nutrition, range: KcalRange | null): string {
  return range ? formatKcalRange(range.low, range.high) : formatKcal(nutrition.kcal);
}

/** Meal/day totals: range when low/high differ meaningfully after rounding. */
export function formatTotalsKcal(
  t: NutritionTotals | null | undefined,
  placeholder = UNKNOWN,
): string {
  if (!t) return placeholder;
  return hasKcalRange(t) ? formatKcalRange(t.kcal_low, t.kcal_high) : formatKcal(t.kcal);
}

/** True when the totals' low/high differ after rounding. */
export function hasKcalRange(t: Pick<NutritionTotals, 'kcal_low' | 'kcal_high'>): boolean {
  return roundKcal(t.kcal_low) !== roundKcal(t.kcal_high);
}

/** Totals kcal without the unit: "1,240" or "1,020–1,260" (unit styled separately). */
export function formatTotalsKcalValue(
  t: NutritionTotals | null | undefined,
  placeholder = UNKNOWN,
): string {
  if (!t) return placeholder;
  if (!hasKcalRange(t)) return formatNumber(t.kcal);
  const lo = Math.min(t.kcal_low, t.kcal_high);
  const hi = Math.max(t.kcal_low, t.kcal_high);
  return `${formatNumber(lo)}${EN_DASH}${formatNumber(hi)}`;
}

/**
 * Neutral remaining/over copy vs. a goal (§6.3): "860 kcal left",
 * "120 kcal over goal", "At your goal". Never judgmental, never an error.
 */
export function formatGoalDelta(intake: number, goal: number, unit: 'kcal' | 'g' = 'kcal'): string {
  const diff = roundInt(goal) - roundInt(intake);
  const fmt = (n: number) => (unit === 'kcal' ? formatKcal(n) : formatGrams(n));
  if (diff > 0) return `${fmt(diff)} left`;
  if (diff < 0) return `${fmt(-diff)} over goal`;
  return 'At your goal';
}

/** Goal progress only (never confidence): 0.62 of goal → "62% of goal". */
export function formatPercentOfGoal(intake: number, goal: number): string {
  if (!(goal > 0)) return UNKNOWN;
  return `${nf.format(roundInt((intake / goal) * 100))}% of goal`;
}

/** Progress value for a bar, clamped to 0–100 (above 100 % the bar stays full, §5.2). */
export function goalProgress(intake: number | null | undefined, goal: number | null | undefined) {
  if (isMissing(intake) || isMissing(goal) || goal <= 0) return 0;
  return Math.max(0, Math.min(100, (intake / goal) * 100));
}

/** "P 32 g · C 60 g · F 18 g" */
export function formatMacros(n: Nutrition): string {
  return `P ${formatGrams(n.protein_g)} · C ${formatGrams(n.carbs_g)} · F ${formatGrams(n.fat_g)}`;
}

/** Portion like "1.5 cup (240 g)". */
export function formatPortion(p: { qty: number; unit: string; grams: number }): string {
  const qty = Math.round(p.qty * 100) / 100;
  return `${qty} ${p.unit} (${formatGrams(p.grams)})`;
}

// ---------- Dates ----------

/** Parse "YYYY-MM-DD" as a local calendar date (not UTC midnight). */
export function parseLocalDate(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/** Date → "YYYY-MM-DD" in local time. */
export function toLocalDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** "2026-10-21" → "Wed, Oct 21" */
export function formatDayLabel(date: string): string {
  return parseLocalDate(date).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/** ISO timestamp → "12:30 PM" */
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

/** Date → ISO 8601 with the local offset, e.g. 2026-10-21T12:30:00-05:00 (api-conventions §1). */
export function toIsoWithOffset(d: Date): string {
  const pad = (n: number) => String(Math.trunc(Math.abs(n))).padStart(2, '0');
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  return (
    `${toLocalDateString(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` +
    `${sign}${pad(off / 60)}:${pad(off % 60)}`
  );
}

export const MEAL_TYPE_LABEL = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
} as const;
