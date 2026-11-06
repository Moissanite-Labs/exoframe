# Rift Manager — branch import proof

Recorded on the PR branch after pushing **`project/rift-manager`** (JSON-only branch root).

| Item | Value |
|------|--------|
| Branch | `project/rift-manager` |
| Branch tip SHA | `8097442030771a965b64f30b49c75d117ff44c1a` |
| Import allowlist | `scripts/import_project_branch.py` → `harbor-light`, `rift-manager` |
| CI publish | Actions → **Aggregate project pages** → `workflow_dispatch` on **`main`** only → import slug `rift-manager` (workflow choice already on `main`; merge PR before using production workflow) |

## Commands (local proof)

Deliberate drift: `project-sources/rift-manager/activity.json` was replaced with stale one-row JSON before import.

```bash
git fetch origin project/rift-manager
python3 scripts/import_project_branch.py rift-manager
python3 scripts/aggregate_projects.py --force
python3 scripts/test_aggregate_regression.py
```

### Transcript (exit codes)

```
$ git fetch origin project/rift-manager
exit 0

$ python3 scripts/import_project_branch.py rift-manager
wrote project-sources/rift-manager/manifest.json
wrote project-sources/rift-manager/activity.json
exit 0

$ python3 scripts/aggregate_projects.py --force
wrote projects/rift-manager/index.html
wrote projects/harbor-light/index.html
exit 0

$ python3 scripts/test_aggregate_regression.py
... Ran 6 tests in 0.218s
OK
exit 0
```

### Generated page checks (`projects/rift-manager/index.html`)

| Check | Result |
|-------|--------|
| `act-mark unknown` (neutral account mark) | YES |
| Screen reader label `Account` | YES |
| Activity text `Merged PR #38` | YES |
| Banner `PoC case study` | YES |

Activity rows on the branch use `actor: "unknown"` with `who` set to GitHub handles (`ahrazzle`, `orda-aska`) or `exoframe` for the live-verify snapshot row — no human/agent attribution on shared accounts.
