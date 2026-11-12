#!/usr/bin/env python3
"""Pull one year's export from the research repo, validate it, and publish it in place.

  python3 scripts/import_year.py 1885                     # from office (the default source)
  python3 scripts/import_year.py 1885 --source path/or/host:path/to/site_export
  python3 scripts/import_year.py 1903 --allow-removals    # accept public IDs that disappear (old links break)

The research repo writes data/site_export/<YEAR>/ with scripts/events/writeups/site_export.py. This copies it to
.staging/<YEAR>, runs scripts/check_pages.py on the copy, refuses removed public IDs unless --allow-removals, then swaps
the whole folder into <YEAR>/ (indexes, cases and text together) and rebuilds the page shells and years.json. Before
the swap, scripts/r2_images.py moves the clipping images to Cloudflare R2 and points the case files at them, so the
repo carries no images.
"""
import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path

from r2_images import publish as publish_images

ROOT = Path(__file__).resolve().parent.parent
DEFAULT = "office:GitHub/dangerouspress-racialviolence/data/site_export"


def ids(base):
    f = base / "reader/data.json"
    return {e["id"] for e in json.loads(f.read_text(encoding="utf-8"))["episodes"]} if f.is_file() else set()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("year", type=int)
    ap.add_argument("--source", default=DEFAULT)
    ap.add_argument("--allow-removals", action="store_true")
    a = ap.parse_args()
    y = str(a.year)
    stage, live = ROOT / ".staging" / y, ROOT / y
    if stage.exists():
        shutil.rmtree(stage)
    stage.parent.mkdir(exist_ok=True)
    subprocess.run(["rsync", "-a", f"{a.source.rstrip('/')}/{y}/", f"{stage}/"], check=True)
    r = subprocess.run([sys.executable, str(ROOT / "scripts/check_pages.py"), str(stage)])
    if r.returncode:
        raise SystemExit("Validation failed; the live site is unchanged.")
    removed = sorted(ids(live) - ids(stage))
    if removed and not a.allow_removals:
        raise SystemExit(f"{len(removed)} public IDs would disappear and break old links; rerun with --allow-removals:\n  "
                         + "\n  ".join(removed))
    publish_images(stage, y)
    old = ROOT / ".staging" / f"old-{y}"
    if old.exists():
        shutil.rmtree(old)
    if live.exists():
        live.rename(old)
    stage.rename(live)
    if old.exists():
        shutil.rmtree(old)
    subprocess.run([sys.executable, str(ROOT / "scripts/build_site.py")], check=True)
    m = json.loads((live / "manifest.json").read_text(encoding="utf-8"))
    print(f"Published {m['label']} (export {m['export_id']}): {m['atlas_count']} on the map, {m['reader_count']} cases"
          + (f"; removed {len(removed)} IDs" if removed else "") + ". Review `git status` before committing.")


if __name__ == "__main__":
    main()
