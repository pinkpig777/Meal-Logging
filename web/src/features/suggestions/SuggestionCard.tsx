import { Link } from 'react-router';
import type { Suggestion, SuggestionResponse } from '@/api/types';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { IconChevronDown } from '@/components/icons';
import { formatDayLabel, formatKcal, formatMacros } from '@/lib/format';

const FEEDBACK: Array<{ value: SuggestionResponse; label: string }> = [
  { value: 'useful', label: 'Useful' },
  { value: 'not_for_me', label: 'Not for me' },
  { value: 'already_do', label: 'I already do this' },
];

export interface SuggestionCardProps {
  suggestion: Suggestion;
  feedback: SuggestionResponse | null;
  pending?: boolean;
  onFeedback: (response: SuggestionResponse) => void;
}

/** M5 · Zach — one suggestion: pattern, ideas, "Why this suggestion", feedback. */
export function SuggestionCard({
  suggestion: s,
  feedback,
  pending,
  onFeedback,
}: SuggestionCardProps) {
  return (
    <Card className="space-y-3">
      <div>
        <h3 className="text-base font-semibold">{s.title}</h3>
        <p className="text-muted text-sm">{s.pattern.summary}</p>
      </div>

      <ul className="space-y-2">
        {s.ideas.map((idea) => (
          <li key={idea.name} className="bg-surface-2 rounded-xl p-3">
            <p className="font-medium">{idea.name}</p>
            <p className="text-muted text-sm">{idea.description}</p>
            {idea.estimated_nutrition && (
              <p className="text-muted mt-1 text-xs tabular-nums">
                About {formatKcal(idea.estimated_nutrition.kcal)} ·{' '}
                {formatMacros(idea.estimated_nutrition)}
              </p>
            )}
          </li>
        ))}
      </ul>

      <details className="group border-line rounded-xl border">
        <summary className="min-h-touch flex cursor-pointer list-none items-center justify-between px-3 font-medium">
          Why this suggestion
          <IconChevronDown className="size-4 transition group-open:rotate-180" />
        </summary>
        <div className="space-y-2 px-3 pb-3 text-sm">
          {s.evidence.observations.length > 0 && (
            <ul className="list-disc space-y-1 pl-5">
              {s.evidence.observations.map((o) => (
                <li key={o}>{o}</li>
              ))}
            </ul>
          )}
          {s.evidence.dates.length > 0 && (
            <p>
              <span className="text-muted">Days: </span>
              {s.evidence.dates.map((d, i) => (
                <span key={d}>
                  {i > 0 && ', '}
                  <Link to={`/?date=${d}`} className="underline">
                    {formatDayLabel(d)}
                  </Link>
                </span>
              ))}
            </p>
          )}
          {s.evidence.meal_ids.length > 0 && (
            <p>
              <span className="text-muted">Meals: </span>
              {s.evidence.meal_ids.map((id, i) => (
                <span key={id}>
                  {i > 0 && ', '}
                  <Link to={`/meals/${id}`} className="underline">
                    Meal {i + 1}
                  </Link>
                </span>
              ))}
            </p>
          )}
          {s.caveats.map((c) => (
            <p key={c} className="text-muted text-xs">
              {c}
            </p>
          ))}
        </div>
      </details>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Was this suggestion helpful?">
        {FEEDBACK.map((f) => (
          <Chip
            key={f.value}
            selected={feedback === f.value}
            disabled={pending || feedback !== null}
            onClick={() => onFeedback(f.value)}
          >
            {f.label}
          </Chip>
        ))}
      </div>
      {feedback && (
        <p role="status" className="text-muted text-sm">
          Thanks — noted.
        </p>
      )}
    </Card>
  );
}
