# Glossary

| | |
|---|---|
| **Status** | Draft |
| **Last updated** | 2026-10-21 |

Use these terms consistently in docs, code, UI copy, and API names. When a code identifier differs from the term, it is shown in `code`.

## Meals and logging

| Term | Definition |
|---|---|
| **Meal** (`meal`) | One eating occasion logged by the user, such as lunch or a post-workout snack. Contains one or more meal items. |
| **Meal item** (`meal_item`) | One food in a meal at the granularity a user would name it, such as "chicken burrito" or "white rice". |
| **Add-on** (`kind = addon`) | A calorie-dense sauce, dressing, oil, or topping listed as its own item so it can be reviewed separately, e.g. "ranch dressing, ~2 tbsp". |
| **Draft** (`status = draft`) | A meal that has been analyzed but not yet confirmed. Drafts never appear in analytics, suggestions, or chat. |
| **Confirmed meal** (`status = confirmed`) | A meal the user has accepted. Confirmation means the user approved the record, **not** that the values are accurate or measured. |
| **Analyze** | The step that sends a photo and/or text to the LLM and returns a draft. |
| **Re-estimate** | Asking the LLM to re-estimate one item after a change the draft cannot absorb locally, such as a new food identity. |
| **Portion** | The amount of a meal item, expressed in a familiar unit (cup, piece, slice) and an estimated weight in grams. |

## Uncertainty and clarification

| Term | Definition |
|---|---|
| **Estimate** | Any nutrition value produced by the system. All calories and macros are estimates. |
| **Uncertain attribute** | A property of a meal item the system cannot determine reliably: identity, portion, preparation, or a hidden ingredient. |
| **Review cue** | A plain-language label plus reason shown on an item or attribute, e.g. *"Portion: needs review — scale is unclear."* |
| **Clarification** (`clarification`) | A targeted question about one uncertain attribute of one meal item. |
| **Quick reply** | A one-tap answer option for a clarification. |
| **Not sure** | A reply that leaves the attribute unresolved. It is **not** treated as confirming the AI's guess. |
| **Something else** | A reply that lets the user type or choose an answer not in the options. |
| **Impact** | How much an answer could change the item's nutrition estimate. Used to decide which clarifications to ask. |

## Provenance

| Term | Definition |
|---|---|
| **Provenance** (`source`) | Where an item's current values came from. |
| `ai` | Produced by the LLM and not changed by the user. |
| `ai_clarified` | Produced by the LLM, then updated by the user's answer to a clarification. |
| `user_edited` | Directly edited by the user. |
| `user_added` | Added manually by the user. |

## Goals and analytics

| Term | Definition |
|---|---|
| **Macros** | Protein, carbohydrates, and fat, in grams. |
| **Goal** (`user_goal`) | A user-selected daily target for calories, protein, carbs, and fat. Goals are self-selected, not prescribed, and kept as history. |
| **Local date** (`local_date`) | The calendar date of a meal in the user's time zone. All daily aggregation uses local date. |
| **Logged day** | A day with at least one confirmed meal. Assumed to be fully logged and compared against that day's goal (ADR-0005). |
| **Unlogged day** | A day with no confirmed meals. Intake is unknown, **never zero**. |
| **Backfill** | Logging a meal for a past date. |
| **Effective goal** | The goal in effect on a given date: the most recent goal whose `effective_from` is on or before that date. |
| **Meal contribution** | The share of a day's total calories or a macro that comes from one meal. |

## Suggestions and chat

| Term | Definition |
|---|---|
| **Suggestion** (`recommendation`) | A meal or snack idea tied to one observed goal-related pattern. |
| **Evidence** | The dates, meals, and values that justify a suggestion. Shown under "Why this suggestion". |
| **Suggestion feedback** | The user's response to a suggestion: `useful`, `not_for_me`, or `already_do`. |
| **Grounded chat** | Chat whose answers use only the user's confirmed meals, goals, and permitted preferences. |
| **Hypothetical meal** | A meal discussed in chat or suggestions that has not been logged. It never enters meal history. |

## Avoided terms

| Avoid | Use instead | Reason |
|---|---|---|
| "Feedback" (ambiguous) | **Review** (correcting a draft), **Insights** (patterns), **Suggestions** (recommendations), **Suggestion feedback** (user ratings) | The source documents used "feedback" for three different features. |
| "Confidence %", "accuracy" | **Review cue**, **likely match**, **needs review** | Model confidence is not calibrated (ADR-0004). |
| "Good / bad food", "cheat meal" | Neutral descriptions of recorded values | Avoid judgmental framing. |
