#!/usr/bin/env node
// Test suite for tools/ascii_camera.html (ASCII Camera).
//
// Runs the page's DOM-free <script id="core"> block in Node; no browser or server. The page promises that each
// character stands for the average brightness of its patch of the picture, that the art keeps the picture's shape
// when pasted into a monospace block, and that what is copied is what the screen shows. So: luma against
// Rec. 709's coefficients; the box average against a brute-force average over hand-built pictures, including sizes
// that do not divide evenly and pictures smaller than the grid; transparency counted as empty paper; rows from the
// 1:2 cell; auto levels on a picture with outliers and on a flat one; brightness and contrast against the CSS
// Filter Effects formulas; ink-measured character choice against a brute-force nearest search; braille bit layout
// against Unicode's dot numbering and the ordered dither's grey levels; mirror and flip; text that keeps leading
// spaces, drops trailing ones and never splits an emoji; and the typed widths, custom sets and saved settings
// people bring (" 120 cols", "64,0", garbage JSON).
//
//   node test/ascii_camera.mjs              # everything
//   node test/ascii_camera.mjs braille text # named suites only
//
// Suites: luma, sample, grid, levels, tone, glyphs, braille, flip, text, colour, input, settings.

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = join(HERE, '..', 'tools', 'ascii_camera.html');
const ALL = ['luma', 'sample', 'grid', 'levels', 'tone', 'glyphs', 'braille', 'flip', 'text', 'colour', 'input', 'settings'];
const picked = process.argv.slice(2).filter(a => !a.startsWith('--'));
const suites = picked.length ? picked : ALL;

let failures = 0, passes = 0;
const check = (ok, what, detail) => { if (ok) passes++; else { failures++; console.log(`  FAIL  ${what}${detail ? '\n          ' + detail : ''}`); } };
const eq = (got, want, what) => check(JSON.stringify(got) === JSON.stringify(want), what, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
const near = (got, want, tol, what) => check(Math.abs(got - want) <= tol, what, `got ${got}, want ${want} ± ${tol}`);
const section = name => console.log(`\n=== ${name} ===`);

const html = readFileSync(PAGE, 'utf8');
const src = html.match(/<script id="core">([\s\S]*?)<\/script>/)[1];
const ctx = {module: {exports: {}}, Uint8ClampedArray, Float32Array, Float64Array, Uint16Array, Int32Array};
vm.runInNewContext(src, ctx);
const C = ctx.module.exports;

// A w×h picture from a function (x, y) → [r, g, b, a?].
function pic(w, h, f) {
  const px = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = f(x, y), o = (y * w + x) * 4;
    px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2]; px[o + 3] = c.length > 3 ? c[3] : 255;
  }
  return px;
}
const grey = v => [v, v, v];
const base = {set: 'standard', cols: 20, auto: false, bright: 0, contrast: 0, invert: false, light: false, color: 'mono', dither: true};
const conv = (px, w, h, o) => C.convert(px, w, h, Object.assign({}, base, o));
let seed = 12345;
const rnd = () => (seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296;

if (suites.includes('luma')) {
  section('luma: Rec. 709 coefficients on encoded values; sRGB decoding');
  near(C.toLinear(0.5), 0.21404, 1e-5, 'sRGB 0.5 is 21.4 % light (IEC 61966-2-1)');
  near(C.toLinear(0.04045), 0.04045 / 12.92, 1e-9, 'linear segment up to 0.04045');
  near(C.toLinear(1), 1, 1e-12, 'white stays 1');
  near(C.luma(0, 0, 0), 0, 1e-12, 'black');
  near(C.luma(255, 255, 255), 1, 1e-12, 'white');
  near(C.luma(255, 0, 0), 0.2126, 1e-12, 'red');
  near(C.luma(0, 255, 0), 0.7152, 1e-12, 'green');
  near(C.luma(0, 0, 255), 0.0722, 1e-12, 'blue');
  near(C.luma(128, 128, 128), 128 / 255, 1e-12, 'mid grey is its own value');
}

if (suites.includes('sample')) {
  section('sample: box average against brute force');
  for (let t = 0; t < 60; t++) {
    const w = 1 + Math.floor(rnd() * 37), h = 1 + Math.floor(rnd() * 29);
    const gw = 1 + Math.floor(rnd() * 12), gh = 1 + Math.floor(rnd() * 9);
    const px = pic(w, h, () => [rnd() * 255, rnd() * 255, rnd() * 255, 255]);
    const s = C.sample(px, w, h, gw, gh);
    let ok = true, msg = '';
    for (let cy = 0; cy < gh && ok; cy++) for (let cx = 0; cx < gw && ok; cx++) {
      // brute force: pixels whose index falls in [floor(i*w/gw), floor((i+1)*w/gw)), at least one pixel
      let x0 = Math.floor(cx * w / gw), x1 = Math.floor((cx + 1) * w / gw), y0 = Math.floor(cy * h / gh), y1 = Math.floor((cy + 1) * h / gh);
      x0 = Math.min(x0, w - 1); y0 = Math.min(y0, h - 1); if (x1 <= x0) x1 = x0 + 1; if (y1 <= y0) y1 = y0 + 1;
      let sl = 0, n = 0;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const o = (y * w + x) * 4; sl += C.luma(px[o], px[o + 1], px[o + 2]); n++; }
      const got = s.L[cy * gw + cx];
      if (Math.abs(got - sl / n) > 1e-5) { ok = false; msg = `${w}x${h} into ${gw}x${gh}, cell ${cx},${cy}: ${got} vs ${sl / n}`; }
    }
    check(ok, `random picture ${t}`, msg);
  }
  const half = pic(4, 2, x => grey(x < 2 ? 0 : 255));
  const s1 = C.sample(half, 4, 2, 1, 1);
  near(s1.L[0], 0.5, 1e-6, 'half black, half white averages to 0.5');
  const s2 = C.sample(pic(1, 1, () => grey(200)), 1, 1, 5, 3);
  check([...s2.L].every(v => Math.abs(v - 200 / 255) < 1e-6), 'a 1-pixel picture fills a 5×3 grid, no empty cells');
  const tr = C.sample(pic(2, 1, x => x ? [255, 0, 0, 0] : [0, 0, 255, 255]), 2, 1, 1, 1);
  near(tr.A[0], 0.5, 1e-6, 'half transparent → coverage 0.5');
  eq([tr.R[0], tr.G[0], tr.B[0]].map(Math.round), [0, 0, 255], 'colour ignores fully transparent pixels');
}

if (suites.includes('grid')) {
  section('grid: rows keep the picture\'s shape in 1:2 cells');
  eq(C.gridFor(640, 480, 80, 'standard'), {cols: 80, rows: 30, aspect: 0.5, sw: 80, sh: 30}, '640×480 at 80');
  eq(C.gridFor(1280, 720, 80, 'standard').rows, 23, '1280×720 at 80 → 22.5 rounds to 23');
  eq(C.gridFor(1280, 720, 60, 'standard').rows, 17, '1280×720 at 60');
  eq(C.gridFor(480, 640, 80, 'standard').rows, 53, 'portrait 480×640');
  eq(C.gridFor(640, 480, 80, 'braille'), {cols: 80, rows: 30, aspect: 0.5, sw: 160, sh: 120}, 'braille: 2×4 dots per character');
  eq(C.gridFor(640, 480, 40, 'moons'), {cols: 40, rows: 30, aspect: 1, sw: 40, sh: 30}, 'emoji cells are square');
  eq(C.gridFor(10000, 1, 80, 'standard').rows, 1, 'a sliver still gets one row');
  eq(C.gridFor(640, 480, 5, 'standard').cols, 20, 'cols clamp up to 20');
  eq(C.gridFor(640, 480, 9999, 'standard').cols, 240, 'cols clamp down to 240');
  eq(C.gridFor(640, 480, NaN, 'standard').cols, 80, 'NaN cols → 80');
  eq(C.gridFor(0, 0, 80, 'standard').rows, 1, 'zero-size source does not divide by zero');
}

if (suites.includes('levels')) {
  section('levels: 1st/99th percentile, flat pictures left alone');
  const L = new Float32Array(1000), A = new Float32Array(1000).fill(1);
  for (let i = 0; i < 1000; i++) L[i] = 0.3 + 0.4 * (i / 999);
  L[0] = 0; L[999] = 1; // two outliers must not set the range
  const lv = C.autoLevels(L, A);
  near(lv.lo, 0.3, 2 / 255, 'low end ignores a single black pixel');
  near(lv.hi, 0.7, 2 / 255, 'high end ignores a single white pixel');
  eq(C.autoLevels(new Float32Array(50).fill(0.5), new Float32Array(50).fill(1)), {lo: 0, hi: 1}, 'flat grey is not stretched');
  eq(C.autoLevels(new Float32Array(5).fill(0.5), new Float32Array(5).fill(0)), {lo: 0, hi: 1}, 'fully transparent picture');
  const Lt = new Float32Array([0.1, 0.9, 0.5, 0.5]), At = new Float32Array([0, 0, 1, 1]);
  eq(C.autoLevels(Lt, At), {lo: 0, hi: 1}, 'transparent pixels do not count');
}

if (suites.includes('tone')) {
  section('tone: CSS brightness() then contrast()');
  const id = {lo: 0, hi: 1};
  near(C.tone(0.5, id, 0, 0), 0.5, 1e-12, 'identity');
  near(C.tone(0.4, id, 50, 0), 0.6, 1e-12, 'brightness +50 multiplies by 1.5');
  near(C.tone(0.4, id, -50, 0), 0.2, 1e-12, 'brightness −50 halves');
  near(C.tone(0.75, id, 0, 50), 0.875, 1e-12, 'contrast +50 scales around 0.5');
  near(C.tone(0.75, id, 0, -50), 0.625, 1e-12, 'contrast −50');
  near(C.tone(0.4, id, 50, 50), (0.6 - 0.5) * 1.5 + 0.5, 1e-12, 'brightness before contrast');
  near(C.tone(0.9, id, 50, 0), 1, 1e-12, 'clamped at 1');
  near(C.tone(0.05, id, 0, 50), 0, 1e-12, 'clamped at 0');
  near(C.tone(0.5, {lo: 0.25, hi: 0.75}, 0, 0), 0.5, 1e-12, 'levels stretch: centre stays');
  near(C.tone(0.25, {lo: 0.25, hi: 0.75}, 0, 0), 0, 1e-12, 'levels stretch: low end to 0');
}

if (suites.includes('glyphs')) {
  section('glyphs: nearest ink for text sets, equal bands for the rest');
  for (const id of ['standard', 'simple', 'detailed', 'binary']) {
    const g = C.glyphsFor(id), lut = C.lutFor(id, g), ink = g.map(c => C.INK[c]);
    const lo = Math.min(...ink), hi = Math.max(...ink);
    let ok = true, msg = '';
    for (let v = 0; v < 256 && ok; v++) {
      const want = v / 255, got = (ink[lut[v]] - lo) / (hi - lo);
      for (let i = 0; i < g.length; i++) if (Math.abs((ink[i] - lo) / (hi - lo) - want) < Math.abs(got - want) - 1e-9) { ok = false; msg = `${id} level ${v}: chose ${JSON.stringify(g[lut[v]])}, ${JSON.stringify(g[i])} is nearer`; break; }
    }
    check(ok, `${id}: every level picks the nearest ink`, msg);
    eq(g[lut[0]], ' ', `${id}: no ink → space`);
    eq(lut[255], ink.indexOf(hi), `${id}: full ink → the inkiest character`);
    let mono = true; for (let v = 1; v < 256; v++) if (ink[lut[v]] < ink[lut[v - 1]]) mono = false;
    check(mono, `${id}: more brightness never means less ink`);
  }
  eq(C.glyphsFor('detailed').length, 69, 'detailed set has 69 characters');
  eq(C.glyphsFor('standard').join(''), ' .,:;i1tfLCG08@', 'standard set unchanged');
  eq(C.glyphsFor('moons'), ['🌑', '🌘', '🌗', '🌖', '🌕'], 'moons are whole emoji, not surrogate halves');
  const bl = C.lutFor('blocks', C.glyphsFor('blocks'));
  eq([0, 50, 52, 101, 103, 152, 154, 203, 204, 255].map(v => C.glyphsFor('blocks')[bl[v]]).join(''), '  ░░▒▒▓▓██', 'blocks: five equal bands');
  // whole conversions, light-on-dark paper, auto levels off
  const one = (v, o) => { const r = conv(pic(2, 2, () => grey(v)), 2, 2, Object.assign({cols: 20}, o)); return r.glyphs[r.idx[0]]; };
  eq(one(0), ' ', 'black on dark paper → blank');
  eq(one(255), '@', 'white on dark paper → @');
  eq(one(0, {light: true}), '@', 'black on light paper → @');
  eq(one(255, {light: true}), ' ', 'white on light paper → blank');
  eq(one(255, {invert: true}), ' ', 'invert flips dark paper');
  eq(one(0, {light: true, invert: true}), ' ', 'invert flips light paper');
  eq(one(255, {set: 'moons'}), '🌕', 'moons: bright → full moon');
  eq(one(0, {set: 'moons', light: true}), '🌑', 'moons ignore paper: dark → new moon');
  eq(conv(pic(2, 2, () => [255, 255, 255, 0]), 2, 2, {cols: 20}).text, '\n'.repeat(9), 'transparent picture → ten empty lines, trailing spaces gone');
  const auto = conv(pic(20, 1, x => grey(100 + x * 3)), 20, 1, {cols: 20, auto: true});
  eq([auto.text[0], auto.text.trimEnd().slice(-1)], [' ', '@'], 'auto levels: a dull ramp still spans blank to @');
}

if (suites.includes('braille')) {
  section('braille: Unicode dot numbering and ordered dither');
  // light the single dot at (dx, dy) of one character; 2×4 picture → 1 braille char at cols 20? use a 40×4 picture → 20 chars
  const bits = [];
  for (let dy = 0; dy < 4; dy++) for (let dx = 0; dx < 2; dx++) {
    const o = conv(pic(40, 4, (x, y) => grey(x === dx && y === dy ? 255 : 0)), 40, 4, {set: 'braille', cols: 20, dither: false});
    bits.push(o.idx[0]);
  }
  eq(bits, [0x01, 0x08, 0x02, 0x10, 0x04, 0x20, 0x40, 0x80], 'dots 1,4,2,5,3,6,7,8 in reading order');
  const full = conv(pic(40, 4, () => grey(255)), 40, 4, {set: 'braille', cols: 20});
  eq(full.text, '⣿'.repeat(20), 'white → all eight dots');
  const none = conv(pic(40, 4, () => grey(0)), 40, 4, {set: 'braille', cols: 20});
  eq(none.text, '⠀'.repeat(20), 'black → blank braille U+2800, not spaces, so lines keep their width');
  for (const v of [64, 128, 192]) {
    const o = conv(pic(160, 16, () => grey(v)), 160, 16, {set: 'braille', cols: 80});
    let on = 0; for (const b of o.idx) for (let k = 0; k < 8; k++) on += (b >> k) & 1;
    near(on / (o.idx.length * 8), C.toLinear(v / 255), 1 / 16, `dithered grey ${v} lights its linear-light share of the dots`);
  }
  const th = conv(pic(40, 4, () => grey(200)), 40, 4, {set: 'braille', cols: 20, dither: false});
  eq(th.idx[0], 0xff, 'dither off: above half → dot on');
}

if (suites.includes('flip')) {
  section('flip: mirror and upside down');
  const p = pic(40, 20, x => grey(x < 20 ? 0 : 255)); // left black, right white
  const a = conv(p, 40, 20, {cols: 20}), b = conv(p, 40, 20, {cols: 20, flipH: true});
  const row = o => o.text.split('\n')[0];
  check(row(a).startsWith(' ') && row(a).endsWith('@'), 'unflipped: blank left, @ right', row(a));
  check(row(b).startsWith('@'), 'mirrored: @ left', row(b));
  const q = pic(20, 40, (x, y) => grey(y < 20 ? 255 : 0));
  const c = conv(q, 20, 40, {cols: 20, flipV: true}).text.split('\n');
  check(c[0].trim() === '' && c[c.length - 1].startsWith('@'), 'flipped: bright rows at the bottom');
}

if (suites.includes('text')) {
  section('text: lines, trailing spaces, emoji');
  const p = pic(20, 20, x => grey(x < 10 ? 255 : 0));
  const t = conv(p, 20, 20, {cols: 20});
  eq(t.text.split('\n').length, 10, 'one line per row, no trailing newline');
  check(t.text.split('\n').every(l => l === '@'.repeat(10)), 'trailing blanks dropped');
  const lead = conv(pic(20, 20, x => grey(x < 10 ? 0 : 255)), 20, 20, {cols: 20}).text.split('\n')[0];
  eq(lead, ' '.repeat(10) + '@'.repeat(10), 'leading blanks kept');
  const m = conv(pic(20, 20, () => grey(255)), 20, 20, {set: 'moons', cols: 20}).text.split('\n')[0];
  eq(Array.from(m).length, 20, 'emoji line has 20 whole emoji');
  check(!/[\ud800-\udfff]/.test(m.replace(/[\ud800-\udbff][\udc00-\udfff]/g, '')), 'no lone surrogates');
  const det = conv(pic(69, 2, x => grey(x * 255 / 68)), 69, 2, {set: 'detailed', cols: 69});
  check(det.text.includes('<') || det.text.includes('>') || det.text.includes('&'), 'markup characters survive as text');
}

if (suites.includes('colour')) {
  section('colour modes');
  const red = pic(4, 4, () => [200, 40, 40]);
  const c = conv(red, 4, 4, {cols: 20, color: 'color'});
  eq([c.rgb[0], c.rgb[1], c.rgb[2]], [255, 51, 51], 'colour lifts toward full value, hue kept');
  const dark = conv(pic(4, 4, () => [20, 10, 5]), 4, 4, {cols: 20, color: 'color'});
  eq([dark.rgb[0], dark.rgb[1], dark.rgb[2]], [40, 20, 10], 'lift is at most ×2');
  const cells = conv(red, 4, 4, {cols: 20, color: 'cells'});
  eq([cells.rgb[0], cells.rgb[1], cells.rgb[2]], [200, 40, 40], 'colour cells keep the true colour');
  const g = v => { const o = conv(pic(2, 2, () => grey(v)), 2, 2, {cols: 20, color: 'gradient'}); return [o.rgb[0], o.rgb[1], o.rgb[2]]; };
  eq(g(0), [0x3b, 0x82, 0xf6], 'gradient: black → first colour');
  eq(g(255), [0x06, 0xb6, 0xd4], 'gradient: white → last colour');
  eq(g(128), [0xf5, 0x9e, 0x0b], 'gradient: mid grey → fifth colour');
  eq(g(223), [0x10, 0xb9, 0x81], 'gradient: 223 → seventh (last colour no longer needs exactly 255)');
  const mono = conv(red, 4, 4, {cols: 20, color: 'mono'});
  eq(mono.rgb[0], 0, 'mono skips colour work');
}

if (suites.includes('input')) {
  section('input: widths and custom sets people type');
  eq(C.parseCols('80').value, 80, '80');
  eq(C.parseCols(' 120 cols ').value, 120, '" 120 cols "');
  eq(C.parseCols('64,0').value, 64, 'decimal comma');
  eq(C.parseCols('99.6').value, 100, 'rounds');
  eq(C.parseCols('+40').value, 40, 'plus sign');
  for (const bad of ['', '   ', 'abc', '-80', '19', '241', '1e3', '٨٠', null]) check(!!C.parseCols(bad).error, `rejects ${JSON.stringify(bad)}`, JSON.stringify(C.parseCols(bad)));
  check(/20 to 240/.test(C.parseCols('500').error), 'error says what is accepted');
  eq(C.parseCustom(' .oO@').value, [' ', '.', 'o', 'O', '@'], 'custom set split into characters');
  eq(C.parseCustom(' ░\n█').value, [' ', '░', '█'], 'line breaks dropped');
  eq(C.parseCustom('ÄÖÜ').value, ['Ä', 'Ö', 'Ü'], 'non-ASCII letters fine');
  for (const bad of ['', 'a', 'aaaa', '🙂🙃', 'x'.repeat(101)]) check(!!C.parseCustom(bad).error, `custom rejects ${JSON.stringify(bad).slice(0, 20)}`);
  // 188 is half of the light in linear terms, so it lands in the middle band
  const cu = conv(pic(3, 1, x => grey([0, 188, 255][x])), 3, 1, {set: 'custom', custom: '.oO', cols: 21});
  eq(cu.text.split('\n')[0], '.'.repeat(7) + 'o'.repeat(7) + 'O'.repeat(7), 'custom set goes by its order; a 3-pixel picture splits evenly over 21 columns');
  const lin = conv(pic(3, 1, x => grey([0, 188, 255][x])), 3, 1, {set: 'custom', custom: '.oO', cols: 21, linear: false});
  eq(lin.text.split('\n')[0], '.'.repeat(7) + 'O'.repeat(14), 'without the linear-light step, 188 would read as near full ink');
  eq(C.glyphsFor('custom', 'x').join(''), ' .,:;i1tfLCG08@', 'an invalid custom set falls back to standard');
}

if (suites.includes('settings')) {
  section('settings: saved JSON trusted for nothing');
  eq(C.cleanSettings(null), C.DEFAULTS, 'nothing saved → defaults');
  eq(C.cleanSettings('{not json'), C.DEFAULTS, 'broken JSON → defaults');
  eq(C.cleanSettings('[1,2]'), C.DEFAULTS, 'array → defaults');
  const s = C.cleanSettings(JSON.stringify({set: 'braille', cols: '120', bright: 99, contrast: -7.6, paper: 'amber', color: 'cells', invert: true, flipH: 'yes', custom: 'a'}));
  eq([s.set, s.cols, s.bright, s.contrast, s.paper, s.color, s.invert, s.flipH, s.custom], ['braille', 120, 50, -8, 'amber', 'cells', true, false, ' .:-=+*#%@'], 'values clamped, bad ones dropped');
  eq(C.cleanSettings({set: '__proto__', paper: 'constructor', color: 'toString'}).set, 'standard', 'prototype keys are not sets');
  eq(C.cleanSettings({paper: 'constructor'}).paper, 'dark', 'prototype keys are not papers');
  eq(C.fileName(new Date(2026, 1, 9, 7, 5, 3), 'png'), 'ascii-art-2026-02-09-070503.png', 'file name');
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
