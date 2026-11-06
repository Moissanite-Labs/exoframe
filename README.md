# exoframe

GitHub Pages host for **ExoFab’s proof-of-concept intake and project pages** — not the ExoFab product itself. This repo lets us validate the flow **idea → visible progress → built result** on static Pages before a standalone ExoFab product ships.

**Live site:** [https://moissanite-labs.github.io/exoframe/](https://moissanite-labs.github.io/exoframe/)

## Brand

- **ExoFab** — the product (see [Moissanite-Labs/exofab](https://github.com/Moissanite-Labs/exofab)).
- **exoframe** — this GitHub host only; not a product name.

## What is live today

| Area | Status |
|------|--------|
| Public intake UI (`index.html`, `submit.html`, `queue.html`) | **Live** on GitHub Pages (Crystal Lattice styling; see [`docs/design/public-intake/SPEC.md`](docs/design/public-intake/SPEC.md)) |
| Queue / idea list | **Example + manual** — prototype data in `data/ideas.json` (inlined in `queue.html` for `file://`); not wired to a live API |
| Submit form | **UI only** — no backend intake pipeline on Pages |
| Project pages `projects/<slug>/` | **Live** when generated and merged to `main` (merge deploys Pages) |
| Synbios links on queue | **Missing** — no live Synbios feed on the public site |
| Automatic “project branch → Pages” | **Manual** — run import + aggregate (see [`docs/design/project-flow.md`](docs/design/project-flow.md)) |

## PoC case study: Rift Manager (real)

The primary public example is **[Rift Manager](projects/rift-manager/)** — a real game maintained in [ahrazzle/rift-manager](https://github.com/ahrazzle/rift-manager), playable at [https://www.rift.askaconsult.com/](https://www.rift.askaconsult.com/).

- **Honesty:** ExoFab / exoframe **did not originate** this game. We showcase a **public repo and live deployment** as the PoC “project page” shape.
- **Activity on the project page:** Copied **manually** from public GitHub merges/tags. Each refresh is labeled with a snapshot time (America/Chicago). **Not** a live Synbios stream.
- **Sources:** `project-sources/rift-manager/{manifest.json,activity.json}` → `scripts/aggregate_projects.py` → `projects/rift-manager/`.

## Harbor Light (retired simulation)

[Harbor Light](projects/harbor-light/) remains as an **archived fictional example** only (lattice demo data, simulated agents, stand-in `work/harbor-light` branch). It is **not** a shipped artifact and is **not** the live proof — see Rift Manager above.

## Source model (preserve)

```
project-sources/<slug>/{manifest.json,activity.json}
        ↓  scripts/aggregate_projects.py
projects/<slug>/index.html + activity.json
        ↓  merge to main
GitHub Pages deploy
```

Optional: `scripts/import_project_branch.py` copies JSON from allowlisted `project/<slug>` branches (today: **harbor-light** only).

## Local preview

```bash
python3 scripts/aggregate_projects.py --force   # refresh projects/ from project-sources/
python3 -m http.server 8000
# http://127.0.0.1:8000/  ·  queue  ·  projects/rift-manager/
python3 scripts/test_aggregate_regression.py
```

## Deploy note

Merging to **`main`** updates the **live** GitHub Pages site. Treat merge as production deploy; review before merge.
