import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CalorieHero } from './CalorieHero';

const totals = (kcal: number, low = kcal, high = kcal, checked = 0) => ({
  kcal,
  kcal_low: low,
  kcal_high: high,
  kcal_checked: checked,
  kcal_ai_only: kcal - checked,
});

describe('CalorieHero', () => {
  it('shows display kcal, the goal, and neutral remaining copy', () => {
    render(<CalorieHero totals={totals(1140)} goal={2000} />);
    expect(screen.getByText('1,140')).toBeInTheDocument();
    expect(screen.getByText('of 2,000 kcal')).toBeInTheDocument();
    expect(screen.getByTestId('goal-delta')).toHaveTextContent('860 kcal left');
  });

  it('over goal is neutral information: no destructive styling, bar fills the scale', () => {
    const { container } = render(<CalorieHero totals={totals(2120)} goal={2000} />);
    const delta = screen.getByTestId('goal-delta');
    expect(delta).toHaveTextContent('120 kcal over goal');
    expect(delta).toHaveClass('text-muted-foreground');
    expect(container.innerHTML).not.toMatch(/destructive/);
    // Above the goal the bar runs to the end of the scale, past the goal tick.
    const ai = screen.getByTestId('bar-ai');
    const goal = screen.getByTestId('bar-goal');
    const end = Number(ai.getAttribute('data-x1'));
    expect(end).toBeGreaterThan(Number(goal.getAttribute('x1')));
    expect(end).toBe(Number(container.querySelector('svg')!.getAttribute('width')) - 2);
  });

  it('splits checked (solid) and AI-only (striped) kcal proportionally', () => {
    render(<CalorieHero totals={totals(1000, 1000, 1000, 600)} goal={1000} />);
    const checked = screen.getByTestId('bar-checked');
    const ai = screen.getByTestId('bar-ai');
    const w = (el: HTMLElement) => Number(el.dataset.x1) - Number(el.dataset.x0);
    // 298 px of scale: 600 → 178.8 px, 400 → 119.2 px minus the 2 px gap.
    expect(w(checked)).toBeCloseTo(178.8, 1);
    expect(w(ai)).toBeCloseTo(117.2, 1);
    expect(screen.getByText('Checked')).toBeInTheDocument();
    expect(screen.getByText('AI estimate')).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: /600 kcal checked by you; 400 kcal AI estimate/ }),
    ).toBeInTheDocument();
  });

  it('shows the estimate range as text and as a whisker', () => {
    render(<CalorieHero totals={totals(1140, 1020.4, 1260.2)} goal={2000} />);
    expect(screen.getByText(/est\. 1,020–1,260 kcal/)).toBeInTheDocument();
    expect(screen.getByTestId('bar-range')).toBeInTheDocument();
    expect(screen.getByText('Range')).toBeInTheDocument();
  });
});
