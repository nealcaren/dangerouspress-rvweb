#!/usr/bin/env python3
"""Pull the Red Spring collection (1919 Black-press-only test, issues March 1 - July 15; research collection 1919_dp)
into redspring/1919/.

  python3 scripts/import_redspring.py                 # office:.../data/site_export/1919_dp -> redspring/1919/
  python3 scripts/import_redspring.py --source path/or/host:path/to/site_export

Copies the export to .staging/redspring, checks the files the atlas and reader read (manifest, atlas, reader, cases,
base map), uploads the clippings to R2 (rvweb/redspring-1919/img), swaps it into redspring/1919/ and rebuilds the
shells (scripts/build_site.py). Like lynching/, redspring/ is kept apart from the August series: years.json, the series
atlas and compare/ do not see it.
"""
import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT = "office:GitHub/dangerouspress-racialviolence/data/site_export"
COLL, YEAR = "1919_dp", "1919"


def check(base):
    errs = []
    need = ["manifest.json", "atlas/data.json", "reader/data.json"]
    errs += [f"missing {f}" for f in need if not (base / f).is_file()]
    if errs:
        return errs
    rd = {e["id"] for e in json.loads((base / "reader/data.json").read_text())["episodes"]}
    at = json.loads((base / "atlas/data.json").read_text())
    errs += [f"atlas case without a case file: {e['dir']}" for e in at["episodes"] if not (base / "cases" / f"{e['dir']}.json").is_file()]
    errs += [f"reader case without a case file: {i}" for i in rd if not (base / "cases" / f"{i}.json").is_file()]
    if not list((base / "atlas").glob("basemap-*.json")):
        errs.append("no base map in atlas/")
    return errs


sys.path.insert(0, str(Path(__file__).resolve().parent))
from r2_images import publish as publish_images  # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", default=DEFAULT)
    a = ap.parse_args()
    stage, live = ROOT / ".staging" / "redspring", ROOT / "redspring" / YEAR
    if stage.exists():
        shutil.rmtree(stage)
    stage.parent.mkdir(exist_ok=True)
    subprocess.run(["rsync", "-a", f"{a.source.rstrip('/')}/{COLL}/", f"{stage}/"], check=True)
    errs = check(stage)
    if errs:
        raise SystemExit("Validation failed; the live page is unchanged:\n  " + "\n  ".join(errs[:40]))
    publish_images(stage, f"redspring-{YEAR}")   # clippings -> R2 rvweb/redspring-1919/img, case files repointed
    live.parent.mkdir(exist_ok=True)
    old = ROOT / ".staging" / "old-redspring"
    if old.exists():
        shutil.rmtree(old)
    if live.exists():
        live.rename(old)
    stage.rename(live)
    if old.exists():
        shutil.rmtree(old)
    subprocess.run([sys.executable, str(ROOT / "scripts/build_site.py")], check=True)


if __name__ == "__main__":
    main()
