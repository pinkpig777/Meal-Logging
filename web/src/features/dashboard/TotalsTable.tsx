import type { Goal, NutritionTotals } from '@/api/types';
import { formatTotalsKcal } from '@/lib/format';
import { formatMetric, METRICS } from './metrics';

/** Totals vs. goal as a plain table. TODO(Xiaochuan): replace with the chosen visualization. */
export function TotalsTable({ totals, goal }: { totals: NutritionTotals; goal: Goal | null }) {
  return (
    <table className="w-full text-sm tabular-nums">
      <thead>
        <tr className="text-muted text-left">
          <th scope="col" className="py-1 font-medium">
            Metric
          </th>
          <th scope="col" className="py-1 text-right font-medium">
            Eaten (est.)
          </th>
          <th scope="col" className="py-1 text-right font-medium">
            Goal
          </th>
        </tr>
      </thead>
      <tbody>
        {METRICS.map((m) => (
          <tr key={m.key} className="border-line border-t">
            <th scope="row" className="py-2 text-left font-medium">
              {m.label}
            </th>
            <td className="py-2 text-right">
              {m.key === 'kcal' ? formatTotalsKcal(totals) : formatMetric(m.key, totals[m.key])}
            </td>
            <td className="text-muted py-2 text-right">
              {goal ? formatMetric(m.key, goal[m.key]) : '—'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
