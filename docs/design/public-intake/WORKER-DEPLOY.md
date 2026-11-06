# Worker deploy — ExoFab public intake API

Deploy the Cloudflare Worker in `worker/` to serve `/api/*` for the GitHub Pages site at `https://moissanite-labs.github.io/exoframe/`. Set `window.EXO_API_BASE` in `assets/config.js` to the Worker origin (no trailing slash).

## Wrangler

```bash
cd worker
npm ci
npx wrangler kv namespace create IDEAS_KV   # paste id into wrangler.toml
npx wrangler secret put GH_ISSUES_TOKEN
npx wrangler secret put TURNSTILE_SECRET
npx wrangler deploy
```

Route the Worker (or custom domain) so `POST https://<worker-host>/api/ideas` is reachable from Pages via CORS. Only `https://moissanite-labs.github.io` is allowed.

## Secrets and vars

| Name | Kind | Purpose |
|------|------|---------|
| `GH_ISSUES_TOKEN` | Secret | Create issues on `Moissanite-Labs/exoframe` |
| `TURNSTILE_SECRET` | Secret | Turnstile `siteverify` |
| `TURNSTILE_HOSTNAME` | Var | Expected hostname (`moissanite-labs.github.io`) |
| `TURNSTILE_ACTION` | Var | Expected action (`submit-idea`) |
| `GITHUB_REPO` | Var | Target repo (`Moissanite-Labs/exoframe`) |
| `IDEAS_KV` | KV binding | Dedupe keys + participation blobs |
| `INTAKE_RL` | Rate limit | 5 requests / 60s per IP (ideas + participation POST) |

## GitHub token — minimum grants

Use a **fine-grained PAT** or classic PAT scoped to **`Moissanite-Labs/exoframe`** only.

### Fine-grained (recommended)

| Permission | Access |
|------------|--------|
| **Issues** | Read and write |
| **Metadata** | Read-only (automatic) |

Repository access: **Only select repositories** → `Moissanite-Labs/exoframe`.

No Contents, Actions, or Workflow permissions are required for intake issue creation.

### Classic PAT (alternative)

| Scope |
|-------|
| `public_repo` (if repo is public) **or** `repo` |

Issue creation only; do not grant admin or delete scopes.

## Turnstile

1. Create a Turnstile widget for hostname `moissanite-labs.github.io`.
2. Action name: `submit-idea` (must match `TURNSTILE_ACTION`).
3. Put the **site key** in `assets/config.js` (`EXO_TURNSTILE_SITEKEY`).
4. Put the **secret key** in Worker secret `TURNSTILE_SECRET`.

## Cloudflare account token (Wrangler deploy)

For CI or operators running `wrangler deploy`, use an API token with:

| Permission | Resource |
|------------|----------|
| **Account → Workers Scripts** | Edit |
| **Account → Workers KV Storage** | Edit |
| **Account → Account Settings** | Read |
| **Zone → Workers Routes** | Edit (if attaching a route on a zone) |

Optional: **Workers R2 / Queues** not used by this worker.

## Intake sync workflow (separate)

The GitHub Actions workflow `.github/workflows/sync-ideas-from-issues.yml` uses `GITHUB_TOKEN` to commit `data/ideas.json`. Commits from `GITHUB_TOKEN` **do not** trigger other workflows (including Pages deploy). After sync commits land on `main`, either merge manually, push an empty commit, or run **Actions → pages build/deploy** via `workflow_dispatch` if configured.

See README **Intake queue sync** for the Pages note.
