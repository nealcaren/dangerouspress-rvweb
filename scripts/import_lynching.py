#!/usr/bin/env python3
"""Pull a lynching-year export (a namespaced collection such as 1888_lyn) from the research repo into lynching/<YEAR>/.

  python3 scripts/import_lynching.py 1888                 # office:.../data/site_export/1888_lyn -> lynching/1888/
  python3 scripts/import_lynching.py 1888 --source path/or/host:path/to/site_export

The research repo writes data/site_export/<YEAR>_lyn/ with site_export.py ... --lynch-compare. This copies it to
.staging/lynching-<YEAR>, checks that the files the lynching page reads are there and agree (manifest, atlas, cases,
lynch_compare.json), swaps it into lynching/<YEAR>/ and rebuilds the shells (scripts/build_site.py). The lynching page
is kept apart from the August series: lynching/ is not a <year>/ collection, so years.json, the series atlas and
compare/ do not see it. No clipping images yet (exported with --no-clips).
"""
import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT = "office:GitHub/dangerouspress-racialviolence/data/site_export"


def check(base):
    errs = []
    need = ["manifest.json", "atlas/data.json", "reader/data.json", "lynch_compare.json"]
    errs += [f"missing {f}" for f in need if not (base / f).is_file()]
    if errs:
        return errs
    rd = {e["id"] for e in json.loads((base / "reader/data.json").read_text())["episodes"]}
    at = json.loads((base / "atlas/data.json").read_text())
    errs += [f"atlas case without a case file: {e['dir']}" for e in at["episodes"] if not (base / "cases" / f"{e['dir']}.json").is_file()]
    errs += [f"reader case without a case file: {i}" for i in rd if not (base / "cases" / f"{i}.json").is_file()]
    if not list((base / "atlas").glob("basemap-*.json")):
        errs.append("no base map in atlas/")
    c = json.loads((base / "lynch_compare.json").read_text())
    for v in c["victims"]:
        errs += [f"compare: dossier {o['dossier']} not published" for o in v["ours"] if o.get("dossier") and o["dossier"] not in rd]
    errs += [f"compare: dossier {o['dossier']} not published" for o in c["found"] if o.get("dossier") and o["dossier"] not in rd]
    return errs


sys.path.insert(0, str(Path(__file__).resolve().parent))
from r2_images import publish as publish_images  # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("year", type=int)
    ap.add_argument("--source", default=DEFAULT)
    a = ap.parse_args()
    y = str(a.year)
    stage, live = ROOT / ".staging" / f"lynching-{y}", ROOT / "lynching" / y
    if stage.exists():
        shutil.rmtree(stage)
    stage.parent.mkdir(exist_ok=True)
    subprocess.run(["rsync", "-a", f"{a.source.rstrip('/')}/{y}_lyn/", f"{stage}/"], check=True)
    errs = check(stage)
    if errs:
        raise SystemExit("Validation failed; the live page is unchanged:\n  " + "\n  ".join(errs[:40]))
    publish_images(stage, f"lynching-{y}")   # clippings -> R2 rvweb/lynching-<YEAR>/img, case files repointed
    live.parent.mkdir(exist_ok=True)
    old = ROOT / ".staging" / f"old-lynching-{y}"
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
