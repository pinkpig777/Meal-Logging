import type { AttributeKind, UncertainAttribute } from '@/api/types';

export type CueStatus = 'needs_review' | 'estimated' | 'likely_match';

export const ATTRIBUTE_LABEL: Record<AttributeKind, string> = {
  identity: 'Food',
  portion: 'Portion',
  preparation: 'Preparation',
  ingredient: 'Ingredient',
};

export const CUE_STATUS_LABEL: Record<CueStatus, string> = {
  needs_review: 'needs review',
  estimated: 'estimated',
  likely_match: 'likely match',
};

/**
 * Map an uncertain attribute to a review cue (ADR-0004). Returns null when the
 * user has answered it. "Not sure" keeps the cue (glossary: not a confirmation).
 */
export function cueForAttribute(
  a: Pick<UncertainAttribute, 'attribute' | 'asked' | 'status'>,
): CueStatus | null {
  if (a.status === 'answered') return null;
  if (a.asked || a.status === 'not_sure') return 'needs_review';
  return a.attribute === 'identity' ? 'likely_match' : 'estimated';
}
