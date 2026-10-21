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

Points to address: goal entry (presets? units?), how goal history is shown, model picker copy (ADR-0006), time zone, sign out, delete account.

### 6.4 Data lifecycle

Points to address: abandoned-draft cleanup (data model D2), account deletion and storage purge, backups for the demo project.

## 7. Testing **[Owner]**

Cover RLS (a user cannot read or modify another user's rows), repository CRUD, the confirm state guard, goal effective-date resolution, and photo deletion.

## 8. Open questions

See [data model §11](../04-data/data-model.md#11-open-questions).
