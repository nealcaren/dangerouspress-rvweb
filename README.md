# Anti-Black Violence in 1903: web publication

A static GitHub Pages site containing the atlas and its supplementary dossier reader. The repository root opens the atlas at `1903/atlas/`, with a link to the supplementary dossiers and sources at `1903/reader/`. All paths are relative, so the site works under a GitHub Pages project path as well as at a domain root.

## Update the site

The research repository is the source of the cases. Do not make substantive case corrections in this publication repository: they would be overwritten on the next export. The current upstream generators are `scripts/events/writeups/dossier2_atlas.py` and `dossier2_reader.py` in `dangerouspress-racialviolence` on office. Export both views together, then copy their generated directories here and run:

```sh
rsync -a office:GitHub/dangerouspress-racialviolence/data/events/1903/dossiers2_sample/reader/ 1903/reader/
rsync -a office:GitHub/dangerouspress-racialviolence/data/events/1903/dossiers2_sample/atlas/ 1903/atlas/
python3 scripts/prepare_pages.py
python3 scripts/check_pages.py
python3 -m http.server 8000
```

Visit `http://localhost:8000/`. A web server is required because the pages fetch JSON. The preparation script extracts the generated records, simplifies map paths, and writes the indexes and shared case files described below. It retains the site’s `app.js` files, which are maintained here; it is safe to rerun on prepared pages. Check the resulting changes before committing. Copy images and `reader/text/` along with the pages; the reader loads those files separately.

## Publishing interface for upstream

The adapter currently creates:

- `1903/atlas/data.json`: map geometry and a compact `episodes` index. Each entry retains its metadata, short summary, coordinates, and `dir` linking it to a case, but excludes the long narrative.
- `1903/reader/data.json`: reader labels and an index of case IDs, titles, locations, dates, lead summaries, classifications, and source counts.
- `1903/cases/<id>.json`: one shared file per reader case, containing `id`, `atlas` (the atlas narrative, or null for reader-only cases), and `reader` (the complete reader record). The atlas and reader fetch this file only when a case is opened. The two narrative representations remain separate within the file because their source and citation structures differ.
- `1903/reader/text/tNN.json` and `1903/reader/img/`: the existing article text shards and clipping images.

The atlas `dir` must match the reader `id` and case filename. Reader hashes use that ID and sometimes an article suffix; changing an ID can break saved links. Preserve identifiers across updates or provide redirects. Treat these JSON files as **publication exports**, not authoritative research records. Upstream can produce this interface directly, or adopt a canonical case schema and generate both view-specific indexes and the shared case file from it. Keep the two representations and their provenance explicit until the upstream team decides how to reconcile them.

Map paths are simplified with a 0.12-unit tolerance in the atlas’s 960-unit coordinate system; this is a display transformation and does not change case locations or underlying research data. The preparation script checks that fresh atlas and reader exports are supplied together. It does not delete old case files automatically, so review obsolete files when cases are removed.

## GitHub Pages

Push the repository to GitHub, then in **Settings → Pages**, select **Deploy from a branch**, the desired branch (currently `master` locally), and `/ (root)`. GitHub will provide the site URL there. No build service or server-side code is needed.

Atlas case links use `#case=<id>`. Search, state, month, and episode-type filters affect the map, timeline, and case list together.
