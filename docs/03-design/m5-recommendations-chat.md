# M5 Design: Personalized Recommendations & Grounded Chat

| | |
|---|---|
| **Status** | Recommendations and initial grounded chat implemented |
| **Owner** | Zach Pena |
| **Reviewers** | Charlie Chiu (LLM client), Xiaochuan Ge (M4) |
| **Last updated** | 2026-11-02 |
| **Related** | ADR-0003, ADR-0005, [API reference §7](../05-api/api-reference.md#7-m5-suggestions-and-chat) |

## 1. Responsibilities and implementation boundary

M5 detects patterns in confirmed meal history, proposes hypothetical meals or snacks,
explains the recorded evidence, and collects suggestion feedback. The initial implementation
extends the existing recommendation cards and endpoints without changing their JSON shapes.
It does not change meal records, goals, logging completeness, or the shared LLM client.

Grounded chat now reads confirmed meal history and goals through the existing M3 repository.
It uses the shared structured-output client. Suggestions and chat discussions never become
confirmed meals implicitly. Chat does not write any meal, item, profile, goal, or feedback row.

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

## 7. Grounded chat

### 7.1 Request and retrieval

`POST /chat` accepts up to twenty messages, each at most 4,000 characters, with a combined
limit of 20,000 characters. The final message must be a non-blank user question. Optional
`period` defaults to `last_14_days`; supported values are `today`, `this_week`, `last_week`,
and `last_14_days`. All dates use the profile's time zone; weeks start on Monday. Today and
this week end today; last week ends Sunday. The last-fourteen-days option includes today.
Unlike recurring recommendation patterns, chat may report today's recorded intake so far.

Each request retrieves current records anew with the caller's RLS-scoped client. Only
confirmed meals in the selected window are included. Aggregate facts use all daily-total
rows in the window. Detailed context contains at most twenty recent meals, at most eight
food names per meal, and at most eighty characters per food name. Truncation is explicit.
No photos, signed photo URLs, raw meal descriptions, or original AI predictions are sent.
Dietary restrictions, the current effective goal, and the bounded conversation provide context.

The frontend labels and locks the selected period during a conversation. To change it, start
a new conversation. If a question asks for a different window, the prompt requests that the
user change the selector instead of silently using the wrong period. Arbitrary date ranges,
search over older history, and automatic intent-based retrieval remain future work.

### 7.2 Numeric grounding and citations

Python constructs a catalog of coverage, period totals, logged-day averages, daily intake,
historical goals, daily goal comparisons, current goals, and recent meal totals. Missing
dates are never zero and do not enter the average denominator. Unlogged dates have no
remaining-intake comparison. Differences preserve above/below direction instead of clipping
an above-goal value to zero. Goal comparisons use that day's effective goal.

The model returns short qualitative prose, selected fact IDs, supporting meal IDs, and an
optional internal hypothetical meal draft (see §7.6). Its
prose for record summaries cannot contain digits; numeric responses are rendered from catalog facts
by the server. Unknown fact IDs and meal IDs outside the retrieved context fail with
`LLM_INVALID_OUTPUT`. Dates are derived from selected facts and verified meals, never invented
by the model. Selecting a meal fact automatically includes that meal's link. The existing
ChatResponse shape is retained: message plus meal/date references.

These checks constrain schema, numeric rendering, and reference existence. They do not prove
that qualitative prose is correct, that an existing reference supports every assertion, or
that prompt injection cannot succeed. Live evaluation remains required. Hypothetical food
estimates are labeled separately from recorded facts and never establish an exact allowance
or imply that a food is saved.

### 7.3 Empty, fixture, and failure states

No confirmed history produces a deterministic explanatory reply without an LLM call. One
logged day is sufficient for a clearly qualified summary; chat does not require the three-day
threshold used for recurring recommendation patterns. All replies identify the selected
window and remind users that values are estimates and chat never saves meals.

Fixture mode loads `m5_chat_v1.json`: a generic recorded response selecting the code-computed
period average and coverage. It is explicitly labeled a demo and does not interpret each
question. The browser mock also returns a labeled demo with supporting links. Neither
fixture mode nor browser mock mode demonstrates live conversational quality.

Live errors use the existing LLM error envelope. The UI retains the failed question and
supports retrying the same request without duplicating the user turn, or editing the failed
question. Pending requests block duplicate submissions. Existing read-only data is unchanged
on success, retry, and failure. Replies render as plain text, not untrusted HTML.

### 7.4 State and costs

Conversations live only in the mounted chat page; navigation away clears them. The browser
sends only the most recent messages within the server's count/character limits. Prior
assistant messages are untrusted conversation context, not a source of saved nutrition facts.
They can supply prior hypothetical portions for a follow-up draft. The prompt explicitly
distinguishes that use from evidence of actual intake, retains unchanged ingredients during
substitutions, and asks for clarification only when the needed context is absent or ambiguous.
There are no new database tables, migrations, environment variables, dependencies, streaming,
or chat-generation caches. Each nonempty-history live request normally makes one structured
call. Invalid structured output gets at most one additional correction call, subject to the
shared client's transport retry. M5 does not retry unavailable/quota or timeout errors itself.
Rate limiting is future work.

### 7.5 Validation

Backend tests cover period boundaries, missing days, historical/absent goals, goal comparison
direction, confirmed-only retrieval, no meal writes, fixture labeling, missing-history
short-circuiting, unknown-reference rejection, request limits, numerical prose rejection,
context truncation, meal-fact citations, and standard timeout errors. Frontend tests cover
period selection, reference links, follow-up messages, request bounds, duplicate-submit
prevention, retry, edit, and conversation reset. Prompt-boundary assertions are not a live
adversarial evaluation. Mobile browser screenshots remain a manual check using a synthetic mock conversation.

### 7.6 Hypothetical meal drafting

Prompt `m5-chat.v3` allows practical portion suggestions for named ingredients, rather than
requiring the user to supply all amounts first. Common preparation details can be stated as
assumptions: cooked/raw weights, beef leanness, added cooking fat, and brand differences.
An optional private structured draft contains up to five ingredient names, portion strings,
estimated nutrition per whole portion, and up to three concise assumptions. No public JSON
fields, tables, dependencies, or environment variables change.

Draft estimates must be finite, non-negative, positive in energy, at most 2,000 kcal per
ingredient and 3,000 kcal per draft, with basic macro-energy plausibility checks. This is
validation of structure and plausibility, not a verified nutrient database. Python sums the
ingredient estimates and renders the hypothetical total. The response explicitly labels
the draft as unsaved AI estimates, includes assumptions, and suggests reviewing package
labels and preparation before logging separately. Draft portion and estimate fields are
the permitted source of hypothetical quantities. When a valid structured draft is accompanied
by numeric prose, replace only that prose with a neutral introduction, preserving the validated
draft and code-calculated totals. Record-summary numeric prose remains invalid and eligible
for the bounded correction attempt. Numeric prose never supplies alternative saved facts.

Assumption string limits are included in the JSON schema sent to the model. Validation
failures log only field paths, stable error types, and the attempt number, never generated
text or conversation contents. A second invalid output returns sanitized validation issues
in the existing error envelope. These diagnostics distinguish numeric prose, oversized
assumptions, and implausible energy without revealing the failed response.

When today's confirmed daily-total row and its effective goals are present in the selected
window, code supplies signed goal-minus-recorded gaps to guide portion suggestions. It
computes projected above/below differences after adding the draft, without saving anything.
That comparison automatically cites today and is qualified by missing meals; it is not an
exact allowance or proof that dinner fits every target. Negative gaps are preserved, and
the prompt avoids compensatory restriction. No logged today, missing goals, or a historical
window produces no remaining-goal projection; a generic hypothetical draft can still be
returned if other history is present. The existing no-history short circuit is unchanged.

Complete rendered drafts remain in the bounded conversation sent by the frontend. A request
such as replacing avocado with half a cup of raspberries should preserve the previously
specified beef and rice amounts. This behavior depends on model interpretation of the
retained conversation, not persistent server memory; reset, navigation, or history truncation
can remove it. Draft replies render at most two supporting facts to keep them concise and
fail with the standard invalid-output error if the full message exceeds the existing limit.

Offline tests verify arithmetic, signed projections, missing-day handling, estimate validation,
read-only endpoint behavior, automatic projection citations, and transmission/rendering of a
substitution conversation. Mocked tests do not demonstrate that a live model retains portions.
Live manual evaluation must cover:

1. With Today selected and confirmed intake/goals present, request dinner portions using beef,
   rice, and avocado; inspect portions, assumptions, estimated totals, and projected differences.
2. Supply explicit beef/rice/avocado amounts, then replace only avocado with `1/2 cup`
   raspberries. Verify beef and rice portions remain unchanged and totals are recalculated.
3. Revise the rice amount alone; verify every other ingredient retains its amount.
4. Ask whether the draft has been saved, then inspect history: no meal should have been added.
5. Repeat without today's records or goals; verify no remaining allowance is invented.

## 8. Next work

- Evaluate live recommendation and chat relevance, restriction compliance, citation support,
  numerical fidelity, neutral wording, and resistance to prompt injection.
- Improve recommendation empty states and immediately hide dismissed suggestion cards.
- Consider arbitrary-date retrieval, richer meal labels, streaming, cross-worker cost controls,
  and rate limiting after the initial chat flow is verified.
- Coordinate usability tasks measuring usefulness and whether users can explain the evidence.
- Revisit persistent conversations only if needed; this version deliberately keeps them local
  to the current page.
