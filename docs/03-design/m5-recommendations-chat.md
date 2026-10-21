# M5 Design: Personalized Recommendations & Grounded Chat

| | |
|---|---|
| **Status** | Draft: skeleton, owner to complete |
| **Owner** | Zach Pena |
| **Reviewers** | Charlie Chiu (LLM client), Xiaochuan Ge (M4) |
| **Last updated** | 2026-10-21 |
| **Related** | ADR-0003, ADR-0005, [API reference §7](../05-api/api-reference.md#7-m5-suggestions-and-chat), [Glossary](../00-overview/glossary.md) |

> Sections marked **[Owner]** are for Zach to complete. Chat is **in scope only if time allows** (product brief Q3).

## 1. Context

Confirmed meals and goals reveal patterns, such as protein below goal on most logged days. M5 turns **one clear pattern** into a small number of familiar meal or snack ideas. Each idea comes with the evidence behind it, and the user can respond to it. Optional grounded chat answers questions such as "Would a burrito fit my goals tonight?" using only stored records.

## 2. Responsibilities

From the Task & Team document:

- Analyze confirmed meal history against goals; rules for selecting relevant patterns.
- Generate personalized suggestions with OpenAI; explain them with evidence from saved meals.
- Recommendation card UI and feedback controls.
- Chat interface grounded in confirmed history, goals, and preferences *(TBD)*.
- Keep hypothetical foods separate from logged meals.
- Coordinate usability testing and evaluate suggestion usefulness.

## 3. Interfaces

| Direction | Interface |
|---|---|
| API | `GET /recommendations`, `POST /recommendations/feedback`, `POST /chat` |
| Data in | Confirmed meals and `daily_totals` (via M3 and M4 services), goals, `profiles.dietary_restrictions`, `suggestion_feedback` |
| LLM | `services/llm.structured(prompt, schema)`; never import OpenAI directly |
| UI | `/suggestions`, `/chat` (`web/src/features/suggestions/`) |

## 4. Fixed constraints

- **Pattern detection is rule-based and computed from stored data.** The LLM only phrases ideas for a pattern the rules already selected. Numbers shown to users come from the data, not from the LLM.
- ADR-0005: days are assumed fully logged, but partial logging is possible. Phrase patterns as "on the days you logged", and require a minimum number of logged days (starter: 3).
- Missing logs are never evidence of under-eating.
- Neutral, non-judgmental language; no medical advice.
- Hypothetical meals (suggestions, chat) never enter meal history.
- Feedback options: **Useful**, **Not for me**, **I already do this**.
- Proactive notifications and lapse prediction are out of scope.

## 5. Starter-code baseline

`GET /recommendations` returns `insufficient_history` below 3 logged days. Otherwise it returns one placeholder suggestion from a simple rule, with evidence. Feedback is stored. Chat returns a placeholder response.

## 6. Design **[Owner]**

### 6.1 Pattern rules

Points to address: candidate patterns (macro below or above goal on N of M logged days, meal-timing patterns, etc.), the rolling window, thresholds, how one pattern is picked, and how `suggestion_feedback` affects future picks.

### 6.2 Suggestion generation

Points to address: prompt inputs (pattern, restrictions, foods the user commonly logs), output schema, the number of ideas (Phase 2: two), and caching (generate on request vs. once per day).

### 6.3 "Why this suggestion"

Points to address: which evidence is shown (dates, meals, values), links into meal records, and caveats.

### 6.4 Grounded chat (if in scope)

Points to address: the retrieval strategy (which records go into context), arithmetic done in code rather than by the LLM, how hypothetical meals are marked, refusal boundaries, and persistence (data model D1).

## 7. Evaluation plan contribution **[Owner]**

Zach coordinates `08-evaluation/usability-study-plan.md` (planned): tasks, measures, and comparison conditions.

## 8. Testing **[Owner]**

## 9. Open questions

| # | Question |
|---|---|
| M5-Q1 | Is chat in scope for the final demo? |
| M5-Q2 | How many logged days are needed before suggestions appear? |
| M5-Q3 | Are suggestions regenerated on every visit or cached per day? |
