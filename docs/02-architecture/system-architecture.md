# System Architecture

| | |
|---|---|
| **Status** | Draft |
| **Owner** | Charlie Chiu |
| **Last updated** | 2026-10-21 |
| **Related** | [Tech stack](tech-stack.md), [Data model](../04-data/data-model.md), [API reference](../05-api/api-reference.md) |

## 1. Context

```mermaid
flowchart LR
    user([User on phone browser])
    app[Meal Logging SPA + API]
    google[Google OAuth]
    openai[OpenAI API]
    user -->|logs meals, views history| app
    app -->|sign-in| google
    app -->|meal analysis, suggestions| openai
```

## 2. Containers

```mermaid
flowchart TB
    subgraph Browser
        spa["Web SPA<br/>React + Vite<br/>(Vercel)"]
    end
    subgraph Backend
        api["API service<br/>FastAPI<br/>(Render)"]
    end
    subgraph Supabase
        auth["Auth<br/>(Google provider)"]
        db[("Postgres<br/>RLS")]
        storage[("Storage<br/>meal-photos")]
    end
    openai["OpenAI API"]

    spa -- "OAuth sign-in, session" --> auth
    spa -- "upload photo (user JWT)" --> storage
    spa -- "REST /api/v1 (Bearer JWT)" --> api
    api -- "verify JWT" --> auth
    api -- "queries as user (RLS)" --> db
    api -- "signed URLs, deletes" --> storage
    api -- "structured outputs" --> openai
```

| Container | Responsibility | Does **not** |
|---|---|---|
| Web SPA | UI, routing, camera capture, client-side image resize, photo upload, calling the API | Call OpenAI; query Postgres directly |
| API service | Business rules, LLM calls, clarification policy, aggregation, authorization checks | Hold sessions; store files on disk |
| Supabase Auth | Google sign-in, JWT issuance | |
| Postgres | Persistent records, views for totals, RLS | |
| Storage | Meal photos | |

The SPA uses Supabase directly for exactly two things, **sign-in** and **photo upload**. Everything else goes through the API.

## 3. Backend components

```
api/app/
├─ main.py              app factory, middleware, router registration
├─ core/                config, auth (JWT → CurrentUser), errors, Supabase client factory
├─ schemas/             shared Pydantic contracts (Meal, MealItem, Nutrition, Goal, …)
├─ services/
│  └─ llm/              the only module that talks to OpenAI (client, prompts, fixtures)
└─ modules/
   ├─ recognition/      M1  router + service
   ├─ clarification/    M2  router + service + policy
   ├─ meals/            M3  router + repository (meals, goals, profile)
   ├─ analytics/        M4  router + service
   └─ recommendations/  M5  router + service
```

Dependency rules:

- `modules/*` may import `core`, `schemas`, `services`, and another module's **service** (never its router).
- Only `services/llm` imports the OpenAI SDK.
- Only `modules/meals` writes to the `meals`, `meal_items`, `uncertain_attributes`, `profiles`, and `user_goals` tables. Other modules call its repository functions. M1 and M2 may create and update draft rows through those functions.

## 4. Key sequences

### 4.1 Log a meal with a photo

```mermaid
sequenceDiagram
    actor U as User
    participant W as SPA
    participant S as Storage
    participant A as API
    participant L as OpenAI
    participant D as Postgres

    U->>W: Take photo (+ optional text)
    W->>W: Resize to ~1024px JPEG
    W->>S: Upload {user_id}/{photo_id}.jpg
    W->>A: POST /meals/analyze {photo_path, text_input, eaten_at}
    A->>D: insert meal (analyzing)
    A->>S: download photo
    A->>L: analyze(image bytes, text, context)
    L-->>A: structured AnalysisResult
    A->>A: validate, compute ranges and impact, select questions (M2 policy)
    A->>D: insert items + uncertain attributes, status = draft
    A-->>W: 201 Meal (draft)
    W-->>U: Review screen with questions
```

### 4.2 Clarify, edit, and confirm

```mermaid
sequenceDiagram
    actor U as User
    participant W as SPA
    participant A as API
    participant L as OpenAI

    U->>W: Tap quick reply "Fried"
    W->>A: POST /meals/{id}/clarify {attribute_id, option_id}
    A-->>W: Meal (values from the option, no LLM call)
    U->>W: Answer "Something else: air-fried"
    W->>A: POST /meals/{id}/clarify {attribute_id, other_text}
    A->>L: re-estimate one item
    A-->>W: Meal
    U->>W: Change rice 1 cup → 1.5 cups
    W->>A: PATCH /meals/{id}/draft
    A-->>W: Meal (scaled locally)
    U->>W: Confirm
    W->>A: POST /meals/{id}/confirm
    A-->>W: Meal (confirmed)
    W->>W: Invalidate dashboard and history queries
```

### 4.3 View history

The SPA calls `GET /analytics/weekly`. The API reads `daily_totals` (a view over confirmed items, joined to effective goals) and returns 7 days, with `null` totals for unlogged days. Selecting a day calls `GET /analytics/daily`; selecting a meal calls `GET /meals/{id}`.

## 5. Cross-cutting concerns

| Concern | Approach |
|---|---|
| Authentication | Supabase JWT in `Authorization: Bearer`; verified by the API with the project's HS256 JWT secret. JWKS (asymmetric signing keys) support is a TODO before deploying to a hosted project. |
| Authorization | RLS on every table; the API uses the caller's JWT for DB access |
| Errors | One error envelope and code list (see [API conventions](../05-api/api-conventions.md)) |
| LLM reliability | Timeout, one retry, schema validation, and semantic checks; on failure the meal is marked `failed` with a reason |
| Observability | Structured JSON logs with request ID, user ID, route, latency, and LLM model and token usage |
| Secrets | Env vars only; never committed; `.env.example` documents each one |
| Development without OpenAI | `LLM_MODE=fixture` returns recorded responses, so every module can be developed offline |

## 6. Deployment

| Environment | Frontend | Backend | Database |
|---|---|---|---|
| Local | `npm run dev` (Vite, :5173) | `uv run fastapi dev` (:8000) | `supabase start` (Docker) or the shared dev project |
| Preview | Vercel preview per PR | Shared dev backend | Shared dev Supabase project |
| Production (demo) | Vercel, `main` branch | Render, `main` branch | Production Supabase project |

Google OAuth redirect URLs must be registered for each environment.
