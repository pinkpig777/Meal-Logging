import { CircleAlert, Info } from 'lucide-react';
import type { AttributeKind } from '@/api/types';
import { cn } from '@/lib/utils';
import { ATTRIBUTE_LABEL, CUE_STATUS_LABEL, type CueStatus } from './reviewCueStatus';

export interface ReviewCueProps {
  attribute: AttributeKind;
  status: CueStatus;
  /** Plain-language reason from the API, e.g. "Bowl size is hard to judge". */
  reason: string;
  className?: string;
}

/**
 * Review cue (ADR-0004, UI guidelines §6.2): `attention` icon + attribute label +
 * status + short reason, e.g. "Portion · needs review: bowl size is hard to judge".
 * Never a percentage, never color alone. Text stays in text tokens for contrast;
 * the icon carries the `attention` color. Lower-salience statuses (estimated,
 * likely match) use an info icon in `muted-foreground`.
 */
export function ReviewCue({ attribute, status, reason, className }: ReviewCueProps) {
  const needsReview = status === 'needs_review';
  const Icon = needsReview ? CircleAlert : Info;
  return (
    <p className={cn('text-label flex items-start gap-2 font-normal', className)}>
      <Icon
        aria-hidden="true"
        strokeWidth={1.75}
        className={cn(
          'mt-0.5 size-4 shrink-0',
          needsReview ? 'text-attention' : 'text-muted-foreground',
        )}
      />
      <span>
        <span className="text-foreground font-medium">
          {ATTRIBUTE_LABEL[attribute]} · {CUE_STATUS_LABEL[status]}
        </span>
        <span className="text-muted-foreground">: {lowerFirst(reason)}</span>
      </span>
    </p>
  );
}

function lowerFirst(s: string) {
  return s ? s.charAt(0).toLowerCase() + s.slice(1) : s;
}
