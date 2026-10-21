# Team and Ownership

| | |
|---|---|
| **Status** | Accepted |
| **Last updated** | 2026-10-21 |

This document follows the **Task & Team** planning document, which is authoritative for module ownership. The work plan in Section 6 of the Phase 2 report is superseded.

## Modules

| Module | Owner | Area | Deliverable |
|---|---|---|---|
| **M1. Meal Recognition & Nutrition Estimation** | Charlie Chiu | Backend + AI integration, capture UI | Photo/text input → structured meal draft with estimated nutrition |
| **M2. Intelligent Clarification & Meal Review** | Clark Wu | Backend logic + frontend | AI-generated draft → clarified, editable draft |
| **M3. Meal Management & Data Persistence** | Yi-Wei Chang | Backend + database + frontend | Confirmed meal → persistent record with reliable retrieval and editing |
| **M4. Data Visualization & Historical Analysis** | Xiaochuan Ge | Frontend + analytics backend | Stored meals → interactive nutrition history dashboard |
| **M5. Personalized Recommendations & Grounded Chat** | Zach Pena | Backend AI + frontend + evaluation | Meal history + goals → explainable suggestions and chat |

## API ownership

| Module | Endpoints |
|---|---|
| M1 | `POST /meals/analyze`, `POST /meals/reestimate` |
| M2 | `POST /meals/{id}/clarify`, `PATCH /meals/{id}/draft` |
| M3 | `POST /meals/{id}/confirm`, `GET /meals`, `GET /meals/{id}`, `PATCH /meals/{id}`, `DELETE /meals/{id}`, `GET /goals`, `PATCH /goals` |
| M4 | `GET /analytics/daily`, `GET /analytics/weekly`, `GET /analytics/history` |
| M5 | `GET /recommendations`, `POST /recommendations/feedback`, `POST /chat` |

Endpoint paths are provisional until `05-api/api-reference.md` is accepted.

## Shared responsibilities

| Area | Responsible | Accountable | Consulted |
|---|---|---|---|
| Shared data models (Meal, MealItem, Nutrition, UserGoal) | Yi-Wei | Yi-Wei | All |
| API contracts and conventions | All | Charlie | All |
| Shared LLM client (`services/llm`) | Charlie | Charlie | Clark, Zach |
| Authentication (Google OAuth) | Yi-Wei | Yi-Wei | Charlie |
| App shell, navigation, design system | All | Xiaochuan | All |
| Mock data and LLM fixtures for parallel development | Charlie | Charlie | All |
| Integration testing | All | All | — |
| Usability testing and evaluation | Zach | Zach | All |
| Documentation | All (each owns their module's design doc) | Charlie | — |

## Cross-module contracts

| Producer → Consumer | Contract |
|---|---|
| M1 → M2 | Draft schema, including uncertain attributes and per-option nutrition |
| M2 → M1 | Re-estimate request when a user's answer cannot be applied locally |
| M2 → M3 | Clarified draft ready for confirmation |
| M3 → M4, M5 | Confirmed meals and goal history |
| M4 → M3 | Navigation from a chart to a meal record for editing |
