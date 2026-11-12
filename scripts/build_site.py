#!/usr/bin/env python3
"""Write the shared atlas page, each year's reader shell and redirects, years.json, and the shared base map.

Every <year>/ folder with a manifest.json is a published collection. The atlas is one page, atlas/index.html (from
templates/atlas.html), with a year selector over every collection; years.json tells it what exists. Each year keeps its
dossier reader at <year>/reader/ (shell from templates/reader.html). <year>/atlas/ holds that year's episodes and paper
shading; its index.html only redirects old links (#case=<id>) to atlas/#year=<year>&case=<id>. The base map is the same
for every year: the import leaves it in <year>/atlas/basemap-<id>.json and this moves it to atlas/. Rerun after an
import or a template change.
"""
import hashlib
import html
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_ALL_MAX = 3000   # show all years on first load while the total is small enough to draw dot by dot

REDIRECT = """<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Atlas of Anti-Black Violence, {label}</title>
<script>
var c = new URLSearchParams(location.hash.slice(1)).get("case");
location.replace("../../atlas/#year={year}" + (c ? "&case=" + encodeURIComponent(c) : ""));
</script>
<p>The atlas has moved: <a href="../../atlas/#year={year}">Atlas of Anti-Black Violence, {label}</a>.</p>
</html>
"""


def stamp(page, prefix):
    """Add ?v=<content hash> to every shared asset a page loads, so a browser never runs new HTML with cached code."""
    for f in sorted((ROOT / "assets").iterdir()):
        h = hashlib.sha256(f.read_bytes()).hexdigest()[:10]
        page = page.replace(f'"{prefix}assets/{f.name}"', f'"{prefix}assets/{f.name}?v={h}"')
    return page


def main():
    ms = []
    for d in sorted(ROOT.iterdir()):
        if d.is_dir() and d.name.isdigit() and (d / "manifest.json").is_file():
            ms.append(json.loads((d / "manifest.json").read_text(encoding="utf-8")))
    if not ms:
        raise SystemExit("No <year>/manifest.json found.")
    shared = ROOT / "atlas"
    shared.mkdir(exist_ok=True)
    used = set()
    for m in ms:
        y = str(m["year"])
        bid = json.loads((ROOT / y / "atlas/data.json").read_text(encoding="utf-8"))["basemap"]
        used.add(f"basemap-{bid}.json")
        for f in (ROOT / y / "atlas").glob("basemap-*.json"):
            if not (shared / f.name).exists():
                f.replace(shared / f.name)
            else:
                f.unlink()
        if not (shared / f"basemap-{bid}.json").exists():
            raise SystemExit(f"{y}: base map {bid} missing")
        (ROOT / y / "atlas/index.html").write_text(REDIRECT.format(year=y, label=html.escape(m["label"])), encoding="utf-8")
        reader = (ROOT / "templates/reader.html").read_text(encoding="utf-8")
        (ROOT / y / "reader/index.html").write_text(stamp(reader.replace("{{TITLE}}", html.escape(m["reader_title"])), "../../"),
                                                     encoding="utf-8")
    for f in shared.glob("basemap-*.json"):
        if f.name not in used:
            f.unlink()
    (shared / "index.html").write_text(stamp((ROOT / "templates/atlas.html").read_text(encoding="utf-8")
                                             .replace("{{TITLE}}", "Atlas of Anti-Black Violence"), "../"), encoding="utf-8")
    keep = ("year", "label", "months", "atlas_dek", "atlas_count", "reader_count", "export_id")
    listing = [{k: m.get(k) for k in keep} for m in sorted(ms, key=lambda m: m["year"])]
    total = sum(m["atlas_count"] for m in ms)
    (ROOT / "years.json").write_text(json.dumps({"default": "all" if total <= DEFAULT_ALL_MAX else listing[-1]["year"],
                                                 "years": listing}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    (ROOT / "index.html").write_text("""<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="refresh" content="0; url=atlas/">
<title>Atlas of Anti-Black Violence</title>
<link rel="canonical" href="atlas/">
<p>Opening the <a href="atlas/">Atlas of Anti-Black Violence</a>.</p>
</html>
""", encoding="utf-8")
    print(f"Built the atlas for {', '.join(m['label'] for m in ms)} ({total} episodes on the map), "
          f"{len(ms)} reader shells and redirects; wrote years.json.")


if __name__ == "__main__":
    main()
