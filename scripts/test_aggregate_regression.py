#!/usr/bin/env python3
"""Regression harness for project aggregation (run in CI and locally)."""

from __future__ import annotations

import json
import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
sys.path.insert(0, str(SCRIPTS))

import aggregate_projects as agg  # noqa: E402
import import_project_branch as imp  # noqa: E402


class AggregateRegression(unittest.TestCase):
    def test_rejects_bad_slug(self) -> None:
        with self.assertRaises(SystemExit):
            agg.assert_safe_slug("not-allowlisted")

    def test_accepts_unknown_actor(self) -> None:
        row = [
            {
                "at": "2026-01-01T12:00:00Z",
                "actor": "unknown",
                "who": "ahrazzle",
                "verb": "Merged PR #1",
            }
        ]
        out = agg.validate_activity(row, "rift-manager")
        self.assertEqual(out[0]["actor"], "unknown")

    def test_rejects_bad_activity_schema(self) -> None:
        bad = [{"at": "2026-01-01", "kind": "x", "summary": "legacy field"}]
        with self.assertRaises(SystemExit):
            agg.validate_activity(bad, "harbor-light")

    def test_rejects_bad_manifest_status(self) -> None:
        manifest = {
            "slug": "harbor-light",
            "title": "T",
            "idea_id": "idea-0042",
            "status": "bogus",
            "stage": 2,
            "blurb": "b",
            "working_repo": "https://github.com/Moissanite-Labs/exoframe/tree/work/harbor-light",
            "opened": "2026-10-28",
        }
        with self.assertRaises(SystemExit):
            agg.validate_manifest(manifest, "harbor-light")

    def test_rejects_synbios_fragment(self) -> None:
        with self.assertRaises(SystemExit):
            agg.validate_public_href("#synbios-placeholder", "test")

    def test_project_branch_import_updates_generated_page(self) -> None:
        fetch = subprocess.run(
            ["git", "fetch", "--depth=1", "origin", "project/harbor-light"],
            cwd=ROOT,
            capture_output=True,
            text=True,
        )
        if fetch.returncode != 0:
            self.skipTest(f"cannot fetch project branch: {fetch.stderr.strip()}")

        imp.import_branch("harbor-light", ROOT)
        branch_raw = subprocess.check_output(
            ["git", "show", "origin/project/harbor-light:activity.json"],
            cwd=ROOT,
            text=True,
        )
        branch_activity = json.loads(branch_raw)
        marker = branch_activity[0]["verb"]

        proc = subprocess.run(
            [sys.executable, str(SCRIPTS / "aggregate_projects.py"), "--force"],
            cwd=ROOT,
            capture_output=True,
            text=True,
        )
        self.assertEqual(proc.returncode, 0, proc.stderr)
        html = (ROOT / "projects/harbor-light/index.html").read_text(encoding="utf-8")
        self.assertIn(marker, html, "imported branch activity must appear in generated HTML")

    def test_fmt_activity_at_offset_keeps_chicago_calendar_day(self) -> None:
        rendered = agg.fmt_activity_at("2026-11-05T18:59:56-06:00")
        self.assertIn("Nov 5, 2026", rendered)
        self.assertRegex(rendered, r"CST|CDT")
        self.assertNotIn("UTC", rendered)
        self.assertNotIn("Nov 6, 2026", rendered)

    def test_fmt_activity_at_z_converts_to_chicago(self) -> None:
        rendered = agg.fmt_activity_at("2026-11-06T00:50:43Z")
        self.assertIn("Nov 5, 2026", rendered)
        self.assertRegex(rendered, r"CST|CDT")
        self.assertNotIn("UTC", rendered)

    def test_rift_generated_page_live_verify_chicago_not_utc(self) -> None:
        proc = subprocess.run(
            [sys.executable, str(SCRIPTS / "aggregate_projects.py"), "--force"],
            cwd=ROOT,
            capture_output=True,
            text=True,
        )
        self.assertEqual(proc.returncode, 0, proc.stderr)
        html = (ROOT / "projects/rift-manager/index.html").read_text(encoding="utf-8")
        self.assertIn("Live game verified at rift.askaconsult.com", html)
        self.assertIn("Nov 5, 2026 · 6:59 PM CST", html)
        self.assertNotIn("18:59 UTC", html)


if __name__ == "__main__":
    unittest.main(verbosity=2)
