import type { MealSummary } from '@/api/types';

/** Group by local_date, newest date first; meals within a day newest first. */
export function groupByDate(meals: MealSummary[]): Array<[string, MealSummary[]]> {
  const map = new Map<string, MealSummary[]>();
  for (const m of meals) {
    const list = map.get(m.local_date) ?? [];
    list.push(m);
    map.set(m.local_date, list);
  }
  return [...map.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([d, list]) => [d, list.sort((a, b) => b.eaten_at.localeCompare(a.eaten_at))]);
}
