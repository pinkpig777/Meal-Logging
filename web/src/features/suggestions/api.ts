import { useMutation, useQuery } from '@tanstack/react-query';
import type {
  ChatRequest,
  ChatResponse,
  RecommendationsResponse,
  SuggestionFeedbackRequest,
} from '@/api/types';
import { apiFetch } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

/** M5 endpoints (api-reference §7). */

export function useRecommendations() {
  return useQuery({
    queryKey: queryKeys.recommendations.all,
    queryFn: ({ signal }) => apiFetch<RecommendationsResponse>('/recommendations', { signal }),
  });
}

export function useSuggestionFeedback() {
  return useMutation({
    mutationFn: (body: SuggestionFeedbackRequest) =>
      apiFetch<void>('/recommendations/feedback', { method: 'POST', body }),
  });
}

export function useChat() {
  return useMutation({
    mutationFn: (body: ChatRequest) => apiFetch<ChatResponse>('/chat', { method: 'POST', body }),
  });
}
