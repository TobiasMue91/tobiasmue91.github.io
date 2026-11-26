#!/usr/bin/env node
// Test suite for tools/image_to_ascii_converter.html (Image to ASCII Converter).
//
// Runs the page's DOM-free <script id="core"> block in Node. The page promises that each character stands
// for how light that patch of the picture looks, at a shape that keeps the picture's proportions in a
// monospace font, and that what is copied is exactly what is shown. So: sRGB decoding and CIE L* against the
// published formulas and reference values; the box filter against brute-force area averages (weights sum to
// one, means are preserved); grid sizes and the row cap; the mapping from lightness to ramp on both
// backgrounds, with transparency always blank; auto levels, contrast, brightness and invert in the right
// direction; braille dot bits against the Unicode chart and dither densities; ramps quoted exactly from
// Paul Bourke; custom ramps read by code point; cell colours averaged in linear light; the widths people type;
// exports escaped; saved settings that trust nothing.
//
//   node test/image_to_ascii_converter.mjs             # everything
//   node test/image_to_ascii_converter.mjs braille     # named suites only
//
// Suites: srgb, filter, grid, mapping, adjust, braille, ramps, colour, widths, output, settings.

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = join(HERE, '..', 'tools', 'image_to_ascii_converter.html');
const ALL = ['srgb', 'filter', 'grid', 'mapping', 'adjust', 'braille', 'ramps', 'colour', 'widths', 'output', 'settings'];
const picked = process.argv.slice(2).filter(a => !a.startsWith('--'));
const suites = picked.length ? picked : ALL;

let failures = 0, passes = 0;
const check = (ok, what, detail) => { if (ok) passes++; else { failures++; console.log(`  FAIL  ${what}${detail ? '\n          ' + detail : ''}`); } };
const eq = (got, want, what) => check(JSON.stringify(got) === JSON.stringify(want), what, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
const near = (got, want, tol, what) => check(Math.abs(got - want) <= tol, what, `got ${got}, want ${want} ± ${tol}`);
const section = name => console.log(`\n=== ${name} ===`);

const html = readFileSync(PAGE, 'utf8');
const src = html.match(/<script id="core">([\s\S]*?)<\/script>/)[1];
const ctx = {module: {exports: {}}, Uint8ClampedArray, Float32Array, Uint8Array, Math, JSON, Array, String, Number, Object};
vm.runInNewContext(src, ctx);
const A = ctx.module.exports;

// ---- image helpers ----
function img(w, h, f) {   // f(x, y) -> [r, g, b, a]
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) d.set(f(x, y), (y * w + x) * 4);
  return d;
}
const solid = (w, h, rgba) => img(w, h, () => rgba);
const conv = (d, w, h, o) => A.convert(d, w, h, o);
const chars = s => Array.from(s);
let seed = 7;
const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);

if (suites.includes('srgb')) {
  section('srgb');
  // IEC 61966-2-1: 0 -> 0, 255 -> 1, 128 -> 0.2158605, the 0.04045 knee continuous.
  near(A.LIN[0], 0, 1e-9, 'sRGB 0 decodes to 0');
  near(A.LIN[255], 1, 1e-6, 'sRGB 255 decodes to 1');
  near(A.LIN[128], 0.2158605, 1e-6, 'sRGB 128 decodes to 0.2158605');
  near(A.LIN[10], 10 / 255 / 12.92, 1e-7, 'sRGB 10 is on the linear segment');
  let mono = true; for (let i = 1; i < 256; i++) if (!(A.LIN[i] > A.LIN[i - 1])) mono = false;
  check(mono, 'decoding table strictly increases');
  let round = true; for (let i = 0; i < 256; i++) if (A.linToSrgb8(A.LIN[i]) !== i) round = false;
  check(round, 'every 8-bit value survives decode then encode');
  // CIE 15: L* = 116 Y^(1/3) - 16 above (6/29)^3, linear below; mid grey Y=0.18 is L* 49.496.
  near(A.lstar(1), 1, 1e-9, 'L* of white is 100');
  near(A.lstar(0), 0, 1e-9, 'L* of black is 0');
  near(A.lstar(0.18) * 100, 49.496, 0.001, 'L* of 18% grey is 49.496');
  near(A.lstar(0.5) * 100, 76.0693, 0.001, 'L* of Y 0.5 is 76.069');
  const e = 216 / 24389;
  near(A.lstar(e - 1e-9), A.lstar(e + 1e-9), 1e-6, 'L* is continuous at the knee');
  near(A.lstar(0.001) * 100, 0.001 * 24389 / 27, 1e-6, 'L* below the knee is Y·903.3');
}

if (suites.includes('filter')) {
  section('filter');
  for (const [sn, dn] of [[7, 3], [3, 7], [10, 10], [1600, 80], [1, 5], [5, 1], [997, 13]]) {
    const w = A.boxWeights(sn, dn);
    let sums = true, brute = true;
    for (let d = 0; d < dn; d++) {
      let s = 0; for (let k = 0; k < w[d].length; k += 2) s += w[d][k + 1];
      if (Math.abs(s - 1) > 1e-9) sums = false;
      // brute force: overlap of [d*sn/dn, (d+1)*sn/dn) with each [s, s+1)
      const a = d * sn / dn, b = (d + 1) * sn / dn;
      for (let s2 = 0; s2 < sn; s2++) {
        const ov = Math.max(0, Math.min(b, s2 + 1) - Math.max(a, s2)) / (sn / dn);
        let got = 0; for (let k = 0; k < w[d].length; k += 2) if (w[d][k] === s2) got += w[d][k + 1];
        if (Math.abs(got - ov) > 1e-9) brute = false;
      }
    }
    check(sums, `box weights ${sn}->${dn} sum to 1 per output`);
    check(brute, `box weights ${sn}->${dn} equal the exact overlaps`);
  }
  // The mean of a plane is preserved by any resample.
  for (const [sw, sh, dw, dh] of [[37, 23, 8, 5], [9, 9, 4, 4], [5, 3, 11, 7], [120, 1, 7, 1]]) {
    const p = new Float32Array(sw * sh).map(() => rnd());
    const [r] = A.resample([p], sw, sh, dw, dh);
    const m1 = p.reduce((a, b) => a + b, 0) / p.length, m2 = r.reduce((a, b) => a + b, 0) / r.length;
    near(m2, m1, 1e-5, `resample ${sw}x${sh}->${dw}x${dh} keeps the mean`);
  }
  const [c] = A.resample([new Float32Array([0, 1, 1, 0])], 2, 2, 1, 1);
  near(c[0], 0.5, 1e-7, '2x2 checker averages to 0.5');
  // Averaging happens in linear light: a 1-pixel black/white checker is not sRGB 128 grey but L* 76.
  const chk = img(4, 4, (x, y) => ((x + y) & 1 ? [255, 255, 255, 255] : [0, 0, 0, 255]));
  const pl = A.resample(A.planes(chk, 4, 4, false), 4, 4, 1, 1);
  near(pl[0][0], 0.5, 1e-6, 'black/white checker averages to Y 0.5 in linear light');
}

if (suites.includes('grid')) {
  section('grid');
  eq((({cols, rows}) => [cols, rows])(A.grid(800, 600, 80, 'simple', 0.5)), [80, 30], '800x600 at 80 columns is 30 rows');
  eq(A.grid(100, 100, 40, 'simple', 0.5).rows, 20, 'a square at 40 columns is 20 rows');
  eq(A.grid(4000, 10, 80, 'simple', 0.5).rows, 1, 'a 4000x10 strip still gets one row (the old page threw)');
  eq(A.grid(1, 1, 60, 'simple', 0.5).rows, 30, '1x1 at 60 columns is 30 rows');
  const tall = A.grid(10, 1000, 80, 'simple', 0.5);
  check(tall.rows <= A.LIMITS.maxRows && tall.limited, 'a 10x1000 strip is narrowed to stay within the row cap', JSON.stringify(tall));
  eq(tall.cols, 20, 'the 10x1000 strip at 80 asked becomes 20 columns');
  check(!A.grid(800, 600, 400, 'simple', 0.5).limited, 'an ordinary photo at 400 columns is not limited');
  const b = A.grid(800, 600, 80, 'braille', 0.5);
  eq([b.dw, b.dh, b.rows], [160, 120, 30], 'braille 800x600 at 80: 160x120 dots, 30 rows');
  near((b.dw / b.dh) / (800 / 600), 1, 1e-9, 'braille dots keep the picture\'s ratio (square dots)');
  const b2 = A.grid(100, 99, 10, 'braille', 0.5);
  eq(b2.rows, Math.ceil(b2.dh / 4), 'braille rows round up so no dot row is lost');
}

if (suites.includes('mapping')) {
  section('mapping');
  const W = [255, 255, 255, 255], K = [0, 0, 0, 255], T0 = [0, 0, 0, 0], T1 = [255, 255, 255, 0];
  const o = {cols: 10, style: 'simple', auto: false};
  const white = conv(solid(4, 4, W), 4, 4, o), black = conv(solid(4, 4, K), 4, 4, o);
  eq(white.lines[0], '@@@@@@@@@@', 'white on a dark background is the densest glyph');
  eq(black.lines, ['', '', '', '', ''], 'black on a dark background is blank (trailing spaces trimmed)');
  eq(white.rows, 5, 'line count holds even when lines are blank');
  eq(conv(solid(4, 4, W), 4, 4, {...o, bg: 'light'}).lines[0], '', 'white on a light background is blank');
  eq(conv(solid(4, 4, K), 4, 4, {...o, bg: 'light'}).lines[0], '@@@@@@@@@@', 'black on a light background is dense');
  for (const bg of ['dark', 'light']) for (const t of [T0, T1]) for (const inv of [false, true]) {
    const r = conv(solid(5, 5, t), 5, 5, {...o, bg, invert: inv, brightness: 50, auto: true});
    check(r.lines.every(l => l === ''), `transparent (${t.join(',')}) is blank on ${bg}${inv ? ', inverted' : ''}, brightened`);
  }
  // 18% grey (sRGB 118) is L* 49.5 -> ink 0.495 -> index 4 of 10 in either direction ("=" / "+").
  const g118 = conv(solid(3, 3, [118, 118, 118, 255]), 3, 3, o);
  eq(g118.lines[0][0], '=', 'sRGB 118 grey (L* 49.5) maps to the 5th of 10 glyphs on dark');
  eq(conv(solid(3, 3, [118, 118, 118, 255]), 3, 3, {...o, bg: 'light'}).lines[0][0], '+', 'and the 6th on light (ink 0.505)');
  // Half-covered white cell is lighter than a full one.
  const half = conv(img(2, 2, (x) => x ? W : T0), 2, 2, {...o, cols: 1});
  const full = conv(solid(2, 2, W), 2, 2, {...o, cols: 1});
  check(A.RAMPS.simple.indexOf(half.lines[0] || ' ') < A.RAMPS.simple.indexOf(full.lines[0]), 'a half-transparent cell is lighter than a full one', `${half.lines[0]} vs ${full.lines[0]}`);
  // A left-to-right gradient never steps backwards along the ramp.
  const grad = conv(img(256, 8, (x) => [x, x, x, 255]), 256, 8, {cols: 64, style: 'detailed', auto: false});
  const idx = chars(grad.lines[0].padEnd(64)).map(ch => A.RAMPS.detailed.indexOf(ch));
  check(idx.every((v, i) => i === 0 || v >= idx[i - 1]), 'a grey gradient climbs the detailed ramp monotonically');
  check(idx[0] === 0 && idx[63] === 69, 'and runs from blank to the last glyph', JSON.stringify([idx[0], idx[63]]));
  // Each glyph of the 10 is reachable: equal bins of ink.
  const used = new Set(chars(conv(img(1000, 4, (x) => { const v = Math.round(x / 999 * 255); return [v, v, v, 255]; }), 1000, 4, {cols: 400, auto: false}).lines[0]));
  eq(used.size, 10, 'every glyph of the simple ramp is used over a full gradient');
  // Lines never exceed the width and the text is the lines joined.
  const rnd8 = img(31, 17, () => [rnd() * 255, rnd() * 255, rnd() * 255, rnd() * 255]);
  for (const style of A.STYLES) {
    const r = conv(rnd8, 31, 17, {cols: 23, style});
    check(r.lines.every(l => chars(l).length <= 23) && r.lines.length === r.rows && r.text === r.lines.join('\n'), `${style}: ${r.rows} lines of at most 23 characters, text is lines joined`);
  }
}

if (suites.includes('adjust')) {
  section('adjust');
  // A low-contrast photo (greys 100..150) gets stretched to the whole ramp by auto levels.
  const flat = img(200, 20, (x) => { const v = 100 + Math.round(x / 199 * 50); return [v, v, v, 255]; });
  const on = new Set(chars(conv(flat, 200, 20, {cols: 100}).lines[0])), off = new Set(chars(conv(flat, 200, 20, {cols: 100, auto: false}).lines[0]));
  check(on.has(' ') && on.has('@'), 'auto levels spreads 100..150 grey over blank to "@"', [...on].join(''));
  check(!off.has('@') && off.size <= 3, 'without auto levels it stays in the middle', [...off].join(''));
  // A flat image is not stretched (nothing to stretch; noise would be amplified).
  eq(conv(solid(9, 9, [128, 128, 128, 255]), 9, 9, {cols: 4}).lines[0], '++++', 'a flat grey (L* 53.6) is not stretched by auto levels');
  const base = {cols: 1, auto: false, style: 'detailed'};
  const at = o => A.RAMPS.detailed.indexOf((conv(solid(2, 2, [90, 90, 90, 255]), 2, 2, {...base, ...o}).lines[0] || ' ')[0]);
  check(at({brightness: 40}) > at({}) && at({}) > at({brightness: -40}), 'brightness raises ink on dark');
  const atL = o => A.RAMPS.detailed.indexOf((conv(solid(2, 2, [200, 200, 200, 255]), 2, 2, {...base, ...o}).lines[0] || ' ')[0]);
  check(atL({contrast: 60}) > atL({}) && atL({contrast: -60}) < atL({}), 'contrast pushes a light grey further from the middle');
  eq(conv(solid(2, 2, [255, 255, 255, 255]), 2, 2, {cols: 3, invert: true}).lines[0], '', 'invert makes white blank on dark');
  eq(conv(solid(2, 2, [0, 0, 0, 255]), 2, 2, {cols: 3, invert: true}).lines[0], '@@@', 'invert makes black dense on dark');
  const logo = img(40, 40, (x, y) => (Math.hypot(x - 20, y - 20) < 12 ? [10, 10, 10, 255] : [0, 0, 0, 0]));
  check(conv(logo, 40, 40, {cols: 20}).faint, 'a black logo on transparency is flagged faint on a dark background');
  check(!conv(logo, 40, 40, {cols: 20, invert: true}).faint, 'and not once inverted');
  check(!conv(logo, 40, 40, {cols: 20, bg: 'light'}).faint, 'nor on a light background');
  check(!conv(solid(9, 9, [0, 0, 0, 255]), 9, 9, {cols: 9}).faint, 'an all-black opaque photo is not flagged (nothing transparent to compare with)');
  eq(conv(solid(2, 2, [0, 0, 0, 255]), 2, 2, {cols: 3, contrast: -100, brightness: 0, auto: false}).lines[0], '---', 'contrast -100 squeezes black toward the middle, not to blank');
}

if (suites.includes('braille')) {
  section('braille');
  // Unicode chart: dots 1,2,3,7 down the left column, 4,5,6,8 down the right.
  const want = [[0, 0, 0x2801], [0, 1, 0x2802], [0, 2, 0x2804], [0, 3, 0x2840], [1, 0, 0x2808], [1, 1, 0x2810], [1, 2, 0x2820], [1, 3, 0x2880]];
  for (const [dx, dy, cp] of want) {
    const d = img(2, 4, (x, y) => (x === dx && y === dy ? [255, 255, 255, 255] : [0, 0, 0, 255]));
    const r = conv(d, 2, 4, {cols: 1, style: 'braille', auto: false, dither: false});
    eq(r.lines[0].codePointAt(0).toString(16), cp.toString(16), `dot at column ${dx}, row ${dy} is U+${cp.toString(16).toUpperCase()}`);
  }
  eq(conv(solid(8, 8, [255, 255, 255, 255]), 8, 8, {cols: 4, style: 'braille'}).lines[0], '\u28ff'.repeat(4), 'white is all eight dots');
  eq(conv(solid(8, 8, [0, 0, 0, 255]), 8, 8, {cols: 4, style: 'braille'}).lines[0], A.BRAILLE_BLANK.repeat(4), 'black is the blank braille cell U+2800, kept so pasted art does not collapse');
  const dens = (v, dither) => {
    const r = conv(solid(200, 200, [v, v, v, 255]), 200, 200, {cols: 50, style: 'braille', auto: false, dither});
    let on = 0, all = 0;
    for (const l of r.lines) for (const ch of l) { const b = ch.codePointAt(0) - 0x2800; for (let k = 0; k < 8; k++) on += (b >> k) & 1; all += 8; }
    return on / all;
  };
  // sRGB 118 is L* 49.5: about half the dots, Atkinson loses some error at the edges so allow a margin.
  near(dens(118, true), 0.495, 0.06, 'dithered 18% grey sets about half the dots');
  near(dens(188, true), A.lstar(A.LIN[188]), 0.06, 'dithered sRGB 188 grey sets dots in proportion to its L*');
  eq(dens(118, false), 0, 'undithered, a grey just below the middle sets no dots');
  eq(dens(122, false), 1, 'undithered, a grey just above sets all of them');
  const odd = conv(solid(3, 5, [255, 255, 255, 255]), 3, 5, {cols: 3, style: 'braille'});
  check(odd.lines.every(l => chars(l).length === 3), 'braille lines keep their full width (no trimming)');
}

if (suites.includes('ramps')) {
  section('ramps');
  // Paul Bourke, "Character representation of grey scale images": dense to light, reversed here.
  const bourke = '$@B%8&WM#*oahkbdpqwmZO0QLCJUYXzcvunxrjft/\\|()1{}[]?-_+~<>i!lI;:,"^`\'. ';
  eq(bourke.length, 70, 'Bourke\'s long ramp has 70 levels');
  eq(A.RAMPS.detailed, [...bourke].reverse().join(''), 'detailed is Bourke\'s 70 levels, light to dense');
  eq(A.RAMPS.simple, ' .:-=+*#%@', 'simple is Bourke\'s 10 levels, light to dense');
  eq(A.RAMPS.blocks, ' \u2591\u2592\u2593\u2588', 'blocks are space, light, medium, dark shade, full block');
  eq(A.customRamp('😀🙂'), [' ', ' '].length ? ['😀', '🙂'] : null, 'a custom ramp keeps emoji whole (the old page split them)');
  eq(A.customRamp('X'), [' ', 'X'], 'one custom character means "this or blank"');
  eq(A.customRamp(''), [...' .:-=+*#%@'], 'an empty custom ramp falls back to simple');
  eq(A.customRamp(' .\no\t#'), [' ', '.', 'o', '#'], 'tabs and newlines are dropped from a custom ramp');
  eq(A.customRamp('é́ab').length, 4, 'combining marks count as their own code points, nothing is split mid-surrogate');
  const r = conv(img(3, 1, (x) => [x * 127, x * 127, x * 127, 255]), 3, 1, {cols: 6, style: 'custom', custom: 'AB', auto: false});
  check(/^A+B+$/.test(r.lines[0]), 'custom "AB": first character for the background, last for the strongest', r.lines[0]);
  const e = conv(solid(2, 2, [255, 255, 255, 255]), 2, 2, {cols: 4, style: 'custom', custom: '😀🙂'});
  eq(e.lines[0], '🙂🙂🙂🙂', 'emoji ramp output is whole emoji');
}

if (suites.includes('colour')) {
  section('colour');
  const red = conv(solid(4, 4, [255, 0, 0, 255]), 4, 4, {cols: 2, colour: 'colour'});
  eq(red.colours[0], [255, 0, 0], 'a red cell is reported red');
  const mix = conv(img(2, 1, (x) => (x ? [0, 0, 255, 255] : [255, 0, 0, 255])), 2, 1, {cols: 1, colour: 'colour'});
  eq(mix.colours[0], [188, 0, 188], 'red and blue average in linear light to (188,0,188), not (128,0,128)');
  const g = conv(solid(4, 4, [255, 0, 0, 255]), 4, 4, {cols: 2, colour: 'gray'});
  eq(g.colours[0], [127, 127, 127], 'grey mode gives the luminance of red (Y 0.2126 -> sRGB 127)');
  const t = conv(solid(4, 4, [255, 0, 0, 0]), 4, 4, {cols: 2, colour: 'colour'});
  eq(t.colours[0], null, 'a transparent cell has no colour');
  const semi = conv(img(2, 1, (x) => (x ? [0, 255, 0, 0] : [255, 0, 0, 255])), 2, 1, {cols: 1, colour: 'colour'});
  eq(semi.colours[0], [255, 0, 0], 'a transparent pixel\'s hidden colour does not bleed into its neighbour');
  const br = conv(solid(16, 16, [10, 200, 30, 255]), 16, 16, {cols: 4, style: 'braille', colour: 'colour'});
  eq([br.colours.length, br.colours[0]], [br.cols * br.rows, [10, 200, 30]], 'braille gets one colour per character, the cell\'s average');
  eq(conv(solid(4, 4, [255, 0, 0, 255]), 4, 4, {cols: 2}).colours, undefined, 'no colour work when colour is off');
}

if (suites.includes('widths')) {
  section('widths');
  const ok = {'80': 80, ' 120 ': 120, '80 cols': 80, '100 chars': 100, '60 characters': 60, '40c': 40, '72.4': 72, '72,6': 73, '+90': 90, '4': 4, '400': 400, '1 2 0': 120};
  for (const [s, v] of Object.entries(ok)) eq(A.parseCols(s).value, v, `"${s}" reads as ${v}`);
  for (const s of ['', '   ', 'abc', '80px', '1e3', '--5', 'NaN', '٨٠']) check(A.parseCols(s).error && A.parseCols(s).value === undefined, `"${s}" is refused with a reason`, JSON.stringify(A.parseCols(s)));
  const big = A.parseCols('9000'), small = A.parseCols('2'), thou = A.parseCols('1,000');
  check(big.error.includes('400') && big.clamp === 400, '9000 is refused, saying 400 is the most, and clamps there on leaving the field');
  check(small.error.includes('4') && small.clamp === 4, '2 is refused, saying 4 is the least');
  eq(thou.clamp, 400, '"1,000" is a thousand (and so too wide), not 1');
  eq(A.parseCols('-5').clamp, 4, 'a negative width is refused and clamps to the least');
  eq(A.options({cols: 1e9}).cols, 400, 'options clamp a huge width');
  eq(A.options({cols: 'x'}).cols, 80, 'options give 80 for nonsense');
}

if (suites.includes('output')) {
  section('output');
  eq(A.fenced('a\nb'), '```\na\nb\n```', 'code block fences on their own lines');
  const res = conv(solid(2, 2, [255, 255, 255, 255]), 2, 2, {cols: 3, style: 'custom', custom: ' <&'});
  const h = A.toHtml(res, 'a<b>&c');
  check(h.includes('&lt;b&gt;&amp;c</title>') && h.includes('&amp;&amp;&amp;') && !h.includes('<b>'), 'html export escapes the title and the art');
  check(h.startsWith('<!doctype html>') && h.includes('charset="utf-8"'), 'html export is a complete UTF-8 page');
  const col = conv(img(4, 2, (x) => (x < 2 ? [255, 0, 0, 255] : [0, 0, 255, 255])), 4, 2, {cols: 4, colour: 'colour', auto: false});
  const ch = A.toHtml(col);
  eq((ch.match(/<span/g) || []).length, col.rows * 2, 'colour html: one span per run of equal colour, not per character');
  const text = ch.replace(/<span[^>]*>|<\/span>/g, '').match(/<pre[^>]*>([\s\S]*)<\/pre>/)[1];
  eq(text, col.text, 'colour html shows exactly the copied text');
  const brl = conv(solid(4, 4, [255, 255, 255, 255]), 4, 4, {cols: 2, style: 'braille', colour: 'colour'});
  check(A.toHtml(brl).includes('\u28ff\u28ff'), 'braille html keeps its glyphs');
  eq(A.baseName('C:\\pics\\My Cat (2).JPG'), 'My-Cat-2-ascii', 'file name from a Windows path');
  eq(A.baseName('.png'), 'image-ascii', 'nameless file gets a default');
  eq(A.baseName('köln.webp'), 'k-ln-ascii', 'names are reduced to safe characters');
}

if (suites.includes('settings')) {
  section('settings');
  const d = A.loadSettings(null);
  eq([d.cols, d.style, d.bg, d.auto, d.invert, d.colour, d.dither], [80, 'simple', 'dark', true, false, 'none', true], 'no saved settings give the defaults');
  for (const raw of ['{', '"x"', '[]', 'null', '{"cols":"<script>","style":"evil","bg":3,"contrast":"9e9","custom":42}']) {
    const s = A.loadSettings(raw);
    check(s.cols === 80 && A.STYLES.includes(s.style) && (s.bg === 'dark' || s.bg === 'light') && s.contrast <= 100 && typeof s.custom === 'string', `garbage ${raw} gives sane settings`);
  }
  const s = A.loadSettings(JSON.stringify({cols: 120, style: 'braille', bg: 'light', invert: true, contrast: 30, brightness: -20, auto: false, colour: 'gray', custom: 'ab'}));
  eq([s.cols, s.style, s.bg, s.invert, s.contrast, s.brightness, s.auto, s.colour, s.custom], [120, 'braille', 'light', true, 30, -20, false, 'gray', 'ab'], 'saved settings come back as saved');
  eq(A.loadSettings(JSON.stringify({custom: 'x'.repeat(5000)})).custom.length, 200, 'a huge custom ramp is cut to 200 characters');
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
