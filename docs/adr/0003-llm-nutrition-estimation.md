# ADR-0003: Estimate calories and macros with the LLM

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-10-21 |
| **Deciders** | Charlie Chiu |

## Context

The source documents disagree:

- The **Phase 2 report** proposed calculating nutrition from matched food records and serving conversions (USDA FoodData Central) instead of accepting model-generated totals.
- The **Task & Team** document plans to "estimate portions and macronutrients directly with OpenAI."

Database matching gives traceable values, but it adds a matching step for every item. That step is hard for mixed, restaurant, and culturally specific dishes, and it needs its own correction UI. The project's focus is the assisted-logging experience and nutrition history, not nutrient-database engineering.

## Decision

The multimodal LLM estimates **portion (unit and grams), calories, protein, carbohydrates, and fat per meal item** as part of the structured analysis response. No food-composition database is used in the MVP.

To control cost, latency, and inconsistency:

- **Portion-only changes are scaled locally**, linearly by grams, without a model call.
- **Clarification options carry their own nutrition estimates**, produced in the same analysis call, so answering a quick reply updates values without another model call.
- **Re-estimation** is called only for one item, and only when its identity or an attribute changes to a value the draft did not anticipate (e.g., "Something else").
- Stored estimates are never silently recomputed. A confirmed meal changes only when the user edits it.
- Each analysis records the model and prompt version that produced it.

## Alternatives considered

| Option | Pros | Cons |
|---|---|---|
| LLM estimation (chosen) | One call per meal; handles mixed and unfamiliar dishes; keeps effort on the core user experience | Values not traceable to a reference source; may vary across calls; accuracy unverified |
| USDA FoodData Central lookup (Phase 2 report) | Traceable, reproducible per-100 g values | Food matching is error-prone for mixed dishes; extra correction UI; more engineering |
| Hybrid (LLM decomposes, USDA computes) | Traceability for common foods | Complexity of both approaches |

## Consequences

- All nutrition values are labeled as **estimates** throughout the UI (see ADR-0004).
- The Phase 2 report's statements about nutrition-source IDs and database mapping no longer apply. The final report must explain this change.
- Evaluation must measure estimation error separately, against reference portions where available. User approval is not ground truth.
- A food-database lookup can be added later behind the same item schema if traceability becomes a requirement.
