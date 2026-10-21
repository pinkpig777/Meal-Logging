import { UtensilsCrossed } from 'lucide-react';
import { useState } from 'react';
import { Navigate, useLocation } from 'react-router';
import { Button } from '@/components/ui/button';
import { useAuth } from './AuthContext';

export function SignInPage() {
  const { user, mode, signInWithGoogle } = useAuth();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (user) {
    const from = (location.state as { from?: string } | null)?.from ?? '/';
    return <Navigate to={from} replace />;
  }

  async function onClick() {
    setError(null);
    setPending(true);
    try {
      await signInWithGoogle();
    } catch {
      setError('Sign-in did not complete. Please try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="pt-safe pb-safe max-w-app mx-auto flex min-h-dvh flex-col px-4">
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <div
          className="bg-primary-soft text-primary flex size-20 items-center justify-center rounded-full"
          aria-hidden="true"
        >
          <UtensilsCrossed className="size-9" strokeWidth={1.75} />
        </div>
        <h1 className="text-display">Meal Log</h1>
        <p className="text-muted-foreground max-w-xs">
          Snap a photo of your meal, review the estimate, and see how your days add up.
        </p>
      </div>
      <div className="space-y-3 pb-10">
        <Button className="w-full" size="lg" onClick={onClick} disabled={pending}>
          <GoogleMark />
          Continue with Google
        </Button>
        {mode === 'dev' && (
          <p className="text-caption text-muted-foreground text-center">
            Dev auth mode: you will be signed in as the local dev user.
          </p>
        )}
        {error && (
          <p role="alert" className="text-label text-destructive text-center font-normal">
            {error}
          </p>
        )}
      </div>
    </main>
  );
}

/** Google "G" mark in currentColor (no raw brand hex in components). */
function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="currentColor">
      <path d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.8-5.5 3.8-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.2 14.6 2.2 12 2.2 6.6 2.2 2.2 6.6 2.2 12s4.4 9.8 9.8 9.8c5.7 0 9.4-4 9.4-9.6 0-.6-.1-1.1-.2-1.6H12z" />
    </svg>
  );
}
