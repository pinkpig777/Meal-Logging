import type { Session } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { env } from '@/lib/env';
import { supabase } from '@/lib/supabase';
import { AuthContext, DEV_USER, type AuthState, type AuthUser } from './AuthContext';

function toUser(session: Session | null): AuthUser | null {
  const u = session?.user;
  if (!u) return null;
  const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
  return {
    id: u.id,
    email: u.email ?? null,
    displayName: (meta.full_name as string) ?? (meta.name as string) ?? null,
    avatarUrl: (meta.avatar_url as string) ?? null,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const mode = env.authMode;
  const qc = useQueryClient();
  const [devSignedIn, setDevSignedIn] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(mode === 'supabase');

  useEffect(() => {
    if (mode !== 'supabase') return;
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [mode]);

  const value = useMemo<AuthState>(
    () => ({
      mode,
      loading,
      user: mode === 'dev' ? (devSignedIn ? DEV_USER : null) : toUser(session),
      async signInWithGoogle() {
        if (mode === 'dev') {
          setDevSignedIn(true);
          return;
        }
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: window.location.origin },
        });
        if (error) throw error;
      },
      async signOut() {
        if (mode === 'dev') setDevSignedIn(false);
        else await supabase.auth.signOut();
        qc.clear();
      },
    }),
    [mode, loading, devSignedIn, session, qc],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
