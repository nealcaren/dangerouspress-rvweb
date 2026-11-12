#!/usr/bin/env python3
"""Validate published collections against docs/data-export-spec.md.

  python3 scripts/check_pages.py                 # every <year>/ folder in the site
  python3 scripts/check_pages.py path/to/1885    # one collection folder (e.g. a staged import)

Checks, per collection: manifest fields and counts; JSON parses; public IDs safe and unique; every atlas `dir` has a
reader case; case files match their names and carry an atlas narrative when on the map; every citation, account index,
clipping number, image and text shard resolves; source dates are YYYY-MM-DD; index entries agree with case details;
atlas dates, precision, types, counts and coordinates are valid. Errors fail the run; warnings (values the renderer shows
generically, orphan case files) are printed.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SAFE = re.compile(r"[a-z0-9-]+")
TYPES = {"lynching", "mob_assault", "police_violence", "posse_killing", "whitecapping", "expulsion", "labor",
         "intimidation", "community_attack", "arson_bombing", "peonage", "insufficient", "other"}
STAGES = {"", "completed", "attempted", "threatened"}
PRECS = {"day", "week", "month", "year", "approx", None}
EVID = {"corroborated", "single_source", "contested", None}
DATE = re.compile(r"~?\d{4}(-\d{2}(-\d{2})?)?")
SRC_DATE = re.compile(r"\d{4}-\d{2}-\d{2}")
MANIFEST = ("schema_version", "export_id", "generated_at", "year", "label", "atlas_title", "reader_title", "months",
            "atlas_count", "reader_count")


def load(path, errors):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        errors.append(f"missing {path}")
    except (ValueError, UnicodeDecodeError) as e:
        errors.append(f"bad JSON in {path}: {e}")
    return None


def check(base):
    errors, warnings = [], []
    man = load(base / "manifest.json", errors)
    atlas = load(base / "atlas/data.json", errors)
    reader = load(base / "reader/data.json", errors)
    if man is None or atlas is None or reader is None:
        return errors, warnings
    for k in MANIFEST:
        if k not in man:
            errors.append(f"manifest lacks {k}")
    if base.name.isdigit() and str(man.get("year")) != base.name:
        errors.append(f"manifest year {man.get('year')} in folder {base.name}")
    m0, m1 = (man.get("months") or [0, 0])[:2]
    if not (1 <= m0 <= m1 <= 12):
        errors.append(f"manifest months {man.get('months')}")

    # identity
    ids = [e["id"] for e in reader["episodes"]]
    errors += [f"unsafe public id {i!r}" for i in ids if not SAFE.fullmatch(i)]
    if len(ids) != len(set(ids)):
        errors.append("duplicate reader ids")
    rid = set(ids)
    aid = [e["id"] for e in atlas["episodes"]]
    if len(aid) != len(set(aid)):
        errors.append("duplicate atlas ids")
    dirs = [e["dir"] for e in atlas["episodes"]]
    if len(dirs) != len(set(dirs)):
        errors.append("two atlas entries share a public id")
    errors += [f"atlas {e['id']}: no reader case {e['dir']}" for e in atlas["episodes"] if e["dir"] not in rid]
    if man.get("atlas_count") != len(aid) or man.get("reader_count") != len(ids):
        errors.append(f"manifest counts {man.get('atlas_count')}/{man.get('reader_count')} vs data {len(aid)}/{len(ids)}")
    on_map = set(dirs)

    # map entries; the base map is a shared atlas/basemap-<id>.json (in the collection folder when staged, else the site's)
    w, h = atlas.get("w") or 0, atlas.get("h") or 0
    bm = [f / f"basemap-{atlas.get('basemap')}.json" for f in (base / "atlas", ROOT / "atlas")]
    bm = next((f for f in bm if f.is_file()), None)
    if bm is None:
        errors.append(f"base map {atlas.get('basemap')!r} not found")
        counties = {}
    else:
        counties = (load(bm, errors) or {}).get("counties") or {}
    for k in atlas.get("papers") or []:
        if str(k) not in counties:
            errors.append(f"shaded county {k} has no path")
    for e in atlas["episodes"]:
        tag = f"atlas {e['dir']}"
        if not (isinstance(e.get("x"), (int, float)) and isinstance(e.get("y"), (int, float))
                and 0 <= e["x"] <= w and 0 <= e["y"] <= h):
            errors.append(f"{tag}: coordinates {e.get('x')},{e.get('y')} outside the {w}x{h} map")
        if not isinstance(e.get("killed"), (int, float)) or e["killed"] < 0:
            errors.append(f"{tag}: killed must be a number >= 0 (got {e.get('killed')!r})")
        if e.get("date") is not None and not DATE.fullmatch(e["date"]):
            errors.append(f"{tag}: date {e['date']!r}")
        if e.get("prec") not in PRECS:
            warnings.append(f"{tag}: date precision {e.get('prec')!r} not handled by the renderer")
        if e.get("type") not in TYPES:
            warnings.append(f"{tag}: type {e.get('type')!r} has no display label")
        if (e.get("stage") or "") not in STAGES:
            warnings.append(f"{tag}: stage {e.get('stage')!r}")
        if e.get("evidence") not in EVID:
            warnings.append(f"{tag}: evidence {e.get('evidence')!r}")
        if e.get("loc") not in ("place", "county"):
            errors.append(f"{tag}: loc {e.get('loc')!r}")
        if e.get("ahcb") is not None and str(e["ahcb"]) not in counties:
            errors.append(f"{tag}: county {e['ahcb']} has no path")
        if not all(isinstance(f, dict) and isinstance(f.get("fips"), str) for f in e.get("fips") or []):
            errors.append(f"{tag}: fips entries need string codes")

    # cases
    shards = {}
    for ix in reader["episodes"]:
        i = ix["id"]
        case = load(base / "cases" / f"{i}.json", errors)
        if case is None:
            continue
        r = case.get("reader") or {}
        if case.get("id") != i or r.get("id") != i:
            errors.append(f"case {i}: id mismatch")
            continue
        if i in on_map and not ((case.get("atlas") or {}).get("text")):
            errors.append(f"case {i}: on the map but no atlas narrative")
        if i not in on_map and case.get("atlas") is not None:
            warnings.append(f"case {i}: atlas narrative but not on the map")
        src = {s["k"]: s for s in r.get("sources", [])}
        nacc = len(r.get("accounts", []))

        def cited(where, keys):
            for k in keys or []:
                if k not in src:
                    errors.append(f"case {i}: {where} cites unknown source {k}")
        for s in r.get("summary", []):
            cited(f"summary {s.get('section')}/{s.get('para')}", (s.get("cites") or []) + (s.get("ext") or []))
        for a in r.get("accounts", []):
            cited("account", (a.get("cites") or []) + (a.get("ext") or []))
        for f in r.get("framing", []):
            cited("framing", (f.get("cites") or []) + (f.get("ext") or []))
        nums = [s["n"] for s in src.values() if s.get("n")]
        if len(nums) != len(set(nums)):
            errors.append(f"case {i}: duplicate clipping numbers")
        if len(nums) != r.get("n_clips"):
            errors.append(f"case {i}: {len(nums)} numbered clippings, n_clips {r.get('n_clips')}")
        for s in src.values():
            if not SRC_DATE.fullmatch(s.get("date") or ""):
                errors.append(f"case {i}: source {s['k']} date {s.get('date')!r}")
            if s.get("acc") is not None and not (0 <= s["acc"] < nacc):
                errors.append(f"case {i}: source {s['k']} account index {s['acc']} of {nacc}")
            if not s.get("url"):
                errors.append(f"case {i}: source {s['k']} has no link")
            if s.get("img") and not (base / "reader" / s["img"]).is_file():
                errors.append(f"case {i}: missing image {s['img']}")
            for g in s.get("group") or []:
                if g not in src:
                    errors.append(f"case {i}: source {s['k']} groups unknown {g}")
        tx = r.get("tx")
        if tx is not None:
            if tx not in shards:
                shards[tx] = load(base / "reader/text" / f"t{tx:02d}.json", errors) or {}
            if nums and i not in shards[tx]:
                errors.append(f"case {i}: no article text in shard t{tx:02d}")
        # the index must agree with the details
        want = {"title": r.get("title"), "city": r.get("city"), "state": r.get("state"), "when": r.get("when"),
                "n_clips": r.get("n_clips"), "n_accounts": nacc,
                "n_this": sum(s.get("rel") == "this" for s in src.values()),
                "n_papers": len({s.get("paper") for s in src.values()}),
                "lead": " ".join(s["text"] for s in r.get("summary", []) if s.get("section") == "lead")}
        for k, v in want.items():
            if ix.get(k) != v:
                errors.append(f"case {i}: index {k} {ix.get(k)!r} differs from the case ({v!r})")
    files = {p.stem for p in (base / "cases").glob("*.json")}
    warnings += [f"orphan case file {f}.json (no reader entry)" for f in sorted(files - rid)]
    return errors, warnings


def main(args):
    bases = [Path(a) for a in args] or sorted(d for d in ROOT.iterdir() if d.is_dir() and d.name.isdigit())
    bad = 0
    for b in bases:
        errors, warnings = check(b)
        for w in warnings[:25]:
            print(f"  warning [{b.name}]: {w}")
        if len(warnings) > 25:
            print(f"  ... {len(warnings) - 25} more warnings")
        for e in errors[:50]:
            print(f"  ERROR [{b.name}]: {e}")
        if errors:
            bad += 1
            print(f"{b.name}: {len(errors)} error(s)")
        else:
            m = json.loads((b / "manifest.json").read_text(encoding="utf-8"))
            print(f"{b.name}: OK, {m['atlas_count']} atlas entries and {m['reader_count']} cases; citations, images, "
                  f"text shards and indexes resolve ({len(warnings)} warnings).")
    if bad:
        raise SystemExit(f"{bad} collection(s) failed")


if __name__ == "__main__":
    main(sys.argv[1:])
