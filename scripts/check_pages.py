#!/usr/bin/env python3
"""Check indexes, case files, and the reader's text shards."""
import json
from pathlib import Path
root = Path(__file__).resolve().parent.parent / '1903'
atlas = json.loads((root/'atlas/data.json').read_text())
reader = json.loads((root/'reader/data.json').read_text())
errors=[]
ids=[e['id'] for e in reader['episodes']]
if len(ids)!=len(set(ids)): errors.append('Duplicate reader IDs')
reader_ids=set(ids)
for ep in atlas['episodes']:
    if ep['dir'] not in reader_ids: errors.append(f"No dossier for {ep['id']}")
for ident in ids:
    path=root/'cases'/f'{ident}.json'
    if not path.is_file():
        errors.append(f'Missing case: {ident}'); continue
    case=json.loads(path.read_text())
    if case.get('id')!=ident or case.get('reader',{}).get('id')!=ident:
        errors.append(f'Case ID mismatch: {ident}'); continue
    tx=case['reader'].get('tx')
    if tx is not None and not (root/'reader'/'text'/f't{tx:02d}.json').is_file(): errors.append(f'Missing text shard for {ident}')
for ep in atlas['episodes']:
    path=root/'cases'/f"{ep['dir']}.json"
    if path.is_file() and not json.loads(path.read_text()).get('atlas'): errors.append(f"Missing atlas narrative for {ep['id']}")
if errors:
    print('\n'.join(errors)); raise SystemExit(f'{len(errors)} error(s)')
print(f"OK: {len(atlas['episodes'])} atlas entries and {len(ids)} shared cases; links and text files resolve.")
