#!/usr/bin/env python3
"""Move a year's clipping images to Cloudflare R2 and point the case files at them.

  python3 scripts/r2_images.py 1903            # a live year folder (one-off migration)
  python3 scripts/r2_images.py .staging/1903   # import_year.py calls publish() on the staged copy

Images go to the DP page bucket (african-american-press-archive, served at pages.dangerouspress.org) under
rvweb/<YEAR>/img/<stem>-<md5[:10]>.jpg. The content hash in the name means a re-cut clipping gets a new URL, so the
files can be cached for good; uploads only add keys and never overwrite or delete. After every key is confirmed in the
bucket, each case file's "img" becomes the full URL and <base>/reader/img/ is removed, so the site repo carries no
images. Needs the `r2` AWS profile (same one the DP ingest uses).
"""
import hashlib
import json
import shutil
import subprocess
import sys
import tempfile
import urllib.request
from pathlib import Path

BUCKET = "african-american-press-archive"
ENDPOINT = "https://ae978df95b073e0e6a0d595c996900ca.r2.cloudflarestorage.com"
PUBLIC = "https://pages.dangerouspress.org"
PREFIX = "rvweb"


def aws(*args, capture=False):
    cmd = ["aws", "--profile", "r2", "--endpoint-url", ENDPOINT, "s3", *args]
    return subprocess.run(cmd, check=True, text=True, capture_output=capture).stdout


def listed(prefix):
    out = aws("ls", f"s3://{BUCKET}/{prefix}/", "--recursive", capture=True)
    return {line.split()[-1].rsplit("/", 1)[-1]: int(line.split()[2]) for line in out.splitlines() if line.strip()}


def publish(base, year):
    base, year = Path(base), str(year)
    img = base / "reader" / "img"
    if not img.is_dir():
        print(f"{base}: no reader/img folder; nothing to do")
        return
    files = sorted(img.glob("*.jpg"))
    names = {}
    with tempfile.TemporaryDirectory(dir=img.parent) as tmp:  # same volume, so hard links (the Mac's disk is full)
        for f in files:
            name = f"{f.stem}-{hashlib.md5(f.read_bytes()).hexdigest()[:10]}.jpg"
            names[f"img/{f.name}"] = name
            (Path(tmp) / name).hardlink_to(f)
        key = f"{PREFIX}/{year}/img"
        # --size-only: hashed names never change content, so existing keys are skipped, not re-sent
        for attempt in range(3):  # R2 sometimes answers "reduce your concurrent request rate"; sync resumes
            try:
                aws("sync", tmp, f"s3://{BUCKET}/{key}/", "--size-only", "--only-show-errors",
                    "--content-type", "image/jpeg", "--cache-control", "public, max-age=31536000, immutable")
                break
            except subprocess.CalledProcessError:
                if attempt == 2:
                    raise
        have = listed(key)
        sizes = {names[f"img/{f.name}"]: f.stat().st_size for f in files}
        missing = [n for n, s in sizes.items() if have.get(n) != s]
        if missing:
            raise SystemExit(f"{len(missing)} images not in R2 after upload (e.g. {missing[:3]}); case files unchanged")
    # Cloudflare's bot check refuses urllib's default user agent (403), not the file
    probe = f"{PUBLIC}/{key}/{names[f'img/{files[0].name}']}"
    with urllib.request.urlopen(urllib.request.Request(probe, method="HEAD", headers={"User-Agent": "Mozilla/5.0 (rvweb)"}), timeout=30) as r:
        if r.status != 200:
            raise SystemExit(f"public URL check failed ({r.status}): {probe}")
    changed, done, left = 0, 0, []

    def repoint(o, cf):
        nonlocal done
        if isinstance(o, dict):
            for k, v in o.items():
                if k == "img" and isinstance(v, str) and not v.startswith("https://"):
                    if v not in names:
                        left.append(f"{cf.name}: {v}")
                    else:
                        o[k] = f"{PUBLIC}/{key}/{names[v]}"
                        done += 1
                else:
                    repoint(v, cf)
        elif isinstance(o, list):
            for v in o:
                repoint(v, cf)

    for cf in sorted((base / "cases").glob("*.json")):
        d = json.loads(cf.read_text(encoding="utf-8"))
        before = done
        repoint(d, cf)
        if done > before:
            cf.write_text(json.dumps(d, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
            changed += 1
    if left:
        raise SystemExit(f"{len(left)} image links not found in reader/img (e.g. {left[:3]}); reader/img kept")
    if files and not done:
        raise SystemExit("no image links were repointed; reader/img kept")
    shutil.rmtree(img)
    print(f"{year}: {len(files)} images in R2 under {PUBLIC}/{key}/; {done} links in {changed} case files repointed; reader/img removed")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    p = Path(sys.argv[1])
    publish(p, p.name)
