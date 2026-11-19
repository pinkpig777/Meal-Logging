import { describe, expect, it } from 'vitest';
import type { DayPoint } from '@/api/types';
import { buildHeatmapWeeks, heatStep, percentOfGoal, summarizeHeatmap } from './heatmap';

const totals = (kcal: number) => ({
  kcal,
  protein_g: 0,
  carbs_g: 0,
  fat_g: 0,
  kcal_low: kcal,
  kcal_high: kcal,
  kcal_checked: 0,
  kcal_ai_only: kcal,
});
const goal = (kcal: number) => ({
  id: 'g',
  effective_from: '2026-01-01',
  kcal,
  protein_g: 100,
  carbs_g: 200,
  fat_g: 60,
});
const day = (date: string, kcal: number | null, g: number | null = 2000): DayPoint => ({
  date,
  logged: kcal !== null,
  meal_count: kcal === null ? 0 : 3,
  totals: kcal === null ? null : totals(kcal),
  goal: g === null ? null : goal(g),
});

describe('heatStep (5 bins, lower bound inclusive)', () => {
  it.each([
    [0, 1],
    [69, 1],
    [70, 2],
    [89, 2],
    [90, 3],
    [100, 3],
    [109, 3],
    [110, 4],
    [129, 4],
    [130, 5],
    [250, 5],
  ])('%i%% → step %i', (pct, step) => {
    expect(heatStep(pct)).toBe(step);
  });

  it('bins on the rounded percentage that the label shows', () => {
    expect(percentOfGoal(1799, 2000)).toBe(90); // 89.95 → 90
    expect(heatStep(percentOfGoal(1799, 2000)!)).toBe(3);
    expect(percentOfGoal(1500, 0)).toBeNull();
    expect(percentOfGoal(1500, null)).toBeNull();
  });
});

describe('buildHeatmapWeeks', () => {
  // Mon 2026-11-03 … Sun 2026-11-16; today = Wed 2026-11-12.
  const days = [
    day('2026-11-03', 1840),
    day('2026-11-04', null),
    day('2026-11-05', 1500, null),
    day('2026-11-12', 400),
  ];
  const weeks = buildHeatmapWeeks(days, '2026-11-03', 2, '2026-11-12');
  const cell = (date: string) => weeks.flat().find((c) => c.date === date)!;

  it('lays out Mon–Sun rows', () => {
    expect(weeks).toHaveLength(2);
    expect(weeks[0].map((c) => c.date)).toEqual([
      '2026-11-03',
      '2026-11-04',
      '2026-11-05',
      '2026-11-06',
      '2026-11-07',
      '2026-11-08',
      '2026-11-09',
    ]);
  });

  it('colors logged days by % of that day goal with an accessible label', () => {
    expect(cell('2026-11-03')).toMatchObject({ state: 'logged', pct: 92, step: 3 });
    expect(cell('2026-11-03').label).toBe('Tue, Nov 3: 1,840 kcal, 92% of goal');
  });

  it('unlogged days are "not logged" with no color step, never zero', () => {
    expect(cell('2026-11-04')).toMatchObject({ state: 'not-logged', step: null, kcal: null });
    expect(cell('2026-11-04').label).toBe('Wed, Nov 4: not logged');
    // A day missing from the response is also unknown.
    expect(cell('2026-11-06').state).toBe('not-logged');
  });

  it('days without a goal are neutral, future days are upcoming, today is in progress', () => {
    expect(cell('2026-11-05')).toMatchObject({ state: 'no-goal', step: null });
    expect(cell('2026-11-13')).toMatchObject({ state: 'future', step: null });
    expect(cell('2026-11-12')).toMatchObject({ state: 'logged', isToday: true, step: 1 });
    expect(cell('2026-11-12').label).toMatch(/today, in progress/);
  });

  it('summarizes for screen readers', () => {
    expect(summarizeHeatmap(weeks.flat())).toBe(
      '3 logged days, 7 not logged; 1 at <70% of goal; 1 at 90–109% of goal.',
    );
  });
});
