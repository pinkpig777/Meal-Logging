import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { toLocalDateString } from '@/lib/format';
import { renderRoute } from '@/test/utils';

function mondayWeeksAgo(weeks: number) {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) - weeks * 7);
  return toLocalDateString(d);
}

describe('WeekPage (MSW)', () => {
  it('renders an unlogged day as "Not logged", never 0', async () => {
    // The previous week is fully in the past; the mock seed leaves 3 days ago
    // unlogged, so pick whichever week contains that day.
    const threeAgo = new Date();
    threeAgo.setDate(threeAgo.getDate() - 3);
    const thisMonday = mondayWeeksAgo(0);
    const start = toLocalDateString(threeAgo) >= thisMonday ? thisMonday : mondayWeeksAgo(1);

    renderRoute(`/week?start=${start}`);
    expect((await screen.findAllByText('Not logged')).length).toBeGreaterThan(0);
    expect(screen.queryByText('0 kcal')).not.toBeInTheDocument();
    expect(
      screen.getByText(/logged days?; days without meals are not counted/),
    ).toBeInTheDocument();
  });
});
