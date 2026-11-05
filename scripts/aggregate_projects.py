#!/usr/bin/env python3
"""Aggregate allowlisted project-sources into published Pages (JSON parse only)."""

from __future__ import annotations

import argparse
import hashlib
import html
import json
import re
import sys
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
SOURCES = ROOT / "project-sources"
ALLOWLIST = frozenset({"harbor-light"})
SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,62}$")
STATUSES = frozenset({"submitted", "accepted", "building", "shipped"})
ALLOWED_URL_HOSTS = (
    "github.com",
    "www.github.com",
    "raw.githubusercontent.com",
)
ALLOWED_URL_PATH_PREFIXES = (
    "/Moissanite-Labs/exoframe/",
    "/Moissanite-Labs/exofab/",
)

STAGE_NAMES = ("Idea", "Shape", "Prototype", "Build", "Ship")
STATUS_LABELS = {
    "submitted": "Submitted",
    "accepted": "Accepted",
    "building": "Building",
    "shipped": "Shipped",
}

WRITABLE_TOP = frozenset({"projects", "data"})
PROJECTS_JSON = ROOT / "data" / "projects.json"


def esc(text: object) -> str:
    return html.escape(str(text), quote=True)


def assert_safe_slug(slug: str) -> None:
    if slug not in ALLOWLIST:
        raise SystemExit(f"slug not allowlisted: {slug}")
    if not SLUG_RE.match(slug):
        raise SystemExit(f"invalid slug: {slug}")


def resolve_source_dir(slug: str) -> Path:
    assert_safe_slug(slug)
    src = (SOURCES / slug).resolve()
    sources_root = SOURCES.resolve()
    if not str(src).startswith(str(sources_root) + "/") and src != sources_root:
        raise SystemExit(f"path escape blocked for slug: {slug}")
    return src


def resolve_output_dir(slug: str) -> Path:
    assert_safe_slug(slug)
    out = (ROOT / "projects" / slug).resolve()
    projects_root = (ROOT / "projects").resolve()
    if not str(out).startswith(str(projects_root) + "/"):
        raise SystemExit(f"output path escape blocked: {slug}")
    return out


def load_json(path: Path) -> object:
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def validate_working_repo(url: str) -> str:
    parsed = urlparse(url)
    if parsed.scheme != "https":
        raise SystemExit(f"working_repo must be https: {url}")
    host = (parsed.hostname or "").lower()
    if host not in ALLOWED_URL_HOSTS:
        raise SystemExit(f"working_repo host not allowlisted: {host}")
    path = parsed.path or ""
    if not any(path.startswith(prefix) for prefix in ALLOWED_URL_PATH_PREFIXES):
        raise SystemExit(f"working_repo path not allowlisted: {path}")
    return url


def validate_manifest(manifest: object, slug: str) -> dict:
    if not isinstance(manifest, dict):
        raise SystemExit(f"{slug}: manifest must be an object")
    required = ("slug", "title", "idea_id", "status", "stage", "blurb", "working_repo", "opened")
    for key in required:
        if key not in manifest:
            raise SystemExit(f"{slug}: manifest missing {key}")
    if manifest["slug"] != slug:
        raise SystemExit(f"{slug}: manifest slug mismatch")
    status = manifest["status"]
    if status not in STATUSES:
        raise SystemExit(f"{slug}: invalid status {status}")
    stage = manifest["stage"]
    if not isinstance(stage, int) or stage < 0 or stage > 4:
        raise SystemExit(f"{slug}: stage must be int 0..4")
    if not isinstance(manifest["title"], str) or not manifest["title"].strip():
        raise SystemExit(f"{slug}: invalid title")
    if not isinstance(manifest["blurb"], str):
        raise SystemExit(f"{slug}: invalid blurb")
    manifest = dict(manifest)
    manifest["working_repo"] = validate_working_repo(str(manifest["working_repo"]))
    return manifest


def validate_activity(activity: object, slug: str) -> list:
    if not isinstance(activity, list):
        raise SystemExit(f"{slug}: activity must be an array")
    for i, row in enumerate(activity):
        if not isinstance(row, dict):
            raise SystemExit(f"{slug}: activity[{i}] must be object")
        for key in ("at", "kind", "summary"):
            if key not in row or not isinstance(row[key], str) or not row[key].strip():
                raise SystemExit(f"{slug}: activity[{i}] missing {key}")
    return activity


def input_fingerprint(manifest_path: Path, activity_path: Path) -> str:
    h = hashlib.sha256()
    h.update(manifest_path.read_bytes())
    h.update(b"\0")
    h.update(activity_path.read_bytes())
    return h.hexdigest()


def outputs_up_to_date(out_dir: Path, fingerprint: str, force: bool) -> bool:
    if force:
        return False
    stamp = out_dir / ".source-sha256"
    page = out_dir / "index.html"
    if not stamp.is_file() or not page.is_file():
        return False
    if stamp.read_text(encoding="utf-8").strip() != fingerprint:
        return False
    # Outputs exist and match current inputs.
    return True


def fmt_date(iso_date: str) -> str:
    y, m, d = iso_date.split("-")[:3]
    from datetime import date

    return date(int(y), int(m), int(d)).strftime("%b %d, %Y")


def fmt_activity_at(iso: str) -> str:
    if "T" not in iso:
        return fmt_date(iso)
    from datetime import datetime

    dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
    return dt.strftime("%b %d, %Y · %H:%M UTC")


def render_project_page(manifest: dict, activity: list) -> str:
    slug = manifest["slug"]
    title = manifest["title"]
    status = manifest["status"]
    stage = int(manifest["stage"])
    blurb = manifest["blurb"]
    working_repo = manifest["working_repo"]
    idea_id = manifest.get("idea_id", "")
    opened = manifest.get("opened", "")
    example = manifest.get("example", False)

    status_label = STATUS_LABELS.get(status, status.title())
    stage_name = STAGE_NAMES[stage]

    activity_items = ""
    for row in activity:
        activity_items += (
            f'<li class="act-item"><time datetime="{esc(row["at"])}">'
            f"{esc(fmt_activity_at(row['at']))}</time>"
            f'<span class="act-kind">{esc(row.get("kind", "update"))}</span>'
            f"<p>{esc(row['summary'])}</p></li>\n"
        )

    if example:
        banner = (
            '<p class="notice ex-banner" role="status">'
            "Example · simulation · status and activity only. "
            "No separate working repo yet. No delivered artifact yet."
            "</p>"
        )
        work_detail = (
            "Linked stand-in only (branch work/harbor-light): not a separate "
            "working repo and not evidence of a built result. Provisioning a dedicated "
            "repo still needs approval."
        )
    else:
        banner = ""
        work_detail = "Build work lives on the linked working surface."

    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{esc(title)} · ExoFab project</title>
<meta name="description" content="{esc(blurb)}">
<meta name="theme-color" content="#08090a">
<link rel="icon" href="../../assets/mark.svg" type="image/svg+xml">
<link rel="stylesheet" href="../../tokens.css">
<style>
.page{{padding-top:var(--sp-6);padding-bottom:var(--sp-6)}}
.ph{{display:flex;flex-wrap:wrap;gap:var(--sp-4);justify-content:space-between;align-items:flex-start}}
h1{{font-weight:500;font-size:clamp(28px,6vw,40px);letter-spacing:-.03em;line-height:1.1;margin:10px 0 8px}}
.lede{{color:var(--tx2);margin:0;max-width:60ch}}
.meta{{display:flex;flex-wrap:wrap;gap:8px 12px;align-items:center;margin-top:var(--sp-3)}}
.stage{{font-family:var(--mono);font-size:12px;color:var(--tx3);letter-spacing:.06em}}
.grid{{display:grid;gap:var(--sp-5);margin-top:var(--sp-5)}}
@media(min-width:720px){{.grid{{grid-template-columns:1fr 1fr}}}}
.section{{padding:var(--sp-5)}}
.section h2{{margin:0 0 var(--sp-4);font-size:17px;font-weight:500}}
.act{{list-style:none;padding:0;margin:0;display:grid;gap:var(--sp-4)}}
.act-item{{border-left:2px solid var(--line-2);padding-left:var(--sp-4)}}
.act-item time{{display:block;font-family:var(--mono);font-size:11px;color:var(--tx3);letter-spacing:.06em}}
.act-kind{{display:inline-block;margin-top:4px;font-family:var(--mono);font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:var(--silicon)}}
.act-item p{{margin:6px 0 0;color:var(--tx2)}}
.links{{display:flex;flex-wrap:wrap;gap:var(--sp-3);margin-top:var(--sp-4)}}
.ex-banner{{margin-bottom:var(--sp-4);max-width:72ch;line-height:1.45}}
.gap-note{{margin:0;color:var(--tx3);font-size:14px;max-width:60ch}}
.back{{margin-top:var(--sp-6);font-size:14px;color:var(--tx3)}}
.back a{{min-height:44px;display:inline-flex;align-items:center}}
</style>
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="top"><div class="wrap">
  <a class="brand" href="../../index.html" aria-label="ExoFab public intake, home"><img src="../../assets/mark.svg" width="22" height="22" alt="">EXOFAB</a>
  <span class="chip">public project</span>
  <nav class="nav" aria-label="Primary"><a href="../../submit.html">Submit</a><a href="../../queue.html">Queue</a></nav>
</div></header>

<main id="main">
<div class="wrap page">
  {banner}
  <div class="ph">
    <div>
      <span class="mono">ExoFab project</span>
      <h1 id="title">{esc(title)}</h1>
      <p class="lede">{esc(blurb)}</p>
      <div class="meta">
        <span class="st {esc(status)}">{esc(status_label)}</span>
        <span class="stage">Stage {stage + 1} of 5 · {esc(stage_name)}</span>
        {f'<span class="id mono" style="font-size:11px">{esc(idea_id)}</span>' if idea_id else ""}
      </div>
    </div>
  </div>

  <div class="grid">
    <section class="panel section" aria-labelledby="work-h">
      <h2 id="work-h">Working surface{" (stand-in)" if example else ""}</h2>
      <p class="gap-note">{esc(work_detail)}</p>
      <p style="margin:var(--sp-3) 0 0;color:var(--tx2);font-size:15px">This page shows public status and activity only—not a shipped build.</p>
      <div class="links">
        <a class="btn sm" href="{esc(working_repo)}">{"View stand-in branch" if example else "Open working surface"}<span class="sr"> for {esc(title)}</span></a>
      </div>
      {f'<p style="margin:var(--sp-3) 0 0;color:var(--tx3);font-size:14px">Opened {esc(fmt_date(opened))}</p>' if opened else ""}
    </section>

    <section class="panel section" aria-labelledby="act-h">
      <h2 id="act-h">Recent activity</h2>
      <ul class="act" id="activity">
{activity_items}      </ul>
    </section>
  </div>

  <p class="back"><a href="../../queue.html#{esc(idea_id)}">← Back to queue</a> · <a href="../../index.html">Home</a></p>
  <p class="ex" style="margin-top:var(--sp-4)">Generated from project-sources/{esc(slug)}/ · edit activity there, then run aggregation</p>
</div>
</main>
<footer class="foot"><div class="wrap">
  <p>Moissanite Labs · <a href="https://github.com/Moissanite-Labs/exofab">ExoFab</a></p>
  <p>We build in the open, with the people we build for.</p>
</div></footer>
</body>
</html>
"""


def safe_write(path: Path, content: str) -> bool:
    path = path.resolve()
    rel = path.relative_to(ROOT.resolve())
    parts = rel.parts
    if parts[0] not in WRITABLE_TOP:
        raise SystemExit(f"refusing to write outside allowlist: {rel}")
    if parts[0] == "projects":
        if len(parts) < 3:
            raise SystemExit(f"invalid projects write path: {rel}")
        assert_safe_slug(parts[1])
        if parts[2] not in ("index.html", "activity.json", ".source-sha256"):
            raise SystemExit(f"invalid projects artifact: {rel}")
    elif parts[0] == "data":
        if rel != PROJECTS_JSON.relative_to(ROOT):
            raise SystemExit(f"invalid data write path: {rel}")
    prev = path.read_text(encoding="utf-8") if path.exists() else ""
    if prev == content:
        return False
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    return True


def aggregate(force: bool = False) -> bool:
    changed = False
    projects_out: list[dict] = []

    for slug in sorted(ALLOWLIST):
        src = resolve_source_dir(slug)
        manifest_path = src / "manifest.json"
        activity_path = src / "activity.json"
        if not manifest_path.is_file() or not activity_path.is_file():
            print(f"skip {slug}: missing manifest or activity", file=sys.stderr)
            continue

        manifest = validate_manifest(load_json(manifest_path), slug)
        activity = validate_activity(load_json(activity_path), slug)
        fingerprint = input_fingerprint(manifest_path, activity_path)
        out_dir = resolve_output_dir(slug)

        if outputs_up_to_date(out_dir, fingerprint, force):
            print(f"skip {slug}: outputs already match sources (use --force to overwrite)")
            projects_out.append(
                {
                    "slug": slug,
                    "idea_id": manifest.get("idea_id"),
                    "title": manifest.get("title"),
                    "status": manifest.get("status"),
                    "stage": manifest.get("stage"),
                    "example": manifest.get("example", False),
                    "opened": manifest.get("opened"),
                }
            )
            continue

        page_html = render_project_page(manifest, activity)
        if safe_write(out_dir / "index.html", page_html):
            changed = True
            print(f"wrote projects/{slug}/index.html")

        act_text = json.dumps(activity, indent=2) + "\n"
        if safe_write(out_dir / "activity.json", act_text):
            changed = True

        if safe_write(out_dir / ".source-sha256", fingerprint + "\n"):
            changed = True

        projects_out.append(
            {
                "slug": slug,
                "idea_id": manifest.get("idea_id"),
                "title": manifest.get("title"),
                "status": manifest.get("status"),
                "stage": manifest.get("stage"),
                "example": manifest.get("example", False),
                "opened": manifest.get("opened"),
            }
        )

    index_text = json.dumps({"example": True, "projects": projects_out}, indent=2) + "\n"
    if safe_write(PROJECTS_JSON, index_text):
        changed = True
        print("wrote data/projects.json")

    return changed


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--force",
        action="store_true",
        help="Overwrite generated pages even when source fingerprint unchanged",
    )
    args = parser.parse_args()
    changed = aggregate(force=args.force)
    if not changed:
        print("aggregate: no file changes")
    sys.exit(0)


if __name__ == "__main__":
    main()
