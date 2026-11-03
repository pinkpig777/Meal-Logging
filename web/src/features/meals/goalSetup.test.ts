import { describe, expect, it } from 'vitest';
import { estimateMaintenance, GOAL_PRESETS, measurements, presetTargets } from './goalSetup';

const adult = { age: 30, sex: 'male' as const, heightCm: 180, weightKg: 80, activity: 0 };

describe('goal calculations', () => {
  it.each([
    ['male', 0, 2750],
    ['male', 1, 2950],
    ['male', 2, 3150],
    ['male', 3, 3500],
    ['female', 0, 2350],
    ['female', 1, 2500],
    ['female', 2, 2650],
    ['female', 3, 2950],
  ] as const)('uses the published %s equation at activity %i', (sex, activity, expected) => {
    expect(estimateMaintenance({ ...adult, sex, activity })).toBe(expected);
  });

  it('converts US measurements and gives equivalent calorie estimates', () => {
    const metric = measurements(72, 180, 'us');
    expect(metric.heightCm).toBeCloseTo(182.88);
    expect(metric.weightKg).toBeCloseTo(81.6466266);
    expect(estimateMaintenance({ ...adult, ...metric })).toBe(
      estimateMaintenance({ ...adult, ...measurements(182.88, 81.6466266, 'metric') }),
    );
  });

  it.each([
    { age: 18 },
    { age: 30.5 },
    { age: 101 },
    { sex: '' as const },
    { heightCm: 0 },
    { weightKg: 0 },
    { activity: 4 },
    { activity: 1.5 },
    { weightKg: Number.NaN },
    { heightCm: Number.POSITIVE_INFINITY },
  ])('rejects incomplete or unsupported calculator inputs %j', (change) => {
    expect(estimateMaintenance({ ...adult, ...change })).toBeNull();
  });

  it('converts calorie-based presets to grams using 4/4/9', () => {
    expect(presetTargets(2000, 'standard')).toEqual({
      kcal: 2000,
      protein_g: 100,
      carbs_g: 250,
      fat_g: 67,
    });
    expect(presetTargets(2000, 'high_protein')?.protein_g).toBe(150);
    expect(presetTargets(2000, 'low_carb')?.carbs_g).toBe(125);
    expect(presetTargets(2000, 'keto')?.carbs_g).toBe(25);
    for (const p of GOAL_PRESETS) {
      expect(p.protein + p.carbs + p.fat).toBeCloseTo(1);
      const n = presetTargets(2750, p.id)!;
      expect(Math.abs(n.protein_g * 4 + n.carbs_g * 4 + n.fat_g * 9 - n.kcal)).toBeLessThan(9);
    }
  });

  it.each([0, -1, 499, 10001, 2000.5, Number.NaN])('rejects invalid preset calories %s', (kcal) => {
    expect(presetTargets(kcal, 'standard')).toBeNull();
  });
});
