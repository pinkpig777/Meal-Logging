# M4 Design: Data Visualization & Historical Analysis

| | |
|---|---|
| **Status** | Draft: implemented for demo |
| **Owner** | Xiaochuan Ge |
| **Reviewers** | Charlie Chiu, Yi-Wei Chang (M3) |
| **Last updated** | 2026-11-19 |
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

## 6. Design

### 6.1 Charting approach

**D3 (v7) for scales, bins, and layout; React renders the SVG.** Each chart builds its scales with `d3-scale` (`scaleLinear`, `scaleBand`, `scaleThreshold`) and uses `d3-array` helpers (`cumsum`, `max`, `descending`), while React owns the DOM. This keeps charts typed, testable with Testing Library, and free of imperative DOM updates that fight React, yet gives full control over the custom encodings below (striped texture, whiskers, dashed slots), which chart libraries such as Recharts make awkward. Building blocks live in `web/src/features/dashboard/charts/` (see its README).

- Colors are design tokens referenced as `var(--token)` in SVG styles, resolved by the browser at paint time, so light and dark themes switch without re-rendering.
- Charts measure their container (`ResizeObserver`) and draw at real pixel width: crisp 2 px gaps, no scaled text.
- Every chart is tappable (drill-down or selection); nothing is hover-only.

**Shared encodings** (all views):

| Meaning | Encoding |
|---|---|
| Intake vs. goal | Length of a thin horizontal bar (10–14 px), square at the baseline, 4 px rounded data end |
| Goal | Dashed vertical tick in `muted-foreground`, never a colored zone |
| Nutrient | Nutrient color + text label (§2.3 of the UI guidelines) |
| Checked vs. AI-only kcal | **Solid fill** for kcal the user checked (item source `ai_clarified`, `user_edited`, `user_added`); **diagonal stripes in the same hue** for AI-only kcal (source `ai`), separated by a 2 px surface gap. API: `NutritionTotals.kcal_checked` + `kcal_ai_only` = `kcal` |
| Estimate range | Thin whisker with end caps just below the bar, from `kcal_low` to `kcal_high`, only when the range differs after rounding; text shows "1,620–1,990 kcal" |
| Over goal | The bar runs past the goal tick; text says "120 kcal over goal" in `muted-foreground`. No red |
| Unlogged day | Dashed empty slot "Not logged"; never a zero bar |

**Why stripes for AI-only kcal.** A second color would read as a second nutrient, and transparency would read as "less" and blends with the track. A texture in the same hue keeps nutrient identity, survives grayscale, print, and color-vision deficiency, and makes "how much of this has the user checked" visible at a glance. A legend ("Checked", "AI estimate", "Range", "Goal") appears wherever the encoding does, showing only the keys present.

### 6.2 Today view

- **Calorie hero:** display-size kcal, "of 2,000 kcal · est. low–high", then a split bar on a muted track whose domain is max(goal, kcal, range high). Under goal, the goal tick sits at the end; over goal, the bar fills the track and the tick sits inside it. Below: "860 kcal left" / "120 kcal over goal" and "% of goal".
- **Meal contributions:** a compact stacked bar of the day's meals in time order toward the goal (`cumsum` layout), each meal one segment split solid/striped by its own `kcal_checked`, with a 2 px gap between meals. Labels (meal type + kcal) sit below each segment and shorten to an initial, or drop, when there is no room before the next segment, so they never collide. Tapping a segment opens the meal; the meal rows below remain the full list.
- Macro tiles keep their thin progress bars (one per macro, separate goals).

### 6.3 Week view and trends

- One row per day (Mon–Sun), all on the **same x scale** (max of goals and range highs, `nice()`), with hairline gridlines and an axis row of interior ticks (no 0, which could read as a value).
- Each logged day: split bar, range whisker, that day's goal tick, and a value label ("1,830 kcal" or "1,620–1,990 kcal"). Unlogged past days: dashed "Not logged" slot. Future days: "Upcoming", quieter, not tappable.
- Tapping a row opens that day in Today (`/?date=`).
- The daily-average card says "Over N logged days; days without meals are not counted".
- Title: "This week" only for the week containing today; other weeks read "Week of Oct 26" with the date range below. The app-bar title is "Week".
- Metric switching (macros by day) is not in this version.

### 6.4 Drill-down and linking

- Week → day (`/?date=`) → meal (`/meals/:id`); History heatmap → day.
- **Meal detail ("Calories by item"):** a bar per item, **sorted by kcal (descending)**, on one scale (incl. range highs). An item is entirely checked (solid) or entirely AI-only (stripes); items with `kcal_range` get a whisker. Name and kcal are labeled above each bar.
- **Linked highlighting:** tapping a bar selects that item: the bar row gets `primary-soft` + outline, the other bars recede, and the matching item card gets a `primary` ring and scrolls into view (respecting reduced motion and the bottom nav). Tapping an item card selects its bar. Tapping again clears the selection. No photo regions.

### 6.5 Uncertainty encoding

Ranges appear as text ("520–680 kcal") and as a whisker at day, meal, and item level; no percentages or confidence numbers (ADR-0004). The striped "AI estimate" share tells users how much of a total they have not checked. Status labels and reasons stay in the review cues on the item cards.

### 6.6 Longer history: calendar heatmap

At the top of the History tab (`HistoryHeatmap`, data from `GET /analytics/history?from&to`):

- **Grid:** columns Mon–Sun (header M T W T F S S), rows = weeks, 4 weeks per page with the current week last; "Previous 4 weeks" / "Next" paging, never into the future (future days are filled in on the client, not requested).
- **Color:** % of **that day's** kcal goal in 5 ordinal steps of one warm hue: <70, 70–89, 90–109, 110–129, 130%+. Bins use `scaleThreshold` on the rounded percentage (lower bound inclusive), so the color always agrees with the number in the label. Rounded cells with a 2 px surface gap; the day of month is drawn in a text token chosen per step.
- **States:** unlogged day = dashed empty cell (not the lightest color); future = very faint fill, no outline, not focusable or tappable; today = in progress, a ring inside the cell; logged day without a goal = neutral gray (`--heat-none`) with a "No goal set" legend item only when present.
- **Legend:** "% of that day's goal" with the 5 swatches, plus "Not logged" and "Today".
- **Accessibility:** each cell has a label ("Tue, Nov 18: 1,830 kcal, 92% of goal", "…: not logged", "…: upcoming"); cells are keyboard-focusable with a visible ring; a screen-reader summary gives logged/unlogged counts and counts per step. Tapping a cell opens that day in Today.
- **Palette** (tokens `--heat-1..5` in `web/src/index.css`), validated with the data-viz palette validator as an ordinal ramp:

| Step | Light | Dark |
|---|---|---|
| 1 (<70%) | `#d4af8e` | `#6e4a34` |
| 2 | `#c09070` | `#8e6243` |
| 3 | `#a2734f` | `#ae7c57` |
| 4 | `#82573a` | `#cb9a72` |
| 5 (130%+) | `#5e3c27` | `#e6be9a` |

  Light (on card `#ffffff`): lightness monotone, adjacent ΔL ≥ 0.06, light-end contrast 2.03:1, hue spread 11°: all pass. Dark (on card `#1f1d1a`, low step = darkest): monotone, ΔL ≥ 0.06, low-end contrast 2.16:1, hue spread 12°: all pass. The first proposed ramp (`#F0E6DD` … `#774B33`) failed the light-end contrast check (1.23:1), so step 1 was darkened. Day-number text uses `foreground` on steps 1–2 and `card` on steps 3–5 (≥ 4.1:1 in both themes); the date is also in the cell's label.

## 7. Alternatives considered

- **Recharts / visx:** faster for standard charts, but the striped split bar, whiskers, dashed "Not logged" slots, and the calendar heatmap all need custom SVG anyway.
- **Transparency or a second color for AI-only kcal:** rejected (see §6.1).
- **Shading the area above the goal:** rejected; the goal is a reference line, and over goal is not an error.
- **Lightest heat color for unlogged days:** rejected; it would read as low intake (ADR-0005).

## 8. Testing

Vitest + Testing Library: heatmap binning at 70/90/110/130, cell states (unlogged has no color step and a dashed outline, future cells are not focusable or tappable, today has a ring), drill-down from a cell, paging; split bar widths (checked vs. AI-only proportional, 2 px gap), range whisker and goal tick; neutral over-goal in the hero; meal detail sort order and linked highlighting; week title for current vs. past weeks.

Still to cover: aggregation correctness in the backend (incl. goal changes mid-week), and refresh after an edit or delete.

## 9. Open questions

| # | Question |
|---|---|
| M4-Q1 | Which charting library? **Resolved:** D3 scales + React SVG (§6.1). |
| M4-Q2 | Is `/analytics/history` needed for the MVP? **Resolved:** yes, for the calendar heatmap (§6.6). |
| M4-Q3 | Should the week start on Monday or Sunday, and should it be a user setting? Currently Monday everywhere; a setting is open. |
