# Project flow architecture (v0)

ExoFab public **project pages** sit beside the existing public intake on `Moissanite-Labs/exoframe` (GitHub Pages). This slice proves one end-to-end path: branch-per-project sources → aggregation → `/projects/<slug>/`.

## Explicit gaps (EXAMPLE · Harbor Light)

Harbor Light is labeled **Example · simulation**. For v0:

1. **No separate working repo yet** — Ahraz’s dedicated working-repo requirement is not met. No new `Moissanite-Labs/<repo>` was provisioned (needs approval).
2. **No delivered / built artifact yet** — the public project page shows **status and activity only**, not a shipped product or build output.
3. **`work/harbor-light` is a labeled stand-in** — a tiny branch with a README placeholder only. It does **not** prove a built result and does **not** replace a real working repo.

We checked existing public Moissanite-Labs repos; none is a Harbor Light working surface, so the stand-in branch remains.

## Source model

| Branch | Role |
|--------|------|
| `project/<slug>` | Source of truth for `manifest.json`, `activity.json`, and a short README |
| `work/<slug>` | **Stand-in only** until a separate working repo is approved |

On **main**, `project-sources/<slug>/` mirrors JSON from `project/<slug>` so aggregation can run in CI and locally without executing code from project branches (v0). Keep branch and snapshot in sync when updating activity.

## Published surface

- `data/projects.json` — index of published projects (slug, `idea_id`, status, …)
- `projects/<slug>/index.html` — static project page (`tokens.css`, EXAMPLE banner when `example: true`)
- Intake `queue.html` links ideas to `projects/<slug>/` when `idea_id` matches

## Aggregation

```bash
python3 scripts/aggregate_projects.py
python3 scripts/aggregate_projects.py --force   # ignore fingerprint skip
```

- **Allowlist + validation**: slug regex, schema, `https` URLs on allowlisted GitHub paths, HTML escaping, writes restricted to `projects/<slug>/` and `data/projects.json`.
- **Stale guard**: stores input SHA256 under `projects/<slug>/.source-sha256`; skips regeneration when outputs already match sources (unless `--force`).
- **Trusted CI**: `.github/workflows/aggregate-projects.yml` lives on **main** only. Jobs always `checkout` **ref: main** for the workflow and `scripts/aggregate_projects.py`. Aggregate job uses `contents: read`; only the commit job uses `contents: write`. Never run a workflow or script checked out from a `project/**` branch with write credentials.
- Triggers: `workflow_dispatch` and pushes to `main` under `project-sources/**` only (not `projects/**`). Bot commits use `[aggregate]` and `[skip ci]`; skip when the previous commit was already aggregation.

### Updating activity (permitted event for v0)

1. Edit `project-sources/harbor-light/activity.json` (prepend `{ "at", "kind", "summary" }`, newest first).
2. Mirror the same JSON on branch `project/harbor-light`.
3. Merge to `main` (or push snapshot). CI aggregates into `projects/harbor-light/`.
4. Or run `workflow_dispatch` on main after the snapshot lands.

No GitHub App, no `repository_dispatch`, no cross-repo automation in v0.

## Security

- Untrusted input is **JSON parse only**; no templates or scripts from project branches are executed during aggregation.
- Private material must not appear in public `manifest.json` / `activity.json`.
- EXAMPLE labeling on page and in copy.

## Deferred

- Cloudflare Worker intake / Turnstile / API stubs
- GitHub App and cross-repo dispatch
- Automatic provisioning of `Moissanite-Labs/<new-repo>`
- Fetching `project/*` branches in Actions (read-only JSON copy into `project-sources/` first)

## Related docs

- Public intake design (unchanged): [`public-intake/SPEC.md`](public-intake/SPEC.md)
