"""Embed the hands of games/rock_paper_scissors_mp.html (Hands Up).

The hands are Microsoft's Fluent Emoji 3D renders (MIT, Copyright (c) Microsoft Corporation,
https://github.com/microsoft/fluentui-emoji): raised fist, raised hand and victory hand. Each is
recoloured by its own brightness onto a four-stop ramp, so every shadow and highlight of the
original survives: violet for you, orange and mirrored for the player across from you. The six
results are written into the page's HANDS block as WebP data URIs.

    python util/hands_up/hands.py
"""
import base64, io, re, urllib.request
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
PAGE = ROOT / 'games' / 'rock_paper_scissors_mp.html'
BASE = 'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/'
SRC = {'rock': 'Raised fist/Default/3D/raised_fist_3d_default.png',
       'paper': 'Raised hand/Default/3D/raised_hand_3d_default.png',
       'scissors': 'Victory hand/Default/3D/victory_hand_3d_default.png'}
# shadow, body, light, highlight
PAL = {'me': ['#2e2596', '#6a60f5', '#9d96ff', '#e6e3ff'], 'op': ['#9c3510', '#f06a32', '#ff9a6a', '#ffe6d6']}
POS = [0, .45, .75, 1]


def hexc(h):
    return [int(h[i:i + 2], 16) for i in (1, 3, 5)]


def percentile(hist, q):
    n, acc = sum(hist), 0
    for i, c in enumerate(hist):
        acc += c
        if acc >= n * q:
            return i
    return 255


def recolor(im, who):
    a, lum = im.getchannel('A'), im.convert('L')
    hist = lum.histogram(mask=a.point(lambda v: 255 if v > 128 else 0))
    lo, hi = percentile(hist, .01), percentile(hist, .995)
    stops = [hexc(c) for c in PAL[who]]

    def colour(v):
        t = min(1, max(0, (v - lo) / max(1, hi - lo)))
        for i in range(3):
            if t <= POS[i + 1]:
                u = (t - POS[i]) / (POS[i + 1] - POS[i])
                return [round(stops[i][c] * (1 - u) + stops[i + 1][c] * u) for c in range(3)]

    lut = [colour(v) for v in range(256)]
    rgb = [lum.point([lut[v][c] for v in range(256)]) for c in range(3)]
    out = Image.merge('RGBA', (*rgb, a))
    return out.transpose(Image.FLIP_LEFT_RIGHT) if who == 'op' else out


def main():
    sources = {k: Image.open(io.BytesIO(urllib.request.urlopen(BASE + urllib.request.quote(p)).read())).convert('RGBA')
               for k, p in SRC.items()}
    lines = []
    for who in PAL:
        for k, im in sources.items():
            buf = io.BytesIO()
            recolor(im, who).save(buf, 'WEBP', quality=88, method=6)
            lines.append(f"    {who}_{k}: 'data:image/webp;base64,{base64.b64encode(buf.getvalue()).decode()}',")
    html = PAGE.read_text()
    new, n = re.subn(r'const HANDS = \{\n[\s\S]*?\n\};', lambda _: 'const HANDS = {\n' + '\n'.join(lines) + '\n};', html)
    if n != 1:
        raise SystemExit('no HANDS block in ' + str(PAGE))
    PAGE.write_text(new)
    print('updated', PAGE)


if __name__ == '__main__':
    main()
