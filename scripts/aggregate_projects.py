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
SOURCES = Path(
    __import__("os").environ.get("EXOFRAME_PROJECT_SOURCES", str(ROOT / "project-sources"))
).resolve()
ALLOWLIST = frozenset({"harbor-light", "rift-manager"})
SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,62}$")
STATUSES = frozenset({"submitted", "accepted", "building", "shipped"})
ALLOWED_URL_HOSTS = (
    "github.com",
    "www.github.com",
    "raw.githubusercontent.com",
)
ALLOWED_URL_PATH_PREFIXES = (
    "/Moissanite-Labs/exoframe",
    "/Moissanite-Labs/exofab",
    "/ahrazzle/rift-manager",
)
LIVE_GAME_HOSTS = frozenset({"www.rift.askaconsult.com", "rift.askaconsult.com"})

SYNBIOS_STUBS = frozenset({"#synbios-placeholder"})
ACTOR_KINDS = frozenset({"human", "agent"})
ACTIVITY_LINK_PREFIXES = ("../../", "https://")
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


def validate_https_repo_or_live(url: str, field: str) -> str:
    parsed = urlparse(url)
    if parsed.scheme != "https":
        raise SystemExit(f"{field} must be https: {url}")
    host = (parsed.hostname or "").lower()
    if host in LIVE_GAME_HOSTS:
        return url
    if host not in ALLOWED_URL_HOSTS:
        raise SystemExit(f"{field} host not allowlisted: {host}")
    path = parsed.path or ""
    if not any(path == p or path.startswith(p + "/") for p in ALLOWED_URL_PATH_PREFIXES):
        raise SystemExit(f"{field} path not allowlisted: {path}")
    return url


def validate_working_repo(url: str) -> str:
    return validate_https_repo_or_live(url, "working_repo")


def validate_public_href(url: str, field: str) -> str:
    if url in SYNBIOS_STUBS or url.startswith("#"):
        raise SystemExit(f"{field}: invalid or stub URL")
    if url.startswith("../../"):
        if ".." in url[6:] or url.startswith("../../.."):
            raise SystemExit(f"{field}: invalid relative link")
        return url
    return validate_https_repo_or_live(url, field)


def normalize_synbios_url(value: object, field: str) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str):
        raise SystemExit(f"{field} must be a string or null")
    url = value.strip()
    if not url or url in SYNBIOS_STUBS or url.startswith("#"):
        return None
    return validate_working_repo(url)

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
    manifest["synbios_url"] = normalize_synbios_url(manifest.get("synbios_url"), f"{slug}: synbios_url")
    live_url = manifest.get("live_url")
    if live_url is not None:
        if not isinstance(live_url, str) or not live_url.strip():
            raise SystemExit(f"{slug}: invalid live_url")
        manifest["live_url"] = validate_https_repo_or_live(live_url.strip(), f"{slug}: live_url")
    snapshot_at = manifest.get("snapshot_at")
    if snapshot_at is not None and (not isinstance(snapshot_at, str) or not snapshot_at.strip()):
        raise SystemExit(f"{slug}: invalid snapshot_at")
    snapshot_note = manifest.get("snapshot_note")
    if snapshot_note is not None and (not isinstance(snapshot_note, str) or not snapshot_note.strip()):
        raise SystemExit(f"{slug}: invalid snapshot_note")
    for flag in ("example", "case_study", "archived"):
        val = manifest.get(flag, False)
        if val is not True and val is not False:
            raise SystemExit(f"{slug}: {flag} must be boolean")
    submitter = manifest.get("submitter")
    if submitter is not None and (not isinstance(submitter, str) or not submitter.strip()):
        raise SystemExit(f"{slug}: invalid submitter")
    return manifest


def validate_activity(activity: object, slug: str) -> list:
    if not isinstance(activity, list):
        raise SystemExit(f"{slug}: activity must be an array")
    if len(activity) > 12:
        raise SystemExit(f"{slug}: activity exceeds 12 rows")
    for i, row in enumerate(activity):
        if not isinstance(row, dict):
            raise SystemExit(f"{slug}: activity[{i}] must be object")
        for key in ("at", "actor", "who", "verb"):
            if key not in row or not isinstance(row[key], str) or not row[key].strip():
                raise SystemExit(f"{slug}: activity[{i}] missing {key}")
        if row["actor"] not in ACTOR_KINDS:
            raise SystemExit(f"{slug}: activity[{i}] invalid actor")
        pending = row.get("pending", False)
        if pending is not True and pending is not False:
            raise SystemExit(f"{slug}: activity[{i}] pending must be boolean")
        link = row.get("link")
        if link is not None:
            if not isinstance(link, str):
                raise SystemExit(f"{slug}: activity[{i}] link must be string")
            row["link"] = validate_public_href(link.strip(), f"{slug}: activity[{i}] link")
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


def fmt_snapshot_chicago(iso: str) -> str:
    from datetime import datetime
    from zoneinfo import ZoneInfo

    dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=ZoneInfo("UTC"))
    local = dt.astimezone(ZoneInfo("America/Chicago"))
    return local.strftime("%b %d, %Y · %I:%M %p %Z").replace(" 0", " ")


def actor_mark(actor: str) -> str:
    kind = "Person" if actor == "human" else "Agent"
    shape = "human" if actor == "human" else "agent"
    return (
        f'<span class="act-mark {shape}" aria-hidden="true"></span>'
        f'<span class="sr">{kind}</span>'
    )


def render_stage_strip(stage: int) -> str:
    items = []
    for i, name in enumerate(STAGE_NAMES):
        current = ' aria-current="step"' if i == stage else ""
        items.append(f"<li{current}><b>{esc(name)}</b></li>")
    return "\n".join(items)


def render_activity_rows(activity: list) -> str:
    if not activity:
        return '<li class="act-empty">No public activity yet.</li>'
    rows = []
    for row in activity[:12]:
        pending = row.get("pending") is True
        pending_cls = " act-pending" if pending else ""
        link = row.get("link")
        link_html = ""
        if link:
            link_html = f' <a class="act-link" href="{esc(link)}">Details<span class="sr"> for {esc(row["verb"])}</span> →</a>'
        pending_note = (
            '<p class="act-pending-note">Waiting on a human decision</p>' if pending else ""
        )
        rows.append(
            f'<li class="act-item{pending_cls}">'
            f'<time datetime="{esc(row["at"])}">{esc(fmt_activity_at(row["at"]))}</time>'
            f'<p class="act-body">{actor_mark(row["actor"])} '
            f"<span>{esc(row['who'])} · {esc(row['verb'])}</span>"
            f"{link_html}</p>{pending_note}</li>"
        )
    return "\n".join(rows)


def render_project_page(manifest: dict, activity: list) -> str:
    slug = manifest["slug"]
    title = manifest["title"]
    status = manifest["status"]
    stage = int(manifest["stage"])
    blurb = manifest["blurb"]
    working_repo = manifest["working_repo"]
    synbios_url = manifest.get("synbios_url")
    idea_id = manifest.get("idea_id", "")
    opened = manifest.get("opened", "")
    submitter = manifest.get("submitter")
    example = manifest.get("example", False)
    case_study = manifest.get("case_study", False)
    archived = manifest.get("archived", False)
    live_url = manifest.get("live_url")
    snapshot_at = manifest.get("snapshot_at")
    snapshot_note = manifest.get("snapshot_note")

    status_label = STATUS_LABELS.get(status, status.title())

    banner = ""
    gap_note = ""
    if case_study:
        banner = '<p class="notice ex-banner" role="status">PoC case study · external project</p>'
        snap_line = ""
        if snapshot_at:
            snap_line = f"Snapshot as of {esc(fmt_snapshot_chicago(snapshot_at))} (America/Chicago). "
        note = snapshot_note or (
            "Activity is refreshed manually from public GitHub; not a live Synbios feed."
        )
        gap_note = (
            f'<p class="gap-note">{snap_line}{esc(note)} '
            "ExoFab did not originate this game — it is built and maintained in "
            f'<a href="{esc(working_repo)}">ahrazzle/rift-manager</a>. '
            "exoframe showcases the public repo and live deployment as a proof-of-concept project page.</p>"
        )
    elif example and archived:
        banner = '<p class="notice ex-banner" role="status">Archived · example simulation</p>'
        gap_note = (
            '<p class="gap-note">Retired fictional example. Status and activity are simulation only — '
            "no delivered artifact. The linked <code>work/harbor-light</code> branch is a stand-in, "
            "not proof of a built result. See the "
            '<a href="../rift-manager/">Rift Manager case study</a> for a real public project.</p>'
        )
    elif example:
        banner = '<p class="notice ex-banner" role="status">Example project · simulation</p>'
        gap_note = (
            '<p class="gap-note">Status and activity only. No separate working repo yet; '
            "no delivered artifact; Synbios is not linked on the public site yet (example simulation copy only). "
            "Linked <code>work/harbor-light</code> branch is a stand-in, "
            "not proof of a built result.</p>"
        )

    meta_bits = [f"Opened {esc(fmt_date(opened))}"]
    if idea_id:
        meta_bits.append(
            f'<a href="../../queue.html#{esc(idea_id)}">{esc(idea_id)}</a>'
        )
    if submitter:
        meta_bits.append(f"by {esc(submitter)}")
    meta_row = " · ".join(meta_bits)

    actions = ""
    if status in ("building", "shipped"):
        actions += (
            f'<a class="btn ice" href="{esc(working_repo)}" rel="noopener noreferrer" '
            f'target="_blank">Open working repo<span class="sr"> for {esc(title)}</span> →</a>'
        )
        if live_url and isinstance(live_url, str) and live_url.startswith("https://"):
            actions += (
                f' <a class="btn sm" href="{esc(live_url)}" rel="noopener noreferrer" '
                f'target="_blank">Play live game<span class="sr"> for {esc(title)}</span> →</a>'
            )
        if synbios_url and synbios_url.startswith("https://") and synbios_url != working_repo:
            syn_label = (
                "See how it was built" if status == "shipped" else "Building in Synbios"
            )
            actions += (
                f' <a class="tlink" href="{esc(synbios_url)}">{esc(syn_label)}'
                f'<span class="sr"> for {esc(title)}</span> →</a>'
            )

    stage_strip = render_stage_strip(stage)
    activity_html = render_activity_rows(activity)

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
.page{{padding:var(--sp-6) 0 var(--sp-7)}}
.hero{{display:grid;gap:var(--sp-3)}}
h1{{font-weight:500;font-size:clamp(30px,6vw,42px);letter-spacing:-.03em;line-height:1.08;margin:8px 0 0}}
.lede{{color:var(--tx2);margin:0;max-width:60ch;font-size:17px}}
.hero-meta{{font-family:var(--mono);font-size:12px;color:var(--tx2);letter-spacing:.04em;margin:0}}
.hero-meta a{{color:var(--ice)}}
.actions{{display:flex;flex-wrap:wrap;gap:var(--sp-3) var(--sp-4);align-items:center;margin:var(--sp-5) 0 var(--sp-4)}}
.ex-banner{{margin-bottom:var(--sp-3)}}
.gap-note{{margin:0 0 var(--sp-4);color:var(--tx3);font-size:14px;max-width:65ch}}
.gap-note code{{font-family:var(--mono);font-size:12px}}
.stages{{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px;list-style:none;padding:0;margin:0 0 var(--sp-6)}}
.stages li{{border:1px solid var(--line);border-radius:var(--r-m);padding:8px 6px;font-size:12px;color:var(--tx2);text-align:center}}
.stages li b{{display:block;font-family:var(--mono);font-size:10px;letter-spacing:.08em;color:var(--tx3);font-weight:400}}
.stages li[aria-current=step]{{border-color:var(--ice);color:var(--tx)}}
.activity{{list-style:none;padding:0;margin:0;display:grid;gap:var(--sp-4)}}
.activity .act-item{{padding:var(--sp-4) var(--sp-5);border:1px solid var(--line);border-radius:var(--r-l);background:var(--s1)}}
.activity time{{display:block;font-family:var(--mono);font-size:11px;color:var(--tx3);letter-spacing:.06em}}
.act-body{{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:8px 0 0;color:var(--tx2);font-size:15px}}
.act-mark{{display:inline-block;width:10px;height:10px;flex:0 0 auto}}
.act-mark.human{{border-radius:50%;border:1.5px solid var(--carbon);background:var(--carbon-dim)}}
.act-mark.agent{{background:var(--silicon);transform:rotate(45deg) scale(.85)}}
.act-link{{font-size:14px;min-height:44px;display:inline-flex;align-items:center}}
.act-pending{{border-color:#e9f4ff55}}
.act-pending-note{{margin:8px 0 0;font-family:var(--mono);font-size:11px;letter-spacing:.06em;color:var(--ice);text-transform:uppercase}}
.act-empty{{padding:var(--sp-5);color:var(--tx2);text-align:center}}
.back{{margin-top:var(--sp-5);font-size:14px;color:var(--tx3)}}
.back a{{min-height:44px;display:inline-flex;align-items:center}}
@media(max-width:520px){{.stages{{grid-template-columns:repeat(2,1fr)}}}}
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
  {gap_note}
  <header class="hero">
    <span class="st {esc(status)}">{esc(status_label)}</span>
    <h1 id="title">{esc(title)}</h1>
    <p class="lede">{esc(blurb)}</p>
    <p class="hero-meta">{meta_row}</p>
  </header>

  {f'<div class="actions">{actions}</div>' if actions else ''}

  <ol class="stages" aria-label="Project stage">
{stage_strip}
  </ol>

  <section aria-labelledby="act-h">
    <h2 id="act-h" class="mono" style="font-size:12px;margin:0 0 var(--sp-4);color:var(--tx3)">Recent activity</h2>
    <ol class="activity">
{activity_html}
    </ol>
  </section>

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

    for slug in sorted(ALLOWLIST, key=lambda s: (0 if s == "rift-manager" else 1, s)):
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
