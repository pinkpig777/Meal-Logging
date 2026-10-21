import { formatGrams, formatKcal } from '@/lib/format';

export const METRICS = [
  { key: 'kcal', label: 'Calories' },
  { key: 'protein_g', label: 'Protein' },
  { key: 'carbs_g', label: 'Carbs' },
  { key: 'fat_g', label: 'Fat' },
] as const;

export type MetricKey = (typeof METRICS)[number]['key'];

export function formatMetric(key: MetricKey, v: number | null | undefined) {
  return key === 'kcal' ? formatKcal(v) : formatGrams(v);
}
