import { scaleLinear } from 'd3';
import { useNavigate } from 'react-router';
import type { MealContribution } from '@/api/types';
import { formatKcal, formatNumber, MEAL_TYPE_LABEL } from '@/lib/format';
import { INK } from './colors';
import { barPath } from './geometry';
import { layoutSegments } from './layout';
import { StripePattern } from './patterns';
import { usePatternId } from './usePatternId';
import { useElementWidth } from './useElementWidth';

export interface MealContributionBarProps {
  meals: MealContribution[];
  /** That day's kcal goal, or null. */
  goal: number | null;
}

const BAR_Y = 4;
const BAR_H = 14;
const LABEL_Y1 = 36; // meal name baseline
const LABEL_Y2 = 52; // kcal baseline
const SVG_H = 58;
const CHAR_PX = 7; // caption (13 px) average glyph width, for fit checks

/**
 * Today's meals stacked toward the goal (D3 linear scale + cumulative sum).
 * Each meal is one segment in the kcal hue: its checked kcal solid, its
 * AI-only kcal striped. Segments are separated by a 2 px surface gap and
 * labeled below with the meal type and kcal (shortened to an initial, or
 * dropped, when the segment is too narrow, so labels never collide). The
 * dashed tick is the goal. Tap a segment to open that meal.
 */
export function MealContributionBar({ meals, goal }: MealContributionBarProps) {
  const navigate = useNavigate();
  const [ref, width] = useElementWidth();
  const pid = usePatternId('meal-stripes');
  const total = meals.reduce((s, m) => s + m.totals.kcal, 0);
  const hasGoal = goal != null && goal > 0;
  const x = scaleLinear()
    .domain([0, Math.max(1, total, hasGoal ? goal : 0)])
    .range([0, Math.max(0, width - 2)]);
  const segments = layoutSegments(meals, x);

  return (
    <div ref={ref}>
      <svg
        width={width}
        height={SVG_H}
        className="block overflow-visible"
        role="group"
        aria-label="Meals toward goal"
      >
        <defs>
          <StripePattern id={pid} />
        </defs>
        <path d={barPath(0, x.range()[1], BAR_Y, BAR_H)} style={{ fill: INK.track }} aria-hidden />
        {segments.map((s, i) => {
          const last = i === segments.length - 1;
          const w = s.x1 - s.x0;
          const kc = s.checked + s.aiOnly;
          const xc = kc > 0 ? s.x0 + (w * s.checked) / kc : s.x0;
          const name = MEAL_TYPE_LABEL[s.meal.meal_type];
          const kcalText = formatNumber(s.meal.totals.kcal);
          // Room for a label: up to the next segment (the last one may use the
          // rest of the track), so labels never overlap.
          const room = (segments[i + 1]?.x0 ?? width) - s.x0;
          const fitsFull = room >= Math.max(name.length, kcalText.length) * CHAR_PX + 6;
          const fitsInitial = room >= CHAR_PX * 1.5 + 2;
          const go = () => navigate(`/meals/${s.meal.id}`);
          return (
            <g
              key={s.meal.id}
              role="link"
              tabIndex={0}
              aria-label={`${name}: ${formatKcal(s.meal.totals.kcal)}. Open meal`}
              className="cursor-pointer outline-none [&:focus-visible>rect.hit]:stroke-(--ring)"
              onClick={go}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  go();
                }
              }}
            >
              <rect
                className="hit"
                x={s.x0}
                y={0}
                width={Math.max(w, 1)}
                height={SVG_H}
                rx={4}
                style={{ fill: 'transparent', strokeWidth: 2 }}
              />
              {s.checked > 0 && (
                <path
                  d={barPath(
                    s.x0,
                    s.aiOnly > 0 ? Math.max(s.x0, xc - 1) : s.x1,
                    BAR_Y,
                    BAR_H,
                    last && s.aiOnly <= 0,
                  )}
                  style={{ fill: 'var(--kcal)' }}
                />
              )}
              {s.aiOnly > 0 && (
                <path
                  d={barPath(s.checked > 0 ? xc + 1 : s.x0, s.x1, BAR_Y, BAR_H, last)}
                  style={{ fill: `url(#${pid})`, stroke: 'var(--kcal)', strokeWidth: 1 }}
                />
              )}
              {fitsInitial && (
                <text
                  x={s.x0 + 1}
                  y={LABEL_Y1}
                  className="text-caption"
                  style={{ fill: INK.foreground, fontWeight: 500 }}
                  aria-hidden
                >
                  {fitsFull ? name : name[0]}
                </text>
              )}
              {fitsFull && (
                <text
                  x={s.x0 + 1}
                  y={LABEL_Y2}
                  className="text-caption tabular-nums"
                  style={{ fill: INK.muted }}
                  aria-hidden
                >
                  {kcalText}
                </text>
              )}
            </g>
          );
        })}
        {hasGoal && (
          <line
            x1={x(goal)}
            x2={x(goal)}
            y1={0}
            y2={BAR_Y + BAR_H + 4}
            style={{ stroke: INK.muted, strokeWidth: 1.5, strokeDasharray: '3 2' }}
            aria-hidden
          />
        )}
      </svg>
    </div>
  );
}
