# AGENTS.md: Guide for AI coding agents

You are helping a teammate on **Intelligent Meal Logging**, a mobile-first web SPA (React + Vite) with a FastAPI backend, Supabase (Postgres/Auth/Storage), and OpenAI for meal analysis. Five people each own one module. Follow this guide before writing any code.

## 0. First steps (do these in order)

1. **Ask your human which module they own** (M1–M5; see §3), unless they already said. Your work lives mainly in that module's folders.
2. **Read**, in this order:
   1. `docs/00-overview/product-brief.md`: what we're building
   2. `docs/00-overview/glossary.md`: required vocabulary for code, UI copy, and docs
   3. `docs/07-engineering/repo-structure.md`: layout and ownership rules
   4. `docs/05-api/api-conventions.md` and `docs/05-api/api-reference.md`: contracts
   5. `docs/04-data/data-model.md`: tables, views, RLS
   6. `docs/adr/`: accepted decisions (do not contradict them)
   7. **Your module's design doc** in `docs/03-design/`. Sections marked **[Owner]** are open design work for your human to decide.
3. **Set up the environment** (§1) and confirm it works before changing anything.
4. **Find the starting points:** search for `TODO(<OwnerFirstName>)`, e.g. `grep -rn "TODO(Clark)" api web/src`.

## 1. Environment setup

### 1.1 Check prerequisites

```bash
node -v            # need >= 22.22
npm -v
uv --version       # install: brew install uv
supabase --version # install: brew install supabase/tap/supabase  (full stack only)
docker info        # full stack only; Docker Desktop must be running
```

If something is missing, tell your human the install command; do not install system software without asking.

### 1.2 Pick a mode

| Mode | Use when | Needs |
|---|---|---|
| **A. Frontend only** | Working on UI only | Node |
| **B. Full stack, fixture mode** | Backend work or end-to-end testing | Node, uv, Docker, Supabase CLI |
| **C. Live LLM** | Tuning prompts or evaluating models (mainly M1, M5) | Mode B + an `OPENAI_API_KEY` from your human |

No accounts are needed for A or B: auth uses a seeded dev user, and the LLM returns recorded fixtures.

### 1.3 Mode A: frontend only

```bash
cp -n web/.env.example web/.env        # keep VITE_API_MOCK=true
npm install
npm run dev                            # http://localhost:5173
```

API calls are served by MSW handlers in `web/src/mocks/`. When you change a contract, update those handlers too.

### 1.4 Mode B: full stack

```bash
cp -n api/.env.example api/.env
cp -n web/.env.example web/.env
# web/.env  → set VITE_API_MOCK=false
supabase start                         # first run pulls images (several minutes)
supabase status                        # copy API URL, anon key, service_role key, JWT secret
# api/.env  → fill SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_JWT_SECRET
# web/.env  → fill VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
supabase db reset                      # apply migrations + seed
cd api && uv sync && uv run fastapi dev app/main.py     # http://localhost:8000
# in another terminal, from the repo root:
npm install && npm run dev
```

### 1.5 Verify the setup

```bash
curl -s localhost:8000/api/v1/health                       # → {"status":"ok",...,"auth_mode":"dev","llm_mode":"fixture"}
curl -s localhost:8000/api/v1/analytics/weekly | head -c 300
curl -s -X POST localhost:8000/api/v1/meals/analyze \
  -H 'content-type: application/json' -d '{"text_input":"chicken burrito bowl"}' | head -c 300
```

Then open http://localhost:5173 and confirm the Today page loads with seeded data.

### 1.6 Common problems

| Symptom | Fix |
|---|---|
| `Cannot connect to the Docker daemon` | Start Docker Desktop (`open -a Docker` on macOS) |
| API returns 401 | `AUTH_MODE=dev` must be set in `api/.env` and `VITE_AUTH_MODE=dev` in `web/.env` |
| API refuses to start in dev auth mode | `APP_ENV` must be `local` |
| Frontend calls fail with CORS errors | `CORS_ORIGINS` in `api/.env` must include `http://localhost:5173` |
| Port 54321/54322 in use | Another Supabase project is running: `supabase stop --project-id <other>` |
| Schema looks outdated | `supabase db reset` |
| `no space left on device`, or Docker keeps crashing | Free disk space (the Supabase images need several GB), then restart Docker Desktop |
| `failed to prepare extraction snapshot` while pulling | Docker's image store was corrupted (often after a full disk): `docker image prune -af`, then retry |
| `supabase db reset` ends with `Error status 502` | Usually harmless; containers are restarting. Check `docker ps` shows them healthy |
| Slow first `supabase start` | Skip unused services: `supabase start -x studio,imgproxy,edge-runtime,logflare,vector,supavisor,mailpit,postgres-meta` |

## 2. Rules you must follow

### Product rules (these come from ADRs; do not break them)

- **No numeric confidence** anywhere in the UI. Show uncertainty as status label + plain-language reason + icon, with color only as a supplement (ADR-0004).
- **Unlogged days are unknown, never zero.** Never coerce missing totals to `0`; render "Not logged" (ADR-0005).
- **Nutrition comes from the LLM** and is always labeled an *estimate* (ADR-0003). Answering a quick reply uses the option's precomputed nutrition; do not add LLM calls for it.
- **"Not sure" is not confirmation.** It leaves the attribute unresolved.
- Neutral, non-judgmental copy: never "good/bad food", "cheat meal", or red-means-bad styling by default.
- Mobile-first: design at 360–430 px, 44 px touch targets, no hover-only interactions.

### Architecture rules

- Only `api/app/services/llm/` may import the OpenAI SDK.
- Only `api/app/modules/meals/repository.py` writes the meal, item, attribute, goal, and profile tables. Other modules call its functions.
- Modules call other modules' `service.py` / `repository.py`, **never their routers**.
- The backend talks to Postgres with the **user's JWT** (RLS applies). The service-role client is for admin tasks only.
- Pydantic models are the API contract. Frontend types come from them (§4.2). Never hand-edit `web/src/api/schema.d.ts`.
- Every error response uses the envelope and codes in `docs/05-api/api-conventions.md`. Add new codes to that table.
- Never commit `.env` files or secrets. Add new variables to the matching `.env.example` and to `docs/07-engineering/environment-setup.md`.

### Ownership

- Stay within your human's module folders unless asked otherwise.
- Shared areas (`api/app/core`, `api/app/schemas`, `api/app/services`, `web/src/lib`, `web/src/components`, `supabase/migrations`) may change, but say so clearly in the PR description so the affected owners notice.

### Documentation

- Write all docs, code comments, and UI copy in **English**.
- Use glossary terms exactly (e.g. *review cue*, *uncertain attribute*, *logged day*, *suggestion*).
- Docs describe the product only. Do not reference coursework, classes, or grading.
- When a design decision is made, update the module design doc. If the decision is hard to reverse, add an ADR (`docs/adr/0000-template.md`).

## 3. Module map

| Module | Owner | Backend | Frontend | Endpoints | Design doc |
|---|---|---|---|---|---|
| **M1** Recognition & estimation | Charlie | `api/app/modules/recognition/`, `api/app/services/llm/` | `web/src/features/capture/` | `POST /meals/analyze`, `POST /meals/{id}/items/{item_id}/reestimate`, `GET /config/models` | `docs/03-design/m1-meal-recognition.md` |
| **M2** Clarification & review | Clark | `api/app/modules/clarification/` | `web/src/features/review/` | `POST /meals/{id}/clarify`, `PATCH /meals/{id}/draft`, `POST /meals/{id}/items` | `docs/03-design/m2-clarification-review.md` |
| **M3** Meal management & persistence | Yi-Wei | `api/app/modules/meals/`, `supabase/` | `web/src/features/meals/` | `/meals/*` CRUD + confirm, `/goals`, `/me` | `docs/03-design/m3-meal-management.md` |
| **M4** Visualization & history | Xiaochuan | `api/app/modules/analytics/` | `web/src/features/dashboard/` | `GET /analytics/{daily,weekly,history}` | `docs/03-design/m4-visualization.md` |
| **M5** Recommendations & chat | Zach | `api/app/modules/recommendations/` | `web/src/features/suggestions/` | `GET /recommendations`, `POST /recommendations/feedback`, `POST /chat` | `docs/03-design/m5-recommendations-chat.md` |

## 4. Development workflow

### 4.1 Per task

1. `git switch main && git pull && git switch -c <type>/<module>-<desc>` (e.g. `feat/m4-week-chart`). **Never commit to `main`.** It is protected; pushes are rejected and changes land only through PRs with passing CI.
2. Implement with tests (see `docs/07-engineering/testing-strategy.md`; the default suite must run offline).
3. Run all checks (§5) and fix failures.
4. Commit with Conventional Commits: `feat(m4): add weekly calorie chart`.
5. Push the branch (`git push -u origin HEAD`) and open a PR (`gh pr create`). Fill in the PR template; include 375 px screenshots in light and dark for UI changes.
6. If CI fails, fix it on the same branch and push again. Merge only after both checks pass.

### 4.2 When you change an API contract

```bash
cd api && uv run python scripts/export_openapi.py   # writes api/openapi.json
cd .. && npm run gen:api                            # regenerates web/src/api/schema.d.ts
npm run typecheck                                   # fix fallout in the same PR
```

Also update `web/src/mocks/` handlers, the backend fixtures if affected, and `docs/05-api/api-reference.md`.

### 4.3 When you change the database

```bash
supabase migration new <short_name>   # write SQL in the new file
supabase db reset                     # verify migrations + seed
```

Never edit a merged migration. Update `docs/04-data/data-model.md` in the same PR.

## 5. Command cheat sheet

| Task | Command |
|---|---|
| Run frontend | `npm run dev` (root) |
| Run backend | `cd api && uv run fastapi dev app/main.py` |
| API docs (Swagger) | http://localhost:8000/api/v1/docs |
| Backend checks | `cd api && uv run ruff check . && uv run ruff format --check . && uv run pyright && uv run pytest` |
| Frontend checks | `npm run lint && npm run typecheck && npm run test -- --run && npm run build` |
| Regenerate API types | `npm run gen:api` (after exporting OpenAPI) |
| Reset local DB | `supabase db reset` |
| Stop local Supabase | `supabase stop` |
| Live LLM tests (costs money) | `cd api && uv run pytest -m live` |
