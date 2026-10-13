"""Builds data/opposites.json for tools/opposite_finder.html from Princeton WordNet 3.0.

    curl -LO https://raw.githubusercontent.com/nltk/nltk_data/gh-pages/packages/corpora/wordnet.zip
    unzip wordnet.zip && python util/opposites/build.py wordnet

Keeps only what antonymy needs: every synset with a recorded (lexical, "!") antonym, the
satellite adjectives clustered around such a head ("&"), and the also-see links ("^") of heads.
Every lemma that reaches one of them is indexed with its synsets in WordNet's sense order and the
tagged-corpus count of that sense, so the page can rank senses the way the dictionary does.
"""
import json, os, sys

src = sys.argv[1]
out = os.path.join(os.path.dirname(__file__), '..', '..', 'data', 'opposites.json')
POS = {'n': 'noun', 'v': 'verb', 'a': 'adj', 's': 'adj', 'r': 'adv'}
FILES = {'noun': 'n', 'verb': 'v', 'adj': 'a', 'adv': 'r'}

syn = {}  # key "a01148283" -> dict
for name, p in FILES.items():
    for line in open(os.path.join(src, 'data.' + name), encoding='utf-8'):
        if line.startswith('  '):
            continue
        body, _, gloss = line.partition(' | ')
        f = body.split()
        off, ss_type = f[0], f[2]
        n = int(f[3], 16)
        lemmas = [f[4 + 2 * i] for i in range(n)]
        i = 4 + 2 * n
        pc = int(f[i]); i += 1
        ptrs = []
        for _ in range(pc):
            sym, toff, tpos, st = f[i:i + 4]; i += 4
            ptrs.append((sym, FILES[POS[tpos]] + toff, int(st[:2], 16), int(st[2:], 16)))
        g = gloss.strip().split(';')[0].strip().strip('"').strip()
        syn[p + off] = dict(lemmas=lemmas, sat=ss_type == 's', ptrs=ptrs, gloss=g, pos=POS[ss_type])

def clean(l):
    l = l.replace('_', ' ')
    return l.split('(')[0]  # adjective markers like (a), (p), (ip)

# tagged counts per (lemma, synset)
cnt = {}
for line in open(os.path.join(src, 'index.sense'), encoding='utf-8'):
    key, off, sn, tc = line.split()
    lemma, rest = key.split('%')
    p = 'nvarr'[int(rest[0]) - 1] if rest[0] != '5' else 'a'
    p = {'1': 'n', '2': 'v', '3': 'a', '4': 'r', '5': 'a'}[rest[0]]
    cnt[(lemma.lower(), p + off)] = (int(sn), int(tc))

keep = {}  # synset key -> record
def need(k):
    if k not in keep:
        s = syn[k]
        keep[k] = dict(p=s['pos'], g=s['gloss'], l=[clean(x) for x in s['lemmas']])
    return keep[k]

heads = [k for k, s in syn.items() if any(p[0] == '!' for p in s['ptrs'])]
for k in heads:
    r = need(k)
    s = syn[k]
    ants = []
    for sym, t, so, ta in s['ptrs']:
        if sym != '!':
            continue
        need(t)
        ants.append([t, so - 1, ta - 1])  # lemma-level pair: source lemma index, target lemma index
    r['a'] = ants
    sats = [t for sym, t, *_ in s['ptrs'] if sym == '&' and syn[t]['sat']]
    for t in sats:
        need(t)['h'] = k
    if sats:
        r['s'] = sats
    also = [t for sym, t, *_ in s['ptrs'] if sym == '^' and any(p[0] == '!' for p in syn[t]['ptrs'])]
    if also:
        r['x'] = also

# number synsets compactly
order = sorted(keep)
idx = {k: i for i, k in enumerate(order)}
S = []
for k in order:
    r = keep[k]
    e = [r['p'][0], r['g'], r['l']]
    e.append([[idx[t], a, b] for t, a, b in r.get('a', [])])
    e.append(idx[r['h']] if 'h' in r else -1)
    e.append([idx[t] for t in r.get('s', [])])
    e.append([idx[t] for t in r.get('x', [])])
    S.append(e)

W = {}
for k in order:
    for raw in syn[k]['lemmas']:
        lw = clean(raw).lower()
        sn, tc = cnt.get((raw.split('(')[0].lower(), k), (99, 0))
        W.setdefault(lw, []).append([idx[k], sn, tc])
for v in W.values():
    v.sort(key=lambda e: e[1])
# frequency of a word overall, used to rank near opposites
F = {}
for (lemma, _), (_, tc) in cnt.items():
    w = lemma.replace('_', ' ')
    if w in W:
        F[w] = F.get(w, 0) + tc
# the word's most frequent sense of any kind, so a rare sense with an opposite is not taken for the usual one
top = {}
for (lemma, _), (_, tc) in cnt.items():
    w = lemma.replace('_', ' ')
    top[w] = max(top.get(w, 0), tc)
for w in W:
    W[w] = [top.get(w, 0)] + [[e[0], e[2]] for e in W[w]]

# every WordNet word (and phrase), as a Bloom filter: tells "dog" (a word with no opposite) from "hapy" (a typo)
def fnv(s, seed):
    h = (2166136261 ^ seed) & 0xffffffff
    for b in s.encode('utf-8'):
        h = ((h ^ b) * 16777619) & 0xffffffff
    return h
words = set()
for name in FILES:
    for line in open(os.path.join(src, 'index.' + name), encoding='utf-8'):
        if not line.startswith(' '):
            words.add(line.split()[0].replace('_', ' ').lower())
K, M = 4, len(words) * 7 // 8 * 8
bits = bytearray(M // 8)
for w in words:
    for k in range(K):
        h = fnv(w, k) % M
        bits[h >> 3] |= 1 << (h & 7)
import base64
B = dict(k=K, m=M, b=base64.b64encode(bytes(bits)).decode())

# exceptions (irregular forms) that lead to an indexed lemma
X = {}
for p in ('noun', 'verb', 'adj', 'adv'):
    for line in open(os.path.join(src, p + '.exc'), encoding='utf-8'):
        f = line.split()
        form, bases = f[0].replace('_', ' '), [b.replace('_', ' ') for b in f[1:]]
        bases = [b for b in bases if b in W]
        if bases:
            X.setdefault(form, [])
            X[form] += [b for b in bases if b not in X[form]]

data = dict(v='WordNet 3.0', s=S, w=W, f={w: c for w, c in F.items() if c}, x=X, b=B)
with open(out, 'w', encoding='utf-8') as fh:
    json.dump(data, fh, ensure_ascii=False, separators=(',', ':'))
print(len(S), 'synsets', len(W), 'words', len(X), 'exceptions', os.path.getsize(out), 'bytes')
