# web — Meal Log frontend

Mobile-first React SPA (React 18 + TypeScript + Vite, React Router, TanStack Query, Tailwind CSS v4, supabase-js). See `docs/07-engineering/repo-structure.md` and `docs/02-architecture/tech-stack.md`.

## Run

Requires Node 22.22+ (or 24 LTS). From the **repo root**:

```bash
npm install
cp web/.env.example web/.env     # defaults: dev auth + mock API
npm run dev                      # http://localhost:5173
npm run dev -w web -- --host     # expose on your LAN to test on a phone
```

Other scripts (root delegates to `web`): `npm run lint`, `npm run typecheck`, `npm run test -- --run`, `npm run build`, `npm run gen:api`. Format with `npm run format -w web`.

## Mock mode (no backend needed)

With `VITE_API_MOCK=true`, [MSW](https://mswjs.io) answers every API call in the browser using `src/mocks/handlers.ts` and an in-memory database in `src/mocks/data.ts` (reset on page reload). It falls back to in-page fetch mocking where service workers are blocked (for example Firefox private windows).

Seed data, relative to today:

- Confirmed meals on each of the last 7 days **except 3 days ago** (an unlogged day, shown as "Not logged").
- A draft meal with two asked clarifications (rice portion, chicken preparation): open `/meals/11111111-1111-4111-8111-111111111111/review`.
- A goal, a profile, two analysis models, and two suggestions with evidence.

Capture triggers: a description containing `fail` returns `LLM_TIMEOUT`; `not food` returns `IMAGE_NOT_FOOD`.

Set `VITE_API_MOCK=false` to use the real backend at `VITE_API_BASE_URL`. `VITE_AUTH_MODE=dev` signs you in as a fake dev user (no token is sent; the backend must run with `AUTH_MODE=dev`) and skips the photo upload to Supabase Storage. Use `VITE_AUTH_MODE=supabase` with `VITE_SUPABASE_ANON_KEY` for Google sign-in.

## Where each owner works

| Folder                      | Owner          | Pages                                                                   |
| --------------------------- | -------------- | ----------------------------------------------------------------------- |
| `src/features/capture/`     | M1 · Charlie   | CapturePage (`/log`), photo resize/upload                               |
| `src/features/review/`      | M2 · Clark     | ReviewPage (`/meals/:id/review`), ClarificationCard, ItemEditor         |
| `src/features/meals/`       | M3 · Yi-Wei    | MealDetailPage, HistoryList, GoalsPage, SettingsPage                    |
| `src/features/dashboard/`   | M4 · Xiaochuan | TodayPage (`/`), WeekPage (`/week`), `charts/` (library not chosen yet) |
| `src/features/suggestions/` | M5 · Zach      | SuggestionsPage, ChatPage                                               |

Shared (anyone may change, mention it in the PR): `src/lib/` (API client, query keys, formatting), `src/components/`, `src/auth/`, `src/api/types.ts`, `src/mocks/`. Search for `TODO(<name>)` to find each owner's starting points.

Conventions:

- Each feature's `api.ts` holds its TanStack Query hooks. Query keys live in `src/lib/queryKeys.ts`; meal mutations call `invalidateAfterMealChange` (meals, analytics, suggestions).
- Throw/handle `ApiError` (`src/lib/api.ts`); show it with `<ErrorState>`.
- Round only for display (`src/lib/format.ts`). Unlogged days are unknown, never 0 (ADR-0005). No confidence percentages; use `<ReviewCue>` (ADR-0004).

## API types

`src/api/types.ts` is a **temporary** hand-written mirror of `docs/05-api/api-reference.md`. All app code imports types from it. When the backend emits `api/openapi.json`:

```bash
npm run gen:api          # writes web/src/api/schema.d.ts (do not edit)
```

then replace the bodies in `src/api/types.ts` with re-exports from `schema.d.ts` (e.g. `export type Meal = components['schemas']['Meal']`) and fix any type errors.
