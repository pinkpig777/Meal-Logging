/**
 * Resolve a URL that may be relative to the page (e.g. "/api/v1") into an absolute one.
 * Relative values go through the Vite dev-server proxy (vite.config.ts), so the app works
 * from any device that can reach the dev server, such as a phone on the same Wi-Fi.
 */
function absolute(url: string): string {
  const trimmed = url.replace(/\/$/, '');
  if (/^https?:\/\//.test(trimmed)) return trimmed;
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
  return `${origin}${trimmed.startsWith('/') ? '' : '/'}${trimmed}`;
}

/** Typed access to Vite env vars, with local-dev defaults. See web/.env.example. */
export const env = {
  apiBaseUrl: absolute(import.meta.env.VITE_API_BASE_URL || '/api/v1'),
  supabaseUrl: absolute(import.meta.env.VITE_SUPABASE_URL || '/supabase'),
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
  authMode: (import.meta.env.VITE_AUTH_MODE === 'supabase' ? 'supabase' : 'dev') as
    'supabase' | 'dev',
  apiMock: import.meta.env.VITE_API_MOCK === 'true',
};

export const isDevAuth = env.authMode === 'dev';
