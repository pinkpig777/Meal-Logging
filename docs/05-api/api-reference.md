# API Reference

| | |
|---|---|
| **Status** | Draft |
| **Owner** | Charlie Chiu (shared schemas); module owners (their endpoints) |
| **Last updated** | 2026-10-21 |
| **Related** | [API conventions](api-conventions.md), [Data model](../04-data/data-model.md) |

This is the provisional contract that the starter code implements as stubs. Once the backend runs, the generated OpenAPI schema (`/api/v1/openapi.json`) is authoritative. Update this document when a contract changes.

Changes from the Task & Team document:

- `POST /meals/reestimate` became item-scoped: `POST /meals/{id}/items/{item_id}/reestimate`.
- `PATCH /goals` became `POST /goals`, because goals are versioned rather than updated.
- New: `POST /meals/{id}/items`, `DELETE /meals/{id}/photo`, `GET`/`PATCH /me`, `GET /config/models`, `GET /health`.

## 1. Endpoint index

| Method | Path | Owner | Summary |
|---|---|---|---|
| GET | `/health` | Charlie | Liveness; no auth |
| GET | `/config/models` | M1 Charlie | Allowed analysis models |
| POST | `/meals/analyze` | M1 Charlie | Photo and/or text → draft meal |
| POST | `/meals/{id}/items/{item_id}/reestimate` | M1 Charlie | Re-estimate one item after an identity or preparation change |
| POST | `/meals/{id}/clarify` | M2 Clark | Answer an uncertain attribute |
| PATCH | `/meals/{id}/draft` | M2 Clark | Edit a draft (meal fields, item portions and values, remove items) |
| POST | `/meals/{id}/items` | M2 Clark | Add an item; estimated if nutrition is omitted |
| POST | `/meals/{id}/confirm` | M3 Yi-Wei | Confirm a draft |
| GET | `/meals` | M3 Yi-Wei | List meals in a date range |
| GET | `/meals/{id}` | M3 Yi-Wei | Get one meal |
| PATCH | `/meals/{id}` | M3 Yi-Wei | Edit a confirmed meal (same body as the draft PATCH) |
| DELETE | `/meals/{id}` | M3 Yi-Wei | Delete a meal and its photo |
| DELETE | `/meals/{id}/photo` | M3 Yi-Wei | Delete only the photo |
| GET | `/goals` | M3 Yi-Wei | Current goal and history |
| POST | `/goals` | M3 Yi-Wei | Set a new goal (effective from a date) |
| GET | `/me` | M3 Yi-Wei | Current user's profile and settings |
| PATCH | `/me` | M3 Yi-Wei | Update profile and settings |
| GET | `/analytics/daily` | M4 Xiaochuan | One day: totals vs. goal, meal contributions |
| GET | `/analytics/weekly` | M4 Xiaochuan | Seven days, with unlogged days as `null` |
| GET | `/analytics/history` | M4 Xiaochuan | Day series over a date range |
| GET | `/recommendations` | M5 Zach | Current suggestions with evidence |
| POST | `/recommendations/feedback` | M5 Zach | Record suggestion feedback |
| POST | `/chat` | M5 Zach | Grounded chat (scope TBD) |

All paths are relative to `/api/v1`.

## 2. Shared schemas

Shown as TypeScript-style shapes for readability; the Pydantic models in `api/app/schemas/` are authoritative.

```ts
type MealStatus = "analyzing" | "draft" | "confirmed" | "failed";
type MealType = "breakfast" | "lunch" | "dinner" | "snack";
type ItemKind = "dish" | "addon";
type ItemSource = "ai" | "ai_clarified" | "user_edited" | "user_added";
type AttributeKind = "identity" | "portion" | "preparation" | "ingredient";
type ResolutionStatus = "unresolved" | "answered" | "not_sure";
type ImageIssue = "blurry" | "dark" | "partial" | "multiple_meals" | "obstructed";

interface Nutrition {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

interface KcalRange { low: number; high: number; }

interface Portion {
  qty: number;     // 1.5
  unit: string;    // "cup", "piece", "slice", "tbsp", "g"
  grams: number;   // estimated weight
}

interface AttributeOption {
  id: string;                 // stable within the attribute, e.g. "fried"
  label: string;              // "Fried"
  nutrition: Nutrition;       // the item's full estimate if this option is chosen
  portion: Portion | null;    // set only for attribute = "portion"
}

interface UncertainAttribute {
  id: string;
  attribute: AttributeKind;
  reason: string;             // "Scale is unclear from one photo"
  question: string;           // "About how much rice did you eat?"
  options: AttributeOption[]; // 2–4
  current_option_id: string;  // the option currently reflected in the item's values
  impact_kcal: number;        // max − min kcal across options
  asked: boolean;             // selected by the clarification policy
  status: ResolutionStatus;
  resolution: { option_id: string | null; text: string | null } | null;
}

interface MealItem {
  id: string;
  position: number;
  kind: ItemKind;
  name: string;
  preparation: string | null;
  portion: Portion;
  nutrition: Nutrition;
  kcal_range: KcalRange | null;      // null when unresolved options do not spread meaningfully
  source: ItemSource;
  uncertain_attributes: UncertainAttribute[];
  ai_original: object | null;        // immutable snapshot of the AI's first estimate
}

interface NutritionTotals extends Nutrition {
  kcal_low: number;
  kcal_high: number;
}

interface Meal {
  id: string;
  status: MealStatus;
  meal_type: MealType;
  eaten_at: string;            // timestamp
  local_date: string;          // date
  text_input: string | null;
  photo_url: string | null;    // short-lived signed URL
  model_version: string | null;
  image_issues: ImageIssue[];
  failure_reason: string | null;
  items: MealItem[];
  totals: NutritionTotals;
  created_at: string;
  updated_at: string;
  confirmed_at: string | null;
}

interface MealSummary {
  id: string;
  status: MealStatus;
  meal_type: MealType;
  eaten_at: string;
  local_date: string;
  photo_url: string | null;
  item_names: string[];
  totals: NutritionTotals;
}

interface Goal {
  id: string;
  effective_from: string;      // date
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

interface Profile {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  timezone: string;
  dietary_restrictions: string[];
  analysis_model: string | null;   // null = server default
}
```

## 3. M1: Recognition and estimation

### `GET /config/models`

```json
{
  "default": "model-a",
  "models": [
    { "id": "model-a", "label": "Faster", "description": "Quicker results, less detail" },
    { "id": "model-b", "label": "More detailed", "description": "Slower, more careful estimates" }
  ]
}
```

### `POST /meals/analyze` → `201 Meal`

```json
{
  "photo_path": "4f1c…/9b2e….jpg",
  "text_input": "chicken burrito bowl, extra rice",
  "eaten_at": "2026-10-21T12:30:00-05:00",
  "meal_type": null
}
```

| Field | Required | Notes |
|---|---|---|
| `photo_path` | one of these two | Storage path under the caller's folder |
| `text_input` | one of these two | ≤ 500 chars |
| `eaten_at` | no | Defaults to now; a past value backfills |
| `meal_type` | no | Inferred from local time if omitted |

The response is a meal with `status: "draft"`, and `asked` already set by the clarification policy. Errors: `INPUT_REQUIRED`, `IMAGE_NOT_FOOD`, `LLM_*`. On an LLM failure the meal is kept with `status: "failed"`, and its ID is returned in `error.details.meal_id`.

### `POST /meals/{id}/items/{item_id}/reestimate` → `200 Meal`

```json
{ "name": "Air-fried chicken thigh", "preparation": "air-fried", "note": null }
```

At least one field is required. The service re-estimates that one item with the meal's original model and photo, replaces its values and uncertain attributes, and sets `source: "user_edited"`. Allowed only for `draft` and `confirmed` meals.

## 4. M2: Clarification and review

### `POST /meals/{id}/clarify` → `200 Meal`

```json
{ "attribute_id": "…", "answer": { "kind": "option", "option_id": "fried" } }
{ "attribute_id": "…", "answer": { "kind": "not_sure" } }
{ "attribute_id": "…", "answer": { "kind": "other", "text": "air-fried" } }
```

| Answer | Effect |
|---|---|
| `option` | Copies the option's nutrition (and portion) into the item; `status: answered`; item `source: ai_clarified`; no LLM call |
| `not_sure` | `status: not_sure`; values unchanged; the review cue stays |
| `other` | `status: answered`; triggers an M1 re-estimate of the item using the text |

Allowed only for `draft` meals (`MEAL_INVALID_STATE` otherwise).

### `PATCH /meals/{id}/draft` → `200 Meal`

Also the body of `PATCH /meals/{id}` for confirmed meals.

```json
{
  "meal_type": "lunch",
  "eaten_at": "2026-10-21T12:30:00-05:00",
  "items": [
    { "op": "update", "id": "…", "portion": { "qty": 1.5, "unit": "cup", "grams": 240 } },
    { "op": "update", "id": "…", "nutrition": { "kcal": 300, "protein_g": 10, "carbs_g": 40, "fat_g": 9 } },
    { "op": "remove", "id": "…" }
  ]
}
```

Item update rules:

- Portion only: nutrition and the range are **scaled by grams** on the server.
- Nutrition provided: used as-is.
- `name` or `preparation` changed without nutrition: values stay as they are. The client should offer a re-estimate.
- Any update sets `source: "user_edited"`.

### `POST /meals/{id}/items` → `200 Meal`

```json
{ "name": "Ranch dressing", "portion": { "qty": 2, "unit": "tbsp", "grams": 30 }, "nutrition": null }
```

`portion` is required when `nutrition` is given. If `nutrition` is `null`, M1 estimates the item (text-only); M1 also estimates `portion` if it is omitted. The new item has `source: "user_added"`.

## 5. M3: Meals, goals, profile

| Endpoint | Request | Response |
|---|---|---|
| `POST /meals/{id}/confirm` | none | `200 Meal`; `MEAL_INVALID_STATE` unless `draft` |
| `GET /meals?from=&to=&status=` | `from`, `to` dates (default: last 7 days); `status` default `confirmed` | `200 { "meals": MealSummary[] }`, newest first |
| `GET /meals/{id}` | none | `200 Meal` |
| `PATCH /meals/{id}` | same as draft PATCH | `200 Meal` |
| `DELETE /meals/{id}` | none | `204` |
| `DELETE /meals/{id}/photo` | none | `204` |
| `GET /goals` | none | `200 { "current": Goal \| null, "history": Goal[] }` |
| `POST /goals` | `{ kcal, protein_g, carbs_g, fat_g, effective_from? }` (default today) | `201 Goal`; replaces a goal with the same `effective_from` |
| `GET /me` | none | `200 Profile` |
| `PATCH /me` | any of `display_name`, `timezone`, `dietary_restrictions`, `analysis_model` | `200 Profile`; `MODEL_NOT_ALLOWED` if not allowlisted |

## 6. M4: Analytics

```ts
interface DayPoint {
  date: string;
  logged: boolean;                 // false → totals is null (unknown, not zero)
  meal_count: number;
  totals: NutritionTotals | null;
  goal: Goal | null;               // effective goal for that date
}

interface MealContribution extends MealSummary {
  share: Nutrition;                // fraction of the day's total for each metric, 0–1
}
```

| Endpoint | Query | Response |
|---|---|---|
| `GET /analytics/daily` | `date` (default today) | `{ date, logged, goal, totals, meals: MealContribution[] }` |
| `GET /analytics/weekly` | `start` (default Monday of the current week) | `{ start, end, days: DayPoint[7], logged_day_count, averages: Nutrition \| null }`. Averages are over **logged days** only. |
| `GET /analytics/history` | `from`, `to` (≤ 92 days) | `{ days: DayPoint[] }` |

The M4 owner may change these shapes in the M4 design doc.

## 7. M5: Suggestions and chat

### `GET /recommendations` → `200`

```json
{
  "status": "ok",
  "logged_day_count": 6,
  "required_day_count": 3,
  "suggestions": [
    {
      "id": "…",
      "pattern": { "metric": "protein_g", "summary": "On 4 of your 6 logged days, protein was below your goal by 30 g or more." },
      "title": "Add a protein-forward snack",
      "ideas": [
        { "name": "Greek yogurt with berries", "description": "…", "estimated_nutrition": { "kcal": 180, "protein_g": 17, "carbs_g": 20, "fat_g": 3 } }
      ],
      "evidence": { "dates": ["2026-10-15", "…"], "meal_ids": ["…"], "observations": ["…"] },
      "caveats": ["Based only on days you logged."]
    }
  ]
}
```

`status` is `"insufficient_history"` (with empty `suggestions`) when `logged_day_count < required_day_count`.

### `POST /recommendations/feedback` → `204`

```json
{ "suggestion": { "...": "snapshot of the suggestion" }, "response": "useful" }
```

### `POST /chat` → `200` *(scope TBD)*

```json
{ "messages": [ { "role": "user", "content": "Would a burrito fit my goals tonight?" } ] }
```

```json
{
  "message": { "role": "assistant", "content": "…" },
  "references": { "meal_ids": [], "dates": [] }
}
```
