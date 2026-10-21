import type { QueryClient } from '@tanstack/react-query';
import type { Meal, MealListParams } from '@/api/types';

/**
 * All TanStack Query keys live here so invalidation stays consistent across
 * features. Keys are hierarchical: invalidating `queryKeys.meals.all`
 * invalidates every list and detail under it.
 */
export const queryKeys = {
  meals: {
    all: ['meals'] as const,
    lists: () => ['meals', 'list'] as const,
    list: (params: MealListParams) => ['meals', 'list', params] as const,
    detail: (id: string) => ['meals', 'detail', id] as const,
  },
  analytics: {
    all: ['analytics'] as const,
    daily: (date: string | undefined) => ['analytics', 'daily', date ?? 'today'] as const,
    weekly: (start: string | undefined) => ['analytics', 'weekly', start ?? 'current'] as const,
    history: (from: string, to: string) => ['analytics', 'history', from, to] as const,
  },
  recommendations: {
    all: ['recommendations'] as const,
  },
  goals: {
    all: ['goals'] as const,
  },
  me: ['me'] as const,
  config: {
    models: ['config', 'models'] as const,
  },
};

/**
 * Call after any mutation that changes a meal (analyze, clarify, edit,
 * confirm, delete). Puts the returned meal in the cache (mutations return the
 * full updated meal) and invalidates meal lists, analytics, and suggestions.
 */
export function invalidateAfterMealChange(qc: QueryClient, meal?: Meal) {
  if (meal) qc.setQueryData(queryKeys.meals.detail(meal.id), meal);
  void qc.invalidateQueries({ queryKey: queryKeys.meals.lists() });
  void qc.invalidateQueries({ queryKey: queryKeys.analytics.all });
  void qc.invalidateQueries({ queryKey: queryKeys.recommendations.all });
}

/** Call after a meal is deleted. */
export function invalidateAfterMealDelete(qc: QueryClient, id: string) {
  qc.removeQueries({ queryKey: queryKeys.meals.detail(id) });
  invalidateAfterMealChange(qc);
}

/** Goals feed analytics (goal lines) and suggestions (patterns vs. goal). */
export function invalidateAfterGoalChange(qc: QueryClient) {
  void qc.invalidateQueries({ queryKey: queryKeys.goals.all });
  void qc.invalidateQueries({ queryKey: queryKeys.analytics.all });
  void qc.invalidateQueries({ queryKey: queryKeys.recommendations.all });
}
