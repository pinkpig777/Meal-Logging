# M1 Design: Meal Recognition & Nutrition Estimation

| | |
|---|---|
| **Status** | Draft |
| **Owner** | Charlie Chiu |
| **Reviewers** | Clark Wu (M2), Yi-Wei Chang (M3) |
| **Last updated** | 2026-10-21 |
| **Related** | ADR-0003, ADR-0004, ADR-0006, [API reference §3](../05-api/api-reference.md#3-m1-recognition-and-estimation) |

## 1. Context

M1 turns a meal photo and/or short text into a structured **draft meal**: items with portions, estimated calories and macros, and the uncertain attributes M2 uses to ask questions. Calories and macros come directly from the LLM (ADR-0003).

## 2. Goals and non-goals

**Goals**

- One LLM call per analysis returns everything the review screen needs, including the nutrition for each clarification option. Answering a quick reply then needs no further call.
- Output is schema-validated and semantically checked before anything is stored.
- Failures are explicit and recoverable: the user can retry or switch to text.
- Every module can be developed without an OpenAI key (fixture mode).

**Non-goals**

- Training or fine-tuning models.
- Food-composition database lookups.
- Pixel-level segmentation or highlighting regions in the photo.
- Asynchronous analysis or job queues (synchronous request + loading state for the MVP).

## 3. Design

### 3.1 Flow

```
POST /meals/analyze
  1. Validate input (photo_path in caller's folder, or text_input) ──► INPUT_REQUIRED
  2. Insert meal (status = analyzing, eaten_at, local_date, meal_type)
  3. Resolve model: profile.analysis_model ∈ allowlist ? it : default
  4. llm.analyze_meal(photo_bytes, text, context) ──► LLM_TIMEOUT / LLM_UNAVAILABLE
  5. Parse into AnalysisResult (Pydantic, strict) ──┐
  6. Semantic checks (§3.4) ─────────────────────────┴─ fail → retry once → LLM_INVALID_OUTPUT
  7. If not is_food → meal.status = failed, IMAGE_NOT_FOOD
  8. Derive: kcal_range per item, impact_kcal per attribute (§3.5)
  9. clarification.policy.select(meal) → sets asked flags (M2)
 10. Persist items + uncertain_attributes + ai_original; status = draft
 11. Return Meal
```

Steps 2 and 10 go through the M3 repository. Step 9 calls the M2 service, so M1 never decides which questions to ask.

### 3.2 LLM output schema (`AnalysisResult`)

Requested with OpenAI structured outputs, using the Pydantic model as the JSON schema.

```python
class LLMNutrition(BaseModel):
    kcal: float
    protein_g: float
    carbs_g: float
    fat_g: float

class LLMPortion(BaseModel):
    qty: float
    unit: str            # familiar unit: cup, piece, slice, tbsp, bowl, g
    grams: float

class LLMOption(BaseModel):
    id: str              # short slug, unique within the attribute
    label: str
    nutrition: LLMNutrition        # item's full estimate if chosen, at the current portion
    portion: LLMPortion | None     # only for attribute == "portion"

class LLMUncertainAttribute(BaseModel):
    attribute: Literal["identity", "portion", "preparation", "ingredient"]
    reason: str          # ≤ 80 chars, plain language, no numbers about confidence
    question: str        # one question about one attribute of this item
    options: list[LLMOption]       # 2–4, mutually exclusive
    current_option_id: str         # the option the item's values currently reflect

class LLMItem(BaseModel):
    name: str
    kind: Literal["dish", "addon"]
    preparation: str | None
    portion: LLMPortion
    nutrition: LLMNutrition
    uncertain_attributes: list[LLMUncertainAttribute]   # 0–3

class LLMImageAssessment(BaseModel):
    is_food: bool
    issues: list[Literal["blurry", "dark", "partial", "multiple_meals", "obstructed"]]
    note: str | None     # user-facing explanation when not food or issues exist

class AnalysisResult(BaseModel):
    image: LLMImageAssessment | None    # null for text-only input
    items: list[LLMItem]                 # 1–12
```

### 3.3 Prompt structure

Prompts live in `api/app/services/llm/prompts/` as versioned files (`analyze_meal.v1.md`). The version string is stored in `meals.prompt_version`.

**System prompt rules** (summary; the file is authoritative):

1. Split the meal into items **at the level a person would name them** ("chicken burrito", not tortilla + rice + beans). Rice, beans, grains, noodles, meat, and vegetables stay inside their dish; never count a food twice.
2. List **calorie-dense sauces, dressings, oils, and toppings** as separate `addon` items when they are visible, named in the user's text, or very likely, even when they sit on a bowl.
2a. **Look for hidden bases** (rice under donburi, curry, poke; noodles under sauce). Name the dish by cuisine and serving style, assume the typical base, and ask about it with an `ingredient` attribute. *(Added in v2.)*
2b. Name the **cooking style** correctly (simmered in sweet soy sauce ≠ stir-fried), because it changes fat and sugar. *(Added in v2.)*
3. Use **familiar units** (cup, piece, slice, tbsp, bowl) and estimate grams.
4. Report an uncertain attribute only when the answer would **change the estimate meaningfully**. At most 3 per item; ignore garnishes.
5. Each attribute has 2–4 mutually exclusive options. One option must match the current estimate (`current_option_id`).
6. Each option's `nutrition` is the **whole item's** estimate if that option is chosen.
7. For portion attributes, options are nearby familiar amounts (e.g. ½ cup / 1 cup / 1½ cups / 2 cups).
8. `reason` explains *why* in plain language ("scale is unclear", "sauce is not visible"). Never state a confidence percentage.
9. If the image does not show food, set `is_food = false` and return no items.
10. Use the user's text as strong evidence; it overrides visual guesses. Never ask about something the text already states.

**User message:** the image (downloaded from Storage by the API and sent inline as base64, because a local Supabase URL is not reachable by OpenAI; `detail` set for adequate resolution), the optional text, the local time and meal type hint, and the user's dietary restrictions (only as context, never to change the recognized food).

**Randomness:** use the lowest randomness setting the chosen model supports, so repeated analyses stay as consistent as possible.

### 3.4 Validation

Pydantic checks types and enums. The service then runs semantic checks:

| Check | Action on failure |
|---|---|
| `current_option_id` exists in `options` | Retry |
| 2 ≤ options ≤ 4; option IDs unique | Retry |
| `grams > 0`, nutrition values ≥ 0 | Retry |
| Energy consistency: `4·protein + 4·carbs + 9·fat` within ±25% of `kcal` (items ≥ 50 kcal) | Retry |
| Current option's nutrition ≈ item nutrition (±5%) | Overwrite the item's values with the option's |
| > 3 attributes on an item | Keep the 3 with the highest `impact_kcal` |
| `is_food = true` but no items | Retry |

On a retry, the validation errors are appended to the prompt. If the second attempt also fails, the result is `LLM_INVALID_OUTPUT`, and the meal is saved with `status = failed`.

### 3.5 Derived values

- `impact_kcal = max(option.kcal) − min(option.kcal)` per attribute.
- `kcal_range` per item: starting from the current kcal, add the most negative and most positive deltas (`option.kcal − current.kcal`) over all attributes that are **not answered** (`unresolved` or `not_sure`). The range is `null` when `high − low < max(30 kcal, 10% of current kcal)`.
- Meal `totals.kcal_low` / `kcal_high` sum the item bounds, using `kcal` for items without a range.

### 3.6 Re-estimation

`POST /meals/{id}/items/{item_id}/reestimate` sends the original photo, the meal context, the item's current state, and the user's change (new name, preparation, or free-text note) to the LLM. It asks for **one** `LLMItem`, validated the same way. The item's values and uncertain attributes are replaced, `ai_original` is kept, and `source` becomes `user_edited`. The meal's original model is used (ADR-0006).

The same path serves:
- M2 "Something else" answers (`note` = the user's text),
- M2 manual adds without nutrition (text-only, no photo).

### 3.7 LLM client (`services/llm`)

| Concern | Behavior |
|---|---|
| Interface | `analyze_meal(...) -> AnalysisResult`, `estimate_item(...) -> LLMItem`, plus generic `structured(prompt, schema)` for M5 |
| Modes | `live` calls OpenAI; `fixture` returns recorded responses from `tests/fixtures/llm/`, selected by a key (photo filename or text hash), with a default fallback |
| Timeout | `LLM_TIMEOUT_SECONDS` (default 45 s); one retry on timeout or 5xx |
| Logging | model, prompt version, latency, token usage, outcome; never the image or the user's text at info level |

### 3.8 Capture UI (frontend)

| State | UI |
|---|---|
| Idle | Two large actions: **Take photo** (`<input type=file accept=image/* capture=environment>`) and **Describe meal** (text). Optional text field under the photo preview. Meal time defaults to now, with a "Logged later?" control for backfill. |
| Uploading / analyzing | Photo preview + progress with staged copy ("Uploading…", "Identifying foods…", "Estimating portions…"); cancel returns to idle |
| Error | Plain message from the error envelope, with **Retry** and **Describe instead** |
| Success | Navigate to `/meals/:id/review` |

Client-side resize: longest edge 1024 px, JPEG quality 0.8, EXIF orientation applied, metadata stripped.

## 4. Alternatives considered

| Decision | Alternative | Why not |
|---|---|---|
| One call returns options with nutrition | Call the LLM again after each answer | Adds 5–15 s per answer and makes values less consistent |
| One call for recognition + estimation | Two calls (recognize → estimate) | Doubles latency and cost |
| Synchronous analyze | 202 + polling | More moving parts; revisit if p95 latency > 15 s |

## 5. Testing

- Unit: validation rules, range and impact math, model resolution.
- Contract: `AnalysisResult` fixtures parse; the API returns a valid `Meal`.
- Fixture set: ~20 photos covering simple plates, mixed dishes, sauce-heavy meals, ambiguous portions, non-food, and blurry shots, with recorded outputs per candidate model.
- Live smoke test (manual, opt-in): `uv run pytest -m live`.

## 6. Open questions

| # | Question |
|---|---|
| M1-Q1 | Which models go in the allowlist? (Decide after the fixture comparison.) |
| M1-Q2 | Should text-only input with an obvious single item skip uncertain attributes entirely? |
| M1-Q3 | Should a second photo angle be supported in the MVP? |

## 7. Prompt history

| Version | Date | Change | Evidence |
|---|---|---|---|
| `analyze_meal.v1` | 2026-10-21 | Initial prompt | — |
| `analyze_meal.v2` | 2026-10-28 | Hidden-base rule (assume and ask), cooking-style naming, add-ons always separate (with example), rice/beans never add-ons, no double counting, never ask what the text states, `partial` only when food is cut off | First live tests: a sukiyaki-beef bowl with rice hidden underneath (v1 missed the rice, ~250–350 kcal, on both models); a text burrito bowl where v1 folded cheese, sour cream and guac into the dish and asked about toppings the user had named |

Observed with v2 (small sample, not an evaluation): both test inputs now produce the expected structure; whether the hidden rice is included by default still varies between runs, but the rice question is always raised. A repeated-run fixture evaluation (testing strategy §4) is needed before choosing the final allowlist.
