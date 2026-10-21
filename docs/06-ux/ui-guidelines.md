# UI Guidelines

| | |
|---|---|
| **Status** | Accepted |
| **Owner** | Charlie Chiu |
| **Applies to** | Everything in `web/` |
| **Last updated** | 2026-10-21 |
| **Related** | ADR-0004 (uncertainty cues), ADR-0005 (unlogged days), ADR-0007 (shadcn/ui), [Glossary](../00-overview/glossary.md) |

The app should feel **clean, warm, and calm**: a health app people open three times a day, not a dashboard they study. These rules keep five people's screens looking like one product. If a rule blocks you, propose a change in a PR to this file; do not work around it locally.

## 1. Principles

1. **Numbers first.** The answer to "how am I doing today?" is visible without scrolling or tapping.
2. **Honest estimates.** Every value is an estimate. Show ranges and review cues where they exist, and never fake precision (ADR-0004).
3. **Neutral, never judgmental.** Food, intake, and users are never "good" or "bad". Going over a goal is information, not an error.
4. **One primary action per screen.** Everything else is secondary or tertiary.
5. **Thumb-first.** Primary actions sit in the lower half of the screen. Touch targets are at least 44 × 44 px.
6. **Calm surfaces.** Use generous spacing, soft cards, and few borders. Color is spent on data and the one primary action.

## 2. Theme and color tokens

Light and dark themes follow the system setting (`prefers-color-scheme`). Both are designed, not inverted. **Never use raw hex or Tailwind palette classes (`bg-orange-500`) in components; use the semantic tokens below.**

### 2.1 Surface and text

| Token | Light | Dark | Use |
|---|---|---|---|
| `background` | `#fbf9f6` | `#161412` | Page background (warm off-white / warm near-black) |
| `card` | `#ffffff` | `#1f1d1a` | Cards, sheets |
| `muted` | `#f3efe9` | `#2a2724` | Subtle fills: chips, progress tracks, inputs |
| `border` | `#ebe5dc` | `#34302b` | Hairlines, card outlines in dark mode |
| `foreground` | `#2a2622` | `#f3efe9` | Primary text, numbers |
| `muted-foreground` | `#6b645c` | `#b8b0a5` | Secondary text, labels, captions |
| `subtle-foreground` | `#8f877d` | `#8f877d` | Placeholder and disabled text only (not for information) |

### 2.2 Brand and interaction

| Token | Light | Dark | Use |
|---|---|---|---|
| `primary` | `#c2532a` | `#e8754a` | The one primary action per screen; calorie accent; active nav |
| `primary-foreground` | `#ffffff` | `#1f1d1a` | Text on `primary` (4.6:1 light, 5.7:1 dark) |
| `primary-soft` | `#fbe9e1` | `#3a2a22` | Selected chip, highlighted row |
| `ring` | `#c2532a` | `#e8754a` | Focus ring (2 px, offset 2 px) |
| `attention` | `#b7791f` | `#e0a43a` | Review cues ("needs review"); always with icon + label |
| `destructive` | `#c0392b` | `#e5675b` | **Only** for destructive actions (delete) and system errors; never for food or intake |

### 2.3 Data colors

Each nutrient has one color everywhere: tiles, rings, charts, legends. These colors identify the nutrient; they never carry judgment.

| Token | Light | Dark | Text-safe variant (light) |
|---|---|---|---|
| `kcal` | `#c2532a` (= primary) | `#e8754a` | `#c2532a` |
| `protein` | `#2a78d6` | `#3987e5` | `#1f5fae` |
| `carbs` | `#eda100` | `#c98500` | `#8a5d00` |
| `fat` | `#e87ba4` | `#d55181` | `#b0386a` (dark: `#e87ba4`) |

Validation, with the data-viz palette validator, on the `background` surface:

- **Protein / carbs / fat:** pass the lightness, chroma, CVD-separation, and normal-vision checks for **all pairs** in both modes. Worst CVD ΔE is 13.0 (light) and 13.2 (dark).
- **Light-mode contrast:** carbs and fat are below 3:1, so a nutrient is **always labeled with text** (name or initial), never identified by color alone.
- **Text:** when a number or label must be colored, use the text-safe variant. Default to `foreground` text with a colored mark beside it.

### 2.4 Status colors are reserved

`attention` and `destructive` mean *system state* (review needed, delete, error). Never use them for data series, intake levels, or "over goal".

## 3. Typography

System font stack: `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`. It looks native on iOS and Android and loads instantly.

| Role | Size / line height | Weight | Example |
|---|---|---|---|
| `display` | 40 / 44 | 700 | Today's calories (hero number) |
| `title` | 22 / 28 | 700 | Page title |
| `heading` | 17 / 24 | 600 | Section and card headings |
| `body` | 16 / 24 | 400 | Default text; inputs are always ≥ 16 px (prevents iOS zoom) |
| `label` | 14 / 20 | 500 | Buttons, chips, form labels |
| `caption` | 13 / 18 | 400 | Meta text, units, footnotes; minimum size for any text |

- Use sentence case everywhere ("Log a meal", not "Log A Meal"). No all-caps, except single-letter macro initials.
- Use `tabular-nums` for numbers that align in columns (tables, axis ticks, lists of kcal). Hero numbers use default figures.
- Units are smaller and in `muted-foreground`: **1,240** kcal.

## 4. Layout and spacing

| Token | Value | Use |
|---|---|---|
| Spacing scale | 4 px base: 4, 8, 12, 16, 20, 24, 32, 40 | Only these values |
| Page gutter | 16 px | Left/right padding on every page |
| Card padding | 16 px (20 px for hero cards) | |
| Section gap | 24 px | Between sections on a page |
| Item gap | 12 px | Between cards in a list |
| Radius | card 20 px · control 12 px · chip/pill 999 px · small 8 px | |
| Shadow (light) | `0 1px 2px rgb(42 38 34 / 0.04), 0 4px 12px rgb(42 38 34 / 0.05)` | Cards only |
| Shadow (dark) | none; use a 1 px `border` | |

- Design at **375 px** wide and check 360 px and 430 px. Content max width 560 px, centered on larger screens.
- The bottom navigation is fixed: **Today · History · Log (raised, center) · Suggestions · Settings**. Page content has bottom padding of nav height + safe-area inset, so nothing is ever hidden behind it. Primary page actions sit **above** the nav (sticky footer bar), never under it.
- Respect `env(safe-area-inset-*)`.
- No horizontal scrolling, except intentional carousels with visible overflow cues.

## 5. Components

### 5.1 Source of components

- Base components come from **shadcn/ui** (ADR-0007). They live in `web/src/components/ui/`, are generated with `npx shadcn@latest add <name>`, and are themed by our tokens.
- App-specific composites (e.g. `MacroTile`, `ReviewCue`, `MealRow`) live in `web/src/components/`.
- Feature-specific components live in their feature folder. If two features need it, move it to `components/`.
- Before building a new primitive, check shadcn/ui. Do not add another component library.

### 5.2 Core components and rules

| Component | Rules |
|---|---|
| **Button** | Variants: `default` (primary, max one per screen), `secondary`, `ghost`, `destructive` (delete only). Height 48 px for page actions, 40 px inline. Full-width at the bottom of forms and flows. Label = verb ("Confirm meal"). |
| **Card** | `card` background, 20 px radius, 16 px padding, soft shadow (light) or border (dark). Tappable cards show a chevron and have an active state. |
| **Chip** (quick reply, filters) | Pill shape, 40 px tall, `muted` fill; selected = `primary-soft` fill + `primary` outline + `primary` check icon, with text in `foreground` (primary text on primary-soft is below 4.5:1). Wrap to multiple lines; never truncate an option. |
| **Bottom sheet** (shadcn `Drawer`) | Use for editing an item, choosing a portion, and confirming a delete. Has a drag handle, a title, and one primary action. |
| **Dialog** | Avoid on mobile; prefer a bottom sheet. |
| **Progress** | Linear bars or rings toward a goal. Track = `muted`; fill = nutrient color. Above 100 %, the bar stays full and the text says "120 kcal over" in `muted-foreground`, with no red. |
| **Toast** (shadcn `Sonner`) | Brief confirmation ("Meal saved"), with an undo action where possible. Bottom, above the nav. |
| **Skeleton** | Loading state for content with a known shape. Use a spinner only for actions (analyzing a meal). |
| **Icons** | `lucide-react`, 20 px (16 px inline with text), stroke 1.75, `currentColor`. Icon-only buttons need `aria-label`. |
| **Tabs / segmented control** | For switching views of the same data (Day / Week). Maximum 3 segments. |

## 6. Product patterns

### 6.1 Numbers and units

| Value | Format | Example |
|---|---|---|
| Calories | Integer with thousands separator | 1,240 kcal |
| Macros | Integer grams | 82 g |
| Range | En dash, unit once | 520–680 kcal |
| Unknown | Em dash, never 0 | — |
| Percentages | Only goal progress, never confidence or share-of-day | 62% of goal |

Use the helpers in `web/src/lib/format.ts`; do not format numbers inline.

### 6.2 Estimates and uncertainty (ADR-0004)

- Totals show "est." or a footnote ("All values are estimates") once per screen, not on every number.
- When a range exists, show it: **520–680 kcal**. When it narrows after an answer, animate the change briefly.
- **Review cue** = `attention` icon (`CircleAlert`) + attribute label + status + short reason: "Portion · needs review: bowl size is hard to judge". The text stays in `foreground`/`muted-foreground`; only the icon uses `attention` (attention text is below 4.5:1). Lower-priority cues ("estimated", "likely match") use an `Info` icon in `muted-foreground`. Never a percentage, never color alone.
- **Provenance:** items changed by the user show a small "Adjusted by you" label (`muted-foreground`, `UserPen` icon). AI values have no badge, because that is the default.

### 6.3 Goals and progress

- Progress compares intake with **that day's** goal.
- Over goal is not an error: no red, no warning icon. Use neutral text ("120 kcal over goal").
- Remaining amounts are phrased neutrally: "860 kcal left", not "You can still eat 860 kcal".

### 6.4 Unlogged days (ADR-0005)

- An unlogged day is **not** a zero. In lists and charts, show it as an empty slot with a dashed outline, labeled "Not logged".
- Never draw an unlogged day as a zero-height bar or a dip in a line; break the line instead.
- Future days are labeled "Upcoming" and are visually quieter than unlogged days.

### 6.5 States

Every screen that loads data has four designed states:

| State | Pattern |
|---|---|
| Loading | Skeleton matching the layout |
| Empty | Short sentence + one action ("No meals yet today. Log a meal") |
| Error | Plain message from the API error + Retry; never a raw code or stack trace |
| Content | The normal view |

### 6.6 Copy and tone

- Short, plain, friendly English. Second person ("your goal"). No exclamation marks in errors.
- Use glossary terms exactly: meal, item, review, suggestion, logged day.
- Never: "good/bad food", "cheat meal", "guilt", "failed your goal", "healthy/unhealthy" as labels.

## 7. Charts

The visualization owner chooses the chart library and designs the charts (M4 design doc). These rules apply whatever library is used:

- Use the data color tokens (§2.3) through CSS variables; never hard-code series colors.
- Never use a dual axis. Calories and grams go in separate charts or are switched with a control.
- Thin marks: 4 px rounded bar ends, 2 px lines, a 2 px surface gap between adjacent bars or stacked segments.
- Gridlines are hairline `border`; axis text is `caption` in `muted-foreground`.
- For two or more series, show a legend and direct labels. Text uses text tokens, not series colors.
- Every chart has a touch interaction (tap a bar or point → tooltip or drill-down). There are no hover-only details.
- Show the goal as a dashed reference line in `muted-foreground`, not a colored zone.
- Unlogged days follow §6.4.

## 8. Accessibility

- Text contrast is at least 4.5:1 (3:1 for ≥ 18 px bold). Non-text UI contrast is at least 3:1.
- Every interactive element has a visible focus ring (`ring` token).
- Touch targets are at least 44 × 44 px, with at least 8 px between adjacent targets.
- Meaning never relies on color alone: nutrients carry labels, status carries an icon and text.
- Respect `prefers-reduced-motion`: disable non-essential animation.
- Sheets and dialogs trap focus and close with Esc or a swipe; shadcn components handle this, so do not replace them with custom divs.
- Images have `alt` text; decorative icons have `aria-hidden`.

## 9. Motion

- Durations: 150 ms (press, toggle), 200–250 ms (sheet, page transition), 400 ms max (number count-up).
- Easing: `ease-out` for entering, `ease-in` for leaving. No bounce or spring overshoot.
- Animate values only when they change because of a user action (e.g., a range narrowing after an answer).

## 10. Implementation

| What | Where |
|---|---|
| Color, radius, and shadow tokens | `web/src/index.css`: CSS variables under `:root` and `.dark` / `prefers-color-scheme`, mapped to Tailwind with `@theme inline` |
| shadcn/ui config | `web/components.json` |
| shadcn components | `web/src/components/ui/` (generated; edit only to apply tokens or fix bugs) |
| App composites | `web/src/components/` |
| Formatting helpers | `web/src/lib/format.ts` |

Add a component: `cd web && npx shadcn@latest add <component>`.

## 11. UI review checklist (for every PR that touches UI)

- [ ] Screenshots at 375 px in **light and dark** in the PR description
- [ ] Only semantic tokens; no raw hex or Tailwind palette colors
- [ ] One primary action; touch targets ≥ 44 px; nothing hidden behind the bottom nav
- [ ] Loading, empty, and error states designed
- [ ] Numbers formatted with `format.ts`; unknown values shown as —, never 0
- [ ] No confidence percentages; review cues have icon + label + reason
- [ ] Neutral copy; glossary terms used
- [ ] Keyboard focus visible; icon-only buttons have `aria-label`
