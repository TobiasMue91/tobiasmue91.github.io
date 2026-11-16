#!/usr/bin/env node
// Test suite for tools/photo_filter_editor.html (Photo Filter Editor).
//
// Runs the page's DOM-free <script id="core"> block in Node. The page promises that the file it saves is the photo you
// see, at the photo's own size, turned the way the screen shows. So: "Original" with every slider at zero leaves every
// byte alone; sepia and black & white follow the Filter Effects 1 matrices; exposure is stops of linear light under the
// sRGB transfer function (IEC 61966-2-1); saturation −100 is a true luminance grey (the old page turned red white);
// every tone curve, at any mix of slider values, keeps the order of brightness (no reversals) and keeps black and white
// where a slider says it does; the eight turn/flip states compose like the symmetries of a rectangle and always fill
// the output exactly; grain and sharpening look the same in the preview as in the full-size file; sharpening leaves
// flat areas, edges and alpha alone (the old page made the top and bottom rows transparent); numbers people type
// (−20, +35, 12,5, 40 %) are read as meant and wrong ones get a sentence saying what is accepted; and stored state is
// cleaned before use. Expected values are worked out in this file from the published formulas, not read off the page.
// The `browser` suite opens the page in Chromium, saves real files and checks their size and pixels against the
// preview pipeline (skipped without Playwright or a server on :8099 — `npx http-server -p 8099`).
//
//   node test/photo_filter_editor.mjs              # everything
//   node test/photo_filter_editor.mjs tone orient  # named suites only
//
// Suites: numbers, identity, matrices, tone, colour, looks, orient, spatial, files, state, huge, browser.

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import {createRequire} from 'module';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = join(HERE, '..', 'tools', 'photo_filter_editor.html');
const ALL = ['numbers', 'identity', 'matrices', 'tone', 'colour', 'looks', 'orient', 'spatial', 'files', 'state', 'huge', 'browser'];
const picked = process.argv.slice(2).filter(a => !a.startsWith('--'));
const suites = picked.length ? picked : ALL;

let failures = 0, passes = 0;
const check = (ok, what, detail) => { if (ok) passes++; else { failures++; console.log(`  FAIL  ${what}${detail ? '\n          ' + detail : ''}`); } };
const eq = (got, want, what) => check(JSON.stringify(got) === JSON.stringify(want), what, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
const near = (got, want, tol, what) => check(Math.abs(got - want) <= tol, what, `got ${got}, want ${want} ± ${tol}`);
const section = name => console.log(`\n=== ${name} ===`);

const html = readFileSync(PAGE, 'utf8');
const src = html.match(/<script id="core">([\s\S]*?)<\/script>/)[1];
const ctx = {module: {exports: {}}};
vm.runInNewContext(src, ctx);
const PF = ctx.module.exports;
// pixel buffers are made in the page's own realm: typed arrays from another realm make every loop crawl
const U8 = vm.runInNewContext('Uint8ClampedArray', ctx);

// ---- helpers, written from the specs ------------------------------------------------------------------------------
const dec = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };           // IEC 61966-2-1
const enc = l => 255 * (l <= 0.0031308 ? 12.92 * l : 1.055 * l ** (1 / 2.4) - 0.055);
const st = (adj = {}, extra = {}) => { const s = PF.defaults(); Object.assign(s.adj, adj); return Object.assign(s, extra); };
const px = (rgb, s, a = 255) => { const d = new U8([...rgb, a]); PF.render(d, 1, 1, s); return [...d]; };
const rgb = (c, s) => px(c, s).slice(0, 3);
const rnd = (seed => () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296)(12345);
const randomImage = (w, h, alpha) => { const d = new U8(w * h * 4); for (let i = 0; i < d.length; i++) d[i] = (i & 3) === 3 && !alpha ? 255 : rnd() * 256; return d; };
const flat = (w, h, c) => { const d = new U8(w * h * 4); for (let i = 0; i < w * h; i++) d.set(c, i * 4); return d; };

if (suites.includes('numbers')) {
  section('numbers');
  const ok = (s, lo, hi, v, what) => { const r = PF.parseValue(s, lo, hi); check(r.ok && r.value === v, what || JSON.stringify(s), JSON.stringify(r)); };
  const bad = (s, lo, hi, has, what) => { const r = PF.parseValue(s, lo, hi); check(!r.ok && r.error.includes(has), what || JSON.stringify(s), JSON.stringify(r)); };
  ok('20', -100, 100, 20); ok('+35', -100, 100, 35); ok('-20', -100, 100, -20);
  ok('−20', -100, 100, -20, 'typographic minus'); ok('– 20', -100, 100, -20, 'en dash and a space');
  ok(' 40 ', 0, 100, 40, 'stray spaces'); ok('40%', 0, 100, 40, 'per cent sign'); ok('40 %', 0, 100, 40, 'per cent after a space');
  ok('12,5', -100, 100, 13, 'decimal comma rounds half up'); ok('12.4', -100, 100, 12, 'decimal point');
  ok(',5', 0, 100, 1, 'leading comma'); ok('-0', -100, 100, 0, 'minus zero is 0, never -0');
  ok('100', -100, 100, 100, 'top of range'); ok('-100', -100, 100, -100, 'bottom of range'); ok('0', 0, 100, 0);
  bad('', -100, 100, '−100 to +100', 'empty names the range');
  bad('   ', 0, 100, '0 to 100', 'blank, one-sided range');
  bad('abc', -100, 100, 'like −20', 'words get an example');
  bad('150', -100, 100, 'Too high', 'too big says so');
  bad('-5', 0, 100, 'Too low: 0 to 100', 'negative where only 0..100 makes sense');
  bad('1e3', -100, 100, 'Numbers only', 'exponent notation refused');
  bad('1.2.3', -100, 100, 'Numbers only', 'two decimal points refused');
  ok('1,000', -100, 100, 1, 'a comma is a decimal comma here: 1,000 is 1 (a slider never reaches a thousand)');
  eq(PF.fmtSigned(12, -100), '+12', 'positive bipolar has a plus'); eq(PF.fmtSigned(-12, -100), '−12', 'negative has a real minus');
  eq(PF.fmtSigned(0, -100), '0', 'zero is bare'); eq(PF.fmtSigned(40, 0), '40', 'one-sided has no plus');
}

if (suites.includes('identity')) {
  section('identity');
  const d = randomImage(64, 64, true), copy = new U8(d);
  PF.render(d, 64, 64, PF.defaults(), {seed: 3});
  eq([...d].every((v, i) => v === copy[i]), true, 'Original with every slider at 0 leaves every byte as it was');
  for (let v = 0; v < 256; v++) { const o = rgb([v, v, v], PF.defaults()); if (o[0] !== v) { check(false, 'identity at ' + v, o); break; } }
  passes++;
  const s = st(); s.look = 'film'; s.amount = 0;
  const d2 = randomImage(32, 32, false), c2 = new U8(d2);
  PF.render(d2, 32, 32, s, {seed: 1});
  eq([...d2].every((v, i) => v === c2[i]), true, 'a look at strength 0 is the original');
  for (const l of PF.LOOKS) {
    const a = randomImage(16, 16, true), alphas = a.filter((_, i) => (i & 3) === 3);
    const s2 = st(); s2.look = l.id;
    PF.render(a, 16, 16, s2, {seed: 9});
    eq([...a.filter((_, i) => (i & 3) === 3)], [...alphas], `alpha untouched by ${l.name}`);
  }
}

if (suites.includes('matrices')) {
  section('matrices');
  // Filter Effects 1 §13.2 sepia(1) on mid grey and pure red, rounded as a canvas stores them.
  const sep = ([r, g, b]) => [0.393 * r + 0.769 * g + 0.189 * b, 0.349 * r + 0.686 * g + 0.168 * b, 0.272 * r + 0.534 * g + 0.131 * b].map(v => Math.min(255, Math.round(v)));
  eq(rgb([128, 128, 128], st({sepia: 100})), sep([128, 128, 128]), 'sepia 100 on grey = W3C matrix (173,154,120)');
  eq(rgb([128, 128, 128], st({sepia: 100})), [173, 154, 120], 'and the number itself');
  eq(rgb([255, 0, 0], st({sepia: 100})), sep([255, 0, 0]), 'sepia 100 on red = W3C matrix (100,89,69)');
  eq(rgb([255, 255, 255], st({sepia: 100})), [255, 255, 239], 'sepia on white clips like the spec');
  const half = ([r, g, b]) => { const s = sep([r, g, b]); return [r, g, b].map((v, i) => v); };
  const m = PF.matrix({bw: 0, sepia: 50});
  near(m[0], 0.393 + 0.607 * 0.5, 1e-12, 'sepia 50: r←r is the spec interpolation'); near(m[1], 0.769 * 0.5, 1e-12, 'sepia 50: r←g');
  eq(PF.matrix({bw: 0, sepia: 0}), null, 'no matrix when nothing asks for one');
  const g = PF.matrix({bw: 1, sepia: 0});
  for (let r = 0; r < 3; r++) { near(g[r * 3], 0.2126, 1e-12, 'grayscale row ' + r + ' r'); near(g[r * 3 + 1], 0.7152, 1e-12, 'g'); near(g[r * 3 + 2], 0.0722, 1e-12, 'b'); }
}

if (suites.includes('tone')) {
  section('tone');
  // exposure is stops of linear light: +50 = ×2, −100 = ÷4
  const expo = (v, ev) => Math.round(enc(Math.min(1, dec(v) * 2 ** ev)));
  for (const v of [0, 1, 10, 64, 128, 200, 254, 255]) {
    eq(rgb([v, v, v], st({exposure: 50}))[0], expo(v, 1), `exposure +50 (one stop) on ${v}`);
    eq(rgb([v, v, v], st({exposure: -100}))[0], expo(v, -2), `exposure −100 (two stops down) on ${v}`);
  }
  eq(rgb([128, 128, 128], st({exposure: 50})), [176, 176, 176], 'one stop up from 128 is 176');
  eq(rgb([0, 0, 0], st({exposure: 100})), [0, 0, 0], 'exposure never lifts black (the old page made it 84)');
  eq(rgb([255, 255, 255], st({exposure: -100})), [137, 137, 137], 'two stops down from white is 137');
  // brightness and contrast hold their ends; contrast holds the middle
  for (const v of [-100, -40, 40, 100]) {
    eq(rgb([0, 0, 0], st({brightness: v})), [0, 0, 0], `brightness ${v} keeps black`);
    eq(rgb([255, 255, 255], st({brightness: v})), [255, 255, 255], `brightness ${v} keeps white`);
    eq(rgb([0, 0, 0], st({contrast: Math.max(0, v)}))[0], 0, `contrast ${Math.max(0, v)} keeps black`);
  }
  eq(rgb([128, 128, 128], st({brightness: 100})), [Math.round(255 * (128 / 255) ** 0.5)] .concat([Math.round(255 * (128 / 255) ** 0.5), Math.round(255 * (128 / 255) ** 0.5)]), 'brightness +100 is a 1/2 gamma on midtones');
  near(PF.curve(0.5, PF.resolve(st({contrast: 100})), 1), 0.5, 1e-12, 'contrast leaves the middle grey');
  near(PF.curve(0.5, PF.resolve(st({contrast: -100})), 1), 0.5, 1e-12, 'negative too');
  near(PF.curve(0, PF.resolve(st({contrast: -100})), 1), 0.25, 1e-12, 'contrast −100 lifts black to a quarter, never to one flat grey');
  near(PF.curve(0.25, PF.resolve(st({contrast: 100})), 1), 0.125, 1e-12, 'contrast +100 at a quarter: the mirrored square');
  eq(rgb([200, 60, 40], st({contrast: -100})).every(v => v !== 128), true, 'the old page turned every pixel 128 at −100; this one keeps the picture');
  // shadows only move darks, highlights only lights
  check(rgb([40, 40, 40], st({shadows: 100}))[0] > 60, 'shadows +100 opens up a dark tone', rgb([40, 40, 40], st({shadows: 100})));
  near(rgb([235, 235, 235], st({shadows: 100}))[0], 235, 3, 'shadows barely touch a light tone');
  check(rgb([215, 215, 215], st({highlights: -100}))[0] < 200, 'highlights −100 pulls a light tone down', rgb([215, 215, 215], st({highlights: -100})));
  near(rgb([25, 25, 25], st({highlights: -100}))[0], 25, 2, 'highlights barely touch a dark tone');
  eq(rgb([255, 255, 255], st({highlights: -100})), [255, 255, 255], 'and leave pure white: a global curve cannot rebuild clipped detail');
  // fade lifts black and lowers white by the stated amounts
  eq(rgb([0, 0, 0], st({fade: 100})), [51, 51, 51], 'fade 100 lifts black to 20 %');
  eq(rgb([255, 255, 255], st({fade: 100})), [235, 235, 235], 'and brings white to 92 %');
  // monotone: every curve, at random mixes of every light slider, never reverses an order of brightness
  // a curve that would bend back is held flat; check that ordinary moves never need that
  for (const id of ['exposure', 'brightness', 'contrast', 'highlights', 'shadows', 'fade']) for (const v of [PF.SLIDER[id].min, PF.SLIDER[id].max]) {
    const p = PF.resolve(st({[id]: v})); let flatRuns = 0;
    for (let i = 1; i < 256; i++) if (PF.curve(i / 255, p, 1) < PF.curve((i - 1) / 255, p, 1) - 1e-9) flatRuns++;
    eq(flatRuns, 0, `${id} ${v} alone is a monotone curve by itself`);
  }
  let reversed = 0, worst = '';
  for (let t = 0; t < 3000; t++) {
    const a = {};
    for (const id of ['exposure', 'brightness', 'contrast', 'highlights', 'shadows', 'warmth', 'tint']) a[id] = Math.round(rnd() * 200 - 100);
    a.fade = Math.round(rnd() * 100);
    if (t < 64) for (const id in a) a[id] = PF.SLIDER[id].min + (t >> Object.keys(a).indexOf(id) & 1) * (PF.SLIDER[id].max - PF.SLIDER[id].min);
    const T = PF.lut(PF.resolve(st(a)));
    for (let c = 0; c < 3; c++) for (let i = 1; i < 256; i++) if (T[c * 256 + i] < T[c * 256 + i - 1] - 1e-7) { reversed++; worst = JSON.stringify(a); }
  }
  eq(reversed, 0, 'no tone curve reverses, over 3000 mixes and every corner of the slider box' + (worst ? ' e.g. ' + worst : ''));
}

if (suites.includes('colour')) {
  section('colour');
  const luma = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
  eq(rgb([255, 0, 0], st({saturation: -100})), [54, 54, 54], 'saturation −100 turns red into its luminance grey (old page: white)');
  for (const c of [[200, 60, 40], [40, 90, 200], [12, 240, 33]]) {
    const o = rgb(c, st({saturation: -100}));
    check(o[0] === o[1] && o[1] === o[2] && Math.abs(o[0] - luma(c)) <= 0.51, `saturation −100 of ${c} is grey ${Math.round(luma(c))}`, o);
  }
  const L = luma([200, 100, 50]), want = [200, 100, 50].map(v => Math.round(Math.max(0, Math.min(255, L + (v - L) * 1.5))));
  eq(rgb([200, 100, 50], st({saturation: 50})), want, 'saturation +50 pushes each channel 1.5× away from luminance');
  eq(rgb([128, 128, 128], st({saturation: 100, vibrance: 100})), [128, 128, 128], 'saturation and vibrance leave greys alone');
  const dull = rgb([140, 120, 110], st({vibrance: 100})), loud = rgb([250, 30, 20], st({vibrance: 100}));
  check(dull[0] - dull[2] > 30 * 1.6, 'vibrance boosts a dull colour a lot', dull);
  check(loud[0] - 250 <= 5, 'and an already loud one hardly at all', loud);
  // warmth and tint: linear-light gains that keep a grey's luminance
  for (const [k, v] of [['warmth', 100], ['warmth', -100], ['tint', 100], ['tint', -100]]) {
    const o = rgb([128, 128, 128], st({[k]: v}));
    const lin = 0.2126 * dec(o[0]) + 0.7152 * dec(o[1]) + 0.0722 * dec(o[2]);
    near(lin, dec(128), 0.006, `${k} ${v} keeps the luminance of grey`);
  }
  const w = rgb([128, 128, 128], st({warmth: 60})), c = rgb([128, 128, 128], st({warmth: -60})), m = rgb([128, 128, 128], st({tint: 60}));
  check(w[0] > w[2] + 20, 'warmth + makes grey orange', w); check(c[2] > c[0] + 20, 'warmth − makes grey blue', c);
  check(m[1] < m[0] && m[1] < m[2], 'tint + makes grey magenta', m);
}

if (suites.includes('looks')) {
  section('looks');
  eq(PF.LOOKS.length, 12, 'twelve looks'); eq(PF.LOOKS[0].id, 'original', 'Original first');
  const names = new Set(PF.LOOKS.map(l => l.name)); eq(names.size, 12, 'names unique');
  for (const l of PF.LOOKS) for (const k in l.p) check(PF.SLIDER[k] && l.p[k] >= PF.SLIDER[k].min && l.p[k] <= PF.SLIDER[k].max, `${l.name}.${k} is a real slider value`);
  const r = PF.resolve(Object.assign(st({fade: 10, contrast: 100, saturation: -100}), {look: 'film', amount: 50}));
  eq(r.fade, PF.LOOK.film.p.fade * 0.5 + 10, 'strength scales the look and the sliders add on top');
  eq(r.contrast, 100, 'and the sum is kept inside the range at the top');
  eq(r.saturation, -100, 'and at the bottom');
  eq(PF.resolve(Object.assign(st({contrast: 100}), {look: 'noir'})).contrast, 100, 'clamped at the top');
  eq(PF.resolve(Object.assign(st(), {look: 'silver', amount: 40})).bw, 0.4, 'black & white follows strength');
  // every look visibly changes a colour chart (mean absolute difference over a 6×6×6 cube)
  for (const l of PF.LOOKS.slice(1)) {
    let diff = 0, n = 0;
    for (let r0 = 0; r0 < 6; r0++) for (let g0 = 0; g0 < 6; g0++) for (let b0 = 0; b0 < 6; b0++) {
      const c = [r0 * 51, g0 * 51, b0 * 51], o = rgb(c, Object.assign(st(), {look: l.id}));
      diff += Math.abs(o[0] - c[0]) + Math.abs(o[1] - c[1]) + Math.abs(o[2] - c[2]); n += 3;
    }
    check(diff / n > 6, `${l.name} changes the colour chart visibly (mean ${(diff / n).toFixed(1)} levels)`);
  }
  // and no two looks are near twins
  const sig = l => { const o = []; for (const c of [[200, 60, 40], [40, 90, 200], [128, 128, 128], [30, 30, 30], [230, 230, 230], [60, 160, 60]]) o.push(...rgb(c, Object.assign(st(), {look: l.id}))); return o; };
  const sigs = PF.LOOKS.map(sig);
  for (let i = 0; i < sigs.length; i++) for (let j = i + 1; j < sigs.length; j++) {
    const d = sigs[i].reduce((a, v, k) => a + Math.abs(v - sigs[j][k]), 0) / sigs[i].length;
    check(d > 5, `${PF.LOOKS[i].name} and ${PF.LOOKS[j].name} differ (mean ${d.toFixed(1)} levels)`);
  }
}

if (suites.includes('orient')) {
  section('orient');
  const I = [1, 0, 0, 1];
  const key = o => o.join();
  const all = new Set([key(I)]);
  let frontier = [I];
  while (frontier.length) { const next = []; for (const o of frontier) for (const n of [PF.turn(o, 1), PF.turn(o, -1), PF.flip(o, 'h'), PF.flip(o, 'v')]) if (!all.has(key(n))) { all.add(key(n)); next.push(n); } frontier = next; }
  eq(all.size, 8, 'turns and flips reach exactly the eight ways a rectangle can lie');
  let o = I; for (let i = 0; i < 4; i++) o = PF.turn(o, 1); eq(o, I, 'four right turns are none');
  eq(PF.turn(PF.turn(I, 1), -1), I, 'right then left is none');
  eq(PF.flip(PF.flip(I, 'h'), 'h'), I, 'mirror twice is none');
  eq(PF.turn(PF.turn(I, 1), 1), PF.flip(PF.flip(I, 'h'), 'v'), 'half a turn = mirror + flip');
  for (const k of all) {
    const m = k.split(',').map(Number);
    eq(PF.clean({o: m}).o, m, 'clean keeps the valid matrix ' + k);
    const w = 7, h = 4, t = PF.orient(w, h, m);
    const seen = new Set();
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const [X, Y] = PF.mapPoint(w, h, m, x + 0.5, y + 0.5); seen.add(Math.floor(X) + ',' + Math.floor(Y)); check(X > 0 && Y > 0 && X < t.w && Y < t.h, `${k}: pixel ${x},${y} lands inside`); }
    eq(seen.size, w * h, `${k}: every pixel lands on its own spot`);
    eq([t.w, t.h], m[0] === 0 ? [h, w] : [w, h], `${k}: output size`);
  }
  // turns and flips act on what is on screen (the old page flipped the wrong axis after a turn)
  const R = PF.turn(I, 1), w = 6, h = 3;
  eq(PF.mapPoint(w, h, R, 0.5, 0.5).map(Math.floor), [2, 0], 'turn right: top-left goes to top-right');
  const RM = PF.flip(R, 'h');
  eq(PF.mapPoint(w, h, RM, 0.5, 0.5).map(Math.floor), [0, 0], 'then mirror: it comes back to the left on screen');
  const RF = PF.flip(R, 'v');
  eq(PF.mapPoint(w, h, RF, 0.5, 0.5).map(Math.floor), [2, 5], 'or flip: it goes to the bottom on screen');
  eq(PF.clean({o: [1, 1, 0, 1]}).o, I, 'a shear is refused'); eq(PF.clean({o: [2, 0, 0, 1]}).o, I, 'a scale is refused');
  eq(PF.clean({o: [0, 0, 0, 0]}).o, I, 'a collapse is refused'); eq(PF.clean({o: 'x'}).o, I, 'junk is refused');
}

if (suites.includes('spatial')) {
  section('spatial');
  // sharpen: flat areas, borders and alpha stay put; an edge gets overshoot on both sides
  const w = 40, h = 30, f = flat(w, h, [120, 130, 140, 200]), f0 = new U8(f);
  PF.render(f, w, h, st({sharpen: 100}), {seed: 1});
  eq([...f].every((v, i) => v === f0[i]), true, 'sharpen leaves a flat picture, its border rows and its alpha untouched');
  const e = new U8(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) e.set(x < 20 ? [60, 60, 60, 255] : [180, 180, 180, 255], (y * w + x) * 4);
  PF.render(e, w, h, st({sharpen: 100}), {full: 40, seed: 1});
  const at = x => e[(15 * w + x) * 4];
  check(at(19) < 60 && at(20) > 180, 'sharpen overshoots on both sides of an edge', [at(18), at(19), at(20), at(21)]);
  eq([at(0), at(39)], [60, 180], 'and leaves the far left and right alone (no wrap to the next row)');
  // vignette: centre untouched, corners darker (or lighter), symmetric
  const v = flat(101, 61, [150, 150, 150, 255]);
  PF.render(v, 101, 61, st({vignette: 100}), {seed: 1});
  const g = (x, y) => v[(y * 101 + x) * 4];
  eq(g(50, 30), 150, 'vignette leaves the centre'); check(g(0, 0) < 60, 'and darkens a corner', g(0, 0));
  eq([g(0, 0), g(100, 0), g(0, 60), g(100, 60)].every(c => c === g(0, 0)), true, 'all four corners alike');
  const vl = flat(101, 61, [150, 150, 150, 255]); PF.render(vl, 101, 61, st({vignette: -100}), {seed: 1});
  check(vl[0] > 200, 'negative vignette lightens corners', vl[0]);
  // grain: reproducible, mean-neutral, the same pattern at preview and full size
  const gr = (W, H, seed) => { const d = flat(W, H, [128, 128, 128, 255]); PF.render(d, W, H, st({grain: 100}), {seed}); return d; };
  const a = gr(300, 200, 7), b = gr(300, 200, 7), c = gr(300, 200, 8);
  eq([...a].every((x, i) => x === b[i]), true, 'grain is the same every time for one photo (old page: new noise on every change)');
  check([...a].some((x, i) => x !== c[i]), 'another photo gets other grain');
  const small = gr(450, 300, 5), big = gr(1800, 1200, 5);
  let mean = 0, dev = 0; for (let i = 0; i < big.length; i += 4) { mean += big[i]; dev += Math.abs(big[i] - 128); } mean /= big.length / 4; dev /= big.length / 4;
  near(mean, 128, 1.5, 'grain does not brighten or darken overall'); check(dev > 3, 'grain 100 is visible at full size', dev);
  let d1 = 0, n1 = 0;
  for (let y = 0; y < 300; y += 3) for (let x = 0; x < 450; x += 3) {
    let s = 0; for (let yy = 0; yy < 4; yy++) for (let xx = 0; xx < 4; xx++) s += big[((y * 4 + yy) * 1800 + x * 4 + xx) * 4];
    d1 += Math.abs(s / 16 - small[(y * 450 + x) * 4]); n1++;
  }
  check(d1 / n1 < 3, `grain in a preview matches the full-size file shrunk down (mean ${(d1 / n1).toFixed(2)} levels)`);
}

if (suites.includes('files')) {
  section('files');
  eq(PF.fileName('IMG_1234.JPG', 'jpeg'), 'IMG_1234-edited.jpg', 'camera name');
  eq(PF.fileName('holiday.final.v2.png', 'webp'), 'holiday.final.v2-edited.webp', 'dots inside the name stay');
  eq(PF.fileName('', 'png'), 'photo-edited.png', 'no name');
  eq(PF.fileName('.png', 'png'), 'photo-edited.png', 'only an extension');
  eq(PF.fileName('C:\\Users\\a\\Pictures\\cat.heic', 'jpeg'), 'cat-edited.jpg', 'a Windows path');
  eq(PF.fileName('写真 Ünïcødé.jpeg', 'jpeg'), '写真 Ünïcødé-edited.jpg', 'non-ASCII kept');
  eq(PF.fileName('a<b>:c"d|e?f*.jpg', 'png'), 'abcdef-edited.png', 'characters no file system allows are dropped');
  eq(PF.fileName('x'.repeat(200) + '.jpg', 'jpeg').length, 80 + '-edited.jpg'.length, 'long names are cut');
  eq(PF.fitArea(4032, 3024, 50e6), {w: 4032, h: 3024, scaled: false}, 'a phone photo saves at full size');
  eq(PF.fitArea(8000, 6000, 50e6), {w: 8000, h: 6000, scaled: false}, '48 MP fits under 50 MP');
  const f = PF.fitArea(8000, 6000, 16777216);
  check(f.scaled && f.w * f.h <= 16777216 && Math.abs(f.w / f.h - 4 / 3) < 0.001, 'iOS limit: 48 MP shrinks to fit 16.7 MP, same shape', JSON.stringify(f));
  check(f.w * f.h > 16777216 * 0.999, 'and uses nearly all of it');
  eq(PF.fitArea(100000, 10, 50000).h >= 1, true, 'an absurd panorama still has a height');
  eq(PF.previewSize(1536, 768, 1024), {w: 1024, h: 512}, 'preview shrinks the long edge'); eq(PF.previewSize(300, 200, 1024), {w: 300, h: 200}, 'never enlarges');
  eq(PF.fileProblem('a.jpg', 'image/jpeg', 100), null, 'jpeg ok'); eq(PF.fileProblem('a.HEIC', '', 100), null, 'heic is tried (Safari reads it)');
  eq(PF.fileProblem('pasted', '', 100), null, 'unknown without a type is tried');
  eq(PF.fileProblem('scan.pdf', 'application/pdf', 100), 'is a PDF, not a photo this browser can open.', 'pdf named');
  eq(PF.fileProblem('a.jpg', 'image/jpeg', 0), 'is empty (0 bytes).', 'empty file');
  eq(PF.fileProblem('clip.mov', 'video/quicktime', 9), 'is a video, not a photo this browser can open.', 'video named');
  eq(PF.fileProblem('x.bin', 'application/octet-stream', 9), 'is not a photo this browser can open.', 'anything else');
}

if (suites.includes('state')) {
  section('state');
  eq(PF.clean(null), PF.defaults(), 'nothing → defaults'); eq(PF.clean('x'), PF.defaults(), 'junk → defaults');
  const c = PF.clean({look: 'film', amount: '55', adj: {contrast: 250, sepia: -4, fade: '12.6', exposure: NaN, nope: 9}, o: [0, 1, -1, 0], extra: 1});
  eq(c.look, 'film', 'known look kept'); eq(c.amount, 55, 'string number read'); eq(c.adj.contrast, 100, 'clamped high');
  eq(c.adj.sepia, 0, 'clamped low'); eq(c.adj.fade, 13, 'rounded'); eq(c.adj.exposure, 0, 'NaN → 0');
  eq('nope' in c.adj, false, 'unknown slider dropped'); eq('extra' in c, false, 'unknown key dropped'); eq(c.o, [0, 1, -1, 0], 'turn kept');
  eq(PF.clean({look: 'instagram'}).look, 'original', 'unknown look → Original');
  eq(PF.isDefault(PF.defaults()), true, 'defaults are default'); eq(PF.isDefault(Object.assign(PF.defaults(), {o: [0, 1, -1, 0]})), false, 'a turn is a change');
  eq(PF.changedCount(st({contrast: 3, sepia: 1})), 2, 'changed sliders counted');
  eq(PF.SLIDERS.map(s => s.id).filter(id => ['brightness', 'contrast', 'saturation', 'exposure', 'sepia', 'grain', 'sharpen'].includes(id)).length, 7, 'all seven sliders of the old page are here (noise is now grain)');
}

if (suites.includes('huge')) {
  section('huge');
  const W = 3000, H = 2000, d = randomImage(W, H, false), s = st({sharpen: 60, grain: 40, vignette: 30, contrast: 20});
  s.look = 'drama';
  const t = Date.now(); PF.render(d, W, H, s, {seed: 2}); const ms = Date.now() - t;
  check(ms < 8000, `6 MP with every spatial effect renders in ${ms} ms`);
  eq(d[3] === 255 && d[d.length - 1] === 255, true, 'and keeps alpha');
}

if (suites.includes('browser')) {
  section('browser');
  let chromium;
  try { chromium = createRequire(import.meta.url)('playwright').chromium; } catch (e) { console.log('  skipped: no Playwright'); }
  let up = false;
  if (chromium) try { up = (await fetch('http://localhost:8099/tools/photo_filter_editor.html')).ok; } catch (e) { console.log('  skipped: no server on :8099'); }
  if (chromium && up) {
    const browser = await chromium.launch();
    const page = await browser.newPage({viewport: {width: 1200, height: 800}, acceptDownloads: true});
    const errors = []; page.on('pageerror', e => errors.push(String(e))); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    const requests = []; page.on('request', r => requests.push(r.url()));
    await page.goto('http://localhost:8099/tools/photo_filter_editor.html');
    await page.waitForFunction(() => window.__pf && window.__pf.last);
    // A 333×211 test photo with a hard edge, a gradient and a transparent corner.
    const mk = async alpha => page.evaluate(async alpha => {
      const c = document.createElement('canvas'); c.width = 333; c.height = 211; const x = c.getContext('2d');
      const g = x.createLinearGradient(0, 0, 333, 211); g.addColorStop(0, '#d23c28'); g.addColorStop(0.5, '#3c78c8'); g.addColorStop(1, '#f0e6a0');
      x.fillStyle = g; x.fillRect(0, 0, 333, 211); x.fillStyle = '#111'; x.fillRect(150, 0, 40, 211);
      if (alpha) x.clearRect(0, 0, 60, 40);
      const b = await new Promise(r => c.toBlob(r, 'image/png'));
      return __pf.openBlob(new File([b], 'test shot.png', {type: 'image/png'}), 'test shot.png');
    }, alpha);
    eq(await mk(false), true, 'opens a PNG');
    const save = async () => { const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#download')]); return dl; };
    const decode = async path => page.evaluate(async b64 => {
      const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
      const bmp = await createImageBitmap(new Blob([bin])); const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
      const x = c.getContext('2d'); x.drawImage(bmp, 0, 0); return {w: bmp.width, h: bmp.height, d: Array.from(x.getImageData(0, 0, bmp.width, bmp.height).data)};
    }, readFileSync(path).toString('base64'));
    // the expected file: the core run on the decoded source, turned by the same matrix, in the page
    const expected = async () => page.evaluate(async () => {
      const p = __pf.photo, S = __pf.state, t = PF.orient(p.w, p.h, S.o), c = document.createElement('canvas'); c.width = t.w; c.height = t.h;
      const x = c.getContext('2d'); x.setTransform(...t.m); x.drawImage(p.bmp, 0, 0); const id = x.getImageData(0, 0, t.w, t.h);
      PF.render(id.data, t.w, t.h, S, {full: Math.max(t.w, t.h), seed: p.seed}); return {w: t.w, h: t.h, d: Array.from(id.data)};
    });
    await page.selectOption('#saveAs', 'png');
    await page.click('.look[data-id=cinema]');
    await page.click('#tabAdjust'); await page.fill('#s_sharpen + .num', '50'); await page.press('#s_sharpen + .num', 'Enter');
    await page.click('#turnR');
    let dl = await save();
    eq(dl.suggestedFilename(), 'test shot-edited.png', 'file name from the photo');
    let got = await decode(await dl.path()), want = await expected();
    eq([got.w, got.h], [211, 333], 'saved at full size, turned (the old page saved the screen and cropped turns)');
    let maxd = 0; for (let i = 0; i < want.d.length; i++) maxd = Math.max(maxd, Math.abs(got.d[i] - want.d[i]));
    check(maxd <= 1, 'the saved PNG is the core\'s result pixel for pixel', 'max diff ' + maxd);
    // the preview shows the same thing, shrunk
    const pv = await page.evaluate(() => { const v = document.getElementById('view'); return [v.width, v.height]; });
    eq(pv, [211, 333], 'a small photo previews at its own size');
    const viewPx = await page.evaluate(() => Array.from(document.getElementById('view').getContext('2d').getImageData(0, 0, 211, 333).data));
    let pd = 0; for (let i = 0; i < viewPx.length; i++) pd = Math.max(pd, Math.abs(viewPx[i] - want.d[i]));
    check(pd <= 1, 'preview = saved file when the photo is small enough to preview 1:1', 'max diff ' + pd);
    // undo goes back step by step
    await page.click('#undo'); eq(await page.evaluate(() => __pf.state.o), [1, 0, 0, 1], 'undo takes back the turn');
    await page.click('#undo'); eq(await page.evaluate(() => __pf.state.adj.sharpen), 0, 'then the sharpening');
    await page.click('#redo'); eq(await page.evaluate(() => __pf.state.adj.sharpen), 50, 'redo puts it back');
    // a bad number keeps what was typed, says why, and changes nothing
    await page.fill('#s_contrast + .num', '1000'); await page.press('#s_contrast + .num', 'Enter');
    eq(await page.inputValue('#s_contrast + .num'), '1000', 'what was typed stays in the box');
    check((await page.textContent('#s_contrast ~ .fielderr')).includes('Too high: −100 to +100'), 'the error next to the box says what is wrong and names the range');
    eq(await page.evaluate(() => __pf.state.adj.contrast), 0, 'and the photo is unchanged');
    await page.click('#tabAdjust'); // leave the box
    eq(await page.inputValue('#s_contrast + .num'), '0', 'leaving the box puts back the value the photo has (never a number that is not in use)');
    check((await page.textContent('#s_contrast ~ .fielderr')).includes('kept 0'), 'and says it kept 0');
    // JPEG with transparency: white, not black
    await mk(true); await page.selectOption('#saveAs', 'jpeg:92'); await page.click('#tabLooks'); await page.click('.look[data-id=original]');
    check((await page.textContent('#note')).includes('white'), 'the note says JPEG fills transparency with white');
    dl = await save(); got = await decode(await dl.path());
    check(got.d[0] > 240 && got.d[1] > 240 && got.d[2] > 240, 'transparent corner is white in the JPEG', got.d.slice(0, 3));
    eq(dl.suggestedFilename(), 'test shot-edited.jpg', 'jpg extension');
    // a PDF is refused with a sentence, and the photo stays
    await page.setInputFiles('#file', {name: 'scan.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4')});
    check((await page.textContent('#err')).includes('is a PDF'), 'a PDF gets a plain message');
    eq(await page.evaluate(() => __pf.photo.name), 'test shot.png', 'and the photo is kept');
    // reload keeps the photo and the edits for this tab
    await page.click('.look[data-id=noir]'); await page.waitForTimeout(300);
    await page.reload(); await page.waitForFunction(() => window.__pf && window.__pf.last && window.__pf.photo);
    eq(await page.evaluate(() => [__pf.photo.name, __pf.state.look]), ['test shot.png', 'noir'], 'reload brings back the photo and the look');
    eq(requests.filter(u => !u.startsWith('http://localhost:8099/') && !u.startsWith('blob:') && !u.startsWith('data:')), [], 'no request leaves the site');
    eq(errors, [], 'no console errors');
    await browser.close();
  }
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
