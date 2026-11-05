#!/usr/bin/env python3
"""Copy allowlisted project branch JSON into project-sources/ (parse only, no branch code)."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ALLOWLIST = frozenset({"harbor-light"})
JSON_FILES = ("manifest.json", "activity.json")


def branch_for_slug(slug: str) -> str:
    if slug not in ALLOWLIST:
        raise SystemExit(f"slug not allowlisted: {slug}")
    override = __import__("os").environ.get("EXOFRAME_PROJECT_GIT_REF")
    if override:
        if ".." in override or override.startswith("/"):
            raise SystemExit("invalid EXOFRAME_PROJECT_GIT_REF")
        return override
    ref = f"origin/project/{slug}"
    return ref


def git_show(repo: Path, ref: str, filename: str) -> str:
    if filename not in JSON_FILES:
        raise SystemExit(f"refusing non-json file: {filename}")
    spec = f"{ref}:{filename}"
    proc = subprocess.run(
        ["git", "-C", str(repo), "show", spec],
        capture_output=True,
        text=True,
        check=False,
    )
    if proc.returncode != 0:
        raise SystemExit(f"git show {spec} failed: {proc.stderr.strip()}")
    return proc.stdout


def import_branch(slug: str, repo: Path | None = None) -> Path:
    repo = (repo or ROOT).resolve()
    ref = branch_for_slug(slug)
    dest_dir = repo / "project-sources" / slug
    dest_dir.mkdir(parents=True, exist_ok=True)

    for name in JSON_FILES:
        raw = git_show(repo, ref, name)
        json.loads(raw)  # untrusted content: JSON parse only
        out = dest_dir / name
        out.write_text(raw if raw.endswith("\n") else raw + "\n", encoding="utf-8")
        print(f"wrote {out.relative_to(repo)}")

    return dest_dir


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("usage: import_project_branch.py <slug>")
    import_branch(sys.argv[1])
    sys.exit(0)


if __name__ == "__main__":
    main()
