# Environment Setup

| | |
|---|---|
| **Status** | Draft |
| **Owner** | Yi-Wei Chang |
| **Last updated** | 2026-10-21 |

## 1. Prerequisites

| Tool | Version | Install |
|---|---|---|
| Node.js | 22.22 or newer | nodejs.org or `brew install node` |
| uv | latest | `brew install uv` |
| Python | 3.12+ | Installed automatically by uv |
| Docker Desktop | latest | Only needed for a local Supabase stack |
| Supabase CLI | latest | `brew install supabase/tap/supabase` |

## 2. Frontend only (no backend, no Docker)

To work only on UI, set `VITE_API_MOCK=true` in `web/.env`. Mock Service Worker handlers in `web/src/mocks/` then answer every API call.

```bash
cp web/.env.example web/.env
npm install && npm run dev
```

## 3. Full stack (fixture mode, no keys needed)

Fixture mode lets you run the whole app without an OpenAI key or Google OAuth.

```bash
git clone <repo-url> && cd Meal-Logging
cp api/.env.example api/.env
cp web/.env.example web/.env
supabase start                       # local Postgres, Auth, Storage (Docker)
supabase db reset                    # apply migrations + seed
cd api && uv sync && uv run fastapi dev app/main.py   # http://localhost:8000
# new terminal
npm install && npm run dev           # http://localhost:5173
```

Set `VITE_API_MOCK=false` to use the real backend. With `AUTH_MODE=dev` (backend) and `VITE_AUTH_MODE=dev` (frontend), the app signs in as a seeded dev user, and `LLM_MODE=fixture` returns recorded analyses. **Dev auth mode is refused at startup unless `APP_ENV=local`.**

## 4. Environment variables

### `api/.env`

| Variable | Example | Purpose |
|---|---|---|
| `APP_ENV` | `local` / `preview` / `production` | Environment name |
| `SUPABASE_URL` | `http://127.0.0.1:54321` | Supabase API URL |
| `SUPABASE_ANON_KEY` | | Used with the user's JWT, so RLS applies |
| `SUPABASE_SERVICE_ROLE_KEY` | | **Admin tasks only** (storage cleanup, account purge). Never sent to the browser. |
| `SUPABASE_JWT_SECRET` | | Verifies access tokens |
| `AUTH_MODE` | `supabase` / `dev` | `dev` = fixed seeded user; local only |
| `LLM_MODE` | `live` / `fixture` | `fixture` = recorded responses, no OpenAI calls |
| `OPENAI_API_KEY` | | Required when `LLM_MODE=live` |
| `ANALYSIS_MODELS` | `model-a:Faster,model-b:More detailed` | Allowlist, as `id:label` pairs |
| `ANALYSIS_MODEL_DEFAULT` | `model-a` | Must be in the allowlist |
| `LLM_TIMEOUT_SECONDS` | `45` | Per-call timeout |
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated |

### `web/.env`

| Variable | Example | Purpose |
|---|---|---|
| `VITE_API_BASE_URL` | `http://localhost:8000/api/v1` | Backend URL |
| `VITE_SUPABASE_URL` | `http://127.0.0.1:54321` | Supabase URL |
| `VITE_SUPABASE_ANON_KEY` | | Public anon key (safe in the browser) |
| `VITE_AUTH_MODE` | `supabase` / `dev` | Must match the backend |
| `VITE_API_MOCK` | `true` / `false` | `true` = MSW mocks, no backend needed |

Never commit `.env` files. Add every new variable to the matching `.env.example` and to this table.

## 5. Google OAuth (shared environments)

1. Google Cloud Console → create an OAuth client (Web application).
2. Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`.
3. Supabase dashboard → Authentication → Providers → Google: paste the client ID and secret.
4. Supabase → Authentication → URL configuration: add `http://localhost:5173`, the Vercel production URL, and the Vercel preview URL pattern.

## 6. Testing on a phone

Run Vite with `npm run dev -- --host` and open `http://<your-LAN-IP>:5173` on the phone, on the same Wi-Fi network. Camera capture through `<input capture>` works over plain HTTP on a LAN IP in most mobile browsers. If a browser blocks it, use the Vercel preview URL.
