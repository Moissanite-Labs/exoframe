# exoframe

**ExoFab** is a **human–agent creation hub**: people bring ideas, and people and agents build in the open together. This repo (**exoframe**) is the GitHub Pages host for ExoFab’s proof-of-concept **public intake** and **project pages** — not the ExoFab product itself. We use it to validate **idea → visible progress → built result** on static Pages before a standalone ExoFab product ships.

**Live site:** [https://moissanite-labs.github.io/exoframe/](https://moissanite-labs.github.io/exoframe/)

## Brand

- **ExoFab** — the product (see [Moissanite-Labs/exofab](https://github.com/Moissanite-Labs/exofab)).
- **exoframe** — this GitHub host only; not a product name.

## What is live today

| Area | Status |
|------|--------|
| Public intake UI (`index.html`, `submit.html`, `queue.html`) | **Live** on GitHub Pages (Crystal Lattice styling; see [`docs/design/public-intake/SPEC.md`](docs/design/public-intake/SPEC.md)) |
| Queue / idea list | **Committed JSON** — `data/ideas.json` (regenerated from GitHub issues via intake sync workflow) |
| Submit form | **Worker-backed when configured** — `assets/config.js` sets `EXO_API_BASE`; see [`docs/design/public-intake/WORKER-DEPLOY.md`](docs/design/public-intake/WORKER-DEPLOY.md) |
| Project pages `projects/<slug>/` | **Live** when generated and merged to `main` (merge deploys Pages) |
| Synbios links on queue | **Missing** — no live Synbios feed on the public site |
| Automatic “project branch → Pages” | **Manual** — run import + aggregate (see [`docs/design/project-flow.md`](docs/design/project-flow.md)) |

## PoC case study: Rift Manager (real)

The primary public example is **[Rift Manager](projects/rift-manager/)** — a real game maintained in [ahrazzle/rift-manager](https://github.com/ahrazzle/rift-manager), playable at [https://www.rift.askaconsult.com/](https://www.rift.askaconsult.com/).

- **Honesty:** ExoFab / exoframe **did not originate** this game. We showcase a **public repo and live deployment** as the PoC “project page” shape.
- **Project page:** Full **Crystal Lattice** composition (`projects/rift-manager/`) seeded from verified public sources (PRs #1, #11, #13, #22, #23, #25, #14, #30, #32, #35, #39, v1.0.0 tag, live game). Gaps (formal Release, launch outcomes, traction, community activity, opted-in crew) show **Pending**. Activity JSON remains for import provenance; the lattice is authoritative for the visitor view.
- **Sources:** allowlisted branch **`project/rift-manager`** (`manifest.json`, `activity.json`, optional `lattice.json`) → import → `project-sources/rift-manager/` → `scripts/aggregate_projects.py` → `projects/rift-manager/`.

## Harbor Light (retired simulation)

[Harbor Light](projects/harbor-light/) remains as an **archived fictional example** only (lattice demo data, simulated agents, stand-in `work/harbor-light` branch). It is **not** a shipped artifact and is **not** the live proof — see Rift Manager above.

## Source model (preserve)

```
project/<slug> branch (JSON at branch root)
        ↓  scripts/import_project_branch.py  (optional; manual or workflow_dispatch)
project-sources/<slug>/{manifest.json,activity.json[,lattice.json]}
        ↓  scripts/aggregate_projects.py
projects/<slug>/index.html + activity.json
        ↓  merge to main
GitHub Pages deploy
```

Import allowlist today: **`harbor-light`**, **`rift-manager`**. See [`docs/design/rift-manager-case-study/IMPORT.md`](docs/design/rift-manager-case-study/IMPORT.md) for a recorded import proof.

## Local preview

```bash
git fetch origin project/rift-manager
python3 scripts/import_project_branch.py rift-manager
python3 scripts/aggregate_projects.py --force
python3 -m http.server 8000
# http://127.0.0.1:8000/  ·  queue  ·  projects/rift-manager/
python3 scripts/test_aggregate_regression.py
```

## Deploy note

Merging to **`main`** updates the **live** GitHub Pages site. Treat merge as production deploy; review before merge.

## Intake queue sync

Workflow [`.github/workflows/sync-ideas-from-issues.yml`](.github/workflows/sync-ideas-from-issues.yml) rebuilds `data/ideas.json` from open GitHub issues labeled `intake:public` when an issue is edited, labeled `intake:listed`, or when you run **workflow_dispatch**.

Commits pushed by **`GITHUB_TOKEN`** do **not** trigger other GitHub Actions workflows (including the default Pages build). After an `[intake-sync]` commit lands on `main`, either push a normal commit to kick Pages, merge via a human-owned token, or run your Pages deploy workflow manually (**workflow_dispatch**) if you have one configured.
