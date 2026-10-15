"""Builds data/word_explainer/<shard>.json for tools/word_explainer.html from Princeton WordNet 3.0.

    curl -LO https://raw.githubusercontent.com/nltk/nltk_data/gh-pages/packages/corpora/wordnet.zip
    unzip wordnet.zip && python util/word_explainer/build.py wordnet

One shard per first two letters (a-z, '_' for anything else or a missing letter), so a lookup loads one
small file (about 30 KB compressed). A synset is repeated in every shard that names it.
A shard holds:
  w: lemma (lower case, spaces) -> [synset ids in WordNet sense order]   (sense order is by tagged frequency)
  s: synset id -> [pos, definition, [examples], [synonyms], kind, [opposites], tagcount]
  x: irregular form -> [[base, pos]]   (WordNet's *.exc files, keyed by the inflected form)
"""
import json, os, re, sys

src = sys.argv[1]
out = os.path.join(os.path.dirname(__file__), '..', '..', 'data', 'word_explainer')
os.makedirs(out, exist_ok=True)
FILES = {'noun': 'n', 'verb': 'v', 'adj': 'a', 'adv': 'r'}
POSN = {'n': 'n', 'v': 'v', 'a': 'a', 's': 'a', 'r': 'r'}

def clean(l):
    return l.replace('_', ' ').split('(')[0]

syn = {}
for name, p in FILES.items():
    for line in open(os.path.join(src, 'data.' + name), encoding='utf-8'):
        if line.startswith('  '):
            continue
        body, _, gloss = line.partition(' | ')
        f = body.split()
        off, t = f[0], f[2]
        n = int(f[3], 16)
        lemmas = [clean(f[4 + 2 * i]) for i in range(n)]
        i = 4 + 2 * n
        pc = int(f[i]); i += 1
        ptrs = []
        for _ in range(pc):
            sym, toff, tpos, st = f[i:i + 4]; i += 4
            ptrs.append((sym, POSN[tpos] + toff, int(st[:2], 16), int(st[2:], 16)))
        # gloss: definition parts, then "quoted examples"; separated by ';'
        parts, exs, defs, cur, q = [], [], [], '', False
        for ch in gloss.strip():
            if ch == '"': q = not q
            if ch == ';' and not q:
                parts.append(cur.strip()); cur = ''
            else:
                cur += ch
        parts.append(cur.strip())
        for s in parts:
            s = s.replace('--', '\u2014')   # WordNet types a dash as two hyphens
            if not s: continue
            # a few glosses run an example on after a colon or comma: 'bring forth, "The apple tree bore..."'
            for x in re.findall(r'"([^"]*)"?', s[s.index('"'):]) if '"' in s else []:
                if x.strip(): exs.append(x.strip())
            s = s.split('"')[0].strip().rstrip(':,').strip()
            if s:
                defs.append(s)
        syn[POSN[t] + off] = dict(lemmas=lemmas, ptrs=ptrs, d='; '.join(defs), ex=exs, pos=POSN[t])

tag = {}
for line in open(os.path.join(src, 'index.sense'), encoding='utf-8'):
    key, off, sn, tc = line.split()
    p = {'1': 'n', '2': 'v', '3': 'a', '4': 'r', '5': 'a'}[key.split('%')[1][0]]
    tag[p + off] = tag.get(p + off, 0) + int(tc)

words = {}
for name, p in FILES.items():
    for line in open(os.path.join(src, 'index.' + name), encoding='utf-8'):
        if line.startswith('  '):
            continue
        f = line.split()
        lemma = f[0].replace('_', ' ')
        n = int(f[2])
        offs = f[-n:]
        words.setdefault(lemma, []).extend(p + o for o in offs)

def rec(k):
    s = syn[k]
    kind = ''
    for sym, t, _, _ in s['ptrs']:
        if sym in ('@', '@i'):
            kind = syn[t]['lemmas'][0]; break
    if not kind and s['pos'] == 'a':
        for sym, t, _, _ in s['ptrs']:
            if sym == '&':
                kind = syn[t]['lemmas'][0]; break   # satellite: "similar to <head>"
    opp = []
    for sym, t, a, b in s['ptrs']:
        if sym == '!':
            o = syn[t]['lemmas'][b - 1] if b else syn[t]['lemmas'][0]
            if o not in opp: opp.append(o)
    return [s['pos'], s['d'], s['ex'], s['lemmas'], kind, opp, tag.get(k, 0)]

exc = {}
for name in FILES:
    for line in open(os.path.join(src, name + '.exc'), encoding='utf-8'):
        f = line.split()
        if len(f) < 2: continue
        form = f[0].replace('_', ' ')
        for b in f[1:]:
            b = b.replace('_', ' ')
            if b in words and [b, FILES[name]] not in exc.setdefault(form, []):
                exc[form].append([b, FILES[name]])

def shard(w):
    return ''.join(c if 'a' <= c <= 'z' else '_' for c in (w + '__')[:2])

shards = {}
for w, ks in words.items():
    sh = shards.setdefault(shard(w), dict(w={}, s={}, x={}))
    sh['w'][w] = ks
    for k in ks:
        if k not in sh['s']:
            sh['s'][k] = rec(k)
for form, bases in exc.items():
    if bases:
        shards.setdefault(shard(form), dict(w={}, s={}, x={}))['x'][form] = bases

letters = 'abcdefghijklmnopqrstuvwxyz_'
for a in letters:
    for b in letters:
        shards.setdefault(a + b, dict(w={}, s={}, x={}))   # every key exists, so a miss is never a 404

total = 0
for name, sh in sorted(shards.items()):
    path = os.path.join(out, name + '.json')
    with open(path, 'w', encoding='utf-8') as fh:
        json.dump(sh, fh, ensure_ascii=False, separators=(',', ':'))
    total += os.path.getsize(path)
print(len(words), 'lemmas,', len(syn), 'synsets,', len(shards), 'shards,', total // 1024, 'KB')
