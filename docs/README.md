# Intelligent Meal Logging: Documentation

Design and engineering documentation for the Intelligent Meal Logging application.

**Statuses:** `Planned` (not started) → `Skeleton` (context filled in; owner to complete) → `Draft` (under discussion) → `Accepted` (agreed; change through review) → `Superseded`.

## Index

| Area | Document | Status | Owner |
|---|---|---|---|
| **Overview** | [Product brief](00-overview/product-brief.md) | Draft | Charlie |
| | [Glossary](00-overview/glossary.md) | Draft | Charlie |
| | [Team and ownership](00-overview/team-and-ownership.md) | Accepted | All |
| **Requirements** | `01-requirements/user-stories.md`: epics, stories, acceptance criteria | Planned | All |
| | `01-requirements/user-flows.md`: end-to-end task flows | Planned | Clark |
| | `01-requirements/non-functional.md`: latency, privacy, accessibility, cost | Planned | Charlie |
| **Architecture** | [System architecture](02-architecture/system-architecture.md): components, deployment, key sequences | Draft | Charlie |
| | [Tech stack](02-architecture/tech-stack.md) | Accepted | Charlie |
| **Module design** | [M1 Meal recognition & estimation](03-design/m1-meal-recognition.md) | Draft | Charlie |
| | [M2 Clarification & review](03-design/m2-clarification-review.md) | Skeleton | Clark |
| | [M3 Meal management & persistence](03-design/m3-meal-management.md) | Skeleton | Yi-Wei |
| | [M4 Visualization & history](03-design/m4-visualization.md) | Skeleton | Xiaochuan |
| | [M5 Recommendations & chat](03-design/m5-recommendations-chat.md) | Skeleton | Zach |
| **Data** | [Data model](04-data/data-model.md): ERD, tables, RLS | Draft | Yi-Wei |
| **API** | [API conventions](05-api/api-conventions.md) | Accepted | Charlie |
| | [API reference](05-api/api-reference.md) | Draft | All |
| **UX** | `06-ux/screen-inventory.md` | Planned | Xiaochuan |
| | `06-ux/ui-guidelines.md`: uncertainty cues, accessibility, tone | Planned | Clark |
| **Engineering** | [Repo structure](07-engineering/repo-structure.md) | Accepted | Charlie |
| | [Dev workflow](07-engineering/dev-workflow.md): branching, PRs, commits | Accepted | Charlie |
| | [Environment setup](07-engineering/environment-setup.md) | Draft | Yi-Wei |
| | [Testing strategy](07-engineering/testing-strategy.md) | Draft | All |
| **Evaluation** | `08-evaluation/usability-study-plan.md` | Planned | Zach |

## Architecture Decision Records

| ADR | Decision | Status |
|---|---|---|
| [0001](adr/0001-mobile-first-web-spa.md) | Build a mobile-first web SPA instead of native apps | Accepted |
| [0002](adr/0002-google-oauth-via-supabase.md) | Require sign-in with Google through Supabase Auth | Accepted |
| [0003](adr/0003-llm-nutrition-estimation.md) | Estimate calories and macros with the LLM | Accepted |
| [0004](adr/0004-no-numeric-confidence.md) | Communicate uncertainty with plain-language review cues | Accepted |
| [0005](adr/0005-assume-days-fully-logged.md) | Assume logged days are complete; no daily-completeness tracking | Accepted |
| [0006](adr/0006-user-selectable-analysis-model.md) | Let users choose the analysis model from a server-side allowlist | Accepted |

New ADRs use the [template](adr/0000-template.md).

## Writing conventions

- Write in English. Use the terms in the [glossary](00-overview/glossary.md).
- Start each document with a metadata table (status, owner, last updated).
- Design docs follow: Context → Goals / Non-goals → Design → Alternatives → Open questions.
- Record any decision that is hard to reverse, or that changes a source document, as an ADR.
