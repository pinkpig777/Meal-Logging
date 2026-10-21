# Intelligent Meal Logging

A mobile-first web app that turns a meal photo or a short description into an editable nutrition record. The app asks only the few questions that would change the estimate most, and the user confirms the result. Confirmed meals feed daily and weekly views of calories and macros against the user's goals, with explainable suggestions.

> **Status:** early development. Starter code and design docs are in place; module owners are building out their parts.

## How it works

1. **Capture**: take a photo and/or describe the meal.
2. **Draft**: a multimodal LLM identifies items, portions, calories, and macros, and flags what it is unsure about.
3. **Clarify**: the app asks one-tap questions only where the answer changes the estimate meaningfully ("About how much rice?").
4. **Confirm**: the user reviews and edits any item, then confirms.
5. **Explore**: daily and weekly intake vs. goals, with drill-down from a week to a day to a meal.
6. **Suggestions**: a few goal-related ideas, each with the evidence behind it.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React + TypeScript, Vite, React Router, TanStack Query, Tailwind CSS |
| Backend | Python, FastAPI, Pydantic |
| Data & auth | Supabase (Postgres with RLS, Storage, Auth with Google) |
| AI | OpenAI API (structured outputs) |
| Hosting | Vercel (web), Render (API) |

## Quick start

No accounts or API keys are needed for local development.

**Frontend only** (mocked API; no Docker):

```bash
cp web/.env.example web/.env      # VITE_API_MOCK=true
npm install
npm run dev                       # http://localhost:5173
```

**Full stack** (local Supabase + API in fixture mode; requires Docker):

```bash
cp api/.env.example api/.env
cp web/.env.example web/.env      # then set VITE_API_MOCK=false
supabase start && supabase db reset
# copy ANON_KEY, SERVICE_ROLE_KEY, JWT_SECRET from `supabase status -o env` into api/.env and web/.env
(cd api && uv sync && uv run fastapi dev app/main.py)   # http://localhost:8000/api/v1/docs
npm install && npm run dev                              # http://localhost:5173
```

Details, environment variables, and phone testing: [docs/07-engineering/environment-setup.md](docs/07-engineering/environment-setup.md).

> **Using an AI coding agent?** Point it at [AGENTS.md](AGENTS.md). It covers setup, conventions, and where each module lives.

## Repository layout

```
├─ web/          React SPA         (web/src/features/<feature>/ per module)
├─ api/          FastAPI backend   (api/app/modules/<module>/ per module)
├─ supabase/     Migrations and seed data
├─ docs/         Design and engineering docs
└─ .github/      CI
```

## Team and modules

| Module | Owner | Backend | Frontend | Design doc |
|---|---|---|---|---|
| M1 Meal recognition & estimation | Charlie Chiu | `api/app/modules/recognition` | `web/src/features/capture` | [m1](docs/03-design/m1-meal-recognition.md) |
| M2 Clarification & review | Clark Wu | `api/app/modules/clarification` | `web/src/features/review` | [m2](docs/03-design/m2-clarification-review.md) |
| M3 Meal management & persistence | Yi-Wei Chang | `api/app/modules/meals`, `supabase/` | `web/src/features/meals` | [m3](docs/03-design/m3-meal-management.md) |
| M4 Visualization & history | Xiaochuan Ge | `api/app/modules/analytics` | `web/src/features/dashboard` | [m4](docs/03-design/m4-visualization.md) |
| M5 Recommendations & chat | Zach Pena | `api/app/modules/recommendations` | `web/src/features/suggestions` | [m5](docs/03-design/m5-recommendations-chat.md) |

Full ownership and shared responsibilities: [docs/00-overview/team-and-ownership.md](docs/00-overview/team-and-ownership.md).

## Documentation

Start at the **[docs index](docs/README.md)**. Key documents:

| Topic | Document |
|---|---|
| What we're building and why | [Product brief](docs/00-overview/product-brief.md) |
| Shared vocabulary | [Glossary](docs/00-overview/glossary.md) |
| Architecture | [System architecture](docs/02-architecture/system-architecture.md) · [Tech stack](docs/02-architecture/tech-stack.md) |
| Data | [Data model](docs/04-data/data-model.md) |
| API | [Conventions](docs/05-api/api-conventions.md) · [Reference](docs/05-api/api-reference.md) |
| Module designs | [docs/03-design/](docs/03-design/) |
| Decisions | [Architecture Decision Records](docs/adr/) |
| How we work | [Repo structure](docs/07-engineering/repo-structure.md) · [Dev workflow](docs/07-engineering/dev-workflow.md) · [Testing](docs/07-engineering/testing-strategy.md) |

## Contributing

- Branch from `main`: `feat/m2-question-policy`, `fix/m4-unlogged-day`, …
- Commit with [Conventional Commits](https://www.conventionalcommits.org/): `feat(m2): rank questions by impact`.
- Open a PR. CI must pass. Mention the affected owners if you change shared code or an API contract.
- Run the checks before pushing:

```bash
(cd api && uv run ruff check . && uv run ruff format --check . && uv run pyright && uv run pytest)
npm run lint && npm run typecheck && npm run test -- --run
```

See [docs/07-engineering/dev-workflow.md](docs/07-engineering/dev-workflow.md).
