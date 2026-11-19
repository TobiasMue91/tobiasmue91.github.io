#!/usr/bin/env python3
"""Build data/character_map/unicode.txt, the data Character Map (tools/character_map_explorer.html) loads.

Sources, all fetched fresh (pass --cache DIR to reuse downloaded copies):
  Unicode Character Database 17.0.0  UnicodeData.txt, NameAliases.txt, Blocks.txt   (unicode.org)
  WHATWG HTML named character references                  entities.json           (html.spec.whatwg.org)
  CLDR English annotations (keywords for emoji/symbols)   annotations.json        (unicode-org/cldr-json)

Output is plain text, one section per '#' header, read by parseData() in the page's <script id="core">:
  #version <ucd version>
  #blocks       <start hex> <end hex> <name>
  #ranges       <start hex> <end hex> <gc> <name rule>    ideograph/syllable/private-use/surrogate runs
  #chars        <delta hex or empty for +1>;<gc>;<name>[;<upper hex>;<lower hex>]
                 a name ending in '-*' is that prefix plus the code point's own hex (CJK COMPATIBILITY IDEOGRAPH-*)
                 <control> characters carry their NameAliases 'control' alias as their name, in brackets
  #aliases      <hex>;<alias>|<alias>...                  corrections, controls, abbreviations, figments
  #entities     <hex>;<name>|<name>...                   only references that stand for one code point
  #keywords     <hex>;<kw>|<kw>...                       CLDR keywords not already words of the name

Never edit the output by hand; re-run this script.
"""
import json, os, sys, urllib.request

UCD = 'https://www.unicode.org/Public/17.0.0/ucd/'
SRC = {
    'UnicodeData.txt': UCD + 'UnicodeData.txt',
    'NameAliases.txt': UCD + 'NameAliases.txt',
    'Blocks.txt': UCD + 'Blocks.txt',
    'entities.json': 'https://html.spec.whatwg.org/entities.json',
    'annotations.json': 'https://raw.githubusercontent.com/unicode-org/cldr-json/main/cldr-json/'
                        'cldr-annotations-full/annotations/en/annotations.json',
}
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', '..', 'data', 'character_map', 'unicode.txt')


def fetch(name, cache):
    if cache and os.path.exists(os.path.join(cache, name)):
        with open(os.path.join(cache, name), encoding='utf-8') as f:
            return f.read()
    with urllib.request.urlopen(SRC[name]) as r:
        text = r.read().decode('utf-8')
    if cache:
        os.makedirs(cache, exist_ok=True)
        with open(os.path.join(cache, name), 'w', encoding='utf-8') as f:
            f.write(text)
    return text


def main():
    cache = sys.argv[sys.argv.index('--cache') + 1] if '--cache' in sys.argv else None
    out = ['#version 17.0.0', '#blocks']
    for line in fetch('Blocks.txt', cache).splitlines():
        line = line.split('#')[0].strip()
        if not line:
            continue
        rng, name = [s.strip() for s in line.split(';')]
        a, b = rng.split('..')
        out.append(f'{a} {b} {name}')

    aliases, control = {}, {}
    for line in fetch('NameAliases.txt', cache).splitlines():
        if not line or line.startswith('#'):
            continue
        cp, alias, kind = line.split(';')
        cp = int(cp, 16)
        if kind == 'control' and cp not in control:
            control[cp] = alias
        aliases.setdefault(cp, []).append(alias)

    ranges, chars, names = [], [], {}
    first = None
    for line in fetch('UnicodeData.txt', cache).splitlines():
        f = line.split(';')
        cp, name, gc = int(f[0], 16), f[1], f[2]
        if name.endswith(', First>'):
            first = cp
            continue
        if name.endswith(', Last>'):
            label = name[1:-len(', Last>')]
            if 'CJK Ideograph' in label:
                rule = 'CJK UNIFIED IDEOGRAPH-*'
            elif label.startswith('Tangut Ideograph'):
                rule = 'TANGUT IDEOGRAPH-*'
            elif label == 'Hangul Syllable':
                rule = 'HANGUL'
            elif 'Surrogate' in label:
                rule = '<surrogate>'
            else:
                rule = '<private-use>'
            ranges.append((first, cp, gc, rule))
            continue
        if name == '<control>':
            name = '<' + control[cp] + '>' if cp in control else '<control>'
        elif name.endswith('-%04X' % cp):
            name = name[:-len('%04X' % cp)] + '*'
        names[cp] = name
        chars.append((cp, gc, name, f[12], f[13]))

    out.append('#ranges')
    out += ['%04X %04X %s %s' % r for r in ranges]
    out.append('#chars')
    prev = -1
    for cp, gc, name, up, lo in chars:
        d = '' if cp == prev + 1 else '%X' % (cp - prev)
        prev = cp
        row = f'{d};{gc};{name}'
        if up or lo:
            row += f';{up};{lo}'
        out.append(row)

    out.append('#aliases')
    for cp in sorted(aliases):
        out.append('%04X;%s' % (cp, '|'.join(aliases[cp])))

    ents = {}
    for ref, v in json.loads(fetch('entities.json', cache)).items():
        if ref.endswith(';') and len(v['codepoints']) == 1:
            ents.setdefault(v['codepoints'][0], []).append(ref[1:-1])
    out.append('#entities')
    for cp in sorted(ents):
        # shortest, then lowercase-first, so &rarr; leads &RightArrow; and &srarr;
        refs = sorted(set(ents[cp]), key=lambda r: (len(r), r.lower() != r, r))
        out.append('%04X;%s' % (cp, '|'.join(refs)))

    ann = json.loads(fetch('annotations.json', cache))['annotations']['annotations']
    kws = {}
    for key, v in ann.items():
        cps = [ord(c) for c in key if ord(c) != 0xFE0F]
        if len(cps) != 1:
            continue
        cp = cps[0]
        nm = names.get(cp, '').lower()
        words = set(nm.replace('-', ' ').split())
        keep = []
        for k in v.get('tts', []) + v.get('default', []):
            k = k.strip().lower()
            if k and k != nm and k not in words and k not in keep and '|' not in k:
                keep.append(k)
        if keep:
            kws[cp] = keep
    out.append('#keywords')
    for cp in sorted(kws):
        out.append('%04X;%s' % (cp, '|'.join(kws[cp])))

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf-8', newline='\n') as f:
        f.write('\n'.join(out) + '\n')
    print(f'{OUT}: {len(chars)} named code points, {len(ranges)} ranges, {len(aliases)} aliased, '
          f'{len(ents)} with entities, {len(kws)} with keywords')


if __name__ == '__main__':
    main()
