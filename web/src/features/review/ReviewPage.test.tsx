import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { DEMO_DRAFT_ID } from '@/mocks/data';
import { renderRoute } from '@/test/utils';

describe('ReviewPage (MSW)', () => {
  it('shows asked clarifications with review cues and answers one', async () => {
    renderRoute(`/meals/${DEMO_DRAFT_ID}/review`);
    expect(await screen.findByText('About how much rice did you eat?')).toBeInTheDocument();
    expect(screen.getByText('How was the chicken cooked?')).toBeInTheDocument();
    expect(screen.getByText('Portion · needs review')).toBeInTheDocument();
    expect(screen.getByText('Preparation · needs review')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /2 left/ })).toBeInTheDocument();

    const group = screen.getByRole('group', { name: 'About how much rice did you eat?' });
    await userEvent.click(within(group).getByRole('button', { name: /1½ cups/ }));
    expect(await screen.findByRole('heading', { name: /1 left/ })).toBeInTheDocument();
    expect(within(group).getByRole('button', { name: /1½ cups/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});
