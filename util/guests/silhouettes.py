"""The people of Unwelcome Guests (games/contents_may_vary.html, box 6), traced from public-domain silhouettes.

    pip install potracer scipy numpy pillow
    python util/guests/silhouettes.py            # prints the SIL table to paste into the box's view

Every figure is a cut-paper silhouette of the 1830s and 1840s in the Metropolitan Museum of Art, released by the museum
as Open Access (CC0, public domain), fetched through its public collection API. Auguste Edouart died in 1861. The script
downloads each image, finds the figure (a dark component on light paper, cropped where a dog stands beside it), traces it
with potrace into a path 1000 units high with its feet on y = 0, and measures the legs a fifth of the way up so the view
can swing shins below the knee. Facing (+1 right, -1 left) is set by hand below.
"""
import sys, json, os, subprocess
import numpy as np
from PIL import Image
from scipy import ndimage
import potrace


def figures(path, thresh=None, crop=None, opening=1):
    im = Image.open(path).convert('L')
    if crop: W, H = im.size; im = im.crop((round(crop[0] * W), round(crop[2] * H), round(crop[1] * W), round(crop[3] * H)))
    a = np.asarray(im).astype(float)
    # dark paper on light: the threshold sits between the two peaks of the histogram unless given
    t = thresh or (np.percentile(a, 5) + np.percentile(a, 60)) / 2
    m = a < t
    m = ndimage.binary_opening(m, iterations=opening)
    lab, n = ndimage.label(m)
    objs = ndimage.find_objects(lab)
    hs = [(s[0].stop - s[0].start) for s in objs]
    top = max(hs) if hs else 0
    out = []
    for k, s in enumerate(objs):
        h = s[0].stop - s[0].start
        if h < top * .2 or h < 60: continue
        sub = lab[s] == k + 1
        # small specks inside the figure's outline that are paper, not lace, are kept as holes; tiny ones filled
        holes = ndimage.binary_fill_holes(sub) & ~sub
        hl, hn = ndimage.label(holes)
        for q in range(1, hn + 1):
            if (hl == q).sum() < 30: sub[hl == q] = True
        out.append((s, sub))
    return out


def trace(sub, H=360):
    # each figure is traced at about H pixels high: enough for a profile's nose and a hand's fingers, small as text
    f = H / sub.shape[0]
    sub = np.asarray(Image.fromarray(sub.astype(np.uint8) * 255).resize((max(2, round(sub.shape[1] * f)), H), Image.LANCZOS)) > 127
    h, w = sub.shape
    sub = np.pad(sub, 2)
    # potracer traces the False pixels of what it is given: hand it the paper, and it outlines the figure
    bm = potrace.Bitmap(~sub)
    pl = bm.trace(turdsize=6, turnpolicy=potrace.POTRACE_TURNPOLICY_MINORITY, alphamax=1.1, opticurve=True, opttolerance=.6)
    # feet: the lowest tenth of the figure; their middle is x = 0
    rows = np.where(sub.any(axis=1))[0]; bottom = rows.max() + 1
    low = sub[int(bottom - (bottom - rows.min()) * .06):bottom]
    xs = np.where(low.any(axis=0))[0]; cx = (xs.min() + xs.max()) / 2
    hh = bottom - rows.min(); k = 1000 / hh
    P = lambda p: f'{round((p.x - cx) * k)} {round((p.y - bottom) * k)}'
    # the legs a quarter of the way up: where trousers are two runs of black, their middles and widths
    row = sub[int(bottom - (bottom - rows.min()) * .2)]
    runs, x = [], 0
    while x < len(row):
        if row[x]: x0 = x
        while x < len(row) and row[x]: x += 1
        if x > 0 and row[x - 1] and (x == len(row) or not row[x]): runs.append([round(((x0 + x) / 2 - cx) * k), round((x - x0) * k)])
        x += 1
    legs = runs if len(runs) == 2 else []
    d = []
    for c in pl:
        d.append('M' + P(c.start_point))
        for seg in c:
            if seg.is_corner: d.append('L' + P(seg.c) + 'L' + P(seg.end_point))
            else: d.append('C' + P(seg.c1) + ' ' + P(seg.c2) + ' ' + P(seg.end_point))
        d.append('Z')
    return ''.join(d), round(w * k), legs



# name in the view: Met object ID, facing, crop (x0, x1, y0, y1 as shares of the image) or None
SOURCES = {
    'harold': (656554, 1, None),    # Auguste Edouart, James Tooley (top hat, cane)
    'prof': (656698, 1, None),      # Auguste Edouart, Aaron Willard of Boston (spectacles in hand)
    'teddy': (656726, 1, None),     # Auguste Edouart, George Wright (a cup in hand)
    'kessler': (654924, -1, None),  # Auguste Edouart, J. Schwartz Massett of London (reading)
    'sparks': (652866, -1, None),   # Auguste Edouart, Reverend Gorham D. Abbott (both hands out)
    'm1': (653219, 1, None),        # Auguste Edouart, Henry B. Humphrey of Boston (arms folded)
    'm2': (691004, -1, None),       # Auguste Edouart, a man, full-length, arms folded
    'm3': (826468, -1, None),       # J. D. Croome, C. J. Croome, full length (top hat)
    'boy': (786115, -1, (.5, 1, 0, 1)),     # Auguste Edouart, Kate and Harry Lucas: Harry
    'kate': (786115, 1, (0, .412, 0, 1)),   # the same: Kate, without the dog
    'girl': (691008, -1, None),     # Auguste Edouart, Young Girl with Long Braids and Pantalettes, Holding a Flower
}


def fetch(oid, cache='.silhouettes'):
    os.makedirs(cache, exist_ok=True); f = f'{cache}/{oid}.jpg'
    if not os.path.exists(f):
        meta = json.loads(subprocess.run(['curl', '-sS', f'https://collectionapi.metmuseum.org/public/collection/v1/objects/{oid}'], capture_output=True, text=True).stdout)
        assert meta.get('isPublicDomain'), f'{oid} is not public domain'
        subprocess.run(['curl', '-sS', '-o', f, meta['primaryImage']], check=True)
    return f


if __name__ == '__main__':
    rows = []
    for name, (oid, face, crop) in SOURCES.items():
        s, sub = figures(fetch(oid), None, crop)[0]
        d, w, legs = trace(sub)
        rows.append(f"  {name}: [{face}, {json.dumps(legs)}, '{d}']")
    print('const SIL = {\n' + ',\n'.join(rows) + '\n};')
