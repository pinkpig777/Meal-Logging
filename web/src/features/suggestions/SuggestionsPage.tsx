import { Lightbulb, MessageCircle } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import type { SuggestionResponse } from '@/api/types';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { LoadingState } from '@/components/LoadingState';
import { Button } from '@/components/ui/button';
import { useRecommendations, useSuggestionFeedback } from './api';
import { SuggestionCard } from './SuggestionCard';

/**
 * M5 · Zach — suggestions tied to observed patterns, with evidence.
 * TODO(Zach): persist feedback state across reloads, dismiss/hide, refresh
 * cadence, copy review with the M5 design doc.
 */
export function SuggestionsPage() {
  const q = useRecommendations();
  const feedback = useSuggestionFeedback();
  const [given, setGiven] = useState<Record<string, SuggestionResponse>>({});

  if (q.isPending) return <LoadingState label="Looking at your logged days…" layout="cards" />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const data = q.data;

  if (data.status === 'insufficient_history') {
    const remaining = Math.max(0, data.required_day_count - data.logged_day_count);
    return (
      <EmptyState
        icon={<Lightbulb strokeWidth={1.75} />}
        title="Suggestions need a few more days"
        description={`Suggestions start after ${data.required_day_count} logged days. You have ${data.logged_day_count} so far, ${remaining} to go.`}
        action={
          <Button asChild className="w-full">
            <Link to="/log">Log a meal</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-label text-muted-foreground font-normal">
        Based on {data.logged_day_count} logged days. Ideas only; adjust them to what works for you.
      </p>
      {data.suggestions.length === 0 && (
        <EmptyState
          title="No suggestions right now"
          description="Check back after logging more meals."
        />
      )}
      {data.suggestions.map((s) => (
        <SuggestionCard
          key={s.id}
          suggestion={s}
          feedback={given[s.id] ?? null}
          pending={feedback.isPending && feedback.variables?.suggestion.id === s.id}
          onFeedback={(response) =>
            feedback.mutate(
              { suggestion: s, response },
              { onSuccess: () => setGiven((g) => ({ ...g, [s.id]: response })) },
            )
          }
        />
      ))}
      {feedback.isError && <ErrorState error={feedback.error} title="Feedback not sent" />}
      <Button asChild variant="ghost" className="w-full">
        <Link to="/chat">
          <MessageCircle aria-hidden="true" strokeWidth={1.75} />
          Ask about your meals (preview)
        </Link>
      </Button>
    </div>
  );
}
