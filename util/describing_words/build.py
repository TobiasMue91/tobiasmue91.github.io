"""
Step 2 of the Describing Words data: turn the adjective-noun counts that fetch.sh pulled out of
Google Books' syntactic n-grams into data/describing_words.txt, the one file
tools/descriptocraft.html loads.

    python util/describing_words/build.py <outdir of fetch.sh> [--moby words.txt]

Needs nltk with the WordNet corpus (nltk.download('wordnet')), wordfreq and vaderSentiment. The Moby
thesaurus (public domain) comes from the npm package "moby" (its words.txt); without it the synonyms
come from WordNet alone.

What it decides, so the page does not have to:
- a noun is a WordNet noun, an adjective a WordNet adjective (or a hyphenated pair of real words);
  plurals are folded into their singular (WordNet's morphy), and spelling variants into the commoner
  form (primaeval -> primeval);
- describing words for a noun are ranked by PMI x ln(count)^2: how much more often books put the
  adjective before the noun than chance would, weighted towards pairings that are not one-offs;
- similar adjectives are the candidates WordNet or Moby lists, ranked by how alike the two words are
  used (cosine of their PPMI vectors over nouns); WordNet antonyms never count;
- tone comes from the VADER lexicon (|valence| >= 0.5, otherwise neutral), rarity from wordfreq's
  Zipf frequency (>= 4 everyday, >= 3 uncommon, below that rare).

File format, one record per line, tab-separated (see the page's core for the reader):
    #describing-words <json header>
    A <tab> word <tab> flags <tab> similar <tab> total   (one per adjective; its line number is its index)
    N <tab> noun <tab> flags <tab> pairs <tab> total     (one per noun)
Only the first 24 similar words and pairs are in describing_words.txt; the rest are in
describing_words_more.txt as "A <tab> word <tab> similar" and "N <tab> noun <tab> pairs", which the page
loads whole, and only when someone asks for a full list, so neither request says what was looked up.
flags is one character from ALPHA: rarity*3 + tone for an adjective (tone 0 neutral, 1 positive,
2 negative), and for a noun 1 when the word is far more often an adjective (cold, light). similar is a
run of varints (adjective indices); pairs a run of (varint index, one count character), best first.
A varint is base-32 big-endian: digits 32..63 of ALPHA continue, 0..31 end. A count character c stands
for about 10 * 10^(c/12) occurrences.
"""
import argparse, glob, json, math, os, pickle, re, sys
from collections import defaultdict

ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"

# Words tagged JJ that only point at something (which, how many, in what order) and describe nothing.
STOP = set("""
other such same own many few several various certain whole entire first second third fourth fifth
last next previous following latter former present only additional further more most much main
particular respective said aforesaid sole mere very similar different specific given possible overall
total usual numerous countless much little less least lesser more own whatever whichever
""".split())


NEG = ("un", "in", "im", "il", "ir", "non", "non-", "dis")


# Slurs that books of the last century used freely; a stranger looking up "child" should not meet them.
OFFENSIVE = set("retarded mongoloid spastic negro mulatto crippled imbecile moronic halfcaste half-caste".split())


def varint(n):
    out = [ALPHA[n & 31]]
    n >>= 5
    while n:
        out.append(ALPHA[32 + (n & 31)])
        n >>= 5
    return "".join(reversed(out))


def countchar(c):
    return ALPHA[max(0, min(63, round(12 * math.log10(c / 10))))]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("outdir")
    ap.add_argument("--moby")
    ap.add_argument("--dest", default=os.path.join(os.path.dirname(__file__), "..", "..", "data", "describing_words.txt"))
    ap.add_argument("--cache", default=None, help="pickle the merged counts here and reuse them")
    args = ap.parse_args()

    from nltk.corpus import wordnet as wn
    from wordfreq import zipf_frequency
    import vaderSentiment

    # --- merge the shards, folding plurals ------------------------------------------------------
    if args.cache and os.path.exists(args.cache):
        pairs = pickle.load(open(args.cache, "rb"))
    else:
        pairs = defaultdict(int)
        lem = {}
        for f in sorted(glob.glob(os.path.join(args.outdir, "*.tsv"))):
            for line in open(f, encoding="utf-8"):
                n, a, k = line.rstrip("\n").split("\t")
                if n.endswith("\x01"):
                    n = n[:-1]
                    if n not in lem:
                        m = wn.morphy(n, "n")
                        lem[n] = m if m and re.fullmatch(r"[a-z][a-z'-]*[a-z]", m) else n
                    n = lem[n]
                pairs[(n, a)] += int(k)
        pairs = dict(pairs)
        if args.cache:
            pickle.dump(pairs, open(args.cache, "wb"))

    noun_ok, adj_ok = {}, {}

    def isnoun(n):
        if n not in noun_ok:
            noun_ok[n] = bool(re.fullmatch(r"[a-z][a-z'-]*[a-z]", n)) and bool(wn.synsets(n, "n"))
        return noun_ok[n]

    def isadj(a):
        if a not in adj_ok:
            parts = a.split("-")
            adj_ok[a] = a not in STOP and a not in OFFENSIVE and len(a) > 1 and (
                bool(wn.synsets(a, "a") or wn.synsets(a, "s"))
                or (len(parts) > 1 and all(len(p) > 1 and wn.synsets(p) for p in parts)))
        return adj_ok[a]

    F = {}
    Na0 = defaultdict(int)
    for (n, a), k in pairs.items():
        if k >= 10 and isnoun(n) and isadj(a):
            F[(n, a)] = k
            Na0[a] += k

    # spelling variants -> the commoner form
    def variants(a):
        out = set()
        for x, y in (("ae", "e"), ("oe", "e")):
            if x in a:
                out.add(a.replace(x, y))
        if a.endswith("re"):
            out.add(a[:-2] + "er")
        if a.endswith("our"):
            out.add(a[:-3] + "or")
        if "our" in a:
            out.add(a.replace("our", "or"))
        if a.endswith("ised"):
            out.add(a[:-4] + "ized")
        if a.endswith("ise"):
            out.add(a[:-3] + "ize")
        if "-" in a:
            out.add(a.replace("-", ""))
        return out
    canon = {}
    for a in Na0:
        best = max((v for v in variants(a) if v in Na0), key=lambda v: Na0[v], default=None)
        if best and Na0[best] > Na0[a]:
            canon[a] = best
    G = defaultdict(int)
    for (n, a), k in F.items():
        G[(n, canon.get(a, a))] += k
    Nn, Na, T = defaultdict(int), defaultdict(int), 0
    for (n, a), k in G.items():
        Nn[n] += k
        Na[a] += k
        T += k
    by = defaultdict(list)
    for (n, a), k in G.items():
        by[n].append((a, k))
    print(f"{len(G)} pairs, {len(Nn)} nouns, {len(Na)} adjectives, {T} occurrences", file=sys.stderr)

    # --- describing words per noun --------------------------------------------------------------
    NMIN = 1000
    nouns = {}
    for n, lst in by.items():
        if Nn[n] < NMIN:
            continue
        floor = max(20, Nn[n] * 2e-5)
        scored = []
        for a, c in lst:
            if c < floor:
                continue
            pmi = math.log(c * T / (Nn[n] * Na[a]))
            if pmi > 0:
                scored.append((pmi * math.log(c) ** 2, a, c))
        if len(scored) < 5:
            continue
        scored.sort(key=lambda t: (-t[0], t[1]))
        K = 40 if Nn[n] < 20000 else 70 if Nn[n] < 200000 else 110
        nouns[n] = scored[:K]

    # --- adjective lexicon ----------------------------------------------------------------------
    vader = {}
    vpath = os.path.join(os.path.dirname(vaderSentiment.__file__), "vader_lexicon.txt")
    for line in open(vpath, encoding="utf-8"):
        w, v = line.split("\t")[:2]
        vader[w] = float(v)

    def tone(a):
        v = vader.get(a)
        if v is None:
            return 0
        return 1 if v >= 0.5 else 2 if v <= -0.5 else 0

    def rarity(a):
        z = zipf_frequency(a, "en") or zipf_frequency(a.replace("-", " "), "en")
        return 0 if z >= 4 else 1 if z >= 3 else 2

    # PPMI vectors over the nouns we ship, for similarity
    vec = defaultdict(dict)
    for n in nouns:
        for a, c in by[n]:
            pmi = math.log(c * T / (Nn[n] * Na[a]))
            if pmi > 0 and c >= 20:
                vec[a][n] = pmi
    norm = {a: math.sqrt(sum(v * v for v in d.values())) for a, d in vec.items()}

    def cos(a, b):
        da, db = vec.get(a), vec.get(b)
        if not da or not db:
            return 0.0
        if len(da) > len(db):
            da, db = db, da
        return sum(v * db.get(k, 0) for k, v in da.items()) / (norm[a] * norm[b])

    moby = {}
    if args.moby:
        for line in open(args.moby, encoding="utf-8"):
            head, _, rest = line.rstrip("\n").partition(",")
            moby[head] = [w for w in rest.split(",") if w and " " not in w]

    used_in_nouns = {a for lst in nouns.values() for _, a, _ in lst}
    # adjectives that can be asked about: those common enough to have a profile
    askable = {a for a in Na if Na[a] >= 2000 and a in vec}

    def wn_related(a):
        syn, ant = set(), set()
        for s in wn.synsets(a, "a") + wn.synsets(a, "s"):
            group = [s] + s.similar_tos() + s.also_sees()
            for g in group:
                for l in g.lemmas():
                    syn.add(l.name().lower().replace("_", " "))
            for l in [l for g in [s] + s.similar_tos() for l in g.lemmas()]:
                for an in l.antonyms():
                    ant.add(an.name().lower())
                    for s2 in [an.synset()] + an.synset().similar_tos() + an.synset().also_sees():
                        for l2 in s2.lemmas():
                            ant.add(l2.name().lower())
        return syn, ant

    similar = {}
    for a in askable:
        syn, ant = wn_related(a)
        cands = (syn | set(moby.get(a, []))) - ant - {a}
        cands = {canon.get(c, c) for c in cands}
        neg = {p + a for p in NEG} | {a[len(p):] for p in NEG if a.startswith(p)}
        cands = {c for c in cands if c in askable and c != a and c not in neg and c not in ant}
        scored = []
        for c in cands:
            s = cos(a, c)
            if c in syn:
                s += 0.15  # WordNet is curated; Moby lists any word that can stand in somewhere
            if s > (0.06 if c in syn else 0.12):
                scored.append((s, c))
        scored.sort(key=lambda t: (-t[0], t[1]))
        if scored:
            similar[a] = [c for _, c in scored[:60]]

    adjs = used_in_nouns | set(similar) | {c for l in similar.values() for c in l}
    order = sorted(adjs, key=lambda a: (-Na[a], a))
    index = {a: i for i, a in enumerate(order)}

    # --- write ----------------------------------------------------------------------------------
    header = {
        "source": "Google Books syntactic n-grams, English, 2013 release (adjectival modifiers, 1900-2008)",
        "occurrences": T,
        "nouns": len(nouns),
        "adjectives": len(order),
        "ranking": "PMI x ln(count)^2",
    }
    CORE, SIM_CORE = 24, 24
    lines = ["#describing-words " + json.dumps(header, separators=(",", ":"))]
    more = ["#describing-words-more " + json.dumps({"core": CORE, "similarCore": SIM_CORE}, separators=(",", ":"))]
    def display(a):
        # Atlantic, Indian, Turkish: WordNet only knows them capitalised, and so should the list.
        names = {l.name() for syn in wn.synsets(a, "a") + wn.synsets(a, "s") for l in syn.lemmas() if l.name().lower() == a}
        return a[0].upper() + a[1:] if names and all(n[0].isupper() for n in names) else a

    for a in order:
        flags = ALPHA[rarity(a) * 3 + tone(a)]
        sim = [varint(index[c]) for c in similar.get(a, [])]
        lines.append(f"A\t{display(a)}\t{flags}\t{''.join(sim[:SIM_CORE])}\t{len(sim)}")
        if len(sim) > SIM_CORE:
            more.append(f"A\t{a}\t{''.join(sim[SIM_CORE:])}")
    for n in sorted(nouns):
        flag = ALPHA[1 if Na.get(n, 0) > 2 * Nn[n] else 0]
        body = [varint(index[a]) + countchar(c) for _, a, c in nouns[n]]
        lines.append(f"N\t{n}\t{flag}\t{''.join(body[:CORE])}\t{len(body)}")
        if len(body) > CORE:
            more.append(f"N\t{n}\t{''.join(body[CORE:])}")
    os.makedirs(os.path.dirname(os.path.abspath(args.dest)), exist_ok=True)
    with open(args.dest, "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(lines) + "\n")
    with open(args.dest.replace(".txt", "_more.txt"), "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(more) + "\n")
    print(f"wrote {args.dest}: {len(nouns)} nouns, {len(order)} adjectives, "
          f"{sum(len(v) for v in nouns.values())} pairs, {len(similar)} with similar words", file=sys.stderr)


if __name__ == "__main__":
    main()
