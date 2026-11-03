# M3 Design: Meal Management & Data Persistence

| | |
|---|---|
| **Status** | Draft: skeleton, owner to complete |
| **Owner** | Yi-Wei Chang |
| **Reviewers** | Charlie Chiu, Xiaochuan Ge (M4) |
| **Last updated** | 2026-10-21 |
| **Related** | ADR-0002, ADR-0005, ADR-0006, [Data model](../04-data/data-model.md), [API reference §5](../05-api/api-reference.md#5-m3-meals-goals-profile) |

> Sections marked **[Owner]** are for Yi-Wei to complete. The schema itself is specified in the [data model](../04-data/data-model.md), which Yi-Wei also owns.

## 1. Context

M3 owns the system of record: authentication setup, the Postgres schema and RLS, photo storage, the meal lifecycle (draft → confirmed → edited/deleted), goals with history, and the user profile and settings. Every other module reads or writes meals through M3's repository.

## 2. Responsibilities

From the Task & Team document, updated by ADR-0005 (no daily-completeness tracking):

- Supabase Auth (Google), Postgres, and Storage setup.
- Shared entities: Meal, MealItem, Nutrition, UserGoal.
- Save and retrieve drafts and confirmed meals; final confirmation flow.
- Edit and delete historical meals; delete photos.
- User nutrition goals (with history) and profile preferences, including the analysis model (ADR-0006).
- Meal detail navigation; history list; backfill entry point.
- Keep nutrition values and history consistent (totals are derived by views).

## 3. Interfaces

| Direction | Interface |
|---|---|
| API | `POST /meals/{id}/confirm`, `GET /meals`, `GET/PATCH/DELETE /meals/{id}`, `DELETE /meals/{id}/photo`, `GET/POST /goals`, `GET/PATCH /me` |
| Python | `modules/meals/repository.py`: the only writer of meal, item, attribute, goal, and profile tables |
| UI | `/meals/:id`, `/history`, `/settings` (`web/src/features/meals/`) |
| DB | `supabase/migrations/`, `supabase/seed.sql` |

## 4. Fixed constraints

- RLS on every table; the API uses the caller's JWT. The service role is for admin tasks only.
- Edits overwrite values and bump `updated_at`; `ai_original` is never modified.
- Goals are insert-only, with same-day replacement.
- Unlogged days have no rows; nothing is stored as zero.
- Deleting a meal deletes its photo object.

## 5. Starter-code baseline

The migrations, seed data, repository CRUD, endpoints, and simple versions of the history, meal detail, and settings pages exist.

## 6. Design **[Owner]**

### 6.1 Confirmation flow

Points to address: what the user sees on confirm (summary? toast + navigate to Today?), and how edits to a confirmed meal are entered (reuse the review screen?).

### 6.2 History and backfill

Points to address: list vs. calendar navigation, how to log for a past date (from history vs. from capture's "Logged later?"), and empty states.

### 6.3 Settings page

Goal setup now starts with a summary of current daily targets and a **Set goals** action.
Users can enter targets manually or choose Standard, High protein, Low carb, or Keto.
Each preset starts from editable calories (the current goal, or a clearly editable 2,000-kcal
starting value when no goal exists). A preview converts calorie shares to rounded grams:

| Template | Protein | Carbs | Fat |
|---|---|---|---|
| Standard | 20% | 50% | 30% |
| High protein | 30% | 40% | 30% |
| Low carb | 30% | 25% | 45% |
| Keto | 20% | 5% | 75% |

These are editable product templates, not individualized dietary recommendations. The
standard split is within adult macronutrient distribution ranges; the restrictive templates
are user-selected alternatives, not recommended defaults. Keto does not promise ketosis.
Conversion uses 4 kcal/g for protein and carbohydrate and 9 kcal/g for fat. Rounded gram
targets can differ slightly in implied calories. An advisory flags larger differences in
the editable review form without preventing deliberate manual targets.

The optional calorie estimator uses adult Estimated Energy Requirement (EER) equations
published by [Health Canada](https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/dietary-reference-intakes/tables/equations-estimate-energy-requirement.html).
It takes age, the published equation's sex category, height, weight, and a four-stop activity
slider (Inactive, Low active, Active, Very active). The equations directly estimate daily
maintenance needs; there is no additional activity multiplier, automatic deficit, surplus,
or weight-change claim. Estimates round to 50 kcal and remain editable. The activity
descriptions summarize categories, not validated activity classification.

The calculator supports ages 19–100, heights 120–230 cm, and weights 35–300 kg (or equivalent
US inches/pounds); these are product input bounds, not clinical adequacy thresholds. Users
confirm they are 19+ and not pregnant/breastfeeding before using this general adult estimate.
Other users can enter their own targets. Blank or invalid inputs never produce a zero-calorie
recommendation. Unit switching converts entered measurements rather than relabeling them.
Source equations use kg/cm regardless of displayed input units. Individual needs differ from
estimates; monitor and adjust rather than assuming the equation measures actual expenditure.

All paths lead to a shared review form with editable calorie/macro values and an optional
effective date. Nothing saves until **Save goal**. An omitted date uses the backend's profile
time zone for today, avoiding device/profile date mismatch. Historical goal behavior and
same-day replacement remain unchanged. Pending saves disable edits/submission; errors retain
entered targets for correction/retry. Cancel never writes. Goal query invalidation continues
to refresh goals, analytics, and recommendations through existing hooks.

Age, equation sex, height, weight, activity, and eligibility remain transient form state.
They are neither sent to OpenAI nor saved in the profile, browser storage, or goal body.
Only the existing target numbers and optional effective date reach `POST /goals`. The UI
does not remember these measurements after the estimator is closed or the page is left.
No API schema, backend, dependency, database, or environment changes are needed.

Still open: goal history presentation, model picker copy (ADR-0006), time zone, sign out,
and account deletion.

### 6.4 Data lifecycle

Points to address: abandoned-draft cleanup (data model D2), account deletion and storage purge, backups for the demo project.

## 7. Testing **[Owner]**

Cover RLS (a user cannot read or modify another user's rows), repository CRUD, the confirm state guard, goal effective-date resolution, and photo deletion.

Goal-setup tests additionally cover all eight adult sex/activity equation combinations,
unit equivalence and switching, invalid inputs, preset arithmetic, review before saving,
manual-entry blanks, measurement privacy in the request, explicit dates, save failure, and
duplicate-submit prevention. Manually review Settings at 375 px in light/dark modes and
verify saved goals appear in Today and affect subsequent chat comparisons.

Calculation references:

- [Adult EER equations](https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/dietary-reference-intakes/tables/equations-estimate-energy-requirement.html)
- [Energy DRI applications and individual variation](https://www.ncbi.nlm.nih.gov/books/NBK591020/)
- [Macronutrient reference values](https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/dietary-reference-intakes/tables/reference-values-macronutrients.html)

## 8. Open questions

See [data model §11](../04-data/data-model.md#11-open-questions).
