# Product Brief: Intelligent Meal Logging

| | |
|---|---|
| **Status** | Draft |
| **Owner** | Charlie Chiu |
| **Contributors** | Clark Wu, Yi-Wei Chang, Xiaochuan Ge, Zach Pena |
| **Last updated** | 2026-10-21 |

## 1. Summary

Intelligent Meal Logging is a mobile-first web application that turns a meal photo or short text description into an editable nutrition record. The system drafts the record with a multimodal LLM. It asks only the few questions that would most change the estimate, and the user confirms the result. Confirmed meals feed interactive visualizations of calorie and macronutrient intake against the user's goals, along with explainable suggestions.

Two experiences define the product, and most design and engineering effort goes into them:

1. **Assisted logging.** The system decides *whether* and *what* to ask, communicates uncertainty honestly, and keeps the user in control of the final record.
2. **Nutrition history.** Users can understand intake against goals, see how certain the estimates are, and move from aggregate patterns to the concrete meals behind them.

## 2. Problem

Users who track macros, such as students who lift or play sports, log meals repeatedly. Conventional logging forces them to:

- search a food database and pick among near-duplicate entries,
- estimate serving sizes they never measured,
- remember hidden ingredients such as oil, sauces, and dressings.

Photo-based logging reduces typing, but recognition alone cannot see hidden ingredients or reliably establish physical portion size. Existing photo loggers usually show a single confident-looking number, so errors pass silently into trends. Most dashboards also show totals without saying how reliable they are, and they plot unlogged days as if the user ate nothing.

## 3. Target users

The target audience is not finalized. The working assumption is **university students and young adults (roughly 18–25) who exercise and track macronutrients.**

| Persona | Description | Key needs |
|---|---|---|
| **Gym-going student** | Lifts 3–5×/week, has a protein target, eats in dining halls, takeout, and simple home-cooked meals. | Fast logging between classes; reliable protein numbers; quick "how much protein do I have left today?" checks. |
| **Recreational athlete** | Plays a sport or runs; cares about having enough carbs and calories around training. | Weekly view of intake vs. goals; knowing which meals drove a high or low day. |

**Assumptions to validate:** users log from a phone, often in public, and value speed over precision. They know rough portions ("about a cup") but not weights.

## 4. Goals

### 4.1 Product goals

- **G1.** Log a typical meal with less effort than manual database entry.
- **G2.** Concentrate user attention on the corrections that matter most nutritionally.
- **G3.** Make estimate uncertainty visible and understandable without false precision.
- **G4.** Let users see intake vs. goals at day and week level, and drill down to individual meals.
- **G5.** Provide a small number of explainable, goal-related suggestions grounded in confirmed logs.

### 4.2 Areas of design depth

| Area | Where it appears | Examples of intended depth |
|---|---|---|
| Assisted logging | Clarification policy, review screen, uncertainty communication, provenance (AI vs. user-corrected), suggestion explanations | Ranking questions by expected nutrition impact; one-tap answers that update estimates instantly |
| Nutrition history | Daily dashboard, weekly trends, history drill-down, meal contribution, uncertainty encoding | Showing estimate ranges; distinguishing unlogged days from zero intake; linked views from week → day → meal |

## 5. Success metrics

These metrics support the usability evaluation (see `08-evaluation/usability-study-plan.md`, planned). They are not product KPIs.

| Metric | Linked goal |
|---|---|
| Time and interaction count to log a meal (vs. manual entry) | G1 |
| Number of clarification questions per meal; share of questions that changed the estimate | G2 |
| Successful correction of an intentionally wrong AI prediction | G2, G3 |
| User comprehension of uncertainty cues (which attribute needs attention, and why) | G3 |
| Success rate and time for "find a weekly pattern" and "find the meal behind a high day" tasks | G4 |
| Perceived usefulness of suggestions; whether users can explain why a suggestion appeared | G5 |

The project makes **no claims** about nutrient-estimation accuracy, time savings, or health outcomes until they are measured.

## 6. Scope

### 6.1 MVP

| Priority | Capability | Module |
|---|---|---|
| P0 | Sign in with Google | M3 |
| P0 | Photo or text meal input | M1 |
| P0 | AI-generated structured meal draft with estimated calories and macros | M1 |
| P0 | Targeted clarification questions with quick replies, "Not sure", and "Something else" | M2 |
| P0 | Editable review screen and final meal confirmation | M2, M3 |
| P0 | Meal history with edit and delete | M3 |
| P0 | User nutrition goals (calories, protein, carbs, fat) | M3 |
| P0 | Daily dashboard: intake vs. goals, meal contributions | M4 |
| P0 | Weekly trends with week → day → meal drill-down | M4 |
| P0 | Logging meals for past dates (backfill) | M1, M3 |
| P0 | Recommendation cards with "Why this suggestion" evidence and feedback controls | M5 |
| TBD | Grounded chat about meals and goals | M5 |

### 6.2 Non-goals

Not yet decided. The following are **candidates** for team discussion:

- Native iOS/Android apps (decided: web only; see ADR-0001)
- Barcode scanning and voice input
- Proactive notifications and lapse prediction
- Depth-camera, multi-view, or 3D portion reconstruction
- Micronutrients (vitamins, minerals, sodium, fiber)
- Social features, sharing, or coaching
- Medical or clinical dietary advice
- Offline logging

## 7. Constraints and assumptions

- **Team and timeline:** five students, one semester.
- **Platform:** mobile-first, web-based single-page application (ADR-0001).
- **Nutrition estimation:** calories and macros are estimated by the LLM, not computed from a food-composition database (ADR-0003). All values are presented as estimates.
- **Uncertainty communication:** no numeric confidence percentages (ADR-0004).
- **Missing data:** days are assumed to be fully logged (ADR-0005). A day with no confirmed meals is unlogged — unknown intake, never zero.
- **Tone:** feedback describes recorded data; it never labels foods or users as good or bad.
- **Cost:** LLM API usage must fit a student budget; the design should avoid unnecessary model calls.

## 8. Open questions

| # | Question | Owner | Status |
|---|---|---|---|
| Q1 | Finalize target audience and recruitment for usability tests | Zach | Open |
| Q2 | Agree on non-goals | All | Open |
| Q3 | Is grounded chat in scope for the final demo? | Zach | Open |
| Q4 | Hosting for frontend and backend | Yi-Wei | Open |

## 9. Source documents

- Phase 2 Project Report: problem framing, related work, design rationale
- Task & Team document: module ownership and task breakdown (authoritative for ownership)
- Feature brainstorm and literature notes
