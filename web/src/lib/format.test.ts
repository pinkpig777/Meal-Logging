import { describe, expect, it } from 'vitest';
import {
  formatGoalDelta,
  formatGrams,
  formatItemKcal,
  formatKcal,
  formatKcalRange,
  formatNumber,
  formatPercentOfGoal,
  formatTotalsKcal,
  formatTotalsKcalValue,
  goalProgress,
  roundKcal,
  toIsoWithOffset,
} from './format';

describe('format helpers', () => {
  it('rounds kcal to integers', () => {
    expect(roundKcal(523.6)).toBe(524);
    expect(roundKcal(-0.2)).toBe(0);
    expect(formatKcal(523.4)).toBe('523 kcal');
    expect(formatKcal(1523.4)).toBe('1,523 kcal');
  });

  it('rounds grams to 0 decimals', () => {
    expect(formatGrams(31.6)).toBe('32 g');
    expect(formatGrams(0.4)).toBe('0 g');
  });

  it('uses a placeholder for missing values, never 0', () => {
    expect(formatKcal(null)).toBe('—');
    expect(formatGrams(undefined)).toBe('—');
    expect(formatTotalsKcal(null)).toBe('—');
  });

  it('formats ranges with an en dash', () => {
    expect(formatKcalRange(520.2, 679.9)).toBe('520–680 kcal');
    expect(formatKcalRange(680, 520)).toBe('520–680 kcal');
    expect(formatKcalRange(500.2, 499.8)).toBe('500 kcal');
  });

  it('shows an item range only when one exists', () => {
    const n = { kcal: 600, protein_g: 1, carbs_g: 1, fat_g: 1 };
    expect(formatItemKcal(n, null)).toBe('600 kcal');
    expect(formatItemKcal(n, { low: 520, high: 680 })).toBe('520–680 kcal');
  });

  it('formats timestamps with the local offset', () => {
    expect(toIsoWithOffset(new Date(2026, 9, 21, 12, 30))).toMatch(
      /^2026-10-21T12:30:00[+-]\d{2}:\d{2}$/,
    );
  });

  it('formats bare numbers with a thousands separator', () => {
    expect(formatNumber(1240.4)).toBe('1,240');
    expect(formatNumber(null)).toBe('—');
    expect(formatTotalsKcalValue({ kcal: 1140, kcal_low: 1020, kcal_high: 1260 } as never)).toBe(
      '1,020–1,260',
    );
  });

  it('phrases goal deltas neutrally', () => {
    expect(formatGoalDelta(1140, 2000)).toBe('860 kcal left');
    expect(formatGoalDelta(2120, 2000)).toBe('120 kcal over goal');
    expect(formatGoalDelta(2000.2, 2000)).toBe('At your goal');
    expect(formatPercentOfGoal(1240, 2000)).toBe('62% of goal');
  });

  it('clamps goal progress to 0–100', () => {
    expect(goalProgress(2500, 2000)).toBe(100);
    expect(goalProgress(500, 2000)).toBe(25);
    expect(goalProgress(null, 2000)).toBe(0);
  });
});
