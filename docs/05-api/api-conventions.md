# API Conventions

| | |
|---|---|
| **Status** | Accepted |
| **Owner** | Charlie Chiu |
| **Last updated** | 2026-10-21 |

These rules apply to every endpoint. Module owners design their own endpoints within them.

## 1. Basics

| Rule | Convention |
|---|---|
| Base path | `/api/v1` |
| Format | JSON (`application/json`), UTF-8 |
| Field names | `snake_case` |
| IDs | UUID strings |
| Timestamps | ISO 8601 with offset, e.g. `2026-10-21T12:30:00-05:00` |
| Dates | `YYYY-MM-DD`, in the user's local time zone |
| Nutrition numbers | Unrounded floats; clients round for display |
| Missing values | `null`, never `0` or omitted, when a value is unknown (e.g. unlogged-day totals) |
| Auth | `Authorization: Bearer <Supabase access token>` on every endpoint except `GET /health` |

## 2. Resource design

- Use nouns for resources (`/meals`, `/goals`) and sub-resources for children (`/meals/{id}/items/{item_id}`).
- Use action sub-paths only for state transitions or operations that are not plain CRUD: `/meals/analyze`, `/meals/{id}/clarify`, `/meals/{id}/confirm`.
- Mutating endpoints on a meal return the **full updated meal**, so the client can replace its cached copy without refetching.
- List endpoints filter with query parameters (`?from=2026-10-01&to=2026-10-07`). Pagination is not needed for the MVP; date ranges are capped at 92 days.

## 3. Status codes

| Code | When |
|---|---|
| `200` | Success with body |
| `201` | Resource created (`POST /meals/analyze`, `POST /goals`) |
| `204` | Success without body (`DELETE`) |
| `400` | Malformed request that passed schema validation but is semantically wrong |
| `401` | Missing or invalid token |
| `404` | Resource not found **or not owned by the caller** (do not reveal existence) |
| `409` | Invalid state transition (e.g. clarifying a confirmed meal) |
| `422` | Request body or query fails validation; analysis rejected the image |
| `429` | Rate limit exceeded |
| `502` | Upstream LLM error or invalid LLM output |
| `504` | Upstream LLM timeout |
| `500` | Unexpected server error |

## 4. Error envelope

Every non-2xx response has this body:

```json
{
  "error": {
    "code": "MEAL_INVALID_STATE",
    "message": "This meal is already confirmed and cannot be clarified.",
    "details": { "meal_id": "…", "status": "confirmed" },
    "request_id": "c0a8…"
  }
}
```

- `code`: stable, `UPPER_SNAKE_CASE`; clients branch on it.
- `message`: a human-readable English sentence, safe to show the user.
- `details`: optional, machine-readable context. For `VALIDATION_ERROR` it holds a list of `{loc, msg}` entries.

### Error codes

| Code | HTTP | Meaning |
|---|---|---|
| `UNAUTHENTICATED` | 401 | Missing or invalid token |
| `NOT_FOUND` | 404 | Resource does not exist for this user |
| `VALIDATION_ERROR` | 422 | Request validation failed |
| `MEAL_INVALID_STATE` | 409 | Operation not allowed in the meal's current status |
| `IMAGE_NOT_FOOD` | 422 | Analysis determined the photo does not show food |
| `INPUT_REQUIRED` | 422 | Neither photo nor text was provided |
| `MODEL_NOT_ALLOWED` | 422 | Requested model is not in the allowlist |
| `LLM_UNAVAILABLE` | 502 | OpenAI returned an error |
| `LLM_INVALID_OUTPUT` | 502 | Output failed validation after a retry |
| `LLM_TIMEOUT` | 504 | OpenAI did not respond in time |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL` | 500 | Unexpected error |

New codes are added to this table in the same PR that introduces them.

## 5. Contracts as code

- Request and response models are Pydantic classes in `api/app/schemas/` (shared) or `api/app/modules/<module>/schemas.py` (module-specific).
- The OpenAPI schema at `/api/v1/openapi.json` is the published contract. The frontend regenerates its types with `npm run gen:api`.
- A breaking change to a shared schema needs a heads-up to every consuming module owner in the PR description.

## 6. Headers

| Header | Direction | Purpose |
|---|---|---|
| `Authorization` | request | Bearer token |
| `X-Request-ID` | both | Optional on request; always returned; included in logs and error bodies |
| `X-Timezone` | request | Optional IANA time zone; used to update `profiles.timezone` when it changes |
