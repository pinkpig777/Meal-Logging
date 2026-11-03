import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import type { ChatRequest } from '@/api/types';
import { server } from '@/mocks/server';
import { renderRoute } from '@/test/utils';
import { recentChatMessages } from './chatHistory';

const answer = {
  message: {
    role: 'assistant',
    content: 'Your recorded summary.\n\nNutrition values are estimates.',
  },
  references: { dates: ['2026-10-28'], meal_ids: ['00000000-0000-0000-0000-000000000123'] },
};
const failure = () =>
  HttpResponse.json(
    {
      error: {
        code: 'LLM_TIMEOUT',
        message: 'The answer took too long.',
        details: null,
        request_id: 'test',
      },
    },
    { status: 504 },
  );

async function ask(text = 'What was my protein intake?') {
  const user = userEvent.setup();
  await user.type(screen.getByRole('textbox', { name: 'Message' }), text);
  await user.click(screen.getByRole('button', { name: 'Send' }));
  return user;
}

describe('ChatPage', () => {
  it('sends the selected period and renders supporting record links', async () => {
    const requests: ChatRequest[] = [];
    server.use(
      http.post('*/api/v1/chat', async ({ request }) => {
        requests.push((await request.json()) as ChatRequest);
        return HttpResponse.json(answer);
      }),
    );
    renderRoute('/chat');
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText('Meal history period'), 'last_week');
    await ask();
    await screen.findByText(/Your recorded summary/);
    expect(requests[0].period).toBe('last_week');
    expect(screen.getByRole('link', { name: 'View meal 1' })).toHaveAttribute(
      'href',
      '/meals/00000000-0000-0000-0000-000000000123',
    );
    expect(document.querySelector('a[href="/?date=2026-10-28"]')).not.toBeNull();
    expect(screen.getByLabelText('Meal history period')).toBeDisabled();
  });

  it('retries a failed question without duplicating the user turn', async () => {
    const requests: ChatRequest[] = [];
    server.use(
      http.post('*/api/v1/chat', async ({ request }) => {
        requests.push((await request.json()) as ChatRequest);
        return requests.length === 1 ? failure() : HttpResponse.json(answer);
      }),
    );
    renderRoute('/chat');
    const user = await ask('Would a burrito fit?');
    await screen.findByRole('button', { name: 'Retry answer' });
    expect(screen.getByRole('textbox', { name: 'Message' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Retry answer' }));
    await screen.findByText(/Your recorded summary/);
    expect(requests).toHaveLength(2);
    expect(requests[1]).toEqual(requests[0]);
    expect(screen.getAllByText('Would a burrito fit?')).toHaveLength(1);
  });

  it('restores a failed question for editing and allows a new conversation', async () => {
    server.use(http.post('*/api/v1/chat', failure));
    renderRoute('/chat');
    const user = await ask('What did I log?');
    await screen.findByRole('button', { name: 'Edit question' });
    await user.click(screen.getByRole('button', { name: 'Edit question' }));
    expect(screen.getByRole('textbox', { name: 'Message' })).toHaveValue('What did I log?');
    expect(screen.queryByText('What did I log?')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Meal history period')).toBeEnabled();
  });

  it('serializes only API messages and resets when the period is changed', async () => {
    const requests: ChatRequest[] = [];
    server.use(
      http.post('*/api/v1/chat', async ({ request }) => {
        requests.push((await request.json()) as ChatRequest);
        return HttpResponse.json(answer);
      }),
    );
    renderRoute('/chat');
    const user = await ask();
    await screen.findByText(/Your recorded summary/);
    await ask('And my carbs?');
    await waitFor(() => expect(requests).toHaveLength(2));
    expect(requests[1].messages).toHaveLength(3);
    expect(requests[1].messages[1]).toEqual(answer.message);
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'New conversation / change period' }),
      ).toBeEnabled(),
    );
    await user.click(screen.getByRole('button', { name: 'New conversation / change period' }));
    expect(screen.queryByText(/Your recorded summary/)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Meal history period')).toBeEnabled();
  });

  it('blocks repeated submits while an answer is pending', async () => {
    let count = 0;
    server.use(
      http.post('*/api/v1/chat', async () => {
        count++;
        await delay(100);
        return HttpResponse.json(answer);
      }),
    );
    renderRoute('/chat');
    const input = screen.getByRole('textbox', { name: 'Message' });
    fireEvent.change(input, { target: { value: 'My protein?' } });
    const form = input.closest('form')!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    await screen.findByText(/Your recorded summary/);
    expect(count).toBe(1);
  });
});

describe('recentChatMessages', () => {
  it('bounds message count and text size while keeping the latest question', () => {
    const messages = Array.from({ length: 21 }, (_, index) => ({
      role: 'user' as const,
      content: `Question ${index}`,
    }));
    expect(recentChatMessages(messages)).toHaveLength(20);
    expect(messages).toHaveLength(21);
    const long = Array.from({ length: 6 }, () => ({
      role: 'user' as const,
      content: 'x'.repeat(4000),
    }));
    expect(recentChatMessages(long)).toHaveLength(5);
    expect(recentChatMessages(messages).at(-1)?.content).toBe('Question 20');
  });
});
