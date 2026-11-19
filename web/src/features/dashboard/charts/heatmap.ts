import { scaleThreshold } from 'd3';
import type { DayPoint } from '@/api/types';
import { formatDayLabel, formatKcal } from '@/lib/format';
import { addDays } from '../dates';

/**
 * Calendar heatmap model (M4 V5): % of that day's kcal goal in 5 ordinal steps
 * of one warm hue. Bins are lower-bound inclusive on the rounded percentage
 * (the same number the label shows): <70, 70–89, 90–109, 110–129, 130+.
 */
export type HeatStep = 1 | 2 | 3 | 4 | 5;
export const HEAT_STEPS: HeatStep[] = [1, 2, 3, 4, 5];
export const HEAT_THRESHOLDS = [70, 90, 110, 130];
export const HEAT_LABELS: Record<HeatStep, string> = {
  1: '<70%',
  2: '70–89%',
  3: '90–109%',
  4: '110–129%',
  5: '130%+',
};

const bin = scaleThreshold<number, HeatStep>().domain(HEAT_THRESHOLDS).range(HEAT_STEPS);

/** Rounded % of goal, or null without a positive goal. */
export function percentOfGoal(kcal: number, goal: number | null | undefined): number | null {
  if (goal == null || !(goal > 0)) return null;
  return Math.round((kcal / goal) * 100);
}

export function heatStep(pct: number): HeatStep {
  return bin(pct);
}

export type HeatCellState = 'logged' | 'no-goal' | 'not-logged' | 'future';

export interface HeatCell {
  date: string;
  state: HeatCellState;
  isToday: boolean;
  kcal: number | null;
  pct: number | null;
  step: HeatStep | null;
  label: string;
}

function cellLabel(c: Omit<HeatCell, 'label'>): string {
  const day = formatDayLabel(c.date) + (c.isToday ? ' (today, in progress)' : '');
  switch (c.state) {
    case 'future':
      return `${day}: upcoming`;
    case 'not-logged':
      return `${day}: not logged`;
    case 'no-goal':
      return `${day}: ${formatKcal(c.kcal)}, no goal set`;
    case 'logged':
      return `${day}: ${formatKcal(c.kcal)}, ${c.pct}% of goal`;
  }
}

/** Build `weeks` rows of Mon–Sun cells starting at `firstMonday`. */
export function buildHeatmapWeeks(
  days: DayPoint[],
  firstMonday: string,
  weeks: number,
  today: string,
): HeatCell[][] {
  const byDate = new Map(days.map((d) => [d.date, d]));
  return Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, i) => {
      const date = addDays(firstMonday, w * 7 + i);
      const d = byDate.get(date);
      const isToday = date === today;
      let base: Omit<HeatCell, 'label'>;
      if (date > today) {
        base = { date, state: 'future', isToday, kcal: null, pct: null, step: null };
      } else if (!d || !d.logged || !d.totals) {
        // Unlogged = unknown, never zero (ADR-0005): no color step.
        base = { date, state: 'not-logged', isToday, kcal: null, pct: null, step: null };
      } else {
        const pct = percentOfGoal(d.totals.kcal, d.goal?.kcal);
        base =
          pct === null
            ? { date, state: 'no-goal', isToday, kcal: d.totals.kcal, pct: null, step: null }
            : { date, state: 'logged', isToday, kcal: d.totals.kcal, pct, step: heatStep(pct) };
      }
      return { ...base, label: cellLabel(base) };
    }),
  );
}

/** Plain-text summary for screen readers. */
export function summarizeHeatmap(cells: HeatCell[]): string {
  const past = cells.filter((c) => c.state !== 'future');
  const logged = past.filter((c) => c.state === 'logged' || c.state === 'no-goal');
  const notLogged = past.length - logged.length;
  const parts = [
    `${logged.length} logged ${logged.length === 1 ? 'day' : 'days'}, ${notLogged} not logged`,
  ];
  for (const s of HEAT_STEPS) {
    const n = past.filter((c) => c.step === s).length;
    if (n) parts.push(`${n} at ${HEAT_LABELS[s]} of goal`);
  }
  return parts.join('; ') + '.';
}
