import type { AttributeKind } from '@/api/types';
import { cn } from './cn';
import { IconEstimate, IconReview } from './icons';
import { ATTRIBUTE_LABEL, CUE_STATUS_LABEL, type CueStatus } from './reviewCueStatus';

export interface ReviewCueProps {
  attribute: AttributeKind;
  status: CueStatus;
  /** Plain-language reason from the API, e.g. "Scale is unclear from one photo". */
  reason: string;
  className?: string;
}

/**
 * Review cue: icon + status label + reason (ADR-0004). Never a percentage.
 * Meaning is carried by text and icon shape; color is only supplementary.
 * Renders e.g. "Portion · needs review — scale is unclear".
 */
export function ReviewCue({ attribute, status, reason, className }: ReviewCueProps) {
  const needsReview = status === 'needs_review';
  const Icon = needsReview ? IconReview : IconEstimate;
  return (
    <p
      className={cn(
        'flex items-start gap-1.5 text-sm',
        needsReview ? 'text-review' : 'text-muted',
        className,
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" />
      <span className="text-text">
        <span className="font-medium">
          {ATTRIBUTE_LABEL[attribute]} · {CUE_STATUS_LABEL[status]}
        </span>
        <span className="text-muted"> — {lowerFirst(reason)}</span>
      </span>
    </p>
  );
}

function lowerFirst(s: string) {
  return s ? s.charAt(0).toLowerCase() + s.slice(1) : s;
}
