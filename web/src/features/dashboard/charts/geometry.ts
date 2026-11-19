/**
 * Horizontal bar path anchored at the baseline (square left end) with rounded
 * data-end corners on the right (UI guidelines §7: 4 px rounded bar ends).
 */
export function barPath(x0: number, x1: number, y: number, h: number, roundEnd = true, r = 4) {
  const w = Math.max(0, x1 - x0);
  if (w === 0) return '';
  const rr = roundEnd ? Math.min(r, w, h / 2) : 0;
  return [
    `M${x0},${y}`,
    `H${x1 - rr}`,
    rr ? `A${rr},${rr} 0 0 1 ${x1},${y + rr}` : '',
    `V${y + h - rr}`,
    rr ? `A${rr},${rr} 0 0 1 ${x1 - rr},${y + h}` : '',
    `H${x0}`,
    'Z',
  ].join('');
}

/** Gap between adjacent fills (stacked segments): 2 px of surface. */
export const SEGMENT_GAP = 2;
