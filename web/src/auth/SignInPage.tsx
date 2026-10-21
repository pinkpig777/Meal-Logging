import { useState } from 'react';
import { Navigate, useLocation } from 'react-router';
import { Button } from '@/components/Button';
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
    <main className="pt-safe pb-safe max-w-app mx-auto flex min-h-dvh flex-col justify-center gap-8 px-6">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-semibold">Meal Log</h1>
        <p className="text-muted">
          Snap a photo of your meal, review the estimate, and see how your days add up.
        </p>
      </div>
      <div className="space-y-3">
        <Button className="w-full" size="lg" onClick={onClick} disabled={pending}>
          <GoogleMark />
          Continue with Google
        </Button>
        {mode === 'dev' && (
          <p className="text-muted text-center text-sm">
            Dev auth mode: you will be signed in as the local dev user.
          </p>
        )}
        {error && (
          <p role="alert" className="text-danger text-center text-sm">
            {error}
          </p>
        )}
      </div>
    </main>
  );
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.8-5.5 3.8-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.2 14.6 2.2 12 2.2 6.6 2.2 2.2 6.6 2.2 12s4.4 9.8 9.8 9.8c5.7 0 9.4-4 9.4-9.6 0-.6-.1-1.1-.2-1.6H12z"
      />
    </svg>
  );
}
