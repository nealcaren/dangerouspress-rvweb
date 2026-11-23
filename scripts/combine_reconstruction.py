#!/usr/bin/env python3
"""reconstruction/all/: one reader over every reconstruction/<year>/ export, and the continuous all-years view of the
Reconstruction atlas (reconstruction/#year=all, a column per month across the years). Purely mechanical: it
concatenates the per-year exports' reader lists (each entry keeps its export's folder and export id, so case files,
article text and clippings are read where they already are), fills a fixed intro from the manifests, and sets the
all-years fields of reconstruction/view.json and years.json. Called by build_site.py after the per-year pages, so it
reruns after every import; run alone with: python3 scripts/combine_reconstruction.py
"""
import hashlib
import html
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MON = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November",
       "December"]
DRAFT = "Hover for a short summary; select a dot to read the account in the sidebar. Drafts: no entry has had human review."
REDIRECT = """<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<script>
var c = new URLSearchParams(location.hash.slice(1)).get("case");
location.replace("../../#year=all" + (c ? "&case=" + encodeURIComponent(c) : ""));
</script>
<p>Moved: <a href="../../#year=all">{title}</a>.</p>
</html>
"""


def write_json(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


def build(base=ROOT / "reconstruction", stamp=None):
    """base = reconstruction/; stamp(page, prefix) = build_site.stamp (asset version hashes). Needs two or more years."""
    ms = sorted((json.loads((d / "manifest.json").read_text(encoding="utf-8")) for d in base.iterdir()
                 if d.is_dir() and d.name.isdigit() and (d / "manifest.json").is_file()), key=lambda m: int(m["year"]))
    if len(ms) < 2:
        return None
    y0, y1 = int(ms[0]["year"]), int(ms[-1]["year"])
    m0, m1 = ms[0]["months"][0], ms[-1]["months"][1]
    span = f"{MON[m0 - 1]} {y0}–{MON[m1 - 1]} {y1}"
    prose = f"{MON[m0 - 1]} {y0} through {MON[m1 - 1]} {y1}"
    eps, labels = [], {}
    for m in ms:
        y = str(m["year"])
        d = json.loads((base / y / "reader/data.json").read_text(encoding="utf-8"))
        labels = d.get("labels") or labels
        eps += [{**e, "base": f"../../{y}/", "v": m["export_id"], "coll": int(y)} for e in d["episodes"]]
    ids = [e["id"] for e in eps]
    if len(ids) != len(set(ids)):
        raise SystemExit(f"reconstruction/all: case ids repeat across years: {sorted({i for i in ids if ids.count(i) > 1})}")
    eps.sort(key=lambda e: (not e.get("when"), e.get("when") or "", e["coll"]))   # dated first, by date; stable
    n_read, n_map = len(eps), sum(int(m["atlas_count"]) for m in ms)
    per = "; ".join(f'{m["reader_count"]} from {html.escape(m["label"])} ({m["atlas_count"]} on the map)' for m in ms)
    links = ", ".join(f'<a href="../../{m["year"]}/reader/">{html.escape(m["label"])}</a>' for m in ms)
    eid = "all-" + hashlib.sha256("|".join(m["export_id"] for m in ms).encode()).hexdigest()[:12]
    intro = (f"<p>Dossiers for {n_read} episodes reported from {prose}, in one list: {per}. "
             f'The <a href="../../#year=all">map</a> shows the {n_map} episodes that involve anti-Black violence or '
             f"threats, month by month across the years. Each collection&rsquo;s own notes on scope, sources and "
             f"method follow.</p>"
             + "".join(f"<h3>{html.escape(m['label'])}</h3>{m.get('reader_intro') or ''}" for m in reversed(ms)))
    title = f"Racial Violence Dossiers, {span}"
    write_json(base / "all/manifest.json", {
        "schema_version": "2", "export_id": eid, "year": "all", "collection": "+".join(m["collection"] for m in ms),
        "label": span, "atlas_title": f"Atlas of Anti-Black Violence, {span}", "reader_title": title,
        "reader_intro": intro, "months": [m0, m1], "atlas_count": n_map, "reader_count": n_read,
        "parts": [{"year": m["year"], "export_id": m["export_id"], "label": m["label"]} for m in ms]})
    write_json(base / "all/reader/data.json", {"episodes": eps, "labels": labels, "built": eid})
    reader = (ROOT / "templates/reader.html").read_text(encoding="utf-8").replace('"../../assets/', '"../../../assets/')
    page = reader.replace("{{TITLE}}", html.escape(title))
    (base / "all/reader/index.html").write_text(stamp(page, "../../../") if stamp else page, encoding="utf-8")
    (base / "all/atlas").mkdir(parents=True, exist_ok=True)
    (base / "all/atlas/index.html").write_text(REDIRECT.format(title=html.escape(f"Atlas of Anti-Black Violence, {span}")),
                                               encoding="utf-8")
    V = json.loads((base / "view.json").read_text(encoding="utf-8"))
    V.update({"default": "all", "all_only": True, "month_span": [[y0, m0], [y1, m1]], "all_label": span, "all_reader": "all/reader/",
              "all_dek": f'<p class="dek">The <span id="n"></span> episodes reported from {prose} in our '
                         f'<a href="all/reader/" target="_blank" rel="noopener">dossiers</a> that involve anti-Black violence '
                         f'or threats, placed on 1910 county lines and by month across the years. {DRAFT}</p>'})
    write_json(base / "view.json", V)
    # one combined collection (Neal 2026-11-23: no year-by-year pages): the readers' header shows one Map link
    write_json(base / "years.json", {"month": "", "years": [{"year": "all", "label": span, "full": False}]})
    (base / "atlas").mkdir(exist_ok=True)   # site.js links readers to ../../atlas/ = reconstruction/atlas/
    (base / "atlas/index.html").write_text(REDIRECT.replace("../../#year=all", "../#year=all").format(title=html.escape(f"Atlas of Anti-Black Violence, {span}")), encoding="utf-8")
    return {"span": span, "reader": n_read, "map": n_map}


if __name__ == "__main__":
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from build_site import stamp
    print(build(stamp=stamp))
