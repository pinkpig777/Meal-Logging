# M2 Design: Intelligent Clarification & Meal Review

| | |
|---|---|
| **Status** | Draft: skeleton, owner to complete |
| **Owner** | Clark Wu |
| **Reviewers** | Charlie Chiu (M1), Yi-Wei Chang (M3) |
| **Last updated** | 2026-10-21 |
| **Related** | ADR-0004, [M1 design](m1-meal-recognition.md), [API reference §4](../05-api/api-reference.md#4-m2-clarification-and-review), [Glossary](../00-overview/glossary.md) |

> Sections marked **[Owner]** are for Clark to complete. Everything else is fixed context from shared decisions.

## 1. Context

M1 returns a draft meal whose items carry **uncertain attributes**. Each attribute has a reason, a question, 2–4 options with precomputed nutrition, and an `impact_kcal`. M2 decides **which attributes to ask about**, presents them, applies the answers, and provides the editable review screen that ends in confirmation.

## 2. Responsibilities

From the Task & Team document:

- Analyze uncertainty about food identity, portions, and preparation.
- Define rules for selecting high-impact clarification questions.
- Present targeted questions with structured answer options; implement the question UI.
- Support quick replies, manual edits, "Not sure", and "Something else".
- Update drafts after corrections; coordinate recalculation with M1.
- Distinguish AI-generated from user-corrected information.
- Build the editable food-item review screen.

## 3. Interfaces

| Direction | Interface | Notes |
|---|---|---|
| In (from M1) | `clarification.service.select_questions(meal) -> meal` | Called during analysis; sets `asked` on attributes |
| Out (API) | `POST /meals/{id}/clarify`, `PATCH /meals/{id}/draft`, `POST /meals/{id}/items` | See API reference §4 |
| Out (to M1) | `recognition.service.reestimate_item(...)` | For "Something else" answers and added items without nutrition |
| Out (to M3) | Repository functions for drafts | M2 does not write tables directly |
| UI | `/meals/:id/review` (`web/src/features/review/`) | |

## 4. Fixed constraints

- No numeric confidence. Use status label + reason + icon; color is only supplementary (ADR-0004).
- "Not sure" leaves the attribute unresolved and its review cue visible. It is never treated as confirmation.
- Every item stays editable, whether or not a question was asked.
- Answering an option applies its precomputed nutrition without an LLM call (ADR-0003).
- Portion edits scale nutrition by grams on the server.
- Provenance (`source`) must be visible to the user: AI estimate vs. adjusted by you.

## 5. Starter-code baseline

The starter policy (`api/app/modules/clarification/policy.py`):

1. Sort all attributes by `impact_kcal`, descending.
2. Ask the top 2 with `impact_kcal ≥ 50`.
3. Show all others as review cues only.

The review page renders items, cues, question cards with chips, portion editing, removal, and Confirm.

## 6. Design **[Owner]**

### 6.1 Question selection policy

Points to address:
- Inputs beyond `impact_kcal`: attribute type (identity before portion?), item share of the meal's calories, conflicting candidates, image issues.
- Maximum questions per meal, and whether the limit adapts (e.g., fewer for text-only input).
- Ordering of questions, and whether answers to one question can make another unnecessary.
- How the policy is evaluated (ties to the usability study: question count, share of questions that changed the estimate).

### 6.2 Review screen interaction

Points to address:
- Layout: photo, item list, questions (inline on items vs. a stacked card flow).
- How review cues, estimate ranges, and provenance appear on each item.
- Editing affordances: portion chips vs. stepper vs. free entry; renaming an item; adding an item.
- What happens visually when an answer changes values (e.g., the range narrows).
- Confirm: enabled even with unresolved attributes? Any summary before confirming?

### 6.3 "Something else" and re-estimation UX

Points to address: loading state for a single item, failure fallback, undo.

### 6.4 Clarification history

The Task & Team document lists "Implement clarification history". Define what is shown and where (e.g., on the meal detail page: "You changed preparation from Grilled to Fried").

## 7. Alternatives considered **[Owner]**

## 8. Testing **[Owner]**

At minimum, cover: policy ranking unit tests, applying each answer kind, portion scaling, the state-transition guard (clarifying a confirmed meal → 409), and review-page interaction tests.

## 9. Open questions

| # | Question |
|---|---|
| M2-Q1 | Should questions appear before the full item list, or inline on it? |
| M2-Q2 | Can a user confirm with unresolved, asked questions? |
| M2-Q3 | Should a correction teach future analyses (e.g., "my rice is usually 1.5 cups")? The Phase 2 report proposed permission-based reuse of corrections. |
