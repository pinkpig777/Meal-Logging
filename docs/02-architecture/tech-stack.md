# Tech Stack

| | |
|---|---|
| **Status** | Accepted |
| **Owner** | Charlie Chiu |
| **Last updated** | 2026-10-21 |
| **Related** | ADR-0001, ADR-0002, ADR-0003, ADR-0006 |

## Summary

| Layer | Choice | Notes |
|---|---|---|
| Frontend | React 18 + TypeScript 5.9, Vite | Mobile-first SPA (ADR-0001) |
| Routing | React Router | |
| Server state | TanStack Query | Caching, invalidation after edits |
| Styling | Tailwind CSS v4 | Utility classes; design tokens defined in CSS (`web/src/index.css`) |
| Charts | **Owner decision (M4)** | Chosen in `03-design/m4-visualization.md` |
| API types | `openapi-typescript` | Frontend types generated from the backend OpenAPI schema |
| Auth client | `@supabase/supabase-js` | Google OAuth (ADR-0002); also used for photo upload |
| Backend | Python 3.12+, FastAPI, Pydantic v2 | |
| LLM | OpenAI API (multimodal, structured outputs) | Model chosen per user from a server allowlist (ADR-0006) |
| Database | Supabase Postgres | RLS on all user tables |
| File storage | Supabase Storage | Private bucket `meal-photos` |
| Hosting | Vercel (frontend), Render (backend), Supabase (DB, auth, storage) | Free tiers; the Render free tier cold-starts after idling |

## Tooling

| Purpose | Frontend (`web/`) | Backend (`api/`) |
|---|---|---|
| Package manager | npm (workspaces) | uv |
| Lint / format | ESLint, Prettier | Ruff (lint + format) |
| Type check | `tsc --noEmit` | Pyright (basic mode) |
| Tests | Vitest, Testing Library | pytest |
| CI | GitHub Actions | GitHub Actions |
| Local DB | Supabase CLI (`supabase start`, requires Docker) | |

## Rationale for key choices

- **Vite + React Router over Next.js.** The backend is FastAPI, and the app is a pure client-side SPA, so server rendering and API routes would go unused.
- **TanStack Query.** Edits to meals must refresh the dashboard, history, and suggestions. Query invalidation gives this behavior without a global store.
- **Generated API types.** Pydantic models are the single source of truth for every contract. The frontend never hand-writes request or response types.
- **npm over pnpm.** Every teammate already has npm; no extra install.
- **No chart library mandated.** The visualization owner chooses it based on the encodings the M4 design needs.

## Versions

Pin exact versions in `package-lock.json` and `uv.lock`. Upgrade dependencies deliberately, in their own PRs.
