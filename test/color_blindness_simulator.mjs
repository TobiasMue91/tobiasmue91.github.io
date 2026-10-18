#!/usr/bin/env node
// Test suite for tools/color_blindness_simulator.html (Color Blindness Simulator).
//
// Runs the page's DOM-free <script id="core"> block in Node. The page promises that what it shows is the
// Machado, Oliveira & Fernandes (2009) model, that "look the same / hard to tell apart" is CIEDE2000, and that
// suggested replacements really stay distinct. Expected values come from outside the page:
//   - simulation: colorspacious 1.1.2 (Nathaniel Smith), cspace_convert(rgb, {"name": "sRGB1+CVD", ...}), which
//     carries the authors' published matrices; the page must agree within one 8-bit level;
//   - CIEDE2000: Sharma, Wu & Dalal (2005) published test pairs;
//   - what people paste, old-style links and broken saved settings.
//
//   node test/color_blindness_simulator.mjs              # everything
//   node test/color_blindness_simulator.mjs simulate     # named suites only
//
// Suites: matrices, simulate, pixels, de2000, parse, clashes, suggest, palette, links, saves, names.

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = join(HERE, '..', 'tools', 'color_blindness_simulator.html');
const ALL = ['matrices', 'simulate', 'pixels', 'de2000', 'parse', 'clashes', 'suggest', 'palette', 'links', 'saves', 'names'];
const picked = process.argv.slice(2).filter(a => !a.startsWith('--'));
const suites = picked.length ? picked : ALL;

let failures = 0, passes = 0;
const check = (ok, what, detail) => { if (ok) passes++; else { failures++; console.log(`  FAIL  ${what}${detail ? '\n          ' + detail : ''}`); } };
const eq = (got, want, what) => check(JSON.stringify(got) === JSON.stringify(want), what, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
const near = (got, want, tol, what) => check(Math.abs(got - want) <= tol, what, `got ${got}, want ${want} ±${tol}`);

const html = readFileSync(PAGE, 'utf8');
const src = /<script id="core">([\s\S]*?)<\/script>/.exec(html)[1];
const ctx = {module: {exports: {}}, URLSearchParams};
vm.createContext(ctx);
vm.runInContext(src, ctx);
const C = ctx.module.exports;
const rgb = h => [0, 2, 4].map(i => parseInt(h.replace('#', '').substr(i, 2), 16));

const T = {
  matrices() {
    // Published endpoints (Machado et al. 2009, severity 1.0).
    const M = C.matrix('protanopia', 100);
    near(M[0][0], 0.152286, 1e-6, 'protan 1.0 [0][0]'); near(M[2][2], 1.051998, 1e-6, 'protan 1.0 [2][2]');
    near(C.matrix('deuteranopia', 100)[1][1], 0.672501, 1e-6, 'deutan 1.0 [1][1]');
    near(C.matrix('tritanopia', 100)[2][1], 0.691367, 1e-6, 'tritan 1.0 [2][1]');
    near(C.matrix('deuteranopia', 50)[0][0], 0.547494, 1e-6, 'deutan 0.5 [0][0] (published table)');
    eq(C.matrix('normal', 70), [[1, 0, 0], [0, 1, 0], [0, 0, 1]], 'normal is identity at any severity');
    eq(C.matrix('protanopia', 0).map(r => r.map(v => Math.round(v * 1e6) / 1e6)), [[1, 0, 0], [0, 1, 0], [0, 0, 1]], 'severity 0 is identity');
    for (const t of ['deuteranopia', 'protanopia', 'tritanopia']) for (let s = 0; s <= 100; s += 10)
      C.matrix(t, s).forEach((r, i) => near(r[0] + r[1] + r[2], 1, 2e-3, `${t} ${s}: row ${i} keeps white white`));
    // Interpolation halfway between published steps.
    const a = C.matrix('deuteranopia', 30)[0][0], b = C.matrix('deuteranopia', 40)[0][0];
    near(C.matrix('deuteranopia', 35)[0][0], (a + b) / 2, 1e-9, 'severity 35 interpolates 30 and 40');
    near(C.matrix('achromatopsia', 100)[0][1], 0.7152, 1e-9, 'achromatopsia uses Rec. 709 luminance');
    near(C.matrix('deuteranopia', 150)[0][0], C.matrix('deuteranopia', 100)[0][0], 0, 'severity over 100 clamps');
  },
  simulate() {
    const V = JSON.parse(readFileSync(join(HERE, 'color_blindness_simulator.vectors.json'), 'utf8'));
    const name = {prot: 'protanopia', deut: 'deuteranopia', trit: 'tritanopia'};
    for (const [k, want] of Object.entries(V)) {
      const [hex, t, s] = k.split(' ');
      const got = C.simulate(rgb(hex), name[t], +s), w = rgb(want);
      check(got.every((v, i) => Math.abs(v - w[i]) <= 1), `#${hex} ${name[t]} ${s}% = #${want} (colorspacious)`, `got ${C.toHex(got)}`);
    }
    for (const t of C.TYPES) for (const s of [20, 60, 100]) {
      eq(C.simulate([255, 255, 255], t, s), [255, 255, 255], `white stays white: ${t} ${s}`);
      eq(C.simulate([0, 0, 0], t, s), [0, 0, 0], `black stays black: ${t} ${s}`);
      const g = C.simulate([128, 128, 128], t, s); check(g.every(v => Math.abs(v - 128) <= 1), `grey stays grey: ${t} ${s}`, String(g));
    }
    eq(C.simulate([255, 0, 0], 'achromatopsia', 100), [127, 127, 127], 'red in achromatopsia = its luminance');
    eq(C.simulate([66, 133, 244], 'normal', 100), [66, 133, 244], 'normal changes nothing');
  },
  pixels() {
    const cols = [[255, 0, 0], [0, 255, 0], [0, 0, 255], [18, 52, 86], [255, 128, 0], [66, 133, 244], [1, 2, 3], [254, 253, 252]];
    for (const t of C.TYPES) for (const s of [10, 35, 100]) {
      const px = new Uint8ClampedArray(cols.flatMap(c => [...c, 77]));
      C.simulatePixels(px, t, s);
      cols.forEach((c, i) => {
        const want = C.simulate(c, t, s), got = [px[i * 4], px[i * 4 + 1], px[i * 4 + 2]];
        check(got.every((v, k) => Math.abs(v - want[k]) <= 1), `pixel path = colour path: ${C.toHex(c)} ${t} ${s}`, `${got} vs ${want}`);
        check(px[i * 4 + 3] === 77, `alpha untouched: ${t}`);
      });
    }
    const big = new Uint8ClampedArray(4 * 1e6).fill(200);
    const t0 = Date.now(); C.simulatePixels(big, 'deuteranopia', 100);
    check(Date.now() - t0 < 1500, 'one megapixel in under 1.5 s', `${Date.now() - t0} ms`);
    const part = new Uint8ClampedArray([255, 0, 0, 255, 255, 0, 0, 255]);
    C.simulatePixels(part, 'protanopia', 100, 4, 8);
    eq(Array.from(part.slice(0, 4)), [255, 0, 0, 255], 'range: pixels before "from" untouched');
    eq(C.simulatePixels(new Uint8ClampedArray(0), 'tritanopia', 100).length, 0, 'empty image');
  },
  de2000() {
    // Sharma, Wu & Dalal (2005), Table 1.
    const P = [[[50, 2.6772, -79.7751], [50, 0, -82.7485], 2.0425], [[50, 0, 0], [50, -1, 2], 2.3669],
      [[50, 2.5, 0], [73, 25, -18], 27.1492], [[60.2574, -34.0099, 36.2677], [60.4626, -34.1751, 39.4387], 1.2644],
      [[22.7233, 20.0904, -46.694], [23.0331, 14.973, -42.5619], 2.0373], [[90.8027, -2.0831, 1.441], [91.1528, -1.6435, 0.0447], 1.4441],
      [[2.0776, 0.0795, -1.135], [0.9033, -0.0636, -0.5514], 0.9082], [[50, 2.49, -0.001], [50, -2.49, 0.0009], 7.1792],
      [[50, -0.001, 2.49], [50, 0.0009, -2.49], 4.8045], [[50, 2.5, 0], [56, -27, -3], 31.903]];
    P.forEach(([a, b, w], i) => { near(C.de2000(a, b), w, 1e-4, `Sharma pair ${i + 1}`); near(C.de2000(b, a), w, 1e-4, `Sharma pair ${i + 1} symmetric`); });
    near(C.de2000([50, 0, 0], [50, 0, 0]), 0, 0, 'identical = 0');
    const L = C.lab([255, 255, 255]); near(L[0], 100, 1e-3, 'white L* = 100'); near(L[1], 0, 1e-3, 'white a* = 0');
  },
  parse() {
    const hexes = s => C.parseColours(s).colours.map(c => c.hex);
    eq(hexes('#D62728, #2ca02c'), ['#d62728', '#2ca02c'], 'comma list');
    eq(hexes('primary: #D62728\nsuccess: #2ca02c'), ['#d62728', '#2ca02c'], 'design tokens with labels');
    eq(C.parseColours('primary: #D62728\nsuccess: #2ca02c').errors, [], 'labels are not errors');
    eq(hexes('  #fff\t#000  '), ['#ffffff', '#000000'], 'short hex and stray whitespace');
    eq(hexes('1f77b4 ff7f0e'), ['#1f77b4', '#ff7f0e'], 'hex without #');
    eq(hexes('0xFF8800'), ['#ff8800'], '0x prefix');
    eq(hexes('#11223380'), ['#112233'], '8-digit hex: alpha ignored');
    eq(hexes('rgb(255, 127, 14)'), ['#ff7f0e'], 'rgb() commas');
    eq(hexes('rgb(255 127 14 / 50%)'), ['#ff7f0e'], 'rgb() space syntax with alpha');
    eq(hexes('rgba(100%,0%,50%,0.3)'), ['#ff0080'], 'rgb() percentages');
    eq(hexes('rgb(300,-5,10)'), ['#ff000a'], 'rgb() out of range clamps');
    eq(hexes('"#abcdef";'), ['#abcdef'], 'quotes and semicolons from CSS/JSON');
    eq(hexes(''), [], 'empty'); eq(hexes('   \n '), [], 'whitespace');
    eq(C.parseColours('#zzz').errors.map(e => e.text), ['#zzz'], 'bad hex is an error');
    eq(C.parseColours('#12345').errors.map(e => e.text), ['#12345'], '5 digits is an error');
    eq(C.parseColours('rgb(1,2)').errors.length, 1, 'rgb() with two numbers is an error');
    eq(C.parseColours('grün #ff0000 ✓').colours.length, 1, 'non-ASCII words ignored');
    eq(C.parseColours('#ff0000'.repeat(1)).colours[0].at, 0, 'position recorded for replace');
    const huge = Array.from({length: 20000}, (_, i) => '#' + (i * 997 % 0xffffff).toString(16).padStart(6, '0')).join(', ');
    const t0 = Date.now(); eq(C.parseColours(huge).colours.length, 20000, '20 000 colours parse'); check(Date.now() - t0 < 1000, 'and fast');
  },
  clashes() {
    const pal = ['#d62728', '#2ca02c', '#ff7f0e', '#1f77b4'].map(rgb);
    const d = C.clashes(pal, 'deuteranopia', 100);
    check(d.some(c => c.i === 0 && c.j === 1), 'red/green clash for deuteranopia');
    check(!C.clashes(pal, 'normal', 100).length, 'no clashes for normal vision');
    eq(C.clashes(pal, 'deuteranopia', 0).length, 0, 'severity 0: no clashes');
    check(C.clashes(pal, 'protanopia', 100).some(c => c.i === 1 && c.j === 2 && c.level === 'same'), 'green/orange look the same for protanopia');
    const okabe = ['#E69F00', '#56B4E9', '#009E73', '#0072B2', '#D55E00', '#CC79A7'].map(rgb);
    for (const t of ['deuteranopia', 'protanopia', 'tritanopia']) eq(C.clashes(okabe, t, 100).filter(c => c.level === 'same').length, 0, `Okabe-Ito: nothing identical for ${t}`);
    eq(C.clashes([[10, 10, 10], [12, 12, 12]], 'deuteranopia', 100).length, 0, 'already-similar pairs are not blamed on colour blindness');
    eq(C.clashes([], 'tritanopia', 100), [], 'empty palette');
  },
  suggest() {
    const pal = ['#d62728', '#2ca02c', '#ff7f0e', '#1f77b4'].map(rgb);
    const s = C.suggest(pal, 1);
    check(s.length > 0 && s.length <= 3, 'up to three suggestions');
    for (const f of s) {
      const next = pal.slice(); next[1] = f.rgb;
      for (const t of ['deuteranopia', 'protanopia', 'tritanopia']) check(!C.clashes(next, t, 100).some(c => c.i === 1 || c.j === 1), `${f.hex} fixes colour 2 for ${t}`);
    }
    check(s.every(f => !pal.some(p => C.toHex(p) === f.hex)), 'never suggests a colour already in the palette');
    check(C.suggest([[0, 0, 0]], 0).length > 0, 'works for a single colour');
  },
  palette() {
    const px = new Uint8ClampedArray(4 * 1000);
    for (let i = 0; i < 1000; i++) { const c = i < 600 ? [214, 39, 40] : i < 990 ? [44, 160, 44] : [0, 0, 255]; px.set([...c, 255], i * 4); }
    const p = C.palette(px, 8);
    eq(p.map(x => C.toHex(x.rgb)), ['#d62728', '#2ca02c', '#0000ff'], 'main colours by area, 1% minimum');
    near(p[0].share, 0.6, 1e-9, 'share');
    eq(C.palette(new Uint8ClampedArray(16), 8), [], 'fully transparent image: none');
  },
  links() {
    eq(C.readParams('', '#type=protanopia&severity=60'), {type: 'protanopia', severity: 60}, 'hash link');
    eq(C.readParams('?type=deutan', ''), {type: 'deuteranopia'}, 'query, short name');
    eq(C.readParams('', '#t=trit&s=0,6'), {type: 'tritanopia', severity: 60}, 'decimal comma fraction');
    eq(C.readParams('', '#severity=250'), {severity: 100}, 'severity clamps');
    eq(C.readParams('', '#type=banana'), {}, 'unknown type ignored');
    eq(C.readParams('', '#colors=d62728,2ca02c'), {colours: '#d62728, #2ca02c', mode: 'colours'}, 'colour link opens colours');
    const st = {mode: 'colours', type: 'deuteranopia', severity: 60, colours: 'a: #D62728\nb: #2CA02C'};
    const url = C.link('https://gptgames.dev/tools/color_blindness_simulator.html', st);
    eq(url, 'https://gptgames.dev/tools/color_blindness_simulator.html#mode=colors&colors=d62728%2C2ca02c&severity=60', 'link carries values only, no labels');
    const back = C.readParams('', url.split('#')[1]); eq([back.colours, back.severity, back.mode], ['#d62728, #2ca02c', 60, 'colours'], 'link round trip');
    eq(C.link('x', {mode: 'image', type: 'normal', severity: 100}), 'x', 'image link with defaults is bare');
  },
  saves() {
    eq(C.loadSettings(null), C.DEFAULTS, 'nothing saved: defaults');
    eq(C.loadSettings('{oops').type, 'deuteranopia', 'corrupt JSON: defaults');
    eq(C.loadSettings('[1,2]').mode, 'image', 'wrong shape: defaults');
    const s = C.loadSettings(JSON.stringify({mode: 'colours', type: 'PROT', severity: '60%', colours: '#fff'}));
    eq([s.mode, s.type, s.severity, s.colours], ['colours', 'protanopia', 60, '#fff'], 'saved settings read leniently');
    eq(C.loadSettings(JSON.stringify({severity: -20})).severity, 0, 'negative severity clamps');
  },
  names() {
    eq(C.label('deuteranopia', 100), 'Deuteranopia', 'full = -opia');
    eq(C.label('deuteranopia', 60), 'Deuteranomaly', 'partial = -anomaly');
    eq(C.label('achromatopsia', 40), 'Achromatopsia', 'partial achromatopsia keeps its name; the % is shown beside it');
    eq(C.fileName('My chart.final.PNG', 'protanopia', 100), 'My-chart-final-protanopia.png', 'file name');
    eq(C.fileName('', 'deuteranopia', 60), 'image-deuteranomaly-60.png', 'file name with severity');
    eq(C.fileName('a.png', 'normal', 100), 'a-original.png', 'normal = original (as before)');
    eq(C.fileName('../../etc/passwd', 'tritanopia', 100), 'etc-passwd-tritanopia.png', 'hostile name');
    eq(C.normType('Green-blind'), 'deuteranopia', 'everyday words');
  },
};
for (const s of suites) { if (!T[s]) { console.log('unknown suite ' + s); process.exit(2); } console.log(s); T[s](); }
console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
