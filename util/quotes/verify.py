"""
Build the quote bank of tools/daily_quote_generator.html from texts nobody here wrote.

Every quote the page shows as a real quotation must be found, word for word, in a named public-domain
text on Project Gutenberg. candidates.txt lists the sources and, under each, quotes as remembered; this
script downloads each source and looks for the passage. A candidate is kept only when its words, in
order, are a run of the source's words (case, accents and punctuation aside); the page then shows the
source's own text for that run - its spelling and punctuation, not memory's. The only changes made are
typographic: curly quotes and dashes, a capital at the start, a full stop at the end of a fragment.
A candidate that is not found is dropped, and the nearest passage is printed so it can be corrected to
what the book says - memory is where misattributions come from, so it never gets the last word.

    python util/quotes/verify.py            # check every candidate, rewrite the bank in the page
    python util/quotes/verify.py --report   # check and report, change nothing
    python util/quotes/verify.py --report --all  # also list every kept quote as the page will show it
    python util/quotes/verify.py --show ID  # print the verified entry

candidates.txt:

    @ key | gutenberg id | author | work | year | translator (optional)
    > key | category,category | where (optional, e.g. "Book IV" or "ch. 2")
    the quote as remembered, on one or more lines
    (a blank line ends it)

Downloads are cached in ~/.cache/quotes. The page's bank sits between the markers
/*BANK*/ and /*END BANK*/ and is replaced whole.
"""

import hashlib
import json
import re
import sys
import unicodedata
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
HERE = Path(__file__).resolve().parent
CACHE = Path.home() / ".cache" / "quotes"
PAGE = ROOT / "tools" / "daily_quote_generator.html"
CATEGORIES = ["inspirational", "motivational", "success", "life", "love", "wisdom", "humor", "leadership",
              "friendship", "courage", "education", "change", "happiness", "perseverance", "creativity"]


# Sources set as verse: a line break inside a quote from them is kept, as " / ", so a capital that starts a line
# of poetry is not read as a typo.
VERSE = {"sonnets", "whitman", "dickinson", "henley", "keats", "tennyson", "memoriam", "browning", "longfellow",
         "milton", "criticism", "essayman", "kipling", "rubaiyat", "gita", "shelleypoems", "hamlet", "asyoulike",
         "caesar", "twelfth", "merchant", "macbeth", "midsummer", "tempest", "henryv", "measure", "allswell", "romeo",
         "lear", "henry4b"}


def fetch(gids: str) -> str:
    """The text of one ebook, or of several volumes joined ("3581+3582")."""
    return "\n\n".join(fetch_one(g) for g in gids.split("+"))


def fetch_one(gid: str) -> str:
    CACHE.mkdir(parents=True, exist_ok=True)
    path = CACHE / f"pg{gid}.txt"
    if not path.exists():
        urls = (f"https://www.gutenberg.org/cache/epub/{gid}/pg{gid}.txt",
                f"https://www.gutenberg.org/ebooks/{gid}.txt.utf-8",
                f"https://www.gutenberg.org/files/{gid}/{gid}-0.txt",
                f"https://www.gutenberg.org/files/{gid}/{gid}.txt")
        for url in urls * 3:
            try:
                with urllib.request.urlopen(url, timeout=60) as r:
                    path.write_bytes(r.read())
                break
            except Exception:
                continue
        else:
            raise SystemExit(f"could not download Gutenberg #{gid}")
    text = path.read_text(encoding="utf-8", errors="replace").replace("\r\n", "\n")
    start = re.search(r"\*\*\* ?START OF (THE|THIS) PROJECT GUTENBERG.*\n", text)
    end = re.search(r"\*\*\* ?END OF (THE|THIS) PROJECT GUTENBERG", text)
    text = text[start.end() if start else 0:end.start() if end else len(text)]
    return re.sub(r"\[(\d+|[A-Z])\]", "", text)  # footnote marks would break a run of words


def fold(ch: str) -> str:
    """A character as matching sees it: lower case, no accents, letters and digits only."""
    ch = unicodedata.normalize("NFKD", ch)
    ch = "".join(c for c in ch if not unicodedata.combining(c)).lower()
    return ch if ch.isalnum() else " "


class Source:
    def __init__(self, text: str):
        self.text = text
        words, spans = [], []
        cur, a = [], None
        for i, ch in enumerate(text + " "):
            f = fold(ch)
            if f.strip():
                if a is None:
                    a = i
                cur.append(f)
            elif a is not None:
                words.append("".join(cur))
                spans.append((a, i))
                cur, a = [], None
        self.words, self.spans = words, spans
        self.index = {}
        for i in range(len(words) - 2):
            self.index.setdefault((words[i], words[i + 1], words[i + 2]), []).append(i)

    def find(self, quote: str):
        """(exact, start word, end word) of the best match of the quote, or None.

        exact: the quote's words are a contiguous run of the source's. Otherwise the span is the
        nearest passage, for the report."""
        q = "".join(fold(c) for c in quote).split()
        if len(q) < 3:
            return None
        starts = {}
        for j in range(len(q) - 2):
            for i in self.index.get((q[j], q[j + 1], q[j + 2]), ()):
                starts[i - j] = starts.get(i - j, 0) + 1
        for off in starts:
            if 0 <= off and self.words[off:off + len(q)] == q:
                return True, off, off + len(q)
        if not starts:
            return None
        off = max(starts, key=starts.get)
        lo = max(0, off - 3)
        return False, lo, min(len(self.words), off + len(q) + 3)

    def passage(self, s: int, e: int, verse: bool = False) -> str:
        a, b = self.spans[s][0], self.spans[e - 1][1]
        if a and self.text[a - 1] in "’'" and self.words[s] in ("tis", "twas", "twere", "em", "neath"):
            a -= 1  # the apostrophe of ’Tis is part of the word
        # carry the closing punctuation that ends the run (a full stop, a question, a closing quote)
        tail = re.match(r"[.!?;:,)\]’'\"”]*", self.text[b:b + 4]).group()
        raw = self.text[a:b] + tail
        raw = raw.replace("_", "")
        if verse:
            # a line of verse starts with a capital; a prose speech wrapped by the printer does not
            raw = re.sub(r"[ \t]*\r?\n\s*(?=[\"'“‘(]?[A-Z])", " / ", raw.strip())
        raw = re.sub(r"\[\d+\]", "", raw)  # footnote marks
        raw = re.sub(r"\s+", " ", raw).strip()
        return raw

    def heading(self, s: int) -> str:
        """The nearest heading-looking line before the match, to check a 'where' by eye."""
        before = self.text[:self.spans[s][0]]
        for line in reversed(before.split("\n")[-4000:]):
            t = line.strip()
            if t and len(t) < 70 and (t.isupper() or re.match(r"(CHAPTER|BOOK|Chapter|Book|ESSAY|SCENE|ACT)\b", t)):
                return t
        return ""


def finish(s: str) -> str:
    """A fragment lifted out of a sentence starts with a capital and ends with a stop."""
    s = re.sub(r"^[\"“‘(\[]+", "", s)
    s = s.rstrip(",;:—- ")
    # a closing quote with no opener inside the run belongs to the book, not to the quote
    if s.count("”") > s.count("“"):
        s = s[::-1].replace("”", "", s.count("”") - s.count("“"))[::-1]
    if "‘" not in s and re.search(r"[.!?,;:]’$", s):
        s = s[:-1]
    if s.count(")") > s.count("("):
        s = s[::-1].replace(")", "", s.count(")") - s.count("("))[::-1]
    s = re.sub(r"[,;:](\s*[”’)]*)$", r".\1", s)          # “…a great ship,” -> “…a great ship.”
    s = s.rstrip(",;:— ")
    # a drop-capital first word ("STUDIES serve", "HE THAT hath") reads as shouting out of context
    m = re.match(r"^((?:[A-Z][A-Z’']+\s)+|[A-Z][A-Z’']+(?=[,\s]))", s)
    if m and re.search(r"[a-z]", s[m.end():m.end() + 30]):
        s = m.group(0)[0] + m.group(0)[1:].lower() + s[m.end():]
    m = re.search(r"[A-Za-zÀ-ÿ]", s)
    if m:
        s = s[:m.start()] + s[m.start()].upper() + s[m.start() + 1:]
    if not re.search(r"[.!?…][’'\"”)]*$", s):
        s += "."
    return s


def typeset(s: str) -> str:
    """Straight quotes to curly, double hyphens to dashes - the words and their order stay the source's."""
    s = s.replace("--", "—")
    s = re.sub(r'(^|[\s(\[—])"', r"\1“", s)
    s = s.replace('"', "”")
    s = re.sub(r"(^|[\s(\[—])'(?=(tis|twas|twere|em|neath)\b)", r"\1’", s, flags=re.I)  # 'Tis, 'em
    s = re.sub(r"(^|[\s(\[—])'", r"\1‘", s)
    s = re.sub(r"‘(?=(tis|twas|twere|em|neath)\b)", "’", s, flags=re.I)
    s = s.replace("'", "’")
    s = re.sub(r"\s+—\s+", "—", s)
    # balance: drop a lone opening quote with no closer, or the reverse
    for o, c in (("“", "”"), ("‘", "’")):
        if s.count(o) > s.count(c) and o == "“":
            s = s.replace(o, "", s.count(o) - s.count(c))
        if s.count(c) > s.count(o) and c == "”":
            s = s[::-1].replace(c, "", s.count(c) - s.count(o))[::-1]
    return s


def parse(path: Path):
    sources, quotes = {}, []
    block = None
    for n, line in enumerate(path.read_text(encoding="utf-8").split("\n") + [""], 1):
        if line.startswith("#"):
            continue
        if line.startswith("@"):
            f = [x.strip() for x in line[1:].split("|")]
            key, gid, author, work, year = f[:5]
            sources[key] = {"gid": gid, "author": author, "work": work, "year": year,
                            "tr": f[5] if len(f) > 5 else ""}
        elif line.startswith(">"):
            f = [x.strip() for x in line[1:].split("|")]
            cats = [c.strip() for c in f[1].split(",") if c.strip()]
            bad = [c for c in cats if c not in CATEGORIES]
            if bad or f[0] not in sources:
                raise SystemExit(f"candidates.txt:{n}: unknown {'source ' + f[0] if f[0] not in sources else bad}")
            block = {"src": f[0], "cats": cats, "where": f[2] if len(f) > 2 else "", "text": [], "line": n}
        elif line.strip() and block is not None:
            block["text"].append(line.strip())
        elif not line.strip() and block is not None:
            block["text"] = " ".join(block["text"])
            quotes.append(block)
            block = None
    return sources, quotes


def slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", "".join(fold(c) for c in s).strip()).strip("-")


def main():
    args = sys.argv[1:]
    sources, cands = parse(HERE / "candidates.txt")
    loaded = {}
    bank, dropped = [], []
    for c in cands:
        src = sources[c["src"]]
        if src["gid"] not in loaded:
            loaded[src["gid"]] = Source(fetch(src["gid"]))
        S = loaded[src["gid"]]
        hit = S.find(c["text"])
        if not hit or not hit[0]:
            dropped.append((c, hit and S.passage(hit[1], hit[2])))
            continue
        text = finish(typeset(S.passage(hit[1], hit[2], c["src"] in VERSE)))
        bank.append({"text": text, "src": c["src"], "cats": c["cats"], "where": c["where"],
                     "heading": S.heading(hit[1]), "line": c["line"]})

    # ids: author slug + the first words, stable while the wording is
    seen = set()
    for q in bank:
        base = slug(sources[q["src"]]["author"]).split("-")[-1] + "-" + "-".join(slug(q["text"]).split("-")[:4])
        qid, k = base, 2
        while qid in seen:
            qid, k = f"{base}-{k}", k + 1
        seen.add(qid)
        q["id"] = qid
    dupes = {}
    for q in bank:
        dupes.setdefault(slug(q["text"]), []).append(q["line"])

    if "--show" in args:
        want = args[args.index("--show") + 1]
        for q in bank:
            if want in q["id"]:
                print(json.dumps(q, ensure_ascii=False, indent=1))
        return

    for c, p in dropped:
        print(f"DROP  line {c['line']} ({c['src']}): {c['text'][:100]}")
        print(f"      nearest: {p[:220] if p else '(nothing alike)'}")
    for k, lines in dupes.items():
        if len(lines) > 1:
            print(f"DUPE  lines {lines}")
    if "--all" in args:
        for q in bank:
            print(f"OK    line {q['line']} [{q['heading'][:30]}] {q['where']}: {q['text']}")
    by_cat = {c: sum(c in q["cats"] for q in bank) for c in CATEGORIES}
    print(f"\n{len(bank)} verified, {len(dropped)} dropped; by category: {by_cat}")
    authors = {}
    for q in bank:
        authors[sources[q['src']]['author']] = authors.get(sources[q['src']]['author'], 0) + 1
    print(f"{len(authors)} authors; most: {sorted(authors.items(), key=lambda kv: -kv[1])[:6]}")
    if "--report" in args:
        return

    used = sorted({q["src"] for q in bank})
    srcs = {k: [sources[k]["author"], sources[k]["work"], sources[k]["year"], sources[k]["tr"],
                int(sources[k]["gid"].split("+")[0])]
            for k in used}
    rows = [[q["id"], q["text"], q["src"], " ".join(CATEGORIES.index(c).__str__() for c in q["cats"]), q["where"]]
            for q in bank]
    # test/daily_quote.mjs recomputes this: a quote edited by hand in the page, not here, fails the suite
    digest = hashlib.sha256("\n".join(f"{r[0]}\t{r[1]}\t{r[2]}" for r in rows).encode("utf-8")).hexdigest()
    js = ("/*BANK*/\nconst BANK_SUM = '" + digest + "';\nconst SOURCES = " + json.dumps(srcs, ensure_ascii=False, separators=(",", ":")) +
          ";\nconst QUOTES = [\n" + ",\n".join(json.dumps(r, ensure_ascii=False, separators=(",", ":")) for r in rows) +
          "\n];\n/*END BANK*/")
    html = PAGE.read_text(encoding="utf-8")
    new, n = re.subn(r"/\*BANK\*/.*?/\*END BANK\*/", lambda m: js, html, flags=re.S)
    if n != 1:
        raise SystemExit("the page has no /*BANK*/ ... /*END BANK*/ block")
    PAGE.write_text(new, encoding="utf-8")
    print(f"wrote {len(rows)} quotes from {len(used)} sources into {PAGE.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
