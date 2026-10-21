import { ChevronLeft } from 'lucide-react';
import { Outlet, useMatches, useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { Toaster } from '@/components/ui/sonner';
import { BottomNav } from './BottomNav';

/** Set on a route via `handle` (see routes.tsx). */
export interface RouteHandle {
  title?: string;
  /** Show a back button on the left of the title. */
  back?: boolean;
  /** Hide the bottom nav (e.g. focused flows). */
  hideNav?: boolean;
}

/**
 * Page frame: sticky title bar, centered content (max 560 px, 16 px gutter),
 * fixed bottom nav. Content is padded by nav height + safe area so nothing is
 * hidden behind the nav (UI guidelines §4). Page actions use <StickyActionBar>.
 */
export function AppShell() {
  const matches = useMatches();
  const navigate = useNavigate();
  const handle = ([...matches].reverse().find((m) => (m.handle as RouteHandle | undefined)?.title)
    ?.handle ?? {}) as RouteHandle;
  const showNav = !handle.hideNav;

  return (
    <div className="max-w-app mx-auto flex min-h-dvh flex-col">
      <header className="pt-safe bg-background/95 sticky top-0 z-30 backdrop-blur">
        <div className="flex h-14 items-center gap-1 px-2">
          {handle.back ? (
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Back">
              <ChevronLeft aria-hidden="true" strokeWidth={1.75} />
            </Button>
          ) : (
            <span className="w-2" aria-hidden="true" />
          )}
          <h1 className="text-title flex-1 truncate">{handle.title ?? 'Meal Log'}</h1>
        </div>
      </header>
      <main
        className="flex-1 px-4 pt-2"
        style={{
          paddingBottom: showNav
            ? 'calc(var(--spacing-nav) + env(safe-area-inset-bottom) + 1.5rem)'
            : 'calc(env(safe-area-inset-bottom) + 1.5rem)',
        }}
      >
        <Outlet />
      </main>
      {showNav && <BottomNav />}
      <Toaster
        position="bottom-center"
        offset={{ bottom: 'calc(var(--spacing-nav) + env(safe-area-inset-bottom) + 16px)' }}
        mobileOffset={{ bottom: 'calc(var(--spacing-nav) + env(safe-area-inset-bottom) + 16px)' }}
      />
    </div>
  );
}
