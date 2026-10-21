# ADR-0006: Let users choose the analysis model from a server-side allowlist

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-10-21 |
| **Deciders** | Charlie Chiu |

## Context

Meal analysis quality, latency, and cost differ across OpenAI models, and the best choice is not known yet. The team needs to compare models during development, demos, and evaluation without redeploying.

## Decision

Users choose the model that analyzes their meals on the **Settings** page.

- The backend exposes an **allowlist** of model IDs (`ANALYSIS_MODELS` env var) and a default (`ANALYSIS_MODEL_DEFAULT`). `GET /config/models` returns the allowlist with display labels.
- The choice is stored in `profiles.analysis_model`. `null` means "use the default".
- The backend rejects any model not in the allowlist and falls back to the default if a stored model is later removed.
- Each meal records the `model_version` that analyzed it, so results can be compared per model.
- Re-estimation of an item uses the model that analyzed the meal, for consistency within a meal.

## Alternatives considered

| Option | Pros | Cons |
|---|---|---|
| Fixed model in config | Simplest | Comparing models requires redeploying |
| Developer-only switch | Hides a technical choice from users | Hard to switch during demos and evaluation sessions |
| User setting with allowlist (chosen) | Easy comparisons; safe, because the server controls which models are allowed | Exposes a technical choice in the UI; needs plain labels |

## Consequences

- The Settings page shows model options with plain-language labels (e.g., "Faster", "More detailed"). Raw model IDs appear only as secondary text.
- Cost control relies on the allowlist; expensive models should not be added to it in deployed environments.
- Evaluation sessions should fix the model per condition and record it.
