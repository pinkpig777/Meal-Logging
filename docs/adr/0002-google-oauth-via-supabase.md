# ADR-0002: Require sign-in with Google through Supabase Auth

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-10-21 |
| **Deciders** | Charlie Chiu |

## Context

Meal photos, eating history, and goals are personal data. Users need their history across sessions and devices, and every query must be restricted to the signed-in user. The planned stack already includes Supabase. The target users are university students, who almost all have Google accounts (including Texas A&M accounts).

## Decision

Sign-in is **required**. Use **Supabase Auth with the Google OAuth provider** as the only sign-in method for the MVP.

- The SPA starts the OAuth flow with the Supabase JS client and receives a Supabase session (JWT).
- The SPA sends the access token as `Authorization: Bearer <token>` on every backend request.
- The FastAPI backend verifies the JWT and calls Supabase on behalf of the user, so Postgres Row Level Security (RLS) policies enforce per-user access.
- A `profiles` row is created on first sign-in.

## Alternatives considered

| Option | Pros | Cons |
|---|---|---|
| Google OAuth via Supabase (chosen) | One-tap sign-in; no password handling; works with RLS | Requires a Google Cloud OAuth client and correct redirect URLs per environment |
| Email + password | No third-party setup | Password reset flows; more friction during usability tests |
| Email magic link | No password | Users switch to their mail app mid-flow; slow on mobile |
| No auth / anonymous | Fastest to build | No persistence across devices; cannot enforce per-user access |

## Consequences

- A Google Cloud project with an OAuth client is needed. Authorized redirect URLs must cover local development and each deployed environment.
- Usability-test participants need a Google account. A small set of test accounts should be prepared for sessions.
- Email/password can be added later as a second provider without schema changes.
