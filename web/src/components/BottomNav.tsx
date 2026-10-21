import { Camera, House, Lightbulb, List, Settings, type LucideIcon } from 'lucide-react';
import { NavLink } from 'react-router';
import { cn } from '@/lib/utils';

const TABS_LEFT: Array<{ to: string; label: string; icon: LucideIcon; end?: boolean }> = [
  { to: '/', label: 'Today', icon: House, end: true },
  { to: '/history', label: 'History', icon: List },
];
const TABS_RIGHT: Array<{ to: string; label: string; icon: LucideIcon }> = [
  { to: '/suggestions', label: 'Suggestions', icon: Lightbulb },
  { to: '/settings', label: 'Settings', icon: Settings },
];

const tabClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'min-h-touch flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-control text-caption font-medium transition-colors duration-150',
    isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
  );

function Tab({ to, label, icon: Icon, end }: (typeof TABS_LEFT)[number]) {
  return (
    <NavLink to={to} end={end} className={tabClass}>
      <Icon className="size-5" strokeWidth={1.75} aria-hidden="true" />
      <span className="max-w-full truncate tracking-tight">{label}</span>
    </NavLink>
  );
}

/**
 * Fixed bottom nav: Today, History, Log (center, prominent), Suggestions, Settings.
 * Active tab in `primary`; safe-area aware (UI guidelines §4).
 */
export function BottomNav() {
  return (
    <nav
      aria-label="Main"
      className="pb-safe bg-card/95 border-card-edge fixed inset-x-0 bottom-0 z-40 border-t shadow-[0_-1px_0_var(--border)] backdrop-blur dark:shadow-none"
    >
      <div className="h-nav max-w-app mx-auto flex items-stretch">
        {TABS_LEFT.map((t) => (
          <Tab key={t.to} {...t} />
        ))}
        <NavLink
          to="/log"
          aria-label="Log a meal"
          className="group flex w-[60px] flex-none flex-col items-center justify-start"
        >
          {({ isActive }) => (
            <>
              <span
                className={cn(
                  'bg-primary text-primary-foreground ring-card -mt-4 flex size-14 items-center justify-center rounded-full ring-4 transition-transform duration-150 group-active:scale-95',
                  'shadow-[0_4px_12px_rgb(0_0_0/0.12)] dark:shadow-none',
                )}
              >
                <Camera className="size-6" strokeWidth={1.75} aria-hidden="true" />
              </span>
              <span
                className={cn(
                  'text-caption mt-0.5 font-medium',
                  isActive ? 'text-primary' : 'text-foreground',
                )}
              >
                Log
              </span>
            </>
          )}
        </NavLink>
        {TABS_RIGHT.map((t) => (
          <Tab key={t.to} {...t} />
        ))}
      </div>
    </nav>
  );
}
