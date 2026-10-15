"""Builds data/names.txt for tools/name_generator.html from the US Social Security Administration's
baby-name records (every name given to at least five babies of one sex in a year, 1880-2017), as
packaged in the `babynames` R data set by Hadley Wickham:

    curl -LO https://raw.githubusercontent.com/hadley/babynames/master/data/babynames.rda
    pip install rdata && python util/name_generator/build.py babynames.rda

Keeps every name with at least 300 babies in all. One line per name:

    Name<TAB>girls 2008-17<TAB>boys 2008-17<TAB>girls all years<TAB>boys all years<TAB>curve

The curve is the name's share of births per decade, 1880s to 2010s, as 14 base-36 digits scaled
so the name's own peak decade is z. The first line is a header with the year range.
"""
import os, sys, math, warnings
from collections import defaultdict
warnings.filterwarnings('ignore')
import rdata

d = rdata.conversion.convert(rdata.parser.parse_file(sys.argv[1]))['babynames']
out = os.path.join(os.path.dirname(__file__), '..', '..', 'data', 'names.txt')
Y0, Y1, RECENT = 1880, 2017, 2008
rec = defaultdict(lambda: [0, 0, 0, 0, [0.0] * 14])
for year, sex, name, n, prop in zip(d.year, d.sex, d.name, d.n, d.prop):
    year = int(year); r = rec[name]; f = sex == 'F'
    r[2 if f else 3] += int(n)
    if year >= RECENT: r[0 if f else 1] += int(n)
    r[4][(year - Y0) // 10] += float(prop)
D36 = '0123456789abcdefghijklmnopqrstuvwxyz'
lines = []
for name, (rf, rm, af, am, cur) in rec.items():
    if af + am < 300: continue
    peak = max(cur)
    c = ''.join(D36[0 if v <= 0 else max(1, round(35 * v / peak))] for v in cur)
    lines.append((-(rf + rm), -(af + am), name, f'{name}\t{rf}\t{rm}\t{af}\t{am}\t{c}'))
lines.sort()
with open(out, 'w', encoding='utf-8', newline='\n') as fh:
    fh.write(f'#{Y0}\t{Y1}\t{RECENT}\n')
    fh.write('\n'.join(l[3] for l in lines) + '\n')
print(len(lines), 'names ->', out, os.path.getsize(out), 'bytes')
