import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { DayPoint } from '@/api/types';
import { WeekDayRow } from './WeekDayRow';

function renderRow(day: DayPoint, opts: { isFuture?: boolean } = {}) {
  return render(
    <MemoryRouter>
      <ul>
        <WeekDayRow day={day} scaleMax={2500} isFuture={!!opts.isFuture} isToday={false} />
      </ul>
    </MemoryRouter>,
  );
}

describe('WeekDayRow', () => {
  it('renders an unlogged day as a "Not logged" slot, with no zero and no bar', () => {
    const { container } = renderRow({
      date: '2026-10-18',
      logged: false,
      meal_count: 0,
      totals: null,
      goal: null,
    });
    expect(screen.getByTestId('not-logged-slot')).toHaveTextContent('Not logged');
    expect(screen.queryByTestId('kcal-bar')).not.toBeInTheDocument();
    expect(container.textContent).not.toMatch(/\b0\b/);
  });

  it('renders a future day as "Upcoming"', () => {
    renderRow(
      { date: '2026-10-25', logged: false, meal_count: 0, totals: null, goal: null },
      { isFuture: true },
    );
    expect(screen.getByText('Upcoming')).toBeInTheDocument();
    expect(screen.queryByText('Not logged')).not.toBeInTheDocument();
  });
});
