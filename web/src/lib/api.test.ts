import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '@/mocks/server';
import { ApiError, apiFetch } from './api';
import { env } from './env';

describe('ApiError', () => {
  it('parses the error envelope', () => {
    const e = ApiError.fromBody(409, {
      error: {
        code: 'MEAL_INVALID_STATE',
        message: 'This meal is already confirmed and cannot be clarified.',
        details: { meal_id: 'm1', status: 'confirmed' },
        request_id: 'req-1',
      },
    });
    expect(e).toBeInstanceOf(ApiError);
    expect(e.status).toBe(409);
    expect(e.code).toBe('MEAL_INVALID_STATE');
    expect(e.message).toBe('This meal is already confirmed and cannot be clarified.');
    expect(e.details).toEqual({ meal_id: 'm1', status: 'confirmed' });
    expect(e.requestId).toBe('req-1');
    expect(e.mealId).toBe('m1');
  });

  it('falls back for non-envelope bodies', () => {
    const e = ApiError.fromBody(502, '<html>Bad gateway</html>', 'hdr-req');
    expect(e.code).toBe('INTERNAL');
    expect(e.requestId).toBe('hdr-req');
    expect(e.message).toMatch(/try again/i);
  });

  it('is thrown by apiFetch on non-2xx responses', async () => {
    server.use(
      http.get(`${env.apiBaseUrl}/meals/missing`, () =>
        HttpResponse.json(
          { error: { code: 'NOT_FOUND', message: 'Not found.', details: null, request_id: 'r9' } },
          { status: 404 },
        ),
      ),
    );
    await expect(apiFetch('/meals/missing')).rejects.toMatchObject({
      name: 'ApiError',
      status: 404,
      code: 'NOT_FOUND',
      requestId: 'r9',
    });
  });

  it('returns undefined for 204', async () => {
    server.use(
      http.delete(`${env.apiBaseUrl}/meals/x`, () => new HttpResponse(null, { status: 204 })),
    );
    await expect(apiFetch('/meals/x', { method: 'DELETE' })).resolves.toBeUndefined();
  });
});
