# Development Workflow

| | |
|---|---|
| **Status** | Accepted |
| **Owner** | Charlie Chiu |
| **Last updated** | 2026-10-21 |

## 1. Branching (GitHub flow)

- `main` is always deployable; Vercel and Render deploy from it.
- **`main` is protected** (GitHub ruleset in `.github/rulesets/protect-main.json`):
  - No direct pushes. Every change reaches `main` through a pull request.
  - Both CI jobs must pass before merging: `API (lint, types, tests)` and `Web (lint, types, tests, build)`.
  - Force-pushes to and deletion of `main` are blocked.
  - No approval is required, and nobody can bypass the rules, admins included.
- Create a short-lived branch per change: `<type>/<module>-<short-description>`.
  - Examples: `feat/m2-question-policy`, `fix/m4-unlogged-day-bar`, `docs/m5-pattern-rules`, `chore/deps-upgrade`.
- Merge through a pull request, then delete the branch.

## 2. Pull requests

- Keep PRs small and focused on one concern, ideally under ~400 changed lines.
- Fill in the PR template (`.github/pull_request_template.md`); it loads automatically.
- CI must pass before merging (enforced). If CI fails, push fixes to the same branch.
- No approval is required. Request a review when a PR:
  - changes a **shared** area (`api/app/core`, `api/app/schemas`, `api/app/services`, `web/src/lib`, `web/src/components`, `supabase/migrations`), or
  - changes an API contract another module consumes.

  In those cases, @-mention the affected owners in the PR description.
- Any merge method is allowed. Squash merge is recommended for PRs with messy commit history.
- Delete the branch after merging.

### PR description template

```markdown
## What
<one or two sentences>

## Why
<link to design doc section / issue>

## Contract changes
<none | endpoints/schemas changed + affected modules>

## How tested
<tests added, manual steps, screenshots for UI (phone width)>
```

## 3. Commit messages (Conventional Commits)

```
<type>(<scope>): <summary in imperative mood>
```

| Type | Use for |
|---|---|
| `feat` | New user-facing behavior |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `refactor` | Code change without behavior change |
| `test` | Tests only |
| `chore` | Tooling, dependencies, config |

Scopes: `m1`–`m5`, `api`, `web`, `db`, `docs`, `ci`. Example: `feat(m2): rank questions by impact and item share`.

## 4. Contract-first changes

When an endpoint or shared schema changes:

1. Update the Pydantic model and endpoint.
2. Run `uv run python scripts/export_openapi.py` in `api/`, then `npm run gen:api` at the root.
3. Fix any TypeScript errors in the same PR.
4. Update `docs/05-api/api-reference.md` if the change is visible to other modules.

## 5. Database changes

1. `supabase migration new <name>` → write the SQL.
2. `supabase db reset` locally to verify migrations and seed data.
3. Never edit a merged migration; add a new one.
4. Update `docs/04-data/data-model.md` in the same PR.

## 6. Decisions and docs

- Each owner keeps their module design doc current; mark sections `Accepted` once agreed.
- Record any decision that is hard to reverse, or that changes a source document, as an ADR (`docs/adr/`).
- Track open questions in the relevant doc's table, not in chat.

## 7. Before you push

```bash
# backend (in api/)
uv run ruff check . && uv run ruff format --check . && uv run pyright && uv run pytest
# frontend (at repo root)
npm run lint && npm run typecheck && npm run test -- --run
```

## 8. Repository settings (admin)

The ruleset lives in the repo so it can be reviewed and re-applied. To create it (once, by a repo admin):

```bash
gh auth login
gh api -X POST repos/pinkpig777/Meal-Logging/rulesets --input .github/rulesets/protect-main.json
```

To update it after editing the JSON, find its ID with `gh api repos/pinkpig777/Meal-Logging/rulesets` and `PUT` to `repos/pinkpig777/Meal-Logging/rulesets/<id>` with the same `--input`.

The required check names must match the `name:` of the jobs in `.github/workflows/ci.yml`. Renaming a job requires updating the ruleset, or merges will wait for a check that never runs.
