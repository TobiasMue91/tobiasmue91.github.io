"""Language model the Leetspeak converter (tools/1337.html) decodes with.

Needs `pip install wordfreq` (code Apache-2.0, word lists CC BY-SA 4.0 by Robyn Speer et al.).
Prints two JS lines that replace the LEXICON and BIGRAM lines in the page's <script id="core">:

  LEXICON  the 5000 most frequent English words (letters only), most frequent first, space-joined,
           plus a handful of words leetspeak itself is made of, appended at the end
  BIGRAM   27x27 letter-pair log-probabilities, row = previous letter, index 0 = word edge,
           weighted by word frequency and scaled to integers 0..99 (higher = likelier)

    python util/1337/bigrams.py
"""
import json, math
from wordfreq import top_n_list, word_frequency

EXTRA = 'leet elite hacker hackers haxor noob noobs pwned pwn owned skills skillz rofl lol lmao omg wtf'.split()
top = [w for w in top_n_list('en', 6000) if w.isalpha() and w.isascii()][:5000]
lex = top + [w for w in EXTRA if w not in top]

A = '^abcdefghijklmnopqrstuvwxyz'
n = [[1e-9] * 27 for _ in range(27)]
for w in top_n_list('en', 50000):
    if not (w.isalpha() and w.isascii()):
        continue
    f = word_frequency(w, 'en')
    s = '^' + w + '^'
    for x, y in zip(s, s[1:]):
        n[A.index(x)][A.index(y)] += f
rows = []
for r in n:
    t = sum(r)
    rows.append([max(0, min(99, round(99 + 6 * math.log(v / t)))) for v in r])
print('const LEXICON=' + json.dumps(' '.join(lex)) + ';')
print('const BIGRAM=[' + ','.join(str(v) for row in rows for v in row) + '];')
