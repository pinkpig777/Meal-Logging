import { useQuery } from '@tanstack/react-query';
import type { DailyAnalytics, HistoryAnalytics, WeeklyAnalytics } from '@/api/types';
import { apiFetch } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

/** M4 endpoints (api-reference §6). Read-only; invalidated by meal/goal mutations. */

export function useDailyAnalytics(date?: string) {
  return useQuery({
    queryKey: queryKeys.analytics.daily(date),
    queryFn: ({ signal }) =>
      apiFetch<DailyAnalytics>('/analytics/daily', { query: { date }, signal }),
  });
}

export function useWeeklyAnalytics(start?: string) {
  return useQuery({
    queryKey: queryKeys.analytics.weekly(start),
    queryFn: ({ signal }) =>
      apiFetch<WeeklyAnalytics>('/analytics/weekly', { query: { start }, signal }),
  });
}

export function useHistoryAnalytics(from: string, to: string) {
  return useQuery({
    queryKey: queryKeys.analytics.history(from, to),
    queryFn: ({ signal }) =>
      apiFetch<HistoryAnalytics>('/analytics/history', { query: { from, to }, signal }),
  });
}
