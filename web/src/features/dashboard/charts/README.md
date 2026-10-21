# charts/

Intentionally empty. **No chart library has been chosen yet.**

The M4 owner (Xiaochuan) picks the library and encodings in
`docs/03-design/m4-visualization.md` (see `docs/02-architecture/tech-stack.md`:
"Charts — Owner decision (M4)"). Until then, `TodayPage` and `WeekPage` render
the analytics data as plain text and tables.

Constraints any chart must keep:

- Unlogged days are **unknown, never zero** (ADR-0005): no bar/point at 0, use a
  distinct "Not logged" treatment.
- No numeric confidence (ADR-0004). Estimate ranges (`kcal_low`–`kcal_high`)
  may be shown; the encoding is an M4 decision.
- Status must not rely on color alone; mobile widths 360–430 px.
