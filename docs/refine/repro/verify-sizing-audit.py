"""Verify snapshot integrity, rollups, and independently reconcile literal px."""
import csv
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / 'docs/refine/sizing-audit-2026-10-03'
def read(name):
    with (OUT / name).open() as stream:
        return list(csv.DictReader(stream))

manifest = json.loads((OUT / 'manifest.json').read_text())
rows = read('occurrences.csv')
direct = [r for r in rows if r['bucket'] in ('direct', 'component default', 'component constant')]
pixels = [r for r in direct if r['unit'] == 'px']
assert len(pixels) == manifest['summary']['directPixelOccurrences']
assert sum(int(r['count']) for r in read('pixel-ranking.csv')) == len(pixels)
assert sum(int(r['raw_pixel_occurrences']) for r in read('component-summary.csv')) == len(pixels)
assert sum(int(r['occurrence_count']) for r in read('component-sizes.csv')) == len(direct)
assert not read('review-candidates.csv')
locations = {(r['file'], int(r['line']), int(r['column'])) for r in rows}
assert len(locations) == len(rows)
literal_count = 0
for entry in manifest['files']:
    source = (ROOT / entry['file']).read_text()
    assert hashlib.sha256(source.encode()).hexdigest() == entry['sha256'], entry['file']
    # Preserve offsets while independently removing comments. String contents in
    # this snapshot contain no comment-like px literals; unmatched px fails below.
    cleaned = re.sub(r'/\*[\s\S]*?\*/|//[^\n]*', lambda m: re.sub(r'[^\n]', ' ', m[0]), source)
    for line, text in enumerate(cleaned.splitlines(), 1):
        for match in re.finditer(r'(?<![\w#])-?\d*\.?\d+px\b', text):
            assert (entry['file'], line, match.start() + 1) in locations, (entry['file'], line, match[0])
            literal_count += 1
for row in rows:
    line = (ROOT / row['file']).read_text().splitlines()[int(row['line']) - 1]
    assert row['excerpt'] == line.strip()
    assert 1 <= int(row['column']) <= len(line)
# Representative cases checked independently against source and role.
def find(component, prop, size):
    return [r for r in rows if r['component'].endswith(component) and r['property'] == prop and r['size'] == size]
assert not find('/OverviewScreen', 'left', '1px')
assert len(find('/Timeline', 'badgeLeft', '38px')) == 2
assert not find('/StatusIconBadge', 'glyph', '12px')
assert any(
    row['token'] == '--status-icon-badge-glyph-sm'
    and row['file'] == 'apps/web/src/app/components/StatusIconBadge.tsx'
    for row in read('token-references.csv')
)
assert find('/PhotoLightbox', 'min-height', '400px')
assert find('/IconBase', 'size', '24px')
assert any(r['unit'] == 'svg-unit' for r in rows)
assert any(r['bucket'] == 'token definition' and r['property'] == 'type-page-title' for r in rows)
print(f'PASS: {len(manifest["files"])} source hashes; {len(pixels)} direct px occurrences; {literal_count} literal px positions; rollups, locations, zero unresolved candidates, representative classifications.')
