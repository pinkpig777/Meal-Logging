import { Link, Outlet, useMatches, useNavigate } from 'react-router';
import { BottomNav } from './BottomNav';
import { IconBack, IconSettings } from './icons';

/** Set on a route via `handle` (see App.tsx). */
export interface RouteHandle {
  title?: string;
  /** Show a back button instead of nothing on the left. */
  back?: boolean;
  /** Hide the bottom nav (e.g. focused flows). */
  hideNav?: boolean;
}

export function AppShell() {
  const matches = useMatches();
  const navigate = useNavigate();
  const handle = ([...matches].reverse().find((m) => (m.handle as RouteHandle | undefined)?.title)
    ?.handle ?? {}) as RouteHandle;
  const showNav = !handle.hideNav;

  return (
    <div className="max-w-app mx-auto flex min-h-dvh flex-col">
      <header className="pt-safe border-line bg-bg/95 sticky top-0 z-30 border-b backdrop-blur">
        <div className="flex h-14 items-center gap-1 px-2">
          {handle.back ? (
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="size-touch hover:bg-surface-2 inline-flex items-center justify-center rounded-full"
              aria-label="Back"
            >
              <IconBack className="size-5" />
            </button>
          ) : (
            <span className="w-2" />
          )}
          <h1 className="flex-1 truncate text-lg font-semibold">{handle.title ?? 'Meal Log'}</h1>
          <Link
            to="/settings"
            className="size-touch text-muted hover:bg-surface-2 inline-flex items-center justify-center rounded-full"
            aria-label="Settings"
          >
            <IconSettings className="size-5" />
          </Link>
        </div>
      </header>
      <main
        className="flex-1 px-4 pt-4"
        style={{
          paddingBottom: showNav
            ? 'calc(var(--spacing-nav) + env(safe-area-inset-bottom) + 1.5rem)'
            : 'calc(env(safe-area-inset-bottom) + 1.5rem)',
        }}
      >
        <Outlet />
      </main>
      {showNav && <BottomNav />}
    </div>
  );
}
