"""Rebuild tools/emoji_data.json from the Unicode and CLDR source data.

Two upstream files, both authoritative:

* ``emoji-test.txt`` - the RGI emoji set, in canonical order, with the group
  each emoji belongs to and the emoji version that introduced it.
* the CLDR English annotations - the official name for each emoji plus the
  search keywords people actually type ("happy" for grinning face, "poop" for
  pile of poo, "car" for automobile).

The previous version of this script scraped the HTML emoji chart and kept only
the name column, which is why searching for "happy" used to find nothing.

Skin-tone variants are not rows of their own - that would multiply the grid
roughly sixfold. An emoji that takes a skin tone carries its light-skin-tone
form instead, under ``tone``; the picker swaps U+1F3FB for whichever of the
five modifiers the reader picked. Only uniform tones are kept: a couple with
two different tones is RGI too, but a single tone picker cannot ask for it.

Usage: python util/emoji_fetcher.py
"""

import json
import os
import re
import xml.etree.ElementTree as ET

import requests

EMOJI_TEST = ("https://raw.githubusercontent.com/unicode-org/unicodetools/"
              "main/unicodetools/data/emoji/18.0/emoji-test.txt")
CLDR = ("https://raw.githubusercontent.com/unicode-org/cldr/main/common/"
        "{}/en.xml")

SKIN_TONES = set("\U0001F3FB\U0001F3FC\U0001F3FD\U0001F3FE\U0001F3FF")
LIGHT = "\U0001F3FB"
OUT = os.path.join(os.path.dirname(__file__), "..", "tools", "emoji_data.json")

# Concepts no emoji is tagged with upstream, but that people search for anyway.
# Keep this list short: it is for ideas that have no emoji of their own, not a
# place to re-add synonyms CLDR already carries.
CONCEPTS = {
    "airport": "\u2708\uFE0F \U0001F6EB \U0001F6EC \U0001F9F3 \U0001F6C4",
    "winter": "\u2744\uFE0F \u26C4 \U0001F328\uFE0F \U0001F9E3 \U0001F9E4",
    "easter": "\U0001F430 \U0001F95A \U0001F423 \U0001F337",
    "new year": "\U0001F386 \U0001F387 \U0001F942 \U0001F37E \U0001F38A",
    "bluetooth": "\U0001F4F6 \U0001F6DC",
    "submarine": "\U0001F6A2 \U0001F419 \U0001F30A",
    "ink": "\U0001F58B\uFE0F \U0001F58A\uFE0F \U0001F5A8\uFE0F",
    "thanksgiving": "\U0001F983 \U0001F967 \U0001F342",
}


def strip_vs(text):
    """Drop variation selectors, so the same emoji compares equal either way."""
    return "".join(c for c in text if c not in "\uFE0F\uFE0E")


def fetch_rgi():
    """Every fully-qualified, non-skin-toned emoji, in canonical order, with the
    light-skin-tone form of those that take a tone."""
    text = requests.get(EMOJI_TEST, timeout=60).text
    pattern = re.compile(r"^([0-9A-F ]+);\s*(\S+)\s*#\s*(\S+)\s+E(\S+)\s+(.*)$")
    rows, toned, group = [], {}, None
    for line in text.splitlines():
        if line.startswith("# group:"):
            group = line.split(":", 1)[1].strip()
            continue
        match = pattern.match(line)
        if not match:
            continue
        _, status, glyph, version, name = match.groups()
        if status != "fully-qualified":
            continue
        tones = [c for c in glyph if c in SKIN_TONES]
        if tones:
            if len(set(tones)) == 1:
                base = strip_vs("".join(c for c in glyph if c not in SKIN_TONES))
                toned.setdefault(base, {})[tones[0]] = glyph
            continue
        rows.append({"emoji": glyph, "name": name.strip(),
                     "group": group, "ver": version})
    for row in rows:
        variants = toned.get(strip_vs(row["emoji"]), {})
        if variants:
            # The picker derives the other four from this one, which only
            # works if upstream really has all five.
            assert len(variants) == 5, row["emoji"]
            for tone, glyph in variants.items():
                assert glyph == variants[LIGHT].replace(LIGHT, tone), glyph
            row["tone"] = variants[LIGHT]
    return rows


def fetch_annotations():
    """CLDR names and keywords, keyed by emoji."""
    out = {}
    for directory in ("annotations", "annotationsDerived"):
        xml = requests.get(CLDR.format(directory), timeout=60).content
        for node in ET.fromstring(xml).iter("annotation"):
            entry = out.setdefault(node.get("cp"), {})
            text = (node.text or "").strip()
            if node.get("type") == "tts":
                entry["name"] = text
            else:
                entry["kw"] = [k.strip() for k in text.split("|") if k.strip()]
    return out


def build():
    annotations = fetch_annotations()
    data = []
    for row in fetch_rgi():
        found = (annotations.get(row["emoji"])
                 or annotations.get(strip_vs(row["emoji"])) or {})
        name = found.get("name") or row["name"]
        name_words = set(re.split(r"[^a-z0-9]+", name.lower()))
        # Keywords that merely repeat the name earn nothing and cost bytes.
        keywords = [k.lower() for k in dict.fromkeys(found.get("kw", []))]
        keywords = [k for k in keywords if k not in name_words]
        item = {"emoji": row["emoji"], "keywords": name,
                "kw": " ".join(keywords), "group": row["group"],
                "ver": row["ver"]}
        if "tone" in row:
            item["tone"] = row["tone"]
        data.append(item)

    by_emoji = {strip_vs(item["emoji"]): item for item in data}
    for concept, glyphs in CONCEPTS.items():
        for glyph in glyphs.split():
            item = by_emoji.get(strip_vs(glyph))
            if item and concept not in item["kw"].split():
                item["kw"] = (item["kw"] + " " + concept).strip()
    return data


if __name__ == "__main__":
    emoji_data = build()
    with open(OUT, "w", encoding="utf-8") as handle:
        json.dump(emoji_data, handle, ensure_ascii=False, indent=2)
    print("Wrote {} emoji to {}".format(len(emoji_data), os.path.normpath(OUT)))
