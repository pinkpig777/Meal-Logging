import { max, scaleLinear } from 'd3';
import type { MealItem } from '@/api/types';
import { formatItemKcal } from '@/lib/format';
import { cn } from '@/lib/utils';
import { isCheckedSource } from './colors';
import { SplitBarLegend } from './Legend';
import { StripePattern } from './patterns';
import { usePatternId } from './usePatternId';
import { hasMeaningfulRange, sortItemsByKcal } from './layout';
import { SplitBar } from './SplitBar';
import { useElementWidth } from './useElementWidth';

export interface MealItemsChartProps {
  items: MealItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const BAR_Y = 2;
const BAR_H = 10;
const SVG_H = 22;

/**
 * V4: what makes up this meal. One D3-scaled horizontal bar per item, sorted
 * by kcal (shared scale incl. range highs). An item is either checked by the
 * user (solid) or an AI-only estimate (stripes); a whisker shows its range.
 * Rows are buttons: tapping one selects it, and the page highlights the
 * matching item card (linked highlighting).
 */
export function MealItemsChart({ items, selectedId, onSelect }: MealItemsChartProps) {
  const [ref, width] = useElementWidth();
  const pid = usePatternId('item-stripes');
  const sorted = sortItemsByKcal(items);
  const domainMax = max(sorted, (i) => Math.max(i.nutrition.kcal, i.kcal_range?.high ?? 0)) ?? 1;
  const x = scaleLinear()
    .domain([0, Math.max(1, domainMax)])
    .range([0, Math.max(0, width - 2)]);
  const anyChecked = sorted.some((i) => isCheckedSource(i.source));
  const anyAi = sorted.some((i) => !isCheckedSource(i.source));
  const anyRange = sorted.some((i) => hasMeaningfulRange(i.kcal_range?.low, i.kcal_range?.high));

  return (
    <div className="space-y-2">
      <ul className="-mx-2 space-y-1">
        {sorted.map((item, idx) => {
          const checked = isCheckedSource(item.source);
          const selected = item.id === selectedId;
          return (
            <li key={item.id}>
              <button
                type="button"
                data-testid="item-bar"
                data-item-id={item.id}
                aria-pressed={selected}
                onClick={() => onSelect(item.id)}
                className={cn(
                  'rounded-small min-h-touch w-full px-2 py-1.5 text-left transition-colors duration-150',
                  selected
                    ? 'bg-primary-soft ring-primary ring-1'
                    : 'hover:bg-muted/50 active:bg-muted',
                  // Linked highlight: other bars recede while one is selected.
                  selectedId && !selected && 'opacity-50',
                )}
              >
                <span className="flex items-baseline justify-between gap-2">
                  <span className="text-label truncate">{item.name}</span>
                  <span className="text-label text-muted-foreground shrink-0 font-normal tabular-nums">
                    {formatItemKcal(item.nutrition, item.kcal_range)}
                  </span>
                </span>
                <span className="sr-only">{checked ? ', checked by you' : ', AI estimate'}</span>
                <span ref={idx === 0 ? ref : undefined} className="mt-1 block">
                  <svg
                    width={width}
                    height={SVG_H}
                    aria-hidden="true"
                    className="block overflow-visible"
                  >
                    <defs>
                      <StripePattern id={`${pid}-${idx}`} />
                    </defs>
                    <SplitBar
                      x={x}
                      y={BAR_Y}
                      height={BAR_H}
                      checked={checked ? item.nutrition.kcal : 0}
                      aiOnly={checked ? 0 : item.nutrition.kcal}
                      low={item.kcal_range?.low}
                      high={item.kcal_range?.high}
                      patternId={`${pid}-${idx}`}
                    />
                  </svg>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <SplitBarLegend
        items={[
          ...(anyChecked ? (['checked'] as const) : []),
          ...(anyAi ? (['ai'] as const) : []),
          ...(anyRange ? (['range'] as const) : []),
        ]}
      />
    </div>
  );
}
