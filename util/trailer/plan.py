"""Step 2: the trailer's timeline, shared by the picture (trailer.html) and the sound (music.py).

Reads the screenshots shoot.mjs took and the git history, and writes build/plan.json plus
build/assets/ (the pictures, as JPEG, at the size the trailer draws them) and build/fonts/.
Every time is in seconds; the music is 120 BPM, so a beat is 0.5 s and a bar 2 s, and every
cut below lands on one.
"""
import json
import re
import subprocess
import urllib.request
from datetime import date
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent
BUILD = HERE / 'build'
SHOTS = BUILD / 'shots'
ASSETS = BUILD / 'assets'
BEAT, BAR, DURATION = 0.5, 2.0, 96.0

# When each model's name fills the screen, on a bar line. They are the names the time
# travel bar carries (timeline_data.json); a new one needs a slot here and in the music.
ERAS = [(16.0, 'GPT 4.0'), (20.0, 'Claude 3.0'), (24.0, 'Claude 3.5'), (28.0, 'Claude 3.7'), (32.0, 'Claude 4.0'),
        (36.0, 'Claude 4.6'), (40.0, 'Claude 4.8'), (42.0, 'Claude 5.0'), (46.0, 'Claude 5.5')]
# One page, version by version, from 50 s: how long each version stays (8 s in all).
SNAKE = 'games/snake.html'
SNAKE_HOLDS = [1.0, 0.25, 0.25, 0.5, 0.25, 0.25, 1.5] + [0.25] * 9 + [1.0, 0.25, 0.5]
# First version against a later one, from 58 s: (page, before, after, seconds).
PAIRS = [('games/pong.html', 1, 5, 2.0), ('games/asteroids.html', 1, 4, 2.0), ('games/frogger.html', 1, 3, 1.5),
         ('games/chess.html', 1, 3, 1.5), ('games/duck_hunt.html', 1, 6, 1.0)]
# The commit log, quoted like the critics on a poster, from 66 s; the stars climb as the
# games did. Each quote must be in its commit's message; the picture is behind it, blurred.
QUOTES = [('bbdbe452', 1, 'maze v 0.1 (player does not even fit through the passages)', 'Escape the Maze',
           ('games/escape_the_maze.html', 15)),
          ('5263c5cb', 2, "add gameOver function that doesn't work", 'Tetris', ('games/blockdrop.html', 6)),
          ('effc9b60', 3, 'update horrendous fishing game to something actually playable', 'Plumb',
           ('games/fishing.html', 5)),
          ('f89c14eb', 5, 'almost forgot to commit the game, because I got lost in playing it myself...',
           'Breakout Remastered', ('games/breakout.html', 7))]
FONTS = ('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323'
         '&family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=block')


def git(*args):
    return subprocess.run(['git', *args], cwd=REPO, check=True, capture_output=True, text=True).stdout


def show(ref, path):
    r = subprocess.run(['git', 'show', f'{ref}:{path}'], cwd=REPO, capture_output=True)
    return r.stdout.decode('utf-8', 'replace') if r.returncode == 0 else None


def jpeg(src, dst, quality=88):
    dst.parent.mkdir(parents=True, exist_ok=True)
    if not dst.exists() or dst.stat().st_mtime < src.stat().st_mtime:
        Image.open(src).convert('RGB').save(dst, quality=quality)
    return str(dst.relative_to(HERE))


def catalogue_size(ref):
    """What the home page listed that day: data/*.json once it existed, else its links."""
    games, tools = show(ref, 'data/games.json'), show(ref, 'data/tools.json')
    if games and tools:
        return len(json.loads(games)), len(json.loads(tools))
    links = set(re.findall(r'''["'(](?:\./|/)?((?:games|tools)/[^"'?#)]+?\.html)''', show(ref, 'index.html') or ''))
    return sum(l.startswith('games/') for l in links), sum(l.startswith('tools/') for l in links)


def ease_in_out(x):
    return x * x * (3 - 2 * x)


def ease_in(x):
    return x * x


def track(events, t0, t1, i0, i1, ease):
    """Day changes from i0 to i1 (both included), spread over [t0, t1) along an ease."""
    steps = abs(i1 - i0)
    sign = 1 if i1 >= i0 else -1
    for s in range(steps + 1):
        x = s / steps if steps else 0
        lo, hi = 0.0, 1.0
        for _ in range(40):  # the time at which the eased position reaches x
            mid = (lo + hi) / 2
            lo, hi = (mid, hi) if ease(mid) < x else (lo, mid)
        events.append([round(t0 + (t1 - t0) * hi, 4), i0 + sign * s])


def fonts():
    """The site's four typefaces, served next to the trailer (latin subsets only)."""
    out = BUILD / 'fonts'
    if (out / 'fonts.css').exists():
        return
    out.mkdir(parents=True, exist_ok=True)
    ua = {'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36'}
    css = urllib.request.urlopen(urllib.request.Request(FONTS, headers=ua)).read().decode()
    faces = []
    for subset, block in re.findall(r'/\* ([^*]+) \*/\s*(@font-face \{[^}]+\})', css):
        if subset.strip() not in ('latin', 'latin-ext'):
            continue
        url = re.search(r'url\((https://[^)]+)\)', block).group(1)
        family = re.search(r"font-family: '([^']+)'", block).group(1).replace(' ', '')
        weight = re.search(r'font-weight: (\d+)', block).group(1)
        name = f"{family}-{weight}-{subset.strip()}.woff2"
        (out / name).write_bytes(urllib.request.urlopen(url).read())
        faces.append(block.replace(url, name))
    (out / 'fonts.css').write_text('\n'.join(faces) + '\n')


def main():
    fonts()
    snapshots = sorted((d for d in json.loads((REPO / 'timeline_data.json').read_text())
                        if d.get('hash') and d.get('GptVersion') != 'CURRENT'), key=lambda d: d['timestamp'])
    days = []
    for d in snapshots:
        day = d['timestamp'][:10]
        games, tools = catalogue_size(d['hash'])
        img = jpeg(SHOTS / 'home' / f"{day}_{d['hash'][:8]}.png", ASSETS / 'home' / f"{day}_{d['hash'][:8]}.jpg")
        days.append({'day': day, 'hash': d['hash'], 'model': d.get('GptVersion'), 'games': games, 'tools': tools,
                     'img': img})
    last = len(days) - 1
    today = jpeg(SHOTS / 'today.png', ASSETS / 'today.jpg', 90)

    # ---- the site, day by day: [time, snapshot index]; last + 1 is today, the live site
    eras = []
    for t, label in ERAS:
        i = next((n for n, d in enumerate(days) if d['model'] == label), None)
        assert i is not None, f"no day in timeline_data.json is labelled {label!r}"
        eras.append((t, i))
    day_track = [[0.0, last + 1]]
    track(day_track, 6.3, 7.85, last, 0, ease_in_out)          # the rewind to day one
    day_track.append([8.0, 0])
    track(day_track, 14.0, 15.95, 0, eras[0][1] - 1, ease_in)   # and away from it
    for n, (t, i) in enumerate(eras):
        t_next, i_next = eras[n + 1] if n + 1 < len(eras) else (48.0, last + 1)
        day_track.append([t, i])
        hold = 1.1 if t_next - t <= 2 else 1.9                   # while the name is up
        if i_next - 1 > i:
            track(day_track, t + hold, t_next - 0.06, i + 1, i_next - 1, ease_in_out)
    day_track.append([48.0, last])
    changes = []
    for t, i in sorted(day_track, key=lambda e: e[0]):
        if not changes or changes[-1][1] != i:
            changes.append([t, i])

    # ---- pages, version by version
    index = json.loads((SHOTS / 'pages' / 'index.json').read_text())
    pages = {}
    for key, rows in index.items():
        pages[key] = [{**r, 'img': jpeg(SHOTS / 'pages' / r['file'], ASSETS / 'pages' / r['file'].replace('.png', '.jpg'), 90)}
                      for r in rows]
    assert len(SNAKE_HOLDS) == len(pages[SNAKE]) and abs(sum(SNAKE_HOLDS) - 8.0) < 1e-9, 'snake holds'
    snake, t = [], 50.0
    for k, hold in enumerate(SNAKE_HOLDS):
        snake.append([t, k])
        t += hold
    pairs, t = [], 58.0
    for key, a, b, hold in PAIRS:
        pairs.append({'t': t, 'hold': hold, 'key': key, 'va': a, 'vb': b})
        t += hold
    assert abs(t - 66.0) < 1e-9, 'pairs must fill 58-66 s'
    quotes = []
    for n, (sha, stars, text, game, (key, v)) in enumerate(QUOTES):
        full, day, message = git('log', '-1', '--date=short', '--format=%H%n%ad%n%s', sha).split('\n', 2)
        assert text in message, (text, message)
        quotes.append({'t': 66.0 + 2 * n, 'hash': full, 'day': day, 'stars': stars, 'text': text, 'game': game,
                       'img': pages[key][v - 1]['img']})

    # ---- the wall: every entry the catalogue has today
    tiles = []
    for f in ('data/games.json', 'data/tools.json'):
        for e in json.loads((REPO / f).read_text()):
            shot = REPO / (e.get('screenshot') or '-')
            if shot.is_file():
                tiles.append(str(Path('..', '..', e['screenshot'])))   # relative to util/trailer/
    entries = [json.loads((REPO / f).read_text()) for f in ('data/games.json', 'data/tools.json')]
    history = json.loads((REPO / 'timeline_pages.json').read_text())
    first = git('log', '--reverse', '--format=%ad', '--date=short', 'HEAD').split('\n', 1)[0]
    numbers = {
        'games': len(entries[0]), 'tools': len(entries[1]),
        'commits': int(git('rev-list', '--count', 'HEAD')),
        'versions': sum(len(v) for v in history.values() if isinstance(v, list)),
        'models': sum(1 for d in days if d['model']),
        'days': (date.today() - date.fromisoformat(first)).days,
    }

    plan = {
        'beat': BEAT, 'bar': BAR, 'duration': DURATION,
        'days': days, 'today': today, 'dayTrack': changes,
        'eras': [{'t': t, 'i': i, 'label': days[i]['model'], 'day': days[i]['day']} for t, i in eras],
        'pages': pages,
        'snake': {'key': SNAKE, 'track': snake},
        'pairs': pairs, 'quotes': quotes,
        'tiles': tiles, 'numbers': numbers,
        'wall': 74.0,
        'stats': [[76.0, 'entries'], [78.0, 'commits'], [80.0, 'versions'], [82.0, 'models']],
        'back': 84.0, 'title': 86.0,
    }
    (BUILD / 'plan.json').write_text(json.dumps(plan))
    print(f"{len(days)} days, {len(changes)} day changes, {len(tiles)} tiles; {numbers}")


if __name__ == '__main__':
    main()
