#!/usr/bin/env node
// Test suite for tools/image_color_extractor.html (Image Color Extractor).
//
// Runs the page's DOM-free <script id="core"> block in Node. The tool promises that each swatch is a colour really in
// the image, that the % is how much of the visible image it covers, and that the codes say exactly that colour. So:
// conversions against values CSS Color 4 and Ottosson's OKLab publish, every 8-bit colour round-tripping through
// OKLab, HSL against a reference written the other way round, WCAG contrast; palettes of images whose answer is known
// (one colour, two at 70/30, three asked for twelve, noisy photos of four colours, transparency, 1x1, all
// transparent), every swatch present in its image with its marker on a pixel of that colour, shares that add to 100,
// determinism and speed at the largest analysis size; exports byte for byte, and saved settings that trust nothing.
//
//   node test/image_color_extractor.mjs            # everything
//   node test/image_color_extractor.mjs palette    # named suites only
//
// Suites: convert, format, contrast, palette, marks, exports, settings.

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = join(HERE, '..', 'tools', 'image_color_extractor.html');
const ALL = ['convert', 'format', 'contrast', 'palette', 'marks', 'exports', 'settings'];
const picked = process.argv.slice(2).filter(a => !a.startsWith('--'));
const suites = picked.length ? picked : ALL;

let failures = 0, passes = 0;
const check = (ok, what, detail) => { if (ok) passes++; else { failures++; console.log(`  FAIL  ${what}${detail ? '\n          ' + detail : ''}`); } };
const eq = (got, want, what) => check(JSON.stringify(got) === JSON.stringify(want), what, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
const near = (got, want, tol, what) => check(Math.abs(got - want) <= tol, what, `got ${got}, want ${want} ±${tol}`);
const section = name => console.log(`\n=== ${name} ===`);

const html = readFileSync(PAGE, 'utf8');
const src = html.match(/<script id="core">([\s\S]*?)<\/script>/)[1];
const ctx = {module: {exports: {}}, Math, Uint32Array, Int32Array, Float64Array, Uint8ClampedArray, JSON, Object, String, Number};
vm.runInNewContext(src, ctx);
const C = ctx.module.exports;

// image helpers
function img(w, h, f) { const d = new Uint8ClampedArray(w * h * 4); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const c = f(x, y); d[(y * w + x) * 4] = c[0]; d[(y * w + x) * 4 + 1] = c[1]; d[(y * w + x) * 4 + 2] = c[2]; d[(y * w + x) * 4 + 3] = c.length > 3 ? c[3] : 255; } return d; }
let seed = 1; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const hexes = r => r.colors.map(c => C.hex(c));

if (suites.includes('convert')) {
  section('convert');
  // Ottosson's published reference values (sRGB white -> L 1, a 0, b 0) and CSS Color 4's oklch for the primaries
  const w = C.rgbToOklab(255, 255, 255); near(w[0], 1, 1e-4, 'white L = 1'); near(w[1], 0, 1e-4, 'white a = 0'); near(w[2], 0, 1e-4, 'white b = 0');
  const k = C.rgbToOklab(0, 0, 0); near(k[0], 0, 1e-9, 'black L = 0');
  const red = C.rgbToOklab(255, 0, 0); near(red[0], 0.62796, 2e-4, 'red L'); near(Math.hypot(red[1], red[2]), 0.25768, 2e-4, 'red C');
  near(Math.atan2(red[2], red[1]) * 180 / Math.PI, 29.2339, 0.02, 'red h');
  const blue = C.rgbToOklab(0, 0, 255); near(blue[0], 0.45201, 2e-4, 'blue L'); near(Math.hypot(blue[1], blue[2]), 0.31321, 2e-4, 'blue C');
  const lime = C.rgbToOklab(0, 255, 0); near(lime[0], 0.86644, 2e-4, 'lime L'); near(Math.hypot(lime[1], lime[2]), 0.29483, 2e-4, 'lime C');
  // every 8-bit colour on a 4-step grid survives the round trip exactly
  let bad = 0;
  for (let r = 0; r < 256; r += 3) for (let g = 0; g < 256; g += 3) for (let b = 0; b < 256; b += 3) { const o = C.rgbToOklab(r, g, b), q = C.oklabToRgb(o[0], o[1], o[2]); if (q[0] !== r || q[1] !== g || q[2] !== b) bad++; }
  eq(bad, 0, 'rgb -> oklab -> rgb is exact on a 86^3 grid');
  // greys have no chroma
  for (const v of [1, 17, 128, 254]) near(Math.hypot(...C.rgbToOklab(v, v, v).slice(1)), 0, 1e-4, `grey ${v} chroma 0`);
}

if (suites.includes('format')) {
  section('format');
  eq(C.hex({r: 18, g: 52, b: 86}), '#123456', 'hex lower-case, padded');
  eq(C.hex({r: 0, g: 0, b: 0}), '#000000', 'hex black');
  eq(C.rgb({r: 255, g: 4, b: 0}), 'rgb(255, 4, 0)', 'rgb');
  const H = [[{r: 255, g: 0, b: 0}, 'hsl(0, 100%, 50%)'], [{r: 0, g: 128, b: 0}, 'hsl(120, 100%, 25%)'], [{r: 18, g: 52, b: 86}, 'hsl(210, 65%, 20%)'],
    [{r: 128, g: 128, b: 128}, 'hsl(0, 0%, 50%)'], [{r: 255, g: 255, b: 255}, 'hsl(0, 0%, 100%)'], [{r: 255, g: 0, b: 1}, 'hsl(0, 100%, 50%)'], [{r: 255, g: 0, b: 128}, 'hsl(330, 100%, 50%)']];
  for (const [c, want] of H) eq(C.hsl(c), want, 'hsl ' + C.hex(c));
  // HSL against a reference written the other way round: rebuild rgb from the unrounded parts
  let worst = 0;
  for (let i = 0; i < 20000; i++) {
    const c = {r: Math.floor(rnd() * 256), g: Math.floor(rnd() * 256), b: Math.floor(rnd() * 256)}, [h, s, l] = C.hslParts(c).map((v, j) => j ? v / 100 : v);
    const f = n => { const k = (n + h / 30) % 12, a = s * Math.min(l, 1 - l); return 255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))); };
    worst = Math.max(worst, Math.abs(f(0) - c.r), Math.abs(f(8) - c.g), Math.abs(f(4) - c.b));
  }
  check(worst < 1e-6, 'hsl parts rebuild the colour (CSS Color 4 hslToRgb)', 'worst ' + worst);
  check(!/hsl\(360/.test([...Array(2000)].map(() => C.hsl({r: 255, g: Math.floor(rnd() * 3), b: Math.floor(rnd() * 3)})).join()), 'hue never prints as 360');
  eq(C.oklch({r: 255, g: 255, b: 255}), 'oklch(100% 0 0)', 'oklch white');
  eq(C.oklch({r: 255, g: 0, b: 0}), 'oklch(62.8% 0.258 29.2)', 'oklch red (CSS Color 4: 62.8% 0.2577 29.23)');
  eq(C.oklch({r: 128, g: 128, b: 128}), 'oklch(59.987% 0 0)'.replace('59.987', '60'), 'oklch grey has no hue');
  eq(C.format({r: 1, g: 2, b: 3}, 'nope'), '#010203', 'unknown format falls back to hex');
  eq(C.percents([{share: 1 / 3}, {share: 1 / 3}, {share: 1 / 3}]), [34, 33, 33], 'largest remainder: thirds sum to 100');
  for (let t = 0; t < 300; t++) { const n = 1 + Math.floor(rnd() * 12), w = [...Array(n)].map(() => rnd() ** 3), s = w.reduce((a, b) => a + b); eq(C.percents(w.map(v => ({share: v / s}))).reduce((a, b) => a + b), 100, 'shares sum to 100 #' + t); if (failures) break; }
  eq(C.pctLabel(0, 0.002), '<1%', 'a sliver is <1%, not 0%');
  eq(C.pctLabel(12, 0.12), '12%', 'pct label');
  eq(C.name({r: 255, g: 255, b: 255}), 'white', 'name white'); eq(C.name({r: 0, g: 0, b: 0}), 'black', 'name black');
  eq(C.name({r: 128, g: 128, b: 128}), 'gray', 'name grey (not pink, as the old page had it)'); eq(C.name({r: 255, g: 0, b: 0}), 'red', 'name red'); eq(C.name({r: 0, g: 0, b: 255}), 'blue', 'name blue');
}

if (suites.includes('contrast')) {
  section('contrast');
  near(C.contrast({r: 0, g: 0, b: 0}, {r: 255, g: 255, b: 255}), 21, 1e-9, 'black on white 21:1');
  near(C.contrast({r: 118, g: 118, b: 118}, {r: 255, g: 255, b: 255}), 4.54, 0.01, '#767676 on white 4.54:1 (WCAG AA boundary)');
  eq(C.ink({r: 255, g: 255, b: 0}), '#000000', 'yellow gets black text'); eq(C.ink({r: 0, g: 0, b: 128}), '#FFFFFF', 'navy gets white text');
}

if (suites.includes('palette')) {
  section('palette');
  let r = C.extract(img(50, 50, () => [255, 0, 0]), 50, 50, 5);
  eq(hexes(r), ['#ff0000'], 'solid red: one swatch, exactly red (old page: two wrong reds)'); near(r.colors[0].share, 1, 1e-12, 'solid red 100%');
  r = C.extract(img(50, 50, () => [255, 255, 255]), 50, 50, 5); eq(hexes(r), ['#ffffff'], 'solid white is a colour (old page: "no opaque pixels")');
  r = C.extract(img(100, 100, x => x < 70 ? [255, 0, 0] : [0, 0, 255]), 100, 100, 5);
  eq(hexes(r), ['#ff0000', '#0000ff'], 'two colours: two swatches, no invented ones'); near(r.colors[0].share, .7, 1e-12, '70%'); near(r.colors[1].share, .3, 1e-12, '30%');
  r = C.extract(img(40, 40, (x, y) => y < 30 ? [0, 0, 0] : [255, 255, 255]), 40, 40, 5); eq(hexes(r), ['#000000', '#ffffff'], '75% black / 25% white both kept');
  r = C.extract(img(30, 30, x => [[255, 0, 0], [0, 255, 0], [0, 0, 255]][x % 3]), 30, 30, 12); eq(hexes(r).sort(), ['#0000ff', '#00ff00', '#ff0000'], 'three colours asked for twelve -> three');
  r = C.extract(img(30, 30, x => [[255, 0, 0], [0, 255, 0], [0, 0, 255]][x % 3]), 30, 30, 2); eq(r.colors.length, 2, 'three colours asked for two -> two');
  check(r.colors.every(c => ['#ff0000', '#00ff00', '#0000ff'].includes(C.hex(c))), 'and both are real colours, not an average (old page: teal)');
  r = C.extract(img(1, 1, () => [255, 128, 0]), 1, 1, 5); eq(hexes(r), ['#ff8000'], '1x1 orange is exactly orange (old page: #804404)');
  r = C.extract(img(1, 1, () => [10, 20, 30]), 1, 1, 2); eq(hexes(r), ['#0a141e'], '1x1 dark');
  r = C.extract(img(20, 20, x => x < 10 ? [0, 0, 0, 0] : [0, 200, 0]), 20, 20, 5); eq(hexes(r), ['#00c800'], 'transparent half ignored'); eq([r.opaque, r.total], [200, 400], 'opaque count');
  r = C.extract(img(20, 20, () => [9, 9, 9, 0]), 20, 20, 5); eq(r.colors.length, 0, 'all transparent: nothing');
  r = C.extract(img(20, 20, () => [9, 9, 9, 127]), 20, 20, 5); eq(r.colors.length, 0, 'alpha below 128 is background');
  r = C.extract(img(20, 20, () => [9, 9, 9, 128]), 20, 20, 5); eq(r.colors.length, 1, 'alpha 128 counts');
  eq(C.extract(new Uint8ClampedArray(0), 0, 0, 5).colors.length, 0, 'empty image');
  // count clamps
  for (const n of [0, -3, 99, NaN, 2.6]) { const q = C.extract(img(64, 64, (x, y) => [x * 4, y * 4, 128]), 64, 64, n); check(q.colors.length >= 1 && q.colors.length <= C.MAX_COUNT, 'count ' + n + ' clamped'); }
  // noisy photo of four colours in quadrants: four swatches, each within a few units of its truth, shares ~25%
  const base = [[200, 40, 40], [40, 160, 70], [30, 60, 190], [235, 220, 150]];
  const noisy = img(200, 200, (x, y) => { const c = base[(x >= 100) + 2 * (y >= 100)], n = Math.round((rnd() - .5) * 16); return c.map(v => Math.max(0, Math.min(255, v + n + Math.round((rnd() - .5) * 6)))); });
  r = C.extract(noisy, 200, 200, 4); eq(r.colors.length, 4, 'noisy four-colour photo: four swatches');
  for (const b of base) { const m = r.colors.find(c => Math.abs(c.r - b[0]) + Math.abs(c.g - b[1]) + Math.abs(c.b - b[2]) < 24); check(!!m, 'found ' + b, hexes(r).join(' ')); if (m) near(m.share, .25, .01, 'share of ' + b); }
  r = C.extract(noisy, 200, 200, 12); check(r.colors.length >= 4, 'asking twelve of a noisy four-colour photo keeps at least the four');
  // every swatch is a colour present in the image
  for (let t = 0; t < 20; t++) {
    const w = 30 + Math.floor(rnd() * 90), h = 30 + Math.floor(rnd() * 90), d = img(w, h, () => [Math.floor(rnd() * 256), Math.floor(rnd() * 256), Math.floor(rnd() * 256), rnd() < .1 ? 0 : 255]);
    const set = new Set(); for (let i = 0; i < d.length; i += 4) if (d[i + 3] >= 128) set.add(d[i] << 16 | d[i + 1] << 8 | d[i + 2]);
    const q = C.extract(d, w, h, 1 + (t % 12));
    check(q.colors.every(c => set.has(c.r << 16 | c.g << 8 | c.b)), 'random image ' + t + ': every swatch is a real pixel colour');
    near(q.colors.reduce((a, c) => a + c.share, 0), 1, 1e-9, 'random image ' + t + ': shares sum to 1');
    check(q.colors.every((c, i) => i === 0 || q.colors[i - 1].share >= c.share), 'sorted largest first');
  }
  // determinism
  eq(hexes(C.extract(noisy, 200, 200, 7)), hexes(C.extract(noisy, 200, 200, 7)), 'same image, same palette');
  // speed at the largest analysis size
  const big = img(800, 800, (x, y) => [(x * 7 + y) & 255, (y * 3) & 255, (x ^ y) & 255]);
  const t0 = Date.now(); r = C.extract(big, 800, 800, 12); const ms = Date.now() - t0;
  check(ms < 3000, '800x800 noisy image at 12 colours in under 3 s (worker)', ms + ' ms'); console.log(`  (800x800, 12 colours: ${ms} ms)`);
  eq(C.fitSize(4000, 3000), {w: 800, h: 600}, 'fit 4000x3000 -> 800x600'); eq(C.fitSize(300, 20), {w: 300, h: 20}, 'small images keep their size');
  eq(C.fitSize(100000, 10), {w: 800, h: 1}, 'extreme panorama keeps at least one row'); eq(C.fitSize(0, 5), {w: 0, h: 0}, 'zero size');
  // sorting
  const cols = [{r: 0, g: 0, b: 0, share: .5}, {r: 255, g: 255, b: 255, share: .2}, {r: 255, g: 0, b: 0, share: .3}];
  eq(C.sortColors(cols, 'light').map(C.hex), ['#ffffff', '#ff0000', '#000000'], 'light to dark');
  eq(C.sortColors(cols, 'share').map(C.hex), ['#000000', '#ff0000', '#ffffff'], 'by share');
  eq(C.sortColors(cols, 'hue').map(C.hex), ['#ff0000', '#ffffff', '#000000'], 'by hue, greys last light to dark');
}

if (suites.includes('marks')) {
  section('marks');
  const d = img(120, 80, (x, y) => (x > 20 && x < 70 && y > 20 && y < 60) ? [200, 30, 30] : [240, 240, 240]);
  const r = C.extract(d, 120, 80, 5), red = r.colors.find(c => c.r === 200);
  check(red.x > 30 && red.x < 60 && red.y > 28 && red.y < 52, 'marker inside the red patch, away from its edge', `${red.x},${red.y}`);
  for (let t = 0; t < 10; t++) {
    const w = 60 + t * 9, h = 50 + t * 5, dd = img(w, h, (x, y) => [[10, 10, 80], [250, 200, 0], [0, 150, 90]][(x * 3 / w | 0)]);
    const q = C.extract(dd, w, h, 3);
    for (const c of q.colors) { const i = (c.y * w + c.x) * 4; eq([dd[i], dd[i + 1], dd[i + 2]], [c.r, c.g, c.b], `marker of ${C.hex(c)} sits on a pixel of that colour (${w}x${h})`); }
  }
}

if (suites.includes('exports')) {
  section('exports');
  const c = [{r: 255, g: 0, b: 0, share: .7}, {r: 0, g: 0, b: 255, share: .3}];
  eq(C.exportAs(c, 'list'), '#ff0000\n#0000ff\n', 'plain list');
  eq(C.exportAs(c, 'text'), '#ff0000 (70%)\n#0000ff (30%)\n', 'list with shares (the old page\'s "text")');
  eq(C.exportAs(c, 'css'), ':root {\n  --color-1: #ff0000; /* red, 70% */\n  --color-2: #0000ff; /* blue, 30% */\n}\n', 'css variables');
  eq(C.exportAs(c, 'css', 'rgb'), ':root {\n  --color-1: rgb(255, 0, 0); /* red, 70% */\n  --color-2: rgb(0, 0, 255); /* blue, 30% */\n}\n', 'css in rgb');
  eq(C.exportAs(c, 'scss'), '$color-1: #ff0000; // red, 70%\n$color-2: #0000ff; // blue, 30%\n', 'scss');
  eq(C.exportAs(c, 'tailwind'), "// tailwind.config.js -> theme.extend.colors\ncolors: {\n  'red': '#ff0000',\n  'blue': '#0000ff',\n}\n", 'tailwind');
  const j = JSON.parse(C.exportAs(c, 'json'));
  eq(j[0], {id: 1, name: 'red', hex: '#ff0000', rgb: 'rgb(255, 0, 0)', hsl: 'hsl(0, 100%, 50%)', oklch: 'oklch(62.8% 0.258 29.2)', percentage: 70}, 'json keeps the old fields (id, rgb, hex, hsl, percentage)');
  eq(C.exportAs(c, 'gpl'), 'GIMP Palette\nName: Image palette\nColumns: 2\n#\n255   0   0\t#ff0000 red\n  0   0 255\t#0000ff blue\n', 'gimp palette');
  eq(C.exportAs([{r: 255, g: 0, b: 0, share: .5}, {r: 254, g: 0, b: 0, share: .5}], 'tailwind').match(/'red(-2)?'/g), ["'red'", "'red-2'"], 'duplicate names made unique');
  eq(C.exportAs([], 'css'), ':root {\n\n}\n', 'empty palette does not throw');
}

if (suites.includes('settings')) {
  section('settings');
  const D = {count: 5, format: 'hex', exportKind: 'list', sort: 'share'};
  eq(C.loadSettings(null), D, 'nothing saved'); eq(C.loadSettings('{oops'), D, 'corrupt JSON'); eq(C.loadSettings('"str"'), D, 'a string');
  eq(C.loadSettings('{"count":8,"format":"oklch","exportKind":"gpl","sort":"hue"}'), {count: 8, format: 'oklch', exportKind: 'gpl', sort: 'hue'}, 'round trip');
  eq(C.loadSettings('{"count":"999","format":"<img>","exportKind":"__proto__","sort":1}'), D, 'hostile values ignored');
  eq(C.loadSettings('{"count":0}').count, 5, 'count 0 refused'); eq(C.loadSettings('{"count":12}').count, 12, 'count 12 accepted');
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
