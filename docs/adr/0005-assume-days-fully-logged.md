# ADR-0005: Assume logged days are complete; do not track daily completeness

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-10-21 |
| **Deciders** | Charlie Chiu |

## Context

The Task & Team document (M3, M4) and the Phase 2 report planned explicit daily completeness: the user marks a day as fully logged, and only those days are compared against goals. This guards against treating a partially logged day as low intake. It also adds a recurring task and UI state that users must remember to maintain.

## Decision

Do **not** track daily completeness. The system assumes the user logs every meal on the day they eat it.

- A **logged day** (at least one confirmed meal) is treated as complete and compared against that day's effective goal.
- An **unlogged day** (no confirmed meals) is unknown intake. It is never shown or computed as zero.
- Users fill gaps by **backfilling**: logging a meal with a past date and time.

## Alternatives considered

| Option | Pros | Cons |
|---|---|---|
| Explicit "I've logged everything today" toggle | Protects goal comparisons and suggestions from partial days | Extra recurring task; most users would forget to toggle it |
| Infer completeness (e.g., meal count, time of day) | No user effort | Heuristics are opaque and often wrong |
| Assume logged days are complete (chosen) | Simplest model and UI; no extra task | A partially logged day looks like low intake |

## Consequences

- No `day_logs` table and no completeness API. The Task & Team items "Handle daily meal-completeness information" (M3) and "Distinguish incomplete days from zero intake" (M4) narrow to **distinguishing unlogged days from zero intake**.
- Meal creation must accept a user-chosen past `eaten_at` time.
- Suggestions (M5) may draw conclusions from partially logged days. The M5 design doc must decide how cautious to be, for example by phrasing patterns as "on the days you logged" and requiring several logged days before suggesting anything.
