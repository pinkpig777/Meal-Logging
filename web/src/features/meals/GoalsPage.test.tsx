import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import type { GoalCreate } from '@/api/types';
import { server } from '@/mocks/server';
import { renderRoute } from '@/test/utils';

const goal = { id: '00000000-0000-0000-0000-000000000123', effective_from: '2026-11-02' };
beforeEach(() => {
  server.use(http.get('*/api/v1/goals', () => HttpResponse.json({ current: null, history: [] })));
});

async function start() {
  const user = userEvent.setup();
  renderRoute('/settings');
  await user.click(await screen.findByRole('button', { name: 'Set goals' }));
  return user;
}

describe('guided goal setup', () => {
  it('reviews a preset without writing and saves only the editable final targets', async () => {
    const requests: GoalCreate[] = [];
    server.use(
      http.post('*/api/v1/goals', async ({ request }) => {
        const body = (await request.json()) as GoalCreate;
        requests.push(body);
        return HttpResponse.json({ ...goal, ...body }, { status: 201 });
      }),
    );
    const user = await start();
    await user.click(screen.getByRole('button', { name: 'High protein' }));
    expect(screen.getByText('150 g')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Review targets' }));
    expect(requests).toHaveLength(0);
    await user.clear(screen.getByLabelText('Protein (g)'));
    await user.type(screen.getByLabelText('Protein (g)'), '160');
    await user.click(screen.getByRole('button', { name: 'Save goal' }));
    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0]).toEqual({ kcal: 2000, protein_g: 160, carbs_g: 200, fat_g: 67 });
  });

  it('offers manual entry and never treats blank macros as zero', async () => {
    const user = await start();
    await user.click(screen.getByRole('button', { name: 'Enter manually' }));
    await user.type(screen.getByLabelText('Calories (kcal)'), '2100');
    await user.type(screen.getByLabelText('Protein (g)'), '120.5');
    await user.type(screen.getByLabelText('Carbs (g)'), '250');
    expect(screen.getByRole('button', { name: 'Save goal' })).toBeDisabled();
    await user.type(screen.getByLabelText('Fat (g)'), '70');
    expect(screen.getByRole('button', { name: 'Save goal' })).toBeEnabled();
    await user.clear(screen.getByLabelText('Protein (g)'));
    expect(screen.getByRole('button', { name: 'Save goal' })).toBeDisabled();
  });

  it('calculates calories from measurements and activity without saving measurements', async () => {
    const requests: GoalCreate[] = [];
    server.use(
      http.post('*/api/v1/goals', async ({ request }) => {
        const body = (await request.json()) as GoalCreate;
        requests.push(body);
        return HttpResponse.json({ ...goal, ...body }, { status: 201 });
      }),
    );
    const user = await start();
    await user.click(screen.getByRole('button', { name: 'Standard' }));
    await user.click(screen.getByRole('button', { name: 'Estimate my calories' }));
    await user.selectOptions(screen.getByLabelText('Measurement units'), 'metric');
    await user.type(screen.getByLabelText('Age (years)'), '30');
    await user.type(screen.getByLabelText('Height (cm)'), '180');
    await user.type(screen.getByLabelText('Weight (kg)'), '80');
    await user.selectOptions(screen.getByLabelText('Sex used by the equation'), 'male');
    expect(screen.getByRole('button', { name: 'Use calorie estimate' })).toBeDisabled();
    await user.click(screen.getByRole('checkbox', { name: /I am 19 or older/ }));
    expect(screen.getByText('Estimated maintenance: 2,750 kcal per day')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('slider'), { target: { value: '2' } });
    expect(screen.getByText('Estimated maintenance: 3,150 kcal per day')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Use calorie estimate' }));
    expect(screen.getByLabelText('Daily calories for preset (kcal)')).toHaveValue(3150);
    expect(requests).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: 'Review targets' }));
    await user.click(screen.getByRole('button', { name: 'Save goal' }));
    await waitFor(() => expect(requests).toHaveLength(1));
    expect(Object.keys(requests[0]).sort()).toEqual(['carbs_g', 'fat_g', 'kcal', 'protein_g']);
    expect(requests[0].kcal).toBe(3150);
  });

  it('preserves measurements when switching units and blocks unsupported ages', async () => {
    const user = await start();
    await user.click(screen.getByRole('button', { name: 'Standard' }));
    await user.click(screen.getByRole('button', { name: 'Estimate my calories' }));
    await user.type(screen.getByLabelText('Height (in)'), '72');
    await user.type(screen.getByLabelText('Weight (lb)'), '180');
    await user.selectOptions(screen.getByLabelText('Measurement units'), 'metric');
    expect(screen.getByLabelText('Height (cm)')).toHaveValue(182.88);
    expect(screen.getByLabelText('Weight (kg)')).toHaveValue(81.65);
    await user.click(screen.getByRole('checkbox', { name: /I am 19 or older/ }));
    await user.type(screen.getByLabelText('Age (years)'), '18');
    await user.selectOptions(screen.getByLabelText('Sex used by the equation'), 'female');
    expect(screen.getByRole('button', { name: 'Use calorie estimate' })).toBeDisabled();
  });

  it('keeps entered targets on save failure and sends an explicit effective date', async () => {
    const requests: GoalCreate[] = [];
    server.use(
      http.post('*/api/v1/goals', async ({ request }) => {
        requests.push((await request.json()) as GoalCreate);
        return HttpResponse.json(
          {
            error: {
              code: 'INTERNAL',
              message: 'Please try again.',
              request_id: 'test',
              details: null,
            },
          },
          { status: 500 },
        );
      }),
    );
    const user = await start();
    await user.click(screen.getByRole('button', { name: 'Keto' }));
    await user.click(screen.getByRole('button', { name: 'Review targets' }));
    fireEvent.change(screen.getByLabelText('Starting from (optional)'), {
      target: { value: '2026-11-05' },
    });
    await user.click(screen.getByRole('button', { name: 'Save goal' }));
    await screen.findByText('Goal not saved');
    expect(screen.getByLabelText('Carbs (g)')).toHaveValue(25);
    expect(requests[0].effective_from).toBe('2026-11-05');
    expect(screen.getByRole('button', { name: 'Save goal' })).toBeEnabled();
  });

  it('blocks duplicate submits while saving', async () => {
    let requests = 0;
    server.use(
      http.post('*/api/v1/goals', async () => {
        requests++;
        await delay(100);
        return HttpResponse.json({ ...goal, kcal: 2000, protein_g: 100, carbs_g: 250, fat_g: 67 });
      }),
    );
    const user = await start();
    await user.click(screen.getByRole('button', { name: 'Standard' }));
    await user.click(screen.getByRole('button', { name: 'Review targets' }));
    await user.dblClick(screen.getByRole('button', { name: 'Save goal' }));
    await screen.findByRole('button', { name: 'Set goals' });
    expect(requests).toBe(1);
  });
});
