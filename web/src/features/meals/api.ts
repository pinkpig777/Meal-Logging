import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  Goal,
  GoalCreate,
  GoalsResponse,
  Meal,
  MealListParams,
  MealListResponse,
  MealPatch,
  Profile,
  ProfilePatch,
} from '@/api/types';
import { apiFetch } from '@/lib/api';
import {
  invalidateAfterGoalChange,
  invalidateAfterMealChange,
  invalidateAfterMealDelete,
  queryKeys,
} from '@/lib/queryKeys';

/** M3 endpoints (api-reference §5). */

export function useMeal(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.meals.detail(id ?? ''),
    queryFn: ({ signal }) => apiFetch<Meal>(`/meals/${id}`, { signal }),
    enabled: !!id,
  });
}

export function useMeals(params: MealListParams) {
  return useQuery({
    queryKey: queryKeys.meals.list(params),
    queryFn: ({ signal }) => apiFetch<MealListResponse>('/meals', { query: { ...params }, signal }),
  });
}

export function useConfirmMeal(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<Meal>(`/meals/${id}/confirm`, { method: 'POST' }),
    onSuccess: (meal) => invalidateAfterMealChange(qc, meal),
  });
}

/** Edit a confirmed meal (same body as the draft PATCH). */
export function useUpdateMeal(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: MealPatch) => apiFetch<Meal>(`/meals/${id}`, { method: 'PATCH', body }),
    onSuccess: (meal) => invalidateAfterMealChange(qc, meal),
  });
}

export function useDeleteMeal(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<void>(`/meals/${id}`, { method: 'DELETE' }),
    onSuccess: () => invalidateAfterMealDelete(qc, id),
  });
}

export function useDeleteMealPhoto(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<void>(`/meals/${id}/photo`, { method: 'DELETE' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.meals.detail(id) });
      invalidateAfterMealChange(qc);
    },
  });
}

export function useGoals() {
  return useQuery({
    queryKey: queryKeys.goals.all,
    queryFn: ({ signal }) => apiFetch<GoalsResponse>('/goals', { signal }),
  });
}

export function useCreateGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: GoalCreate) => apiFetch<Goal>('/goals', { method: 'POST', body }),
    onSuccess: () => invalidateAfterGoalChange(qc),
  });
}

export function useProfile() {
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: ({ signal }) => apiFetch<Profile>('/me', { signal }),
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ProfilePatch) => apiFetch<Profile>('/me', { method: 'PATCH', body }),
    onSuccess: (profile, vars) => {
      qc.setQueryData(queryKeys.me, profile);
      // A time zone change moves meals between local dates.
      if (vars.timezone !== undefined) invalidateAfterMealChange(qc);
    },
  });
}
