import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AnalyzeRequest, Meal, ModelsConfig, ReestimateRequest } from '@/api/types';
import { apiFetch } from '@/lib/api';
import { invalidateAfterMealChange, queryKeys } from '@/lib/queryKeys';

/** M1 endpoints (api-reference §3). */

export function useModelsConfig() {
  return useQuery({
    queryKey: queryKeys.config.models,
    queryFn: ({ signal }) => apiFetch<ModelsConfig>('/config/models', { signal }),
    staleTime: Infinity,
  });
}

export interface AnalyzeVariables extends AnalyzeRequest {
  signal?: AbortSignal;
}

export function useAnalyzeMeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ signal, ...body }: AnalyzeVariables) =>
      apiFetch<Meal>('/meals/analyze', { method: 'POST', body, signal }),
    onSuccess: (meal) => invalidateAfterMealChange(qc, meal),
  });
}

export function useReestimateItem(mealId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, ...body }: ReestimateRequest & { itemId: string }) =>
      apiFetch<Meal>(`/meals/${mealId}/items/${itemId}/reestimate`, { method: 'POST', body }),
    onSuccess: (meal) => invalidateAfterMealChange(qc, meal),
  });
}
