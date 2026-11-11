# dangerouspress-rvweb

Static web builds from the racial-violence project (`dangerouspress-racialviolence`). Files here are generated; do not
edit by hand. Rebuild on office and copy over.

## 1903

- `1903/reader/`: Random Sample Dossiers, 1903. `index.html` plus `text/t*.json` (white-press article text, loaded
  per entry) and `img/*.jpg` (Black-press clippings). Published: https://claude.ai/artifact/YEUyhyLnPRyfT29KWg5Jny
- `1903/atlas/index.html`: Atlas of Anti-Black Violence, 1903 (self-contained map and timeline). Published:
  https://claude.ai/artifact/4DkdHxNMtb8WbPzemp2byD

Source (office Mac): `~/GitHub/dangerouspress-racialviolence/data/events/1903/dossiers2_sample/{reader,atlas}`, built by
`scripts/events/writeups/dossier2_reader.py` and `dossier2_atlas.py`. Refresh:

    rsync -a office:GitHub/dangerouspress-racialviolence/data/events/1903/dossiers2_sample/reader/ 1903/reader/
    rsync -a office:GitHub/dangerouspress-racialviolence/data/events/1903/dossiers2_sample/atlas/ 1903/atlas/

To view the reader locally, serve it (it fetches `text/*.json`): `python3 -m http.server -d 1903/reader 8000`.
