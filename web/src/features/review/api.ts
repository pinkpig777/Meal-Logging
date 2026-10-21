import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { AddItemRequest, ClarifyRequest, Meal, MealPatch } from '@/api/types';
import { apiFetch } from '@/lib/api';
import { invalidateAfterMealChange } from '@/lib/queryKeys';

/** M2 endpoints (api-reference §4). Each returns the full updated meal. */

export function useClarify(mealId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ClarifyRequest) =>
      apiFetch<Meal>(`/meals/${mealId}/clarify`, { method: 'POST', body }),
    onSuccess: (meal) => invalidateAfterMealChange(qc, meal),
  });
}

export function useUpdateDraft(mealId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: MealPatch) =>
      apiFetch<Meal>(`/meals/${mealId}/draft`, { method: 'PATCH', body }),
    onSuccess: (meal) => invalidateAfterMealChange(qc, meal),
  });
}

export function useAddItem(mealId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AddItemRequest) =>
      apiFetch<Meal>(`/meals/${mealId}/items`, { method: 'POST', body }),
    onSuccess: (meal) => invalidateAfterMealChange(qc, meal),
  });
}
