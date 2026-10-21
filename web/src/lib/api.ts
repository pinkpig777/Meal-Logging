import type { ErrorBody } from '@/api/types';
import { env, isDevAuth } from './env';
import { supabase } from './supabase';

/**
 * Error thrown for every non-2xx API response (and for network failures).
 * Mirrors the error envelope in docs/05-api/api-conventions.md §4.
 * `message` is safe to show the user.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;
  readonly requestId: string | null;

  constructor(opts: {
    status: number;
    code: string;
    message: string;
    details?: unknown;
    requestId?: string | null;
  }) {
    super(opts.message);
    this.name = 'ApiError';
    this.status = opts.status;
    this.code = opts.code;
    this.details = opts.details ?? null;
    this.requestId = opts.requestId ?? null;
  }

  /** Build an ApiError from a status code and a (possibly malformed) parsed body. */
  static fromBody(status: number, body: unknown, headerRequestId?: string | null): ApiError {
    if (isErrorBody(body)) {
      const e = body.error;
      return new ApiError({
        status,
        code: e.code,
        message: e.message,
        details: e.details,
        requestId: e.request_id ?? headerRequestId ?? null,
      });
    }
    return new ApiError({
      status,
      code: status >= 500 ? 'INTERNAL' : 'UNKNOWN',
      message:
        status >= 500
          ? 'Something went wrong on our side. Please try again.'
          : `Request failed (${status}).`,
      details: body ?? null,
      requestId: headerRequestId ?? null,
    });
  }

  /** Meal ID attached to LLM failures on POST /meals/analyze, if present. */
  get mealId(): string | null {
    const d = this.details as Record<string, unknown> | null;
    return d && typeof d === 'object' && typeof d.meal_id === 'string' ? d.meal_id : null;
  }
}

function isErrorBody(body: unknown): body is ErrorBody {
  if (!body || typeof body !== 'object' || !('error' in body)) return false;
  const e = (body as { error: unknown }).error;
  return (
    !!e &&
    typeof e === 'object' &&
    typeof (e as { code?: unknown }).code === 'string' &&
    typeof (e as { message?: unknown }).message === 'string'
  );
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}

type Query = Record<string, string | number | boolean | null | undefined>;

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  query?: Query;
  body?: unknown;
  signal?: AbortSignal;
}

async function getAccessToken(): Promise<string | null> {
  if (isDevAuth) return null; // backend AUTH_MODE=dev accepts unauthenticated requests as the dev user
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export function buildUrl(path: string, query?: Query): string {
  const url = new URL(env.apiBaseUrl + (path.startsWith('/') ? path : `/${path}`));
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

/** Typed fetch against the backend. Returns `undefined` for 204 responses. */
export async function apiFetch<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  const token = await getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    headers['X-Timezone'] = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    /* ignore */
  }
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';

  let res: Response;
  try {
    res = await fetch(buildUrl(path, opts.query), {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new ApiError({
      status: 0,
      code: 'NETWORK_ERROR',
      message: 'Could not reach the server. Check your connection and try again.',
    });
  }

  const requestId = res.headers.get('X-Request-ID');
  if (res.status === 204) return undefined as T;

  const text = await res.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }
  if (!res.ok) throw ApiError.fromBody(res.status, parsed, requestId);
  return parsed as T;
}

export const api = {
  get: <T>(path: string, query?: Query, signal?: AbortSignal) =>
    apiFetch<T>(path, { query, signal }),
  post: <T>(path: string, body?: unknown) => apiFetch<T>(path, { method: 'POST', body }),
  patch: <T>(path: string, body?: unknown) => apiFetch<T>(path, { method: 'PATCH', body }),
  delete: <T = void>(path: string) => apiFetch<T>(path, { method: 'DELETE' }),
};
