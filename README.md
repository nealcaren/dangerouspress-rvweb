# Atlas of Anti-Black Violence: web publication

A static GitHub Pages site for the atlas and dossiers, built one collection (year) at a time: 1903 and August 1885 now, 1880–1922 eventually. There is one atlas, at `atlas/` (the site root redirects there), with a year selector over every collection, including all years at once; each year's episodes load only when that year is shown. Each collection keeps its own dossier reader, with the clippings and sources, at `<year>/reader/`. Old `<year>/atlas/#case=<id>` links redirect to `atlas/#year=<year>&case=<id>`. All paths are relative, so the site works under a GitHub Pages project path as well as at a domain root.

## Layout

```text
index.html, years.json        # redirect to the atlas, and the year list the atlas reads (written by build_site.py)
atlas/index.html              # the atlas (from templates/atlas.html)
atlas/basemap-<id>.json       # 1910 counties, states and nation as SVG paths, shared by every year
assets/                       # shared code and styles: atlas.js, reader.js, site.js, *.css
templates/                    # page shells for the atlas and the readers
<year>/manifest.json          # export metadata: label, titles, header texts, months covered, counts, source revision
<year>/atlas/data.json        # that year's atlas episodes and paper shading; index.html redirects old links
<year>/reader/data.json       # reader index and section labels
<year>/cases/<id>.json        # one shared case file (atlas narrative + full reader record)
<year>/reader/text/tNN.json   # article-text shards
<year>/reader/img/            # clipping images
```

Code and layout live in `assets/` and `templates/` and are maintained here. Everything under `<year>/` except the two `index.html` shells is a publication export from the research repository and is replaced whole on each import, so do not make case corrections here.

## Update or add a year

The research repository (`dangerouspress-racialviolence`, on office) exports a year in the contract described in the [data export specification](docs/data-export-spec.md):

```sh
# on office, from the research repo root
python3 scripts/events/writeups/site_export.py 1885 data/events/1885/dossiers2_all --label "August 1885" \
    --reader-intro data/site_export/intros/1885_reader.html --atlas-dek data/site_export/intros/1885_atlas.html
```

It runs the atlas and reader generators into a staging folder, writes `data/site_export/<year>/` (manifest, indexes, cases, text, images from one run) and swaps it into place. Then, here:

```sh
python3 scripts/import_year.py 1885      # rsync from office, validate, swap into 1885/, rebuild shells and years.json
python3 -m http.server 8000              # http://localhost:8000/ (the pages fetch JSON, so a server is required)
```

`import_year.py` refuses an export in which public IDs disappear (old links would break) unless given `--allow-removals`. After editing `assets/` or `templates/`, run `python3 scripts/build_site.py`. `python3 scripts/check_pages.py` validates every published year: manifest and counts, unique safe IDs, atlas-to-reader links, case files, every citation, account index, clipping number, image and text shard, source dates, agreement between indexes and case details, and atlas dates, types, counts and coordinates.

## Publication interface

- `atlas/data.json`: the base-map id, `w`/`h`, `papers` (counties to shade) and a compact `episodes` index. Each entry has its metadata, short summary, coordinates, and `dir` linking it to a case, without the long narrative. The base map itself is `atlas/basemap-<id>.json` (export schema version 2).
- `reader/data.json`: reader labels and an index of case IDs, titles, locations, dates, lead summaries, classifications and source counts.
- `cases/<id>.json`: `id`, `atlas` (the atlas narrative, or null for reader-only cases) and `reader` (the complete reader record), fetched only when a case is opened.
- `manifest.json`: `schema_version`, `export_id`, `generated_at`, `year`, `label`, `atlas_title`, `reader_title`, `atlas_dek` and `reader_intro` (HTML for the atlas header and the reader's index page), `months` (first and last timeline column), `atlas_count`, `reader_count`, `source` (research git revision and table hash) and `id_changes`.

The atlas `dir` must match the reader `id` and case filename. Reader hashes use that ID and sometimes an article suffix; changing an ID can break saved links, so preserve identifiers across updates. Map paths are simplified with a 0.12-unit tolerance in the atlas's 960-unit coordinate system, a display transformation only.

For one year, the atlas timeline has one column per month in the manifest's `months` range, plus a "Month unknown" column when an episode's date has no month; for all years it has one column per collection, and switches from dots to stacked bars when a column gets too tall. `years.json` sets the first view: all years while the total is at most 3,000 episodes, else the latest year. Dates marked approximate (`~` or precision `approx`) read "about".

## GitHub Pages

Push the repository to GitHub, then in **Settings → Pages**, select **Deploy from a branch**, the desired branch (currently `master` locally), and `/ (root)`. No build service or server-side code is needed.

Atlas links use `#year=<year|all>&case=<id>`. Search, state, month, and episode-type filters affect the map, timeline, and case list together.
