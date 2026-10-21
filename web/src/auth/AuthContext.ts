import { createContext, useContext } from 'react';

export interface AuthUser {
  id: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface AuthState {
  mode: 'supabase' | 'dev';
  user: AuthUser | null;
  /** True until the initial session check finishes. */
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/**
 * Fake user for VITE_AUTH_MODE=dev. The backend (AUTH_MODE=dev) maps all
 * requests to its seeded dev user; keep this ID in sync with supabase/seed.sql.
 */
export const DEV_USER: AuthUser = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'dev@example.com',
  displayName: 'Dev User',
  avatarUrl: null,
};
