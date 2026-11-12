#!/usr/bin/env python3
"""Write the atlas pages, each year's reader shell and redirects, years.json, and the shared base map.

Every <year>/ folder with a manifest.json is a published collection. site.json says how they are shown:

- The main atlas, atlas/, is the series: one month (August) from every collection, only the episodes dated in that
  month of that year, on a timeline across the series span (1800-1922). Each collection is one slice, chosen with the
  year selector; "all" shows every slice at once.
- Each year in full_years also keeps an atlas of its whole collection at <year>/atlas/ (1903). Other years'
  <year>/atlas/index.html only redirects old links (#case=<id>) to atlas/#year=<year>&case=<id>.

Every atlas page is templates/atlas.html plus a view.json beside it that lists its collections, where their files are,
and the header texts; assets/atlas.js reads it. Each year keeps its dossier reader at <year>/reader/ (shell from
templates/reader.html). years.json lists the collections for the readers' header links. compare/ sets the
inventory lynchings of Black victims in the series month beside our records, for every year whose export has a
compare.json (research repo: inventory_compare.py); compare/view.json joins it with the published reader and atlas so
only dossiers on the site are linked. The base map is the same for
every year: the import leaves it in <year>/atlas/basemap-<id>.json and this moves it to atlas/. Rerun after an import,
a site.json change or a template change.
"""
import hashlib
import html
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_ALL_MAX = 3000   # show all slices on first load while the total is small enough to draw dot by dot
MON = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November",
       "December"]
DRAFT = "Hover for a short summary; select a dot to read the account in the sidebar. Drafts: no entry has had human review."

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


def atlas_page(prefix):
    page = (ROOT / "templates/atlas.html").read_text(encoding="utf-8")
    return stamp(page.replace("{{TITLE}}", "Atlas of Anti-Black Violence").replace("{{ROOT}}", prefix), prefix)


def in_month(ep, year, month):
    """The episode's stated date falls in that month of that year (approximate dates count; no month does not).
    assets/atlas.js applies the same rule when it loads a slice."""
    parts = (ep.get("date") or "").replace("~", "").split("-")
    yr = int(parts[0]) if parts[0] else year
    return yr == year and len(parts) > 1 and int(parts[1]) == month


def write_json(path, obj):
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


COMPARE_DEK = ("<p class=\"dek\">Lynchings of Black victims in {mname} of each sampled year as the standard inventories record "
               "them (Beck and Tolnay\u2019s 2022 inventory of twelve Southern states: lynchings, probable and possible "
               "lynchings; Seguin and Rigby\u2019s national inventory; the Historical American Lynching data; and the "
               "<a href=\"https://monroeworktoday.org\">Monroe Work Today</a> map data, which gives the month but not the day, "
               "used under CC BY-NC-SA 4.0), set beside "
               "our event table and dossiers. A row names one victim; when inventories list the same person, the rows are "
               "joined. Our record is the table event linked to that row, or an event that names the victim within three "
               "weeks in the same state. Below each year are the completed lynchings our sources report that no inventory "
               "lists, with any victim not recorded as white. Links open the full dossier. {draft}</p>")


def compare_page(ms, mname):
    """compare/: each year's compare.json, with every dossier marked published (in the reader) and mapped (in the atlas)."""
    years = []
    for m in ms:
        y = str(m["year"])
        f = ROOT / y / "compare.json"
        if not f.is_file():
            continue
        c = json.loads(f.read_text(encoding="utf-8"))
        titles = {e["id"]: e["title"] for e in json.loads((ROOT / y / "reader/data.json").read_text(encoding="utf-8"))["episodes"]}
        mapped = {e["dir"] for e in json.loads((ROOT / y / "atlas/data.json").read_text(encoding="utf-8"))["episodes"]}
        for o in [o for v in c["inventory"] for o in v["ours"]] + c["found"]:
            o["published"] = o.get("dossier") in titles
            o["map"] = o.get("dossier") in mapped
            o["title"] = titles.get(o.get("dossier"))
            for k in ("summary", "inventory", "id"):
                o.pop(k, None)
        years.append({"year": m["year"], "inventory": c["inventory"], "found": c["found"], "lists": c["lists"]})
    out = ROOT / "compare"
    if not years:
        return 0
    out.mkdir(exist_ok=True)
    write_json(out / "view.json", {"root": "../", "month": mname, "lists": years[-1]["lists"], "years": years,
                                   "dek": COMPARE_DEK.format(mname=mname, draft=DRAFT.split(". ", 1)[1])})
    title = f"Lynchings in the Inventories and in Our Sources, {mname}"
    page = (ROOT / "templates/compare.html").read_text(encoding="utf-8")
    (out / "index.html").write_text(stamp(page.replace("{{TITLE}}", html.escape(title)).replace("{{ROOT}}", "../"), "../"),
                                    encoding="utf-8")
    return len(years)


def main():
    cfg = json.loads((ROOT / "site.json").read_text(encoding="utf-8"))
    month, span = cfg["series"]["month"], cfg["series"]["span"]
    full = set(cfg.get("full_years", []))
    ms = []
    for d in sorted(ROOT.iterdir()):
        if d.is_dir() and d.name.isdigit() and (d / "manifest.json").is_file():
            ms.append(json.loads((d / "manifest.json").read_text(encoding="utf-8")))
    if not ms:
        raise SystemExit("No <year>/manifest.json found.")
    ms.sort(key=lambda m: m["year"])
    missing = full - {m["year"] for m in ms}
    if missing:
        raise SystemExit(f"site.json full_years without a collection: {sorted(missing)}")
    shared = ROOT / "atlas"
    shared.mkdir(exist_ok=True)
    used, slices = set(), []
    mname = MON[month - 1]
    for m in ms:
        y = str(m["year"])
        data = json.loads((ROOT / y / "atlas/data.json").read_text(encoding="utf-8"))
        bid = data["basemap"]
        used.add(f"basemap-{bid}.json")
        for f in (ROOT / y / "atlas").glob("basemap-*.json"):
            if not (shared / f.name).exists():
                f.replace(shared / f.name)
            else:
                f.unlink()
        if not (shared / f"basemap-{bid}.json").exists():
            raise SystemExit(f"{y}: base map {bid} missing")
        reader = (ROOT / "templates/reader.html").read_text(encoding="utf-8")
        (ROOT / y / "reader/index.html").write_text(stamp(reader.replace("{{TITLE}}", html.escape(m["reader_title"])), "../../"),
                                                     encoding="utf-8")
        n = sum(in_month(ep, m["year"], month) for ep in data["episodes"])
        also = (f' The whole year is mapped in the <a href="../{y}/atlas/">{y} atlas</a>.' if m["year"] in full else "")
        cmp = (f' <a href="../compare/#y{y}">Compare its lynchings with the inventories</a>.'
               if (ROOT / y / "compare.json").is_file() else "")
        slices.append({"year": m["year"], "label": f"{mname} {y}", "months": [month, month], "month": month,
                       "atlas_count": n, "export_id": m["export_id"], "full": f"../{y}/atlas/" if m["year"] in full else None,
                       "atlas_dek": f'<p class="dek">The <span id="n"></span> episodes of anti-Black violence that took place '
                                    f'in {mname} {y}, from our <a href="../{y}/reader/" target="_blank" rel="noopener">dossiers</a>, '
                                    f'placed on 1910 county lines and by day of the month.{also}{cmp} {DRAFT}</p>'})
        if m["year"] in full:
            write_json(ROOT / y / "atlas/view.json", {
                "root": "../../", "basemaps": "../../atlas/", "default": m["year"], "month": None,
                "series": {"href": f"../../atlas/#year={y}", "label": f"{mname} in every sampled year"},
                "years": [{"year": m["year"], "label": m["label"], "months": m["months"], "atlas_count": m["atlas_count"],
                           "export_id": m["export_id"], "full": None,
                           "atlas_dek": (m.get("atlas_dek") or "").replace("</p>", f' This page maps the whole year; the main atlas '
                                         f'compares <a href="../../atlas/#year={y}">{mname} across the years</a>.</p>', 1)}]})
            (ROOT / y / "atlas/index.html").write_text(atlas_page("../../"), encoding="utf-8")
        else:
            (ROOT / y / "atlas/index.html").write_text(REDIRECT.format(year=y, label=html.escape(m["label"])), encoding="utf-8")
    for f in shared.glob("basemap-*.json"):
        if f.name not in used:
            f.unlink()
    total = sum(s["atlas_count"] for s in slices)
    names = [str(s["year"]) for s in slices]
    sampled = names[0] if len(names) == 1 else ", ".join(names[:-1]) + (" and " if len(names) == 2 else ", and ") + names[-1]
    fulls = [f'<a href="../{y}/atlas/">{y}</a>' for y in sorted(full)]
    write_json(shared / "view.json", {
        "root": "../", "basemaps": "", "default": "all" if total <= DEFAULT_ALL_MAX else slices[-1]["year"],
        "month": month, "span": span, "all_label": f"{mname}, {span[0]}–{span[1]}",
        "all_dek": f'<p class="dek">The <span id="n"></span> episodes of anti-Black violence that took place in {mname} '
                   f'of the years sampled so far ({sampled}), from a series that will reach across {span[0]}–{span[1]}, '
                   f'placed on 1910 county lines. Years with nothing on the timeline have not been collected yet. Choose a year '
                   f'to see its {mname} day by day.'
                   + (f' Full-year atlas{"es" if len(fulls) > 1 else ""}: {", ".join(fulls)}.' if fulls else "")
                   + (' <a href="../compare/">Compare the lynchings with the inventories</a>.'
                      if any((ROOT / str(m["year"]) / "compare.json").is_file() for m in ms) else "")
                   + f' {DRAFT}</p>',
        "years": slices})
    (shared / "index.html").write_text(atlas_page("../"), encoding="utf-8")
    keep = ("year", "label", "months", "atlas_count", "reader_count", "export_id")
    write_json(ROOT / "years.json", {"month": mname, "years": [{**{k: m.get(k) for k in keep}, "full": m["year"] in full}
                                                              for m in ms]})
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
    nc = compare_page(ms, mname)
    print(f"Built the {mname} atlas for {', '.join(s['label'] for s in slices)} ({total} episodes on the map), "
          f"full-year atlases for {', '.join(map(str, sorted(full))) or 'none'}, {len(ms)} reader shells, "
          f"the inventory comparison for {nc} years; wrote years.json.")


if __name__ == "__main__":
    main()
