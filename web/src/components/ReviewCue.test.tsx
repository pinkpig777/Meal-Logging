import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ReviewCue } from './ReviewCue';
import { cueForAttribute } from './reviewCueStatus';

describe('ReviewCue', () => {
  it('renders label and reason as text (not color only), with no percentage', () => {
    const { container } = render(
      <ReviewCue attribute="portion" status="needs_review" reason="Scale is unclear" />,
    );
    expect(screen.getByText('Portion · needs review')).toBeInTheDocument();
    expect(screen.getByText(/scale is unclear/)).toBeInTheDocument();
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(container.textContent).not.toMatch(/%/);
  });

  it('maps attribute state to cue status (ADR-0004)', () => {
    expect(cueForAttribute({ attribute: 'portion', asked: true, status: 'unresolved' })).toBe(
      'needs_review',
    );
    expect(cueForAttribute({ attribute: 'portion', asked: false, status: 'unresolved' })).toBe(
      'estimated',
    );
    expect(cueForAttribute({ attribute: 'identity', asked: false, status: 'unresolved' })).toBe(
      'likely_match',
    );
    expect(cueForAttribute({ attribute: 'preparation', asked: false, status: 'not_sure' })).toBe(
      'needs_review',
    );
    expect(cueForAttribute({ attribute: 'portion', asked: true, status: 'answered' })).toBeNull();
  });
});
