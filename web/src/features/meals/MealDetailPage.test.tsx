import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DEMO_DRAFT_ID } from '@/mocks/data';
import { renderRoute } from '@/test/utils';

describe('MealDetailPage item chart (MSW)', () => {
  it('sorts item bars by kcal, largest first', async () => {
    renderRoute(`/meals/${DEMO_DRAFT_ID}`);
    const bars = await screen.findAllByTestId('item-bar');
    // Seed: rice 242, chicken 250, greens 9, ranch 129 (list order).
    expect(bars.map((b) => within(b).getAllByText(/./)[0].textContent)).toEqual([
      'Chicken thigh',
      'White rice',
      'Ranch dressing',
      'Mixed greens',
    ]);
    // All items are AI-only estimates in the draft: striped, never solid.
    expect(screen.queryAllByTestId('bar-checked')).toHaveLength(0);
    expect(screen.getAllByTestId('bar-ai')).toHaveLength(4);
  });

  it('links highlighting between bars and item cards', async () => {
    renderRoute(`/meals/${DEMO_DRAFT_ID}`);
    const bars = await screen.findAllByTestId('item-bar');
    const ranchBar = bars.find((b) => b.textContent?.includes('Ranch dressing'))!;
    const cards = screen.getAllByTestId('item-card');
    const card = (name: string) => cards.find((c) => c.textContent?.includes(name))!;

    fireEvent.click(ranchBar);
    expect(ranchBar).toHaveAttribute('aria-pressed', 'true');
    expect(card('Ranch dressing')).toHaveAttribute('data-selected', 'true');
    expect(card('White rice')).not.toHaveAttribute('data-selected');

    fireEvent.click(card('White rice'));
    const riceBar = bars.find((b) => b.textContent?.includes('White rice'))!;
    expect(riceBar).toHaveAttribute('aria-pressed', 'true');
    expect(ranchBar).toHaveAttribute('aria-pressed', 'false');
    expect(card('Ranch dressing')).not.toHaveAttribute('data-selected');
  });
});
