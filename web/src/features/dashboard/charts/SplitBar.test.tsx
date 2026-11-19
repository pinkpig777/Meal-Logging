import { render, screen } from '@testing-library/react';
import { scaleLinear } from 'd3';
import { describe, expect, it } from 'vitest';
import { SplitBar } from './SplitBar';

function renderBar(props: Partial<Parameters<typeof SplitBar>[0]> = {}) {
  const x = scaleLinear().domain([0, 1000]).range([0, 200]);
  return render(
    <svg>
      <SplitBar x={x} y={0} height={10} checked={600} aiOnly={400} patternId="p" {...props} />
    </svg>,
  );
}

const span = (el: HTMLElement) => [Number(el.dataset.x0), Number(el.dataset.x1)];

describe('SplitBar', () => {
  it('draws checked kcal solid and AI-only kcal striped, proportional on one scale', () => {
    renderBar();
    expect(span(screen.getByTestId('bar-checked'))).toEqual([0, 120]);
    // 2 px surface gap, then stripes to the total.
    expect(span(screen.getByTestId('bar-ai'))).toEqual([122, 200]);
    expect(screen.getByTestId('bar-ai').getAttribute('style')).toMatch(/url\("?#p"?\)/);
    expect(screen.getByTestId('bar-checked').getAttribute('style')).toMatch(/var\(--kcal\)/);
  });

  it('all-checked and all-AI bars have a single segment', () => {
    const { unmount } = renderBar({ checked: 500, aiOnly: 0 });
    expect(screen.queryByTestId('bar-ai')).not.toBeInTheDocument();
    expect(span(screen.getByTestId('bar-checked'))).toEqual([0, 100]);
    unmount();
    renderBar({ checked: 0, aiOnly: 500 });
    expect(screen.queryByTestId('bar-checked')).not.toBeInTheDocument();
    expect(span(screen.getByTestId('bar-ai'))).toEqual([0, 100]);
  });

  it('draws a range whisker only when the range is meaningful, and a dashed goal tick', () => {
    const { unmount } = renderBar({ low: 900, high: 1000, goal: 800 });
    expect(screen.getByTestId('bar-range')).toBeInTheDocument();
    const goal = screen.getByTestId('bar-goal');
    expect(goal.getAttribute('x1')).toBe('160');
    expect(goal.getAttribute('style')).toMatch(/stroke-dasharray/);
    expect(goal.getAttribute('style')).toMatch(/muted-foreground/);
    unmount();
    renderBar({ low: 1000.2, high: 999.8 });
    expect(screen.queryByTestId('bar-range')).not.toBeInTheDocument();
  });
});
