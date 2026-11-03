# M5 Design: Personalized Recommendations & Grounded Chat

| | |
|---|---|
| **Status** | Recommendations implemented; chat planned |
| **Owner** | Zach Pena |
| **Reviewers** | Charlie Chiu (LLM client), Xiaochuan Ge (M4) |
| **Last updated** | 2026-10-30 |
| **Related** | ADR-0003, ADR-0005, [API reference §7](../05-api/api-reference.md#7-m5-suggestions-and-chat) |

## 1. Responsibilities and implementation boundary

M5 detects patterns in confirmed meal history, proposes hypothetical meals or snacks,
explains the recorded evidence, and collects suggestion feedback. The initial implementation
extends the existing recommendation cards and endpoints without changing their JSON shapes.
It does not change meal records, goals, logging completeness, or the shared LLM client.

Grounded chat is a separate next increment. Its existing page and endpoint still return a
placeholder. Suggestions and future chat discussions never become confirmed meals implicitly.

## 2. Pattern rules

Use the **previous fourteen calendar days**, ending yesterday in the profile's time zone.
Today is excluded because it is still in progress. Unlogged dates are unknown, not zero;
no synthetic rows enter pattern calculations. A logged day still means at least one confirmed
meal, as required by ADR-0005. We do not infer completeness from meal count.

Every candidate metric needs at least **three logged days with a positive effective goal**.
Days without a goal, or with a zero target for that macro, are excluded for that metric.
Compare each day to the goal in effect on that day, including when goals changed during
the window. At least half of eligible days, and at least two days, must meet both thresholds:

| Pattern | Absolute difference | Relative difference | Suggested direction |
|---|---|---|---|
| Protein below goal | ≥30 g | ≥20% of that day's goal | Protein-forward meal or snack |
| Carbs below goal | ≥40 g | ≥20% | Carbohydrate-forward meal or snack |
| Fat above goal | ≥15 g | ≥20% | Optional meal alternative with less added fat |
| Calories above goal | ≥300 kcal | ≥15% | Optional meal alternative closer to the goal |

These are initial product thresholds to evaluate, not dietary prescriptions. A low-calorie
rule is intentionally deferred: incomplete records do not establish under-eating.

Rank candidates by the fraction of eligible days matching, then by mean relative difference
on matching days. Rule order breaks ties. Show **one pattern with two ideas** to keep the
page focused. Missing goals, no recurring pattern, or dismissal of every candidate produce
`status=ok` with an empty suggestions list. Fewer than three logged days produces
`status=insufficient_history`. More specific empty-state UI is future work.

## 3. Personalized generation

`generation.py` calls only `app.services.llm.client.structured`; it never imports OpenAI.
The model is resolved from the profile's existing allowlisted choice and server default.
There are no new environment variables or dependencies.

Inputs are the selected code-computed pattern and evidence, the current effective goal,
dietary restrictions, and up to thirty unique food names from confirmed meals in the window.
Food names are bounded to 100 characters. They are context, not an inferred preference.
No photos, descriptions, user identifiers, or meal IDs are sent as prompt content.

The model returns exactly two ideas with serving descriptions and estimated calories/macros,
or explicitly reports that suitable ideas are unavailable. Historical counts, dates, goals,
evidence links, and the card title remain under code control. The prompt treats all embedded
user strings as untrusted data and asks for neutral wording and no medical claims.
Above-goal ideas are alternatives, not extra snacks or instructions to compensate.

Validation rejects incomplete idea sets, blank/oversized text, non-finite or zero-energy
estimates, estimates over 2,000 kcal per idea, and implausible macro-energy disagreement.
This checks structure and basic plausibility, **not nutrient accuracy or allergen safety**.
Restrictions are prompt constraints; live output still needs a reviewed evaluation set.

Successful results are cached in memory per worker, in fifteen-minute time buckets, bounded
to 128 entries. Keys include the user, prompt inputs, model, mode, and time bucket. Changed
constraints or evidence produce different inputs. No cache or conversation table is added.
Concurrent misses can still make duplicate calls; cross-worker caching and rate limits remain
future work. LLM failures are not cached: the verified pattern remains visible with no ideas
and a temporary-unavailability caveat. Never substitute generic foods after an error.

Fixture mode uses one recorded two-idea example per pattern. It makes no network calls and
labels these as demo estimates. Fixtures are not tailored to restrictions: with any restriction,
show the pattern without food ideas and explain their unavailability.

## 4. Evidence and incomplete records

Each card's existing **Why this suggestion** section receives matching local dates, confirmed
meal IDs for those dates, and code-formatted observed values alongside historical goals.
Suggestion IDs are deterministic for the metric, eligible-day count, and matching values/goals.
They change when those inputs change. Links continue to open the existing day and meal pages.

Caveats state that values are estimates, only logged days are represented, missing meals can
change the pattern, and today is excluded. Backfilling can correct incomplete records. These
warnings do not establish completeness; the product deliberately does not track that state.

## 5. Feedback

Continue storing the displayed suggestion snapshot and response in `suggestion_feedback`
through the caller's RLS-scoped client. On subsequent recommendation requests, read the most
recent seven days of feedback (at most 500 records, newest first). Latest response per metric
wins. **Not for me** or **I already do this** suppresses that metric for seven days after that
response, across changing evidence IDs. **Useful** leaves the metric eligible.

Suppression happens before generation, so dismissed candidates make no LLM call. If another
candidate is eligible, show it instead. Feedback is user-scoped and never changes meal history.
The existing page acknowledges submission; immediate dismissal and persistent positive-button
state are future UI improvements.

## 6. Testing and trying it

The default offline suite exercises rule thresholds, historical/zero/missing goals, sparse
history, ranking, fixture generation, restricted fixtures, cache isolation, output validation,
feedback behavior, confirmed-only retrieval, current-day exclusion, and generation failure.
Endpoint tests use the shared in-memory repository and verify no meal records change.

To exercise the real recommendation backend locally, use the README's full-stack fixture
setup with `VITE_API_MOCK=false`. Log and confirm meals on at least three past dates within
the last fourteen days and set goals effective on those dates. Open Suggestions, expand
Why this suggestion, submit feedback, and revisit/refetch the page.

With `VITE_API_MOCK=true`, the independent browser mock still supplies illustrative demo
responses; it does not execute the Python rules. Live generation additionally requires
`LLM_MODE=live`, an OpenAI key, and the configured allowlist. Automated checks do not spend
API credits or prove live recommendation quality or hosted Supabase behavior.

## 7. Next work

- Improve empty states for absent goals and dismissed patterns; immediately hide dismissed cards.
- Add grounded chat: bounded confirmed-history retrieval, code-computed arithmetic, citations,
  failed-message recovery, and explicit separation of hypothetical meals.
- Evaluate relevance, restriction compliance, neutral language, and prompt-injection resistance
  using live outputs and a reviewed fixture set. Current prompt checks are not an adversarial eval.
- Coordinate usability tasks measuring usefulness and whether users can explain the evidence.
- Decide whether conversations should persist; no chat database migration is made here.
