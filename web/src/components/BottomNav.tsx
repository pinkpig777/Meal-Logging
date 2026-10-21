import { NavLink } from 'react-router';
import { cn } from './cn';
import { IconBulb, IconCamera, IconHistory, IconToday } from './icons';

const tabClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'flex min-h-touch flex-1 flex-col items-center justify-center gap-0.5 text-xs font-medium',
    isActive ? 'text-accent' : 'text-muted',
  );

/** Four tabs: Today, History, Log (center, prominent), Suggestions. */
export function BottomNav() {
  return (
    <nav
      aria-label="Main"
      className="pb-safe border-line bg-surface/95 fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur"
    >
      <div className="h-nav max-w-app mx-auto flex items-stretch px-2">
        <NavLink to="/" end className={tabClass}>
          <IconToday />
          Today
        </NavLink>
        <NavLink to="/history" className={tabClass}>
          <IconHistory />
          History
        </NavLink>
        <NavLink
          to="/log"
          className={({ isActive }) =>
            cn(
              'flex flex-1 flex-col items-center justify-center gap-0.5 text-xs font-medium',
              isActive ? 'text-accent' : 'text-text',
            )
          }
        >
          <span className="bg-accent text-accent-fg ring-bg -mt-5 flex size-14 items-center justify-center rounded-full shadow-md ring-4">
            <IconCamera className="size-7" />
          </span>
          Log
        </NavLink>
        <NavLink to="/suggestions" className={tabClass}>
          <IconBulb />
          Suggestions
        </NavLink>
      </div>
    </nav>
  );
}
