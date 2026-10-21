# Testing Strategy

| | |
|---|---|
| **Status** | Draft |
| **Owner** | All (each owner tests their module) |
| **Last updated** | 2026-10-21 |

## 1. Principles

- Tests run **offline**: no OpenAI key, no network, no Docker needed for the default suite.
- Test the logic that decides what users see: question selection, nutrition scaling, ranges, aggregation, the unlogged-vs-zero distinction, and state transitions.
- LLM behavior is evaluated separately from unit tests (see §4).

## 2. Test levels

| Level | Backend (`api/`) | Frontend (`web/`) | Runs in CI |
|---|---|---|---|
| Unit | pytest for pure functions: policy, derived values, scaling, aggregation, config | Vitest for helpers and hooks | Yes |
| Component | — | Testing Library + MSW mocks | Yes |
| API / contract | FastAPI `TestClient` with the repository mocked; OpenAPI contains all documented endpoints | Generated types compile (`npm run typecheck`) | Yes |
| Integration (DB) | pytest marked `db` against local Supabase (`supabase start`), including RLS checks | — | No (run locally before DB PRs) |
| Live LLM | pytest marked `live` against OpenAI with fixture photos | — | No (manual, costs money) |
| End-to-end | — | Manual checklist on real phones (iOS Safari, Android Chrome) before demos | No |

Markers: `uv run pytest -m "not db and not live"` is the CI default.

## 3. Fixtures and mocks

| Asset | Location | Used by |
|---|---|---|
| Recorded LLM outputs | `api/tests/fixtures/llm/` | `LLM_MODE=fixture`, backend tests |
| Seed data (dev user, a week of meals with unlogged days) | `supabase/seed.sql` | Local development, demos |
| MSW handlers | `web/src/mocks/` | Frontend development without a backend; component tests |

When an API contract changes, update the fixtures and MSW handlers in the same PR.

## 4. LLM quality evaluation (M1)

Kept separate from pass/fail tests:

1. Fixture photo set (~20 meals) with reference descriptions and, where possible, reference portions.
2. A script runs every allowlisted model over the set and stores outputs plus latency and token usage.
3. Compare: item recognition, portion error where a reference exists, validation failure rate, number and quality of uncertain attributes, latency, cost.

Results inform the model allowlist (ADR-0006) and the final report.

## 5. Must-have test cases

| Module | Case |
|---|---|
| M1 | Invalid output → retry → `LLM_INVALID_OUTPUT`; non-food → `IMAGE_NOT_FOOD`; range/impact math |
| M2 | Option answer applies precomputed nutrition; `not_sure` keeps the cue; clarify on confirmed → 409 |
| M3 | User A cannot read or modify user B's meals (RLS); goal effective-date resolution |
| M4 | Unlogged day → `logged: false`, `totals: null`; weekly average over logged days; mid-week goal change |
| M5 | Fewer than 3 logged days → `insufficient_history`; evidence references real meal IDs |
