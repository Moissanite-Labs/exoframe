# ExoFab public intake — design package

Design-only package for grk-smith. Product: **ExoFab public intake**, hosted in the `Moissanite-Labs/exoframe` repo and served at https://moissanite-labs.github.io/exoframe.

## Open the prototypes
No build, no server, no network. Open directly in a browser:

- `prototypes/index.html` — landing + Harbor Light lattice hero
- `prototypes/submit.html` — form (`?done=1` shows the success state; submitting empty shows errors)
- `prototypes/queue.html` — queue with filters (`?status=building` preselects; `?empty=1` shows the empty state)

Or serve: `cd docs/design/public-intake && python3 -m http.server 8000` → http://localhost:8000/prototypes/

Pages are generated from `prototypes/src/*.src` (shared header/footer, inlined `data/ideas.json`) with `python3 prototypes/src/build.py` run from `prototypes/`. Edit `.src`, not `.html`.

- `SPEC.md` — build spec
- `assets/mark.svg` — ExoFab hex mark (only asset)
- `shots/` — Playwright screenshots at 390 and 1440, plus focus, error, and success states
