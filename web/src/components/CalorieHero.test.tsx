import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CalorieHero } from './CalorieHero';

const totals = (kcal: number, low = kcal, high = kcal) => ({
  kcal,
  kcal_low: low,
  kcal_high: high,
});

describe('CalorieHero', () => {
  it('shows display kcal, the goal, and neutral remaining copy', () => {
    render(<CalorieHero totals={totals(1140)} goal={2000} />);
    expect(screen.getByText('1,140')).toBeInTheDocument();
    expect(screen.getByText('of 2,000 kcal')).toBeInTheDocument();
    expect(screen.getByTestId('goal-delta')).toHaveTextContent('860 kcal left');
  });

  it('over goal is neutral information: no destructive styling', () => {
    const { container } = render(<CalorieHero totals={totals(2120)} goal={2000} />);
    const delta = screen.getByTestId('goal-delta');
    expect(delta).toHaveTextContent('120 kcal over goal');
    expect(delta).toHaveClass('text-muted-foreground');
    expect(container.innerHTML).not.toMatch(/destructive/);
    // Above 100 % the bar stays full.
    const fill = container.querySelector('[data-slot="progress-indicator"]') as HTMLElement;
    expect(fill.style.transform).toBe('translateX(-0%)');
  });

  it('shows the estimate range when present', () => {
    render(<CalorieHero totals={totals(1140, 1020.4, 1260.2)} goal={2000} />);
    expect(screen.getByText(/est\. 1,020–1,260 kcal/)).toBeInTheDocument();
  });
});
