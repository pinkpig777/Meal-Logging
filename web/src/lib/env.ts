/** Typed access to Vite env vars, with local-dev defaults. See web/.env.example. */
export const env = {
  apiBaseUrl: (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1').replace(
    /\/$/,
    '',
  ),
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321',
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
  authMode: (import.meta.env.VITE_AUTH_MODE === 'supabase' ? 'supabase' : 'dev') as
    'supabase' | 'dev',
  apiMock: import.meta.env.VITE_API_MOCK === 'true',
};

export const isDevAuth = env.authMode === 'dev';
