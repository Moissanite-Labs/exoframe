# exoframe

Host repo for **[ExoFab](https://github.com/Moissanite-Labs/exofab) public intake** and **public project pages** — ask what to build, watch status and activity as work proceeds.

**Live site:** [https://moissanite-labs.github.io/exoframe/](https://moissanite-labs.github.io/exoframe/)

## What this repo serves

GitHub Pages publishes static HTML at the repository root:

- **Intake:** `index.html`, `submit.html`, `queue.html` (Crystal Lattice UI; see [`docs/design/public-intake/SPEC.md`](docs/design/public-intake/SPEC.md))
- **Projects:** `projects/<slug>/` generated from `project-sources/<slug>/` (EXAMPLE: [Harbor Light](projects/harbor-light/))

Design sources and screenshots live under [`docs/design/public-intake/`](docs/design/public-intake/). Project-flow architecture: [`docs/design/project-flow.md`](docs/design/project-flow.md).

### Harbor Light (EXAMPLE)

The Harbor Light project page is **simulation data** only: it shows **status and activity**, not a shipped artifact. There is **no separate working repo yet**; `work/harbor-light` is a **labeled stand-in branch**, not evidence of a built result.

## Local preview

```bash
python3 scripts/aggregate_projects.py   # refresh projects/ from project-sources/
python3 -m http.server 8000
# open http://127.0.0.1:8000/queue.html and http://127.0.0.1:8000/projects/harbor-light/
```

## Brand

Use **ExoFab** for the product. **exoframe** is this GitHub host only — not a product name.
