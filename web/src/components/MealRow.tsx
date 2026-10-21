import { ChevronRight, UtensilsCrossed } from 'lucide-react';
import { Link } from 'react-router';
import type { MealSummary, NutritionTotals } from '@/api/types';
import { MEAL_TYPE_LABEL, formatTime, formatTotalsKcal } from '@/lib/format';
import { cn } from '@/lib/utils';

export interface MealRowProps {
  meal: Pick<MealSummary, 'id' | 'meal_type' | 'eaten_at' | 'item_names' | 'photo_url'> & {
    totals: NutritionTotals;
  };
  /** Show the photo thumbnail (or a placeholder) on the left. */
  showThumbnail?: boolean;
  to?: string;
  className?: string;
}

/** Tappable meal row: meal type + time, item names, kcal, chevron (§5.2 tappable card). */
export function MealRow({ meal: m, showThumbnail, to, className }: MealRowProps) {
  return (
    <Link
      to={to ?? `/meals/${m.id}`}
      className={cn(
        'bg-card border-card-edge shadow-card rounded-card min-h-touch hover:bg-muted/50 active:bg-muted flex items-center gap-3 border p-4 transition-colors duration-150',
        className,
      )}
    >
      {showThumbnail &&
        (m.photo_url ? (
          <img src={m.photo_url} alt="" className="rounded-small size-12 shrink-0 object-cover" />
        ) : (
          <div
            className="rounded-small bg-muted text-muted-foreground flex size-12 shrink-0 items-center justify-center"
            aria-hidden="true"
          >
            <UtensilsCrossed className="size-5" strokeWidth={1.75} />
          </div>
        ))}
      <div className="min-w-0 flex-1">
        <p className="text-body truncate font-semibold">{MEAL_TYPE_LABEL[m.meal_type]}</p>
        <p className="text-label text-muted-foreground truncate font-normal">
          <span className="whitespace-nowrap">{formatTime(m.eaten_at)}</span> ·{' '}
          {m.item_names.join(', ')}
        </p>
      </div>
      <p className="text-label shrink-0 text-right tabular-nums">{formatTotalsKcal(m.totals)}</p>
      <ChevronRight
        className="text-muted-foreground size-5 shrink-0"
        strokeWidth={1.75}
        aria-hidden="true"
      />
    </Link>
  );
}
