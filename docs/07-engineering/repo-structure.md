# Repository Structure

| | |
|---|---|
| **Status** | Accepted |
| **Owner** | Charlie Chiu |
| **Last updated** | 2026-10-21 |

## Layout

```
Meal-Logging/
├─ README.md                  Quick start
├─ package.json               npm workspaces root (web)
├─ .github/workflows/ci.yml   Lint, type check, test for web and api
├─ docs/                      This documentation
├─ supabase/
│  ├─ config.toml
│  ├─ migrations/             Timestamped SQL migrations
│  └─ seed.sql                Local/demo seed data
├─ api/                       FastAPI backend (uv project)
│  ├─ pyproject.toml
│  ├─ app/
│  │  ├─ main.py
│  │  ├─ core/                config.py, auth.py, errors.py, db.py, logging.py
│  │  ├─ schemas/             Shared Pydantic contracts (meal.py, goal.py, profile.py, nutrition.py, common.py)
│  │  ├─ services/
│  │  │  └─ llm/              client.py, prompts/, fixtures.py
│  │  └─ modules/
│  │     ├─ recognition/      M1 · Charlie   router.py, service.py, schemas.py
│  │     ├─ clarification/    M2 · Clark     router.py, service.py, policy.py, schemas.py
│  │     ├─ meals/            M3 · Yi-Wei    router.py, repository.py, schemas.py
│  │     ├─ analytics/        M4 · Xiaochuan router.py, service.py, schemas.py
│  │     └─ recommendations/  M5 · Zach      router.py, service.py, schemas.py
│  └─ tests/
│     ├─ fixtures/llm/        Recorded LLM responses (+ sample photos)
│     └─ modules/<module>/    Tests mirror app/modules
└─ web/                       React SPA (Vite)
   ├─ package.json
   ├─ index.html
   └─ src/
      ├─ main.tsx, App.tsx    Providers, router
      ├─ lib/                 supabase.ts, api.ts (typed client), queryClient.ts, format.ts
      ├─ api/                 schema.d.ts (generated; do not edit)
      ├─ components/          Shared UI (AppShell, BottomNav, Button, Sheet, ReviewCue, …)
      ├─ auth/                AuthProvider, RequireAuth, SignInPage
      └─ features/
         ├─ capture/          M1 · Charlie   CapturePage, photo resize/upload
         ├─ review/           M2 · Clark     ReviewPage, ClarificationCard, ItemEditor
         ├─ meals/            M3 · Yi-Wei    MealDetailPage, HistoryList, GoalsPage, SettingsPage
         ├─ dashboard/        M4 · Xiaochuan TodayPage, WeekPage, charts/
         └─ suggestions/      M5 · Zach      SuggestionsPage, ChatPage
```

## Ownership rules

- Each module owner owns `api/app/modules/<module>/`, `web/src/features/<feature>/`, the matching tests, and `docs/03-design/m<N>-*.md`.
- Shared folders (`core/`, `schemas/`, `services/`, `web/src/lib`, `web/src/components`, `supabase/migrations/`) can be changed by anyone. The PR description must mention the change so other owners notice.
- Cross-module calls go through another module's `service.py` or `repository.py`, never its router.

## Frontend routes

| Path | Page | Owner |
|---|---|---|
| `/sign-in` | SignInPage | Shared |
| `/` | TodayPage (daily dashboard) | M4 |
| `/week` | WeekPage (weekly trends, drill-down) | M4 |
| `/log` | CapturePage (photo/text input, analyzing state) | M1 |
| `/meals/:id/review` | ReviewPage (clarifications, item editing, confirm) | M2 |
| `/meals/:id` | MealDetailPage (confirmed meal view/edit/delete) | M3 |
| `/history` | HistoryList (meals by date, backfill entry) | M3 |
| `/suggestions` | SuggestionsPage | M5 |
| `/chat` | ChatPage (TBD) | M5 |
| `/settings` | SettingsPage (goals, analysis model, time zone, account) | M3 |

The bottom navigation has four tabs: **Today**, **History**, **Log** (center), and **Suggestions**. Settings opens from the header.
