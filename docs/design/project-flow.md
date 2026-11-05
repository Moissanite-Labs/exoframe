# Project flow architecture (v0)

ExoFab public **project pages** sit beside the existing public intake on `Moissanite-Labs/exoframe` (GitHub Pages).

## What publishes to Pages (main)

GitHub Pages serves **`main`**. After merge, published project HTML comes from:

1. **`project-sources/<slug>/`** on `main` (committed snapshot), **or**
2. A **manual** workflow on **`main`** that copies JSON from an allowlisted **`project/<slug>`** branch, then aggregates.

There is **no automatic** “push to `project/harbor-light` → Pages updates” job in v0. Updating the project branch alone does nothing to Pages until someone runs import + aggregate (locally or via manual dispatch on `main`).

## Explicit gaps (EXAMPLE · Harbor Light)

1. **No separate working repo yet** — dedicated working-repo provisioning not done; `work/harbor-light` is a **stand-in** only.
2. **No delivered / built artifact yet** — public page shows **status + activity only**.
3. **Synbios not wired** — example queue cards use **Example · Building in Synbios (not linked yet)** (simulation copy, not live Synbios work); no real URL until `https://…` exists in data.
4. **Example · simulation** labeling on the Harbor Light page.

## Source model

| Location | Role |
|----------|------|
| `project/<slug>` branch | JSON source (`manifest.json`, `activity.json` at branch root) |
| `project-sources/<slug>/` on `main` | Aggregation input snapshot on Pages |
| `work/<slug>` | Stand-in README only — not a built result |

## Local vs CI

| | **Local / PR checkout** | **GitHub Actions (trusted `main`)** |
|--|-------------------------|-------------------------------------|
| Scripts | `scripts/aggregate_projects.py` from your checkout | Re-checkout **`scripts/`** at recorded default-branch SHA before import/aggregate (`contents: read`) |
| Input JSON | `project-sources/` in working tree (`EXOFRAME_PROJECT_SOURCES` optional) | `project-sources/` on `main`, **or** import via `import_project_branch.py` after `git fetch origin project/<slug>` |
| Import branch | `python3 scripts/import_project_branch.py harbor-light` (after fetch) | Manual **workflow_dispatch** on **`main` only** with “Import from project branch” |
| Output | `projects/`, `data/projects.json` | Commit job writes only those paths + updated `project-sources/` when imported (`contents: write`) |

**Prove branch → page locally:**

```bash
git fetch origin project/harbor-light
python3 scripts/import_project_branch.py harbor-light
python3 scripts/aggregate_projects.py --force
# open projects/harbor-light/index.html
```

**Publish via trusted workflow (after merge to main):** Actions → *Aggregate project pages* → Run on **`main`** → enable import for `harbor-light`. No push trigger on `project/**` branches.

Push to `main` under `project-sources/**` still runs aggregation from the committed snapshot (no branch import).

## Activity JSON schema (validated)

Newest first, max **12** rows:

| Field | Required | Notes |
|-------|----------|--------|
| `at` | yes | ISO timestamp or date |
| `actor` | yes | `human` or `agent` |
| `who` | yes | Display name |
| `verb` | yes | Short public phrase |
| `link` | no | Allowlisted `https://…` or relative `../../queue.html#…` |
| `pending` | no | `true` → ice “waiting on a human decision” (no approve/decline UI) |

(`kind` / `summary` are **not** accepted — use `actor` / `who` / `verb`.)

## Aggregation commands

```bash
python3 scripts/aggregate_projects.py
python3 scripts/aggregate_projects.py --force
python3 scripts/test_aggregate_regression.py   # CI harness
```

## Security

- JSON parse only from project branches; **never** run scripts from `project/**` with write credentials in the commit job.
- **`workflow_dispatch` only on the default branch** (`github.ref` guard). GitHub always runs the **workflow definition** from the branch that owns the workflow file (typically `main`); this repo does **not** claim to “pin” that YAML at runtime—only **`scripts/`** are re-checked out from the resolved default-branch SHA before import/aggregate.
- Writes restricted to `project-sources/<slug>/`, `projects/<slug>/`, `data/projects.json`.
- **Aggregate loop prevention (accurate):**
  - Pushes that change `project-sources/**` match the workflow path filter (including bot commits that refresh the snapshot).
  - The job **`if`** skips runs when the triggering commit message contains **`[aggregate]`** (bot commits). That message check is the guard that stops an import/aggregate bot push from immediately re-running aggregation.
  - Human (or non-bot) commits that change `project-sources/**` without `[aggregate]` in the message still run aggregation—even right after a bot commit.

## Related docs

- Page IA: [`public-intake/PROJECT-PAGE.md`](public-intake/PROJECT-PAGE.md)
- Intake SPEC: [`public-intake/SPEC.md`](public-intake/SPEC.md)
