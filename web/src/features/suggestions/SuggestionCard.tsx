import { ChevronDown } from 'lucide-react';
import { Link } from 'react-router';
import type { Suggestion, SuggestionResponse } from '@/api/types';
import { Chip } from '@/components/Chip';
import { MacroLine } from '@/components/MacroLine';
import { Card } from '@/components/ui/card';
import { formatDayLabel, formatKcal } from '@/lib/format';

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
    <Card className="gap-4">
      <div className="space-y-1">
        <h3 className="text-heading">{s.title}</h3>
        <p className="text-muted-foreground">{s.pattern.summary}</p>
      </div>

      <ul className="space-y-2">
        {s.ideas.map((idea) => (
          <li key={idea.name} className="bg-muted rounded-control space-y-1 p-3">
            <p className="font-medium">{idea.name}</p>
            <p className="text-label text-muted-foreground font-normal">{idea.description}</p>
            {idea.estimated_nutrition && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1">
                <span className="text-caption text-muted-foreground tabular-nums">
                  About {formatKcal(idea.estimated_nutrition.kcal)}
                </span>
                <MacroLine nutrition={idea.estimated_nutrition} />
              </div>
            )}
          </li>
        ))}
      </ul>

      <details className="group border-border rounded-control border">
        <summary className="min-h-touch text-label rounded-control flex cursor-pointer list-none items-center justify-between px-3 [&::-webkit-details-marker]:hidden">
          Why this suggestion
          <ChevronDown
            className="text-muted-foreground size-5 transition-transform duration-200 group-open:rotate-180"
            strokeWidth={1.75}
            aria-hidden="true"
          />
        </summary>
        <div className="text-label space-y-2 px-3 pb-3 font-normal">
          {s.evidence.observations.length > 0 && (
            <ul className="list-disc space-y-1 pl-5">
              {s.evidence.observations.map((o) => (
                <li key={o}>{o}</li>
              ))}
            </ul>
          )}
          {s.evidence.dates.length > 0 && (
            <p>
              <span className="text-muted-foreground">Days: </span>
              {s.evidence.dates.map((d, i) => (
                <span key={d}>
                  {i > 0 && ', '}
                  <Link to={`/?date=${d}`} className="text-primary underline underline-offset-2">
                    {formatDayLabel(d)}
                  </Link>
                </span>
              ))}
            </p>
          )}
          {s.evidence.meal_ids.length > 0 && (
            <p>
              <span className="text-muted-foreground">Meals: </span>
              {s.evidence.meal_ids.map((id, i) => (
                <span key={id}>
                  {i > 0 && ', '}
                  <Link to={`/meals/${id}`} className="text-primary underline underline-offset-2">
                    Meal {i + 1}
                  </Link>
                </span>
              ))}
            </p>
          )}
          {s.caveats.map((c) => (
            <p key={c} className="text-caption text-muted-foreground">
              {c}
            </p>
          ))}
        </div>
      </details>

      <div className="space-y-2">
        <p className="text-caption text-muted-foreground">Was this helpful?</p>
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label="Was this suggestion helpful?"
        >
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
          <p role="status" className="text-caption text-muted-foreground">
            Thanks, noted.
          </p>
        )}
      </div>
    </Card>
  );
}
