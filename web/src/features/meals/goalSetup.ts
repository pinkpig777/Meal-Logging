import type { GoalCreate } from '@/api/types';

/** Editable product templates, not universal dietary recommendations. */
export const GOAL_PRESETS = [
  { id: 'standard', name: 'Standard', protein: 0.2, carbs: 0.5, fat: 0.3 },
  { id: 'high_protein', name: 'High protein', protein: 0.3, carbs: 0.4, fat: 0.3 },
  { id: 'low_carb', name: 'Low carb', protein: 0.3, carbs: 0.25, fat: 0.45 },
  { id: 'keto', name: 'Keto', protein: 0.2, carbs: 0.05, fat: 0.75 },
] as const;
export type PresetId = (typeof GOAL_PRESETS)[number]['id'];
export type GoalTargets = Pick<GoalCreate, 'kcal' | 'protein_g' | 'carbs_g' | 'fat_g'>;
export type EquationSex = 'female' | 'male';
export type Units = 'metric' | 'us';

export const ACTIVITIES = [
  { name: 'Inactive', description: 'Usual daily tasks, with little additional activity.' },
  {
    name: 'Low active',
    description: 'Daily tasks plus regular walking or similar light activity.',
  },
  { name: 'Active', description: 'Substantial daily walking, cycling, sport, or active work.' },
  {
    name: 'Very active',
    description: 'A high volume of physical work, training, or sport each day.',
  },
] as const;

// Adult EER equations published by Health Canada (2023 Dietary Reference Intakes).
// Coefficients are [constant, age years, height cm, weight kg], one row per activity.
// These estimate maintenance directly; do not multiply by another activity factor.
const EER = {
  male: [
    [753.07, -10.83, 6.5, 14.1],
    [581.47, -10.83, 8.3, 14.94],
    [1004.82, -10.83, 6.52, 15.91],
    [-517.88, -10.83, 15.61, 19.11],
  ],
  female: [
    [584.9, -7.01, 5.72, 11.71],
    [575.77, -7.01, 6.6, 12.14],
    [710.25, -7.01, 6.54, 12.34],
    [511.83, -7.01, 9.07, 12.56],
  ],
} as const;

export function measurements(height: number, weight: number, units: Units) {
  return units === 'us'
    ? { heightCm: height * 2.54, weightKg: weight * 0.45359237 }
    : { heightCm: height, weightKg: weight };
}

export function estimateMaintenance(input: {
  age: number;
  sex: EquationSex | '';
  heightCm: number;
  weightKg: number;
  activity: number;
}): number | null {
  const { age, sex, heightCm, weightKg, activity } = input;
  if (
    ![age, heightCm, weightKg, activity].every(Number.isFinite) ||
    !Number.isInteger(age) ||
    age < 19 ||
    age > 100 ||
    heightCm < 120 ||
    heightCm > 230 ||
    weightKg < 35 ||
    weightKg > 300 ||
    !Number.isInteger(activity) ||
    activity < 0 ||
    activity > 3 ||
    (sex !== 'male' && sex !== 'female')
  )
    return null;
  const [constant, ageFactor, heightFactor, weightFactor] = EER[sex][activity];
  const kcal = constant + ageFactor * age + heightFactor * heightCm + weightFactor * weightKg;
  // Round to a practical starting target; individual needs differ from an equation.
  return Math.round(kcal / 50) * 50;
}

export function presetTargets(kcal: number, preset: PresetId): GoalTargets | null {
  if (!Number.isInteger(kcal) || kcal < 500 || kcal > 10000) return null;
  const split = GOAL_PRESETS.find((p) => p.id === preset);
  if (!split) return null;
  return {
    kcal,
    protein_g: Math.round((kcal * split.protein) / 4),
    carbs_g: Math.round((kcal * split.carbs) / 4),
    fat_g: Math.round((kcal * split.fat) / 9),
  };
}
