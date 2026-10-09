"""Turn Search Console and Bing Webmaster exports into a short list of things to change.

No account, key or network: download the performance exports by hand and point this at the folder.

    Google: Search Console > Performance > Export > Download CSV (or Excel as CSV). The zip holds
            Queries.csv and Pages.csv (the German names are Suchanfragen / Seiten).
    Bing:   Webmaster Tools > Search Performance > the Queries and Pages tabs > Export. Put "bing" in
            the file name (bing_pages.csv) so it is told apart from Google's.

    python util/seo_report.py exports/                 # every .csv in the folder
    python util/seo_report.py exports/ --min-impressions 20 --out report.md

Four lists come out, each one tied to an edit:
    1. pages whose click rate is below what their position usually earns -> rewrite <title> / description
    2. pages sitting at position 8-20 with real impressions               -> work the query into title, h1, links
    3. queries nothing in the catalogue answers                           -> candidates for IDEAS.md
    4. catalogue pages the export never mentions                          -> thin, unlinked, or not indexed
The exports are capped (1000 rows in Google), so list 4 is a hint, not a verdict.
"""
import argparse
import csv
import io
import json
import re
import sys
from collections import defaultdict
from pathlib import Path
from urllib.parse import unquote, urlparse

ROOT = Path(__file__).resolve().parent.parent

# What a result usually earns at each rounded position (blend of public CTR studies). Past 20: nearly nothing.
EXPECTED_CTR = {1: .28, 2: .15, 3: .11, 4: .08, 5: .06, 6: .05, 7: .04, 8: .03, 9: .025, 10: .02}

PAGE_HEADS = {'top pages', 'pages', 'page', 'url', 'seiten', 'häufigste seiten', 'seite'}
QUERY_HEADS = {'top queries', 'queries', 'query', 'suchanfragen', 'häufigste suchanfragen', 'suchanfrage'}
NAMES = {  # header (lower case) -> field, English and German
    'clicks': 'clicks', 'klicks': 'clicks',
    'impressions': 'impressions', 'impressionen': 'impressions',
    'ctr': 'ctr',
    'position': 'position', 'avg impression position': 'position', 'avg. impression position': 'position',
    'durchschnittliche position': 'position',
}
STOP = set('a an the of for and or to in on with free online game games play spiel spiele kostenlos und der die das'.split())


def number(text, whole=False):
    """'1,234', '3,2%', '12.5 %' -> float. Google localises these, Bing does not.
    whole=True for counts (clicks, impressions): there '1.234' is a German thousand, not 1.234."""
    t = re.sub(r'[%\s\u00a0]', '', str(text))
    if not t:
        return 0.0
    if whole:
        t = re.sub(r'[.,](?=\d{3}(\D|$))', '', t)
    if ',' in t and '.' in t:
        t = t.replace('.', '').replace(',', '.') if t.rfind(',') > t.rfind('.') else t.replace(',', '')
    elif ',' in t:
        head, _, tail = t.rpartition(',')
        t = head + tail if len(tail) == 3 and head and head.isdigit() and ',' not in head else head + '.' + tail
    try:
        return float(t)
    except ValueError:
        return 0.0


def read_export(path):
    """-> (kind, source, rows) with kind 'pages' | 'queries' | None. Rows: key, clicks, impressions, position."""
    raw = Path(path).read_bytes().decode('utf-8-sig', errors='replace')
    sample = raw[:4000]
    delim = max(',;\t', key=lambda d: sample.split('\n', 1)[0].count(d))
    reader = csv.reader(io.StringIO(raw), delimiter=delim)
    head = next(reader, None)
    if not head:
        return None, None, []
    cols = [h.strip().lower() for h in head]
    first = cols[0]
    kind = 'pages' if first in PAGE_HEADS else 'queries' if first in QUERY_HEADS else None
    if kind is None:
        return None, None, []
    source = 'bing' if 'bing' in Path(path).name.lower() or any(c.startswith('avg click') for c in cols) else 'google'
    idx = {NAMES[c]: i for i, c in enumerate(cols) if c in NAMES}
    if 'impressions' not in idx:
        return None, None, []
    rows = []
    for r in reader:
        if len(r) <= idx['impressions'] or not r[0].strip():
            continue
        rows.append({
            'key': r[0].strip(),
            'clicks': number(r[idx['clicks']], True) if 'clicks' in idx else 0.0,
            'impressions': number(r[idx['impressions']], True),
            'position': number(r[idx['position']]) if 'position' in idx else 0.0,
        })
    return kind, source, rows


def merge(sets):
    """Add clicks and impressions across sources; position is weighted by impressions."""
    out = {}
    for rows in sets:
        for r in rows:
            m = out.setdefault(r['key'], {'key': r['key'], 'clicks': 0.0, 'impressions': 0.0, 'pos_x_imp': 0.0})
            m['clicks'] += r['clicks']
            m['impressions'] += r['impressions']
            m['pos_x_imp'] += r['position'] * r['impressions']
    for m in out.values():
        m['position'] = m['pos_x_imp'] / m['impressions'] if m['impressions'] else 0.0
        m['ctr'] = m['clicks'] / m['impressions'] if m['impressions'] else 0.0
    return list(out.values())


def page_key(url):
    """https://www.gptgames.dev/games/2048.html?x=1 -> games/2048  (so .html and clean URLs meet)"""
    path = unquote(urlparse(url).path if '://' in url else url).strip('/')
    path = re.sub(r'(^|/)index\.html$', '', path)
    return re.sub(r'\.html$', '', path)


def tokens(text):
    return {w for w in re.findall(r"[a-zäöüß0-9]+", text.lower()) if w not in STOP and len(w) > 1}


def catalogue():
    entries = []
    for name in ('games', 'tools'):
        for e in json.loads((ROOT / 'data' / f'{name}.json').read_text(encoding='utf-8')):
            words = tokens(' '.join([e['title'], e.get('description', ''), ' '.join(e.get('tags', [])),
                                     ' '.join(e.get('categories', [])), e['id'].replace('_', ' ')]))
            entries.append({'key': page_key(e['url']), 'url': e['url'], 'title': e['title'], 'words': words})
    return entries


def current_head(url):
    """The <title> and meta description as they stand in the file: what the edit would replace."""
    try:
        html = (ROOT / url).read_text(encoding='utf-8', errors='replace')[:20000]
    except OSError:
        return '', ''
    t = re.search(r'<title[^>]*>(.*?)</title>', html, re.S | re.I)
    d = re.search(r'<meta[^>]+name=["\']description["\'][^>]*content=["\'](.*?)["\']', html, re.S | re.I)
    return (t.group(1).strip() if t else ''), (d.group(1).strip() if d else '')


def expected_ctr(position):
    p = round(position)
    return EXPECTED_CTR.get(p, .01 if p <= 20 else .005) if p >= 1 else EXPECTED_CTR[1]


def table(header, rows):
    if not rows:
        return '_Nothing here._\n'
    lines = ['| ' + ' | '.join(header) + ' |', '|' + '|'.join('---' for _ in header) + '|']
    lines += ['| ' + ' | '.join(str(c).replace('|', '/') for c in r) + ' |' for r in rows]
    return '\n'.join(lines) + '\n'


def build_report(files, min_imp, limit):
    pages, queries, seen = defaultdict(list), defaultdict(list), []
    for f in files:
        kind, source, rows = read_export(f)
        if kind:
            (pages if kind == 'pages' else queries)[source].append(rows)
            seen.append(f'{Path(f).name} ({source} {kind}, {len(rows)} rows)')
    cat = catalogue()
    by_key = {e['key']: e for e in cat}
    out = ['# SEO report', '', 'Read: ' + (', '.join(seen) or 'nothing recognised'), '']
    if not seen:
        out.append('No export recognised. The first column must be called Top pages / Seiten or '
                   'Top queries / Suchanfragen (Bing: Page / Query).')
        return '\n'.join(out) + '\n'

    # pages: fold URL variants (www / not, .html / clean) into one row per catalogue key
    folded = defaultdict(lambda: {'clicks': 0.0, 'impressions': 0.0, 'pos_x_imp': 0.0})
    for rows in (r for sets in pages.values() for r in sets):
        for r in merge([rows]):
            f = folded[page_key(r['key'])]
            f['clicks'] += r['clicks']
            f['impressions'] += r['impressions']
            f['pos_x_imp'] += r['position'] * r['impressions']
    plist = []
    for k, f in folded.items():
        if f['impressions']:
            plist.append({'key': k, 'clicks': f['clicks'], 'impressions': f['impressions'],
                          'position': f['pos_x_imp'] / f['impressions'], 'ctr': f['clicks'] / f['impressions']})

    if plist:
        chances = []
        for p in plist:
            if p['impressions'] < min_imp or p['position'] > 10.5:
                continue
            missed = p['impressions'] * expected_ctr(p['position']) - p['clicks']
            if missed >= 1 and p['ctr'] < expected_ctr(p['position']) * .7:
                chances.append((missed, p))
        chances.sort(key=lambda c: -c[0])
        rows = []
        for missed, p in chances[:limit]:
            e = by_key.get(p['key'])
            title, desc = current_head(e['url']) if e else ('', '')
            rows.append([f"`{e['url'] if e else p['key']}`", int(p['impressions']), int(p['clicks']),
                         f"{p['ctr']:.1%}", f"{p['position']:.1f}", f'+{missed:.0f}', title, desc[:90]])
        out += ['## 1. Click rate below what the position earns', '',
                'Rewrite the title first (it is what people read), then the description. '
                '"Missed" is clicks per export period at a typical rate for that position.', '',
                table(['page', 'impr.', 'clicks', 'CTR', 'pos.', 'missed', 'title now', 'description now'], rows)]

        near = sorted((p for p in plist if 8 <= p['position'] <= 20 and p['impressions'] >= min_imp),
                      key=lambda p: -p['impressions'])[:limit]
        rows = [[f"`{by_key[p['key']]['url'] if p['key'] in by_key else p['key']}`", int(p['impressions']),
                 int(p['clicks']), f"{p['position']:.1f}"] for p in near]
        out += ['## 2. Just off page one (position 8-20)', '',
                'Find the query behind each in the Queries export (filter by page in Search Console), '
                'then put its words in the title, the `<h1>`, and link to the page from related ones.', '',
                table(['page', 'impr.', 'clicks', 'pos.'], rows)]

    qlist = merge([r for sets in queries.values() for r in sets])
    if qlist:
        gaps = []
        for q in qlist:
            if q['impressions'] < min_imp:
                continue
            qt = tokens(q['key'])
            if not qt:
                continue
            best = max(cat, key=lambda e: len(qt & e['words']))
            cover = len(qt & best['words']) / len(qt)
            if cover < .6:
                gaps.append((q['impressions'], q, best, cover))
        gaps.sort(key=lambda g: -g[0])
        rows = [[q['key'], int(q['impressions']), int(q['clicks']), f"{q['position']:.1f}",
                 f"{best['title']} ({cover:.0%})"] for _, q, best, cover in gaps[:limit]]
        out += ['## 3. Queries the catalogue barely answers', '',
                'People already see the site for these, so there is demand. Check `IDEAS.md` '
                '(including Tried and rejected) before pitching one. The last column is the closest page and how much '
                'of the query it covers; a word-overlap guess, not a judgement.', '',
                table(['query', 'impr.', 'clicks', 'pos.', 'closest page'], rows)]

    if plist:
        listed = {p['key'] for p in plist}
        missing = [e for e in cat if e['key'] not in listed]
        out += ['## 4. In the catalogue, not in the export', '',
                f'{len(missing)} of {len(cat)} pages have no impressions in the period '
                f'({len(plist)} pages listed). If the export hit its row cap this is partly an artefact; '
                'otherwise check these in the URL Inspection tool for "Discovered / Crawled - currently not indexed".', '',
                table(['page', 'title'], [[f"`{e['url']}`", e['title']] for e in missing[:limit]])]
        if len(missing) > limit:
            out.append(f'_{len(missing) - limit} more not shown (use --limit)._\n')
    return '\n'.join(out) + '\n'


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n\n')[0])
    ap.add_argument('folder', help='folder with the exported CSV files (or a single CSV)')
    ap.add_argument('--min-impressions', type=int, default=30, help='ignore rows seen less often (default 30)')
    ap.add_argument('--limit', type=int, default=25, help='rows per list (default 25)')
    ap.add_argument('--out', help='write Markdown here instead of printing it')
    a = ap.parse_args()
    p = Path(a.folder)
    files = [p] if p.is_file() else sorted(p.rglob('*.csv'))
    if not files:
        sys.exit(f'No .csv files in {p}')
    report = build_report(files, a.min_impressions, a.limit)
    if a.out:
        Path(a.out).write_text(report, encoding='utf-8')
        print(f'Wrote {a.out}')
    else:
        sys.stdout.write(report)


if __name__ == '__main__':
    main()
