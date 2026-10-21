# M4 Design: Data Visualization & Historical Analysis

| | |
|---|---|
| **Status** | Draft: skeleton, owner to complete |
| **Owner** | Xiaochuan Ge |
| **Reviewers** | Charlie Chiu, Yi-Wei Chang (M3) |
| **Last updated** | 2026-10-21 |
| **Related** | ADR-0004, ADR-0005, [Data model §6](../04-data/data-model.md#6-derived-views), [API reference §6](../05-api/api-reference.md#6-m4-analytics) |

> Sections marked **[Owner]** are for Xiaochuan to complete, including the choice of charting library.

## 1. Context

Confirmed meals become daily and weekly views of calories and macros against the user's goals. Users move from patterns to the meals behind them: week → day → meal → photo and editable record.

## 2. Responsibilities

From the Task & Team document, updated by ADR-0005:

- Daily and weekly aggregation; progress against goals.
- Daily calorie and macro progress views.
- Weekly calorie and macro trends.
- Interactive history with week → day → meal drill-down.
- Individual meal contributions to daily totals.
- Distinguish **unlogged days** from zero intake.
- Refresh views when meals are edited or deleted.
- Loading, empty-history, and error states.

## 3. Interfaces

| Direction | Interface |
|---|---|
| API | `GET /analytics/daily`, `GET /analytics/weekly`, `GET /analytics/history` (shapes are provisional, and the owner may revise them) |
| Data | Views `daily_totals` and `meal_totals` (confirmed meals only, joined to the effective goal) |
| UI | `/` (Today), `/week` (`web/src/features/dashboard/`) |
| Navigation | Day → `GET /analytics/daily`; meal → `/meals/:id` (M3) |

## 4. Fixed constraints

- **Unlogged days are unknown, never zero.** They must be visually distinct from low intake, not drawn as a zero-height bar or a dip in a line.
- Weekly averages use logged days only, and the UI says so ("avg. over 5 logged days").
- Every value is an **estimate**. Where `kcal_low` / `kcal_high` exist, the uncertainty can be shown (ADR-0004); the encoding is the owner's decision.
- Each day is compared with **that day's effective goal**, not the current goal.
- Calories and each macro have separate goals; do not merge them into a single score.
- Status must not depend on color alone; text or shape carries the meaning.
- Neutral framing: no "good/bad" or red-for-over judgments by default.
- Mobile-first: charts must be readable at 360 px wide and usable by touch (no hover-only details).
- Edits elsewhere invalidate analytics queries (TanStack Query keys in `web/src/lib/queryKeys.ts`).

## 5. Starter-code baseline

The analytics endpoints read `daily_totals` and meals. The Today and Week pages render the API data as plain text and tables, with no chart library. Unlogged days render as "Not logged".

## 6. Design **[Owner]**

### 6.1 Charting approach

Choose the library or approach (e.g., D3 + React SVG, visx, Recharts, Observable Plot) based on the encodings below. Record the choice and its rationale here; if it is hard to reverse, also write an ADR.

### 6.2 Today view

Points to address: calorie and macro progress vs. goal, remaining amounts, meal contributions (which meal contributed what), estimate ranges, and the empty state before the first meal.

### 6.3 Week view and trends

Points to address: chart form for 7 days × 4 metrics, the goal reference per day, unlogged-day encoding, averages over logged days, and switching metric.

### 6.4 Drill-down and linking

Points to address: week → day → meal transitions, preserving context (back navigation, selected metric), and showing the meal photo.

### 6.5 Uncertainty encoding

Points to address: whether and how to show ranges at the meal, day, and week levels, and how to explain them in plain language.

### 6.6 Longer history

Points to address: the `/analytics/history` use case (calendar heatmap? monthly trend?), or defer it.

## 7. Alternatives considered **[Owner]**

## 8. Testing **[Owner]**

Cover aggregation correctness (incl. goal changes mid-week and unlogged days), rendering of unlogged vs. zero-like days, and refresh after an edit or delete.

## 9. Open questions

| # | Question |
|---|---|
| M4-Q1 | Which charting library? |
| M4-Q2 | Is `/analytics/history` needed for the MVP? |
| M4-Q3 | Should the week start on Monday or Sunday, and should it be a user setting? |
