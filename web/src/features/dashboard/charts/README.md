# charts/

D3-based chart building blocks for M4 (design: `docs/03-design/m4-visualization.md` §6).
D3 computes scales, bins, and layout; React renders the SVG. Colors are design
tokens referenced as `var(--token)`, so light and dark need no re-render.

| File                      | What it is                                                                                                       |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `SplitBar.tsx`            | One horizontal calorie bar: checked kcal solid, AI-only kcal striped (same hue), range whisker, dashed goal tick |
| `patterns.tsx`            | `<StripePattern>`: the diagonal "AI estimate" texture                                                            |
| `usePatternId.ts`         | Unique, `url()`-safe pattern ids per chart                                                                       |
| `Legend.tsx`              | `SplitBarLegend`: Checked · AI estimate · Range · Goal                                                           |
| `MealContributionBar.tsx` | Today: meals stacked toward the goal, tap a segment → meal                                                       |
| `MealItemsChart.tsx`      | Meal detail: items sorted by kcal, linked to the item list                                                       |
| `heatmap.ts`              | History heatmap model: % of goal bins, cell states, labels, summary                                              |
| `layout.ts`               | Pure helpers: range check, item sort, meal segment layout                                                        |
| `colors.ts`               | Token helpers, ink colors, `splitOf()` for `kcal_checked` / `kcal_ai_only`                                       |
| `geometry.ts`             | Bar path with a square baseline end and rounded data end; 2 px gap                                               |
| `useElementWidth.ts`      | Container width via ResizeObserver (charts draw at real pixel size)                                              |

Views that use them: `TodayPage` + `components/CalorieHero`, `WeekPage` / `WeekDayRow`,
`HistoryHeatmap` (rendered at the top of History), and `features/meals/MealDetailPage`.
