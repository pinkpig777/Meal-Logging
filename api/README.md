# Meal Logging API

FastAPI backend (Python 3.12+, uv). Contracts: `docs/05-api/`. Architecture: `docs/02-architecture/`.

## Run

```bash
cp -n .env.example .env          # AUTH_MODE=dev + LLM_MODE=fixture: no keys needed
# fill SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_JWT_SECRET from `supabase status`
uv sync
uv run fastapi dev app/main.py   # http://localhost:8000/api/v1/docs
```

The local database comes from the repo root: `supabase start && supabase db reset`
(migrations + `supabase/seed.sql`, which creates the dev user and a week of meals).

In fixture mode, `POST /meals/analyze` picks a recorded analysis from `tests/fixtures/llm/` by
keyword in `text_input` ("burrito", "rice", "pasta", "not food") or by photo filename stem
(e.g. `{user_id}/pasta_cream_sauce.jpg`); otherwise the burrito-bowl fixture.

## Check

```bash
uv run ruff check . && uv run ruff format --check . && uv run pyright && uv run pytest
uv run pytest -m live                       # opt-in tests that call OpenAI (costs money)
uv run python scripts/export_openapi.py     # writes openapi.json → `npm run gen:api` at the root
```

The default test suite needs no network, Docker, or OpenAI: `tests/conftest.py` swaps the
repository's Supabase calls for an in-memory store.

## Layout and owners

| Path | What | Owner |
|---|---|---|
| `app/main.py` | App factory, middleware (request ID, CORS), router registration | Shared |
| `app/core/` | `config`, `auth` (`CurrentUser`), `errors` (`AppError`), `db` (`UserDb`), `logging` | Shared |
| `app/schemas/` | Shared contracts (`Meal`, `MealItem`, `Nutrition`, …) | Shared (Yi-Wei) |
| `app/services/llm/` | The only OpenAI caller: `client.py`, `schemas.py`, `fixtures.py`, `prompts/` | Charlie |
| `app/services/nutrition.py` | Pure nutrition math (ranges, impact, scaling, totals) | Shared |
| `app/modules/recognition/` | M1: analyze, re-estimate, `/config/models` | Charlie |
| `app/modules/clarification/` | M2: clarify, draft edits, add item, `policy.py` | Clark |
| `app/modules/meals/` | M3: `repository.py` (all writes to meal/goal/profile tables), CRUD, goals, `/me` | Yi-Wei |
| `app/modules/analytics/` | M4: daily / weekly / history | Xiaochuan |
| `app/modules/recommendations/` | M5: suggestions, feedback, chat | Zach |

Find your starting points with `grep -rn "TODO(<YourName>)" app`.

Rules: modules import other modules' `service.py` / `repository.py` (never routers); only
`services/llm` imports `openai`; use the user-scoped `UserDb` client (RLS) — the admin client in
`core/db.py` is for admin tasks only; raise `AppError(ErrorCode.X, "...")` for every error.
