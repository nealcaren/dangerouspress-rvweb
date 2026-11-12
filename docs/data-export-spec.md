# Data specification for the atlas and dossier reader

Status (2026-11-11): implemented, schema version 2. The research repo's `scripts/events/writeups/site_export.py` emits this contract per year (with `manifest.json`); `scripts/import_year.py` here validates a staged copy with `scripts/check_pages.py` and swaps it in; `scripts/build_site.py` writes the shared atlas page (`atlas/`, one map with a year selector), each year's reader shell, redirects from the old `<year>/atlas/` links, and `years.json`. Version 2 moves the base map (`w`, `h`, `states`, `nation`, `counties`) out of `atlas/data.json` into a shared `atlas/basemap-<id>.json`; a year's `atlas/data.json` keeps `basemap`, `w`, `h`, `papers` and `episodes`. Sections below that describe geometry inside `atlas/data.json` refer to version 1.

## Goal

The research workflow owns the evidence, case narratives, classifications, and decisions about inclusion. It should be possible to add, revise, merge, or remove a case there and produce a complete, internally consistent static-site export. The website should not have to parse generated HTML, and its JavaScript, styling, and layout should not be overwritten by a data refresh.

A visitor should be able to load a small index, find and select a case, and then download that case's detailed narrative and sources. The atlas and reader should use the same stable public case ID, even if they display different material or only one view includes a case.

## Recommended delivery

Produce a complete, versioned export directory containing:

```text
1903/
  manifest.json          # recommended: schema version, export ID, date, counts
  atlas/data.json        # map geometry and atlas index (current interface)
  reader/data.json       # reader index and section labels (current interface)
  cases/<public-id>.json # one shared case detail file per reader case
  reader/text/tNN.json   # existing article-text shards
  reader/img/...         # existing clipping images
```

Use UTF-8 JSON, relative asset paths, and no server-side dependencies. Export an internally consistent snapshot: indexes, case files, text shards, images, and map data must all come from the same run. Write the export to a staging directory, validate it, then replace the publication data together. The website lives under a GitHub Pages project path, so paths must not assume the domain root.

`manifest.json` is **proposed**, not currently consumed by the site. Suggested fields are `schema_version`, `export_id`, `generated_at` (ISO 8601 with time zone), `year`, `atlas_count`, and `reader_count`. Record the upstream dataset revision if available. A schema version should change when the meaning or shape of the export changes, not whenever case contents change.

## Identity and coverage

- Assign every public case a unique, stable `public_id`: lowercase ASCII letters, digits, and hyphens. Keep it stable when a title, date, location, or classification changes. It is the filename, reader URL fragment, and atlas `#case=` link.
- Preserve upstream research identifiers separately; they need not follow the public-ID format. In the current export, atlas `id` is a research ID while atlas `dir` is the public ID. Reader `id` is the public ID. Do not treat those two atlas fields as interchangeable.
- Some reader cases are outside the atlas's inclusion criteria. They still receive a case file with `atlas: null`. Every atlas entry must have a matching reader case in the current site.
- If cases are merged, split, or renamed, provide a mapping of old public IDs to current ones and the reason. **Redirect support is not implemented yet**; do not change an existing public ID until the website supports the intended migration. Likewise, coordinate removals: old links otherwise stop working.
- Preserve uncertain, contested, and absent information. Do not silently infer precision, race, place, sources, or deaths from an incomplete record.

## Canonical research record: recommended direction

Maintain one authoritative case record upstream, with explicit view eligibility, rather than asking the web team to reconcile two independent copies. The site-specific files can then be derived from it. This is a design proposal, **not a schema the site currently reads**. A case might contain:

```json
{
  "public_id": "example-person-exampletown-1903-05-12",
  "research_ids": ["research-system:123"],
  "title": "Example case title",
  "eligibility": {"atlas": true, "reader": true},
  "date": {"value": "1903-05-12", "precision": "day", "note": null},
  "place": {
    "city": "Exampletown", "state": "MS", "county_1910": "Example",
    "latitude": 32.1, "longitude": -90.2, "precision": "place"
  },
  "classification": {"type": "lynching", "stage": "attempted", "black_people_killed": 0},
  "short_summary": "A brief, sourced account of the episode.",
  "atlas_narrative": [{"section": "lead", "paragraphs": ["A longer account."]}],
  "reader_narrative": [],
  "sources": [],
  "review": {"status": "draft", "notes": null}
}
```

The sample uses invented values and is illustrative. A production schema should specify provenance and citations for claims; the empty arrays above are not a complete dossier. Keep atlas prose and reader prose distinct if they have different citation structures or editorial purposes. Source IDs, images, OCR, alternative accounts, uncertainty, and review status should retain their provenance. Never replace an unknown count with zero: in particular, zero deaths and an unknown death count mean different things. The existing interface currently expects a numeric `killed`, so agree on a presentation change before exporting null there.

Dates should include explicit precision, and location should retain the distinction between a documented place and a county-center estimate. Do not make a display coordinate stand in for historical certainty. The year collection and event year are separate concepts: some reader-only cases refer to an earlier year.

## Current export contract: what the website reads today

For compatibility now, produce exactly the current shapes, or continue to send both current generated pages through `scripts/prepare_pages.py`. The actual files are the definitive examples. The proposed canonical record above is **not** a drop-in replacement for them.

### `atlas/data.json`

Top-level keys are `w`, `h`, `states`, `nation`, `counties`, `papers`, and `episodes`. The geometry describes a projected 960 × 602.4 SVG map; `states` and `nation` are SVG paths, `counties` maps historical county identifiers to SVG paths, and `papers` is a list of county identifiers to shade. The current website expects `x` and `y` on each episode in the same projection; latitude/longitude alone will not draw a mark. `ahcb` references a `counties` key for the selected-county highlight. `fips` is a list of objects containing `fips` (a string, preserving leading zeros), `name`, and weight `w`.

Each `episodes` entry currently includes:

| Field | Meaning and current use |
| --- | --- |
| `id` | Research record ID; used internally for linked marker highlighting. Must be unique in the atlas. |
| `dir` | Stable public case ID; must equal reader `id` and the case filename. |
| `title`, `summary` | Case title and short hover/search summary. Plain text. |
| `type`, `stage` | Classification used for labels and three map categories. |
| `date`, `prec` | Date string and precision, used for placement, filtering, and display. |
| `city`, `state`, `county`, `county_state` | Place labels; `state` is a postal abbreviation. |
| `fips`, `ahcb`, `x`, `y`, `lat`, `lon`, `loc` | Historical county and location data; `loc` is currently `place` or `county`. |
| `killed` | Number of Black people killed; controls filled versus outlined markers. Current code expects a number. |
| `evidence`, `lists`, `doubt`, `scope` | Evidence classification, existing-list information, uncertainty, and scope metadata. Some may be null. |

The current renderer explicitly labels `lynching`, `mob_assault`, `police_violence`, `posse_killing`, `whitecapping`, `expulsion`, `labor`, `intimidation`, `community_attack`, `arson_bombing`, and `other`. The current data also includes `peonage` and `insufficient`, which need agreed display labels; new type values need a website update. Stages currently include empty string, `completed`, `attempted`, and `threatened`. Evidence includes `corroborated`, `single_source`, and `contested`.

The renderer handles `day`, `week`, and otherwise treats a date as a month; current data also contains `year`, `approx`, and null. Thus year-only or approximate dates are **not yet represented faithfully**. Coordinate a renderer update before relying on additional date precision values. Month filtering uses the numeric month in the date value; do not encode unknown dates as invented precise dates.

Map path simplification in the present adapter is a display optimization, not a change to research geography. If upstream supplies geometry directly, use the same projection and historical boundaries and coordinate any simplification or projection change with the website.

### `reader/data.json`

Top-level fields are `episodes`, `labels`, and `built`. Each episode is an index entry containing `id`, `title`, `city`, `state`, `when`, `chips`, `lead`, `n_this`, `n_papers`, `n_clips`, and `n_accounts`. These fields populate the reader's index and finder; derive them from the same case records as the detailed files. `labels.section` maps narrative section keys to display headings. The reader currently has an introductory paragraph with fixed historical counts; changes in corpus coverage require that text to be updated as well.

### `cases/<public-id>.json`

The current structure is:

```json
{
  "id": "example-person-exampletown-1903-05-12",
  "atlas": {"text": [{"section": "lead", "paras": ["Atlas paragraph."]}]},
  "reader": {"id": "example-person-exampletown-1903-05-12", "...": "full current reader record"}
}
```

This is a **shape illustration**, not a valid complete case: `reader` must include all fields expected by the current reader. For a real, complete record, inspect `1903/cases/macon-macon-1903-01-03.json`. `atlas` is null for reader-only cases. Atlas sections currently include `lead`, `background`, `events`, `aftermath`, `press`, `disputed`, and `legacy`; unknown section names become headings. `text` is a list of section keys and arrays of plain-text paragraphs.

The reader record currently includes `id`, `tx`, `title`, `state`, `city`, `when`, `chips`, `bases`, `summary`, `accounts`, `framing`, `conflicts`, `record_check`, `info`, `sources`, `n_clips`, `uncovered`, `searches`, and `set_aside`. Some fields are preserved even if the interface does not currently display them. Use the existing export as the source for the exact nested structure until a separately versioned reader schema is agreed.

In particular, each `summary` statement has a `section`, paragraph number `para`, `text`, and `cites`/`ext` arrays of source keys. `sources` have a case-local key `k` such as `A1`, a clipping number `n` when displayed, a newspaper name, date, page, URL, press designation, notes, quotations, and optional image path. `accounts` and `framing` can also refer to source keys. Preserve source keys and citation relationships across updates; IDs are not a substitute for citation provenance. The reader expects source dates in `YYYY-MM-DD` format and uses `acc` as an index into `accounts` when present.

### Text and images

`reader.tx` is an integer selecting `reader/text/tNN.json`, with at least two digits (for example, `7` selects `text/t07.json`). Each shard is an object keyed by public case ID; each value maps source key to article text. For example:

```json
{"example-person-exampletown-1903-05-12": {"A1": "Article text or OCR."}}
```

Source `img` paths such as `img/example.jpg` are relative to `1903/reader/`, not to the case file or domain root. Include every referenced image in the export and preserve original source URLs. A source without an image may use article text or be identified as unavailable, as in the current reader; avoid substituting a different source or silently dropping the evidence.

## Validation before publication

At minimum, check:

1. JSON parses as UTF-8; IDs are safe and unique; every atlas `dir` resolves to exactly one reader index entry and case file.
2. Every case file's top-level `id` and `reader.id` match its filename; atlas entries have an atlas narrative. Reader-only cases are allowed.
3. Every cited source key resolves within its case; numbered clippings and account indexes resolve; every source link, image path, and text shard that is expected to exist is present and readable.
4. Dates, precision, location precision, classifications, counts, and missing values are valid and have not been silently converted into false certainty. Check coordinates against the map projection.
5. Index metadata and counts match case details; no removed or merged case leaves an unhandled public link. Flag any changes in case coverage or the research method that require a change to the reader's fixed explanatory text.
6. Serve the resulting site over HTTP and test a filtered atlas search, a direct case URL, a dossier link, a clipping, and a mobile viewport. Confirm that all paths work under a GitHub Pages project prefix.

The existing `python3 scripts/check_pages.py` checks only a subset: unique reader IDs, atlas-to-reader links, case-file IDs, atlas narratives, and the presence of text shard files. It does **not** currently validate citations, images, date semantics, all fields, or completeness of shard contents. Those checks are recommended work for the export pipeline.

## Transition

1. Continue exporting both current generated views together and use the existing adapter until an upstream data export is ready.
2. Agree on canonical research fields, uncertainty, stable IDs, inclusion decisions, and versioning with the research team.
3. Have upstream emit the current publication contract from that canonical source; compare counts, links, text, sources, and images against a known export.
4. When ready to change the website contract, version it explicitly and update the website and validator together. Keep old case URLs working before changing public IDs.
