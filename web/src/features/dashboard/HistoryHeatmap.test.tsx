import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { toLocalDateString } from '@/lib/format';
import { renderRoute } from '@/test/utils';

const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toLocalDateString(d);
};
const cellFor = (container: HTMLElement, date: string) =>
  container.querySelector(`[data-date="${date}"]`) as HTMLElement;

describe('HistoryHeatmap (MSW)', () => {
  it('renders 4 weeks of Mon–Sun cells colored by % of goal', async () => {
    const { container } = renderRoute('/history');
    const grid = await screen.findByRole('grid');
    expect(within(grid).getAllByRole('row')).toHaveLength(4);
    expect(within(grid).getAllByRole('gridcell')).toHaveLength(28);
    await waitFor(() =>
      expect(cellFor(container, daysAgo(1))).toHaveAttribute('data-state', 'logged'),
    );
    const y = cellFor(container, daysAgo(1));
    expect(y).toHaveAttribute('data-step');
    expect(y.getAttribute('aria-label')).toMatch(/: [\d,]+ kcal, \d+% of goal$/);
    expect(screen.getByText('% of that day’s goal')).toBeInTheDocument();
  });

  it('shows an unlogged day as a dashed "not logged" cell, not a color', async () => {
    const { container } = renderRoute('/history');
    await screen.findByRole('grid');
    await waitFor(() =>
      expect(cellFor(container, daysAgo(3))).toHaveAttribute('data-state', 'not-logged'),
    );
    const cell = cellFor(container, daysAgo(3));
    expect(cell).not.toHaveAttribute('data-step');
    expect(cell.getAttribute('aria-label')).toMatch(/not logged$/);
    const rect = within(cell).getByTestId('heat-not-logged');
    expect(rect.getAttribute('style')).toMatch(/fill: none/);
    expect(rect.getAttribute('style')).toMatch(/stroke-dasharray/);
    expect(cell.innerHTML).not.toMatch(/--heat-/);
  });

  it('marks today with a ring; future days are not tappable', async () => {
    const { container, router } = renderRoute('/history');
    await screen.findByRole('grid');
    expect(within(cellFor(container, daysAgo(0))).getByTestId('heat-today')).toBeInTheDocument();
    const future = container.querySelectorAll('[data-state="future"]');
    future.forEach((c) => {
      expect(c).not.toHaveAttribute('tabindex');
      fireEvent.click(c);
    });
    expect(router.state.location.pathname).toBe('/history');
  });

  it('tapping a day opens it in Today', async () => {
    const { container, router } = renderRoute('/history');
    await screen.findByRole('grid');
    fireEvent.click(cellFor(container, daysAgo(2)));
    expect(router.state.location.pathname).toBe('/');
    expect(router.state.location.search).toBe(`?date=${daysAgo(2)}`);
  });

  it('pages back by 4 weeks and never into the future', async () => {
    const { container } = renderRoute('/history');
    await screen.findByRole('grid');
    const next = screen.getByRole('button', { name: /next/i });
    expect(next).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /previous 4 weeks/i }));
    await waitFor(() => expect(cellFor(container, daysAgo(35))).not.toBeNull());
    expect(next).toBeEnabled();
    expect(container.querySelectorAll('[data-state="future"]')).toHaveLength(0);
    fireEvent.click(next);
    await waitFor(() => expect(cellFor(container, daysAgo(0))).not.toBeNull());
    expect(next).toBeDisabled();
  });
});
