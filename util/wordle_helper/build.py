"""Builds data/wordle_helper/ for tools/wordle_helper.html (Wordle Helper).

    python util/wordle_helper/build.py                       # downloads the two lists
    python util/wordle_helper/build.py answers.txt guesses.txt   # or reads local copies

Needs Python 3 and a C compiler (cc); nothing to pip install. Takes about ten minutes on four cores, most of it the extra openers.

Sources. The lists are the two arrays in the original Wordle by Josh Wardle (powerlanguage.co.uk/wordle,
main.e65ce0a5.js, January 2022, before the New York Times bought the game and edited them): 2,315 words
that could be an answer and 10,657 more that are accepted as guesses. The copies read here are Carl
Freshman's gists of those arrays, unchanged but sorted:

    https://gist.github.com/cfreshman/a03ef2cba789d8cf00c08f767e0fad7b   wordle-answers-alphabetical.txt
    https://gist.github.com/cfreshman/cdcdf777450c5b5301e439061d29694c   wordle-allowed-guesses.txt

They are pinned by SHA-256 below, so a changed gist stops the build instead of quietly changing the data.
They are the original lists and not the NYT's: 3Blue1Brown's copy of the NYT version (github.com/3b1b/
videos, _2022/wordle/data) lacks agora, fibre, lynch, pupal and slave among the answers and a few slurs
among the guesses, and has nothing these lists lack. The original list is also the one Bertsimas and
Paskov solved, so the tree can be checked against their published numbers.

Licence. Neither the game's source nor the gists carry a licence; the lists are Josh Wardle's, now the
New York Times Company's. What is copied is a bare list of English words in alphabetical order, used
the way every public Wordle solver uses it - to tell a player which words are still possible - and the
page never shows the day's answer or anything else of the game. If the owner asks, take the data down.

Outputs, all in data/wordle_helper/:

    answers.json      the 2,315 answers, sorted
    guesses.json      all 12,972 accepted guesses (answers included), sorted
    tree_salet.json   the optimal normal-mode decision tree after the opener SALET

The tree is exact, not heuristic: solve.c (next to this file) is a branch and bound over every one of
the 12,972 guesses at every node, memoised on the candidate set and pruned with lower bounds, and it
minimises the total number of guesses over all answers. Its result must equal Bertsimas and Paskov,
"An Exact Solution to Wordle", Operations Research (2025): SALET solves all 2,315 answers in 7,920
guesses (3.421 on average) and never needs more than five. This script re-plays every answer through
the tree with its own feedback function and stops if it does not.

tree_salet.json: {"opener", "answers", "total", "max", "fit", "openers", "tree"}. "openers" is a list of
[word, total] for a few popular first words, each the exact optimal total with that word first (same
search, tree not kept), so the page can say what an opener costs against SALET. A node is either a word (the one
candidate left; guess it) or [guess, {pattern: node}], with one entry for every feedback but five
greens that some answer gives. A pattern is the sum of colour * 3^position, grey 0, yellow 1, green 2,
first letter in the lowest digit, so 242 is five greens. "fit" is [a, b] in f(n) ~ n * (a + b ln n),
the page's estimate of the optimal total for n candidates (sizes 1 and 2 are exactly 1 and 3), fitted to
every set the search solved exactly.
"""
import hashlib, json, math, os, subprocess, sys, tempfile, urllib.request
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', '..', 'data', 'wordle_helper')
URLS = [
    'https://gist.githubusercontent.com/cfreshman/a03ef2cba789d8cf00c08f767e0fad7b/raw/wordle-answers-alphabetical.txt',
    'https://gist.githubusercontent.com/cfreshman/cdcdf777450c5b5301e439061d29694c/raw/wordle-allowed-guesses.txt',
]
SHA = ['5209b35f823f8b80f0404f863bd80df06d6a966c6eb1016d69f38badc6eed5d0',
       '99be2e38dadf3e26952af7cb4d963f65b632d5de91aa99e5ce308e4dc9617b65']
OPENER, WANT_TOTAL, WANT_MAX = 'salet', 7920, 5
# openers whose exact optimal total the page shows next to SALET's (a minute or two each)
OPENERS = ['reast', 'crate', 'trace', 'slate', 'crane', 'carte', 'slant', 'stare', 'raise', 'arose', 'roate', 'soare',
           'adieu', 'audio']


def read(i):
    if len(sys.argv) == 3:
        data = open(sys.argv[1 + i], 'rb').read()
    else:
        data = urllib.request.urlopen(URLS[i], timeout=60).read()
    got = hashlib.sha256(data).hexdigest()
    if got != SHA[i]:
        sys.exit(f'{URLS[i]}: sha256 {got}, expected {SHA[i]} - the list changed; check it before building')
    words = data.decode().split()
    assert all(len(w) == 5 and w.isalpha() and w.islower() for w in words)
    return words


def feedback(guess, answer):
    res, left = [0] * 5, {}
    for i in range(5):
        if guess[i] == answer[i]: res[i] = 2
        else: left[answer[i]] = left.get(answer[i], 0) + 1
    for i in range(5):
        if res[i] != 2 and left.get(guess[i], 0) > 0:
            left[guess[i]] -= 1; res[i] = 1
    return sum(c * 3 ** i for i, c in enumerate(res))


answers, extra = read(0), read(1)
assert len(answers) == 2315 and len(extra) == 10657 and not set(answers) & set(extra)
answers = sorted(answers)
guesses = sorted(answers + extra)
os.makedirs(OUT, exist_ok=True)
for name, words in (('answers', answers), ('guesses', guesses)):
    with open(os.path.join(OUT, name + '.json'), 'w') as f:
        json.dump(words, f, separators=(',', ':'))

with tempfile.TemporaryDirectory() as tmp:
    for name, words in (('answers', answers), ('guesses', guesses)):
        with open(os.path.join(tmp, name + '.txt'), 'w') as f:
            f.write('\n'.join(words) + '\n')
    exe = os.path.join(tmp, 'solve')
    subprocess.run(['cc', '-O2', '-o', exe, os.path.join(HERE, 'solve.c')], check=True)
    workers = max(1, os.cpu_count() or 1)

    def solve(opener, cost_only=False):
        run = lambda i: subprocess.run([exe, os.path.join(tmp, 'guesses.txt'), os.path.join(tmp, 'answers.txt'), opener,
                                        str(workers), str(i)] + (['cost'] if cost_only else []),
                                       check=True, capture_output=True, text=True).stdout
        with ThreadPoolExecutor(workers) as pool:
            return list(pool.map(run, range(workers)))

    outputs = solve(OPENER)
    openers = {}
    for w in OPENERS:
        out = solve(w, True)
        openers[w] = len(answers) + sum(int(l.split()[3]) for o in out for l in o.splitlines() if l.startswith('#cost'))
        print(f'{w.upper()}: {openers[w]} guesses, average {openers[w] / len(answers):.4f}', flush=True)

nodes, fit = {}, {}
for out in outputs:
    for line in out.splitlines():
        if line.startswith('#fit'):
            _, n, s, c = line.split(); s0, c0 = fit.get(int(n), (0, 0)); fit[int(n)] = (s0 + int(s), c0 + int(c))
        elif line.startswith('#cost'):
            _, _, n, f = line.split(); s0, c0 = fit.get(int(n), (0, 0)); fit[int(n)] = (s0 + int(f), c0 + 1)
        elif line:
            path, guess = line.split('\t')
            nodes[tuple(int(p) for p in path.split(','))] = guess


roots = sorted({p[0] for p in nodes})
children = {}
for p in nodes: children.setdefault(p[:-1], []).append(p)
def build(path):
    guess = nodes[path]
    kids = sorted(children.get(path, []))
    return [guess, {str(k[-1]): build(k) for k in kids}] if kids else guess
tree = [OPENER, {str(p): build((p,)) for p in roots}]

# re-play every answer through the tree with this file's own feedback
total, worst, hist = 0, 0, {}
for a in answers:
    node, n = tree, 0
    while True:
        guess = node if isinstance(node, str) else node[0]
        n += 1
        p = feedback(guess, a)
        if p == 242: break
        if isinstance(node, str) or str(p) not in node[1] or n > 10:
            sys.exit(f'tree does not solve {a}')
        node = node[1][str(p)]
    total += n; worst = max(worst, n); hist[n] = hist.get(n, 0) + 1
print(f'{OPENER.upper()}: {len(answers)} answers in {total} guesses, average {total / len(answers):.4f}, '
      f'at most {worst}; by guesses {dict(sorted(hist.items()))}')
if total != WANT_TOTAL or worst != WANT_MAX:
    sys.exit(f'expected {WANT_TOTAL} guesses and at most {WANT_MAX} (Bertsimas and Paskov 2025)')

# weighted least squares of f(n)/n = a + b ln n over every exactly solved set of 3 or more
fit[len(answers)] = (total, 1)
sw = sx = sy = sxx = sxy = 0
for n, (s, c) in fit.items():
    if n < 3: continue
    x, y, w = math.log(n), s / c / n, c
    sw += w; sx += w * x; sy += w * y; sxx += w * x * x; sxy += w * x * y
b = (sw * sxy - sx * sy) / (sw * sxx - sx * sx); a = (sy - b * sx) / sw
print(f'fit: f(n) ~ n * ({a:.4f} + {b:.4f} ln n) over {sum(c for _, c in fit.values()):,} sets')

with open(os.path.join(OUT, 'tree_' + OPENER + '.json'), 'w') as f:
    if openers.get(OPENER, total) != total: sys.exit('the opener run and the tree disagree')
    ranked = sorted({**openers, OPENER: total}.items(), key=lambda kv: (kv[1], kv[0]))
    json.dump({'opener': OPENER, 'answers': len(answers), 'total': total, 'max': worst,
               'fit': [round(a, 4), round(b, 4)], 'openers': ranked, 'tree': tree}, f, separators=(',', ':'))
for name in sorted(os.listdir(OUT)):
    print(f'{name}: {os.path.getsize(os.path.join(OUT, name)):,} bytes')
