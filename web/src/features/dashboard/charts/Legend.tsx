import { cn } from '@/lib/utils';
import { cssVar, INK, type ChartHue } from './colors';
import { StripePattern } from './patterns';
import { usePatternId } from './usePatternId';

export type LegendKey = 'checked' | 'ai' | 'range' | 'goal';

const LABEL: Record<LegendKey, string> = {
  checked: 'Checked',
  ai: 'AI estimate',
  range: 'Range',
  goal: 'Goal',
};

/**
 * Key for the split calorie bar. Swatches are drawn with the same marks as the
 * chart; text stays in `muted-foreground` (never the series color).
 */
export function SplitBarLegend({
  items = ['checked', 'ai', 'range', 'goal'],
  hue = 'kcal',
  className,
}: {
  items?: LegendKey[];
  hue?: ChartHue;
  className?: string;
}) {
  const pid = usePatternId();
  return (
    <ul
      aria-label="Chart key"
      className={cn(
        'text-caption text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1',
        className,
      )}
    >
      {items.map((k) => (
        <li key={k} className="flex items-center gap-1.5">
          <svg width={18} height={12} aria-hidden="true" className="shrink-0">
            {k === 'ai' && (
              <defs>
                <StripePattern id={pid} hue={hue} />
              </defs>
            )}
            {k === 'checked' && (
              <rect x={1} y={2} width={16} height={8} rx={2} style={{ fill: cssVar(hue) }} />
            )}
            {k === 'ai' && (
              <rect
                x={1.5}
                y={2.5}
                width={15}
                height={7}
                rx={2}
                style={{ fill: `url(#${pid})`, stroke: cssVar(hue), strokeWidth: 1 }}
              />
            )}
            {k === 'range' && (
              <g style={{ stroke: INK.muted, strokeWidth: 1.5 }}>
                <line x1={2} x2={16} y1={6} y2={6} />
                <line x1={2} x2={2} y1={3} y2={9} />
                <line x1={16} x2={16} y1={3} y2={9} />
              </g>
            )}
            {k === 'goal' && (
              <line
                x1={9}
                x2={9}
                y1={0}
                y2={12}
                style={{ stroke: INK.muted, strokeWidth: 1.5, strokeDasharray: '3 2' }}
              />
            )}
          </svg>
          {LABEL[k]}
        </li>
      ))}
    </ul>
  );
}
