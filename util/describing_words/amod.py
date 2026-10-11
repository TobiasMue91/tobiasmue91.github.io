# Filter for fetch.sh. stdin: syntactic-ngram "arcs" lines already grepped for "/amod/".
# stdout: noun \t adjective \t count summed over 1900-2008 (a plural noun carries a trailing \x01).
import sys, re
from collections import Counter
ok = re.compile(r"^[a-z][a-z'-]*[a-z]$")
c = Counter()
for line in sys.stdin:
    parts = line.rstrip('\n').split('\t')
    if len(parts) < 4: continue
    toks = parts[1].split(' ')
    if len(toks) != 2: continue
    t = []
    for tok in toks:
        r = tok.rsplit('/', 3)
        if len(r) != 4: break
        t.append(r)
    if len(t) != 2: continue
    for i, (w, tag, dep, h) in enumerate(t):
        if dep == 'amod' and tag == 'JJ':
            try: hi = int(h) - 1
            except ValueError: continue
            if hi not in (0, 1) or hi == i: continue
            nw, ntag = t[hi][0], t[hi][1]
            if ntag not in ('NN', 'NNS'): continue
            a = w.lower(); n = nw.lower()
            if not ok.match(a) or not ok.match(n): continue
            s = 0
            for yc in parts[3:]:
                y, _, k = yc.partition(',')
                if y >= '1900': s += int(k)
            if s: c[(n + ('\x01' if ntag == 'NNS' else ''), a)] += s
for (n, a), k in c.items():
    sys.stdout.write(f"{n}\t{a}\t{k}\n")
