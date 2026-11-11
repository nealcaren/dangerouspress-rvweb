#!/usr/bin/env python3
"""Convert upstream generated pages into the static site's indexes and shared cases."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BASE = ROOT / '1903'
ARTIFACT = 'https://claude.ai/artifact/YEUyhyLnPRyfT29KWg5Jny'

def dump(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')

def upstream(section, variable):
    folder = BASE / section
    page = folder / 'index.html'
    html = page.read_text(encoding='utf-8')
    marker = f'<script>\nconst {variable} = '
    if marker not in html:
        return None
    start = html.index(marker)
    data_start = start + len(marker)
    end = html.index(';\n', data_start)
    data = json.loads(html[data_start:end])
    script_end = html.index('</script>', end)
    html = html[:start] + '<script src="app.js" defer></script>' + html[script_end + len('</script>'):]
    html = html.replace('</style>', '</style>\n<link rel="stylesheet" href="../theme.css">', 1)
    if section == 'atlas':
        html = html.replace(" placed on 1910 county lines and month by month through the year. Hover a mark for the event table's short summary; click or tap it to read the dossier's\n account. Drafts: no entry has had human review.", " placed on 1910 county lines and month by month through the year. Hover for a short summary; select a dot to read the account in the sidebar. Drafts: no entry has had human review.")
    html = (html.replace('family=Fraunces:opsz,wght@9..144,600', 'family=Source+Serif+4:opsz,wght@8..60,600')
            .replace('family=IBM+Plex+Sans+Condensed:wght@400;500;600', 'family=IBM+Plex+Sans:wght@400;500;600')
            .replace('--display:"Fraunces",Georgia,serif', '--display:"Source Serif 4",Georgia,serif')
            .replace('--ui:"IBM Plex Sans Condensed","Arial Narrow",system-ui,sans-serif', '--ui:"IBM Plex Sans",system-ui,sans-serif'))
    page.write_text('<!doctype html>\n<html lang="en">\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n' + html.replace(ARTIFACT, '../reader/'), encoding='utf-8')
    return data

def simplify_path(path, tolerance=.12):
    """Remove near-collinear points from each closed ring (screen units at 960px)."""
    def simplify(points):
        if len(points) < 4:
            return points
        keep = {0, len(points)-1}
        stack = [(0, len(points)-1)]
        while stack:
            a,b = stack.pop()
            x,y=points[a]; dx=points[b][0]-x; dy=points[b][1]-y
            denom=dx*dx+dy*dy
            best, idx = 0, None
            for i in range(a+1,b):
                px,py=points[i]
                t=max(0,min(1,((px-x)*dx+(py-y)*dy)/denom)) if denom else 0
                d=(px-x-t*dx)**2+(py-y-t*dy)**2
                if d>best: best,idx=d,i
            if best>tolerance*tolerance:
                keep.add(idx); stack.extend(((a,idx),(idx,b)))
        result=[points[i] for i in sorted(keep)]
        return result if len(result)>=3 else points
    def ring(match):
        coords=re.findall(r'[ML](-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)', match.group())
        points=[(float(x),float(y)) for x,y in coords]
        points=simplify(points)
        return ''.join(('M' if i==0 else 'L')+f'{x:.1f},{y:.1f}' for i,(x,y) in enumerate(points))+'Z'
    return re.sub(r'M[^M]*?Z', ring, path)

def prepare(atlas, reader):
    case_dir = BASE / 'cases'; case_dir.mkdir(exist_ok=True)
    atlas_by_dir = {e['dir']:e for e in atlas['episodes']}
    ids = set()
    for e in reader['episodes']:
        ident=e['id']
        if not re.fullmatch(r'[a-z0-9-]+', ident) or ident in ids:
            raise ValueError(f'Unsafe or duplicate case ID: {ident}')
        ids.add(ident)
        a=atlas_by_dir.get(ident)
        dump(case_dir / f'{ident}.json', {'id':ident,'atlas':{'text':a['text']} if a else None,'reader':e})
    missing=set(atlas_by_dir)-ids
    if missing: raise ValueError(f'Atlas cases missing reader records: {sorted(missing)}')
    for e in atlas['episodes']: e.pop('text', None)
    for key in ('nation', 'states'): atlas[key]=simplify_path(atlas[key])
    atlas['counties']={k:simplify_path(v) for k,v in atlas['counties'].items()}
    reader['episodes']=[{'id':e['id'],'title':e['title'],'city':e['city'],'state':e['state'],
      'when':e['when'],'chips':e['chips'],'lead':' '.join(s['text'] for s in e['summary'] if s['section']=='lead'),
      'n_this':sum(s['rel']=='this' for s in e['sources']),'n_papers':len({s['paper'] for s in e['sources']}),
      'n_clips':e['n_clips'],'n_accounts':len(e['accounts'])} for e in reader['episodes']]
    dump(BASE/'atlas/data.json',atlas); dump(BASE/'reader/data.json',reader)
    print(f"Prepared {len(atlas['episodes'])} atlas entries and {len(ids)} shared cases.")

if __name__ == '__main__':
    # Both files must be fresh generated pages. Published app.js files are maintained here.
    htmls=[(BASE/s/'index.html').read_text(encoding='utf-8') for s in ('atlas','reader')]
    flags=['<script>\nconst G = ' in htmls[0], '<script>\nconst DATA = ' in htmls[1]]
    if not any(flags): print('Already prepared; nothing to do.')
    elif not all(flags): raise SystemExit('Copy both fresh upstream pages before preparing.')
    else: prepare(upstream('atlas','G'),upstream('reader','DATA'))
