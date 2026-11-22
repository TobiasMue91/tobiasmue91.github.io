#!/usr/bin/env node
// Test suite for tools/image_background_remover.html (Image Background Remover).
//
// The page promises a cutout you can trust at the photo's own size: no rim of the old background, no haze far from
// the subject, touch-ups that undo exactly, a file named after the photo, and nothing sent anywhere. The pixel work
// lives in the page's DOM-free <script id="core"> block, which this suite runs in Node's vm (the page also runs it,
// unchanged, inside its worker). What checks each promise:
//   size     fitSize keeps photos under the 16.7 MP canvas limit with their shape; modelSize; 1 × 1 and 100000 × 10
//   resize   bilinear resize: identity, constant planes, hand-worked half-pixel values, down then up
//   matte    cleanMatte drops specks and far haze, keeps soft pixels near the subject, leaves an empty matte alone
//   edge     the Edge LUT: identity ends, monotone at every setting, higher keeps less (the old slider's direction)
//   compose  touch-up layers: restore wins, erase wins, the later stroke wins, colour of restored pixels is the photo
//   stamp    soft round brush: inside/outside radius, dirty rectangle, strokes off the image, zero-length dabs
//   blur     the O(1) box blur against a naive one on random planes, at every radius up to wider than the image
//   fg       blur-fusion foreground estimation against test/image_background_remover.vectors.json, written by the
//            paper's reference code (Forte & Pitié 2021, numpy + OpenCV); a true composite gets its colour back
//   export   trimBox, coverage, flatten, pack3/unpack3 round trip
//   text     colour parsing, download names (paths, dots, non-ASCII, reserved characters), byte and size labels
//   sniff    what a file is from its first bytes: JPEG, PNG, WebP, GIF, BMP, AVIF, HEIC, TIFF, ICO, PDF, SVG (with a
//            BOM, a prolog, a comment), and text that is none of them
//   page     (Chromium, needs `npx http-server -p 8099`) the real page with `?engine=fake`, a soft ellipse in place of
//            the model: the example on arrival, a chosen photo cut out, download name and alpha, JPG flattening,
//            erase + undo + redo, a bad file and a fake HEIC, the job back after a reload, start over, the old theme
//            key, phone layout with the buttons in view, no console errors and no request that leaves the site
//
// No browser or server for anything but `page`, which is skipped when Chromium or the server is missing.
//
//   npm run test:background                          # or: node test/image_background_remover.mjs
//   node test/image_background_remover.mjs fg page   # named suites only

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import {createRequire} from 'module';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const ALL = ['size', 'resize', 'matte', 'edge', 'compose', 'stamp', 'blur', 'fg', 'export', 'text', 'sniff', 'page'];
const picked = process.argv.slice(2).filter(a => !a.startsWith('--'));
const suites = picked.length ? picked : ALL;
const arg = name => (process.argv.find(a => a.startsWith(`--${name}=`)) || '').slice(name.length + 3);
const PAGE = arg('page') || join(ROOT, 'tools', 'image_background_remover.html');
const URL_BASE = arg('url') || 'http://localhost:8099/tools/image_background_remover.html';

let failures = 0, passes = 0;
const check = (ok, what, detail) => { if (ok) passes++; else { failures++; console.log(`  FAIL  ${what}${detail !== undefined ? '\n          ' + detail : ''}`); } };
const J = v => JSON.stringify(v);
const eq = (got, want, what) => check(J(got) === J(want), what, `got ${J(got)}, want ${J(want)}`);
const section = name => console.log(`\n=== ${name} ===`);

const html = readFileSync(PAGE, 'utf8');
const src = html.match(/<script id="core">([\s\S]*?)<\/script>/)[1];
const ctx = {module: {exports: {}}};
vm.runInNewContext(src, ctx);
const B = ctx.module.exports;
const arr = a => Array.from(a);

let seed = 20261122;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x80000000; };
const rint = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));

// ---------------------------------------------------------------------------------------------------------------------
if (suites.includes('size')) {
  section('size');
  eq(B.MAX_PIXELS, 16777216, 'the limit is 4096 × 4096');
  eq(J(B.fitSize(4032, 3024)), J({w: 4032, h: 3024, scaled: false}), 'a 12 MP phone photo is kept as is');
  eq(J(B.fitSize(4096, 4096)), J({w: 4096, h: 4096, scaled: false}), 'exactly at the limit is kept');
  const f = B.fitSize(4097, 4096);
  check(f.scaled && f.w * f.h <= B.MAX_PIXELS && f.w >= f.h, 'one pixel over is scaled to fit', J(f));
  const t = B.fitSize(10000, 10000);
  check(t.scaled && t.w * t.h <= B.MAX_PIXELS && t.w === t.h && t.w >= 4090, '10000 × 10000 becomes about 4096 square', J(t));
  const g = B.fitSize(8064, 6048);                                  // a 48 MP phone
  check(g.w * g.h <= B.MAX_PIXELS && Math.abs(g.w / g.h - 4 / 3) < 0.002, '48 MP keeps 4:3', J(g));
  const s = B.fitSize(100000, 10);
  check(s.w * s.h <= B.MAX_PIXELS && s.h >= 1 && s.w >= 1, 'a 100000 × 10 strip stays at least a pixel high', J(s));
  eq(J(B.fitSize(1, 1)), J({w: 1, h: 1, scaled: false}), '1 × 1');
  eq(J(B.fitSize(0, 0)), J({w: 1, h: 1, scaled: false}), 'a zero size is treated as one pixel');
  eq(J(B.modelSize(4032, 3024)), J({w: 1024, h: 768}), 'the model is fed 1024 on the long side');
  eq(J(B.modelSize(300, 200)), J({w: 300, h: 200}), 'small pictures are not enlarged for the model');
  eq(J(B.modelSize(1, 5000)), J({w: 1, h: 1024}), 'a thin strip keeps a pixel');
}

// ---------------------------------------------------------------------------------------------------------------------
if (suites.includes('resize')) {
  section('resize');
  const p = Uint8Array.from([0, 255]);
  eq(arr(B.resizePlane(p, 2, 1, 4, 1)), [0, 64, 191, 255], '[0, 255] to 4 wide: pixel-centre sampling (as PIL and OpenCV)');
  eq(arr(B.resizePlane(p, 2, 1, 2, 1)), [0, 255], 'same size is the identity');
  eq(arr(B.resizePlane(Uint8Array.from([10, 20, 30, 40]), 4, 1, 2, 1)), [15, 35], 'halving averages pairs');
  const c = new Uint8Array(30 * 20).fill(77);
  check(B.resizePlane(c, 30, 20, 97, 13).every(v => v === 77), 'a constant plane stays constant at any size');
  eq(arr(B.resizePlane(Uint8Array.from([200]), 1, 1, 3, 2)), [200, 200, 200, 200, 200, 200], 'from 1 × 1');
  const r = new Uint8Array(64 * 48); for (let i = 0; i < r.length; i++) r[i] = (i * 37) % 256;
  const back = B.resizePlane(B.resizePlane(r, 64, 48, 128, 96), 128, 96, 64, 48);
  let mx = 0; for (let i = 0; i < r.length; i++) mx = Math.max(mx, Math.abs(back[i] - r[i]));
  check(mx <= 128, 'up and back down stays bounded', mx);
  const g = new Uint8Array(100); for (let i = 0; i < 100; i++) g[i] = i * 2;
  const g2 = B.resizePlane(g, 100, 1, 1000, 1);
  let mono = true; for (let i = 1; i < g2.length; i++) if (g2[i] < g2[i - 1]) mono = false;
  check(mono, 'a ramp stays monotone when enlarged ten times');
}

// ---------------------------------------------------------------------------------------------------------------------
if (suites.includes('matte')) {
  section('matte');
  const w = 100, h = 60, m = new Uint8Array(w * h);
  for (let y = 10; y < 50; y++) for (let x = 10; x < 40; x++) m[y * w + x] = 255;   // the subject
  m[5 * w + 90] = 255;                                                                 // a speck far away
  for (let x = 40; x < 60; x++) m[30 * w + x] = 100;                                   // a soft wisp leaving the subject
  for (let y = 0; y < 60; y++) m[y * w + 95] = 60;                                     // haze far away
  const o = B.cleanMatte(m, w, h);                                                     // reach: 4 % of 100 = 4 px
  eq(o[30 * w + 20], 255, 'the subject is kept');
  eq(o[5 * w + 90], 0, 'a one-pixel speck is dropped');
  eq(o[30 * w + 41], 100, 'soft pixels next to the subject are kept');
  check(o[30 * w + 42] > 0 && o[30 * w + 42] < 100, 'and fade towards the edge of the reach', o[30 * w + 42]);
  eq(o[30 * w + 50], 0, 'soft pixels beyond the reach are dropped');
  eq(o[20 * w + 95], 0, 'far haze is dropped');
  const two = new Uint8Array(w * h);
  for (let y = 10; y < 50; y++) { for (let x = 5; x < 30; x++) two[y * w + x] = 255; for (let x = 60; x < 90; x++) two[y * w + x] = 230; }
  const o2 = B.cleanMatte(two, w, h);
  check(o2[30 * w + 10] === 255 && o2[30 * w + 70] === 230, 'two subjects of similar size are both kept (two cats)');
  const small = new Uint8Array(w * h);
  for (let y = 0; y < 50; y++) for (let x = 0; x < 50; x++) small[y * w + x] = 255;
  small[55 * w + 90] = 255; small[55 * w + 91] = 255;                                  // 2 px: under 1 % of 2500
  for (let y = 52; y < 58; y++) for (let x = 60; x < 66; x++) small[y * w + x] = 255;  // 36 px: over 1 %
  const o3 = B.cleanMatte(small, w, h);
  check(o3[55 * w + 90] === 0 && o3[54 * w + 62] === 255, 'regions under 1 % of the largest go, regions over stay');
  const faint = new Uint8Array(w * h).fill(90);
  eq(arr(B.cleanMatte(faint, w, h)).every(v => v === 90), true, 'with no solid region the matte is left as it was');
  eq(arr(B.cleanMatte(new Uint8Array(1).fill(255), 1, 1)), [255], '1 × 1');
  const big = new Uint8Array(1024 * 768); for (let i = 0; i < big.length; i++) big[i] = (i % 1024 > 300 && i % 1024 < 700) ? 255 : (i % 7 ? 40 : 0);
  const t0 = Date.now(); B.cleanMatte(big, 1024, 768); const ms = Date.now() - t0;
  check(ms < 1500, 'a 1024 × 768 matte is cleaned in well under a second or two', ms + ' ms');
}

// ---------------------------------------------------------------------------------------------------------------------
if (suites.includes('edge')) {
  section('edge');
  eq(J(B.edgeRange(0.5)), J([0.04999999999999999, 0.95]), 'default: 5 % to 95 % of the matte maps to clear and solid');
  for (const t of [0.1, 0.25, 0.5, 0.6, 0.75, 0.9]) {
    const l = B.edgeLut(t);
    let mono = true; for (let i = 1; i < 256; i++) if (l[i] < l[i - 1]) mono = false;
    check(mono && l[0] === 0 && l[255] === 255, `LUT at ${t}: monotone, 0 stays clear and 255 stays solid`);
  }
  const lo = B.edgeLut(0.2), hi = B.edgeLut(0.8);
  let less = true; for (let i = 0; i < 256; i++) if (hi[i] > lo[i]) less = false;
  check(less, 'a higher setting never keeps more (the old "Detection Precision" direction)');
  eq(B.edgeLut(0.5)[128], 128, 'mid matte stays mid at the default');
  eq(J(B.edgeRange('x')), J(B.edgeRange(0.5)), 'junk falls back to the default');
  eq(J(B.edgeRange(5)), J(B.edgeRange(0.9)), 'out of range is clamped');
}

// ---------------------------------------------------------------------------------------------------------------------
function picture(w, h) {
  const n = w * h, orig = new Uint8ClampedArray(n * 4), fg = new Uint8ClampedArray(n * 4), base = new Uint8Array(n);
  for (let i = 0; i < n; i++) { orig[i * 4] = 200; orig[i * 4 + 1] = 100; orig[i * 4 + 2] = 50; orig[i * 4 + 3] = 255; fg[i * 4] = 10; fg[i * 4 + 1] = 20; fg[i * 4 + 2] = 30; base[i] = (i % w) < w / 2 ? 255 : 0; }
  return {orig, fg, base, K: new Uint8Array(n), R: new Uint8Array(n), out: new Uint8ClampedArray(n * 4)};
}
if (suites.includes('compose')) {
  section('compose');
  const w = 20, h = 10, P = picture(w, h), lut = B.edgeLut(0.5);
  B.compose(P.out, P.orig, P.fg, P.base, P.K, P.R, lut, w);
  eq([P.out[3], P.out[(w - 1) * 4 + 3]], [255, 0], 'no touch-up: the matte decides');
  eq([P.out[0], P.out[1], P.out[2]], [10, 20, 30], 'colour comes from the corrected foreground');
  B.stamp(P.K, P.R, w, h, 15, 5, 15, 5, 3, 'restore');
  B.compose(P.out, P.orig, P.fg, P.base, P.K, P.R, lut, w);
  const c = (5 * w + 15) * 4;
  eq([P.out[c], P.out[c + 1], P.out[c + 2], P.out[c + 3]], [200, 100, 50, 255], 'restored: solid, in the photo\'s own colour');
  B.stamp(P.K, P.R, w, h, 15, 5, 15, 5, 3, 'erase');
  B.compose(P.out, P.orig, P.fg, P.base, P.K, P.R, lut, w);
  eq(P.out[c + 3], 0, 'erase over restore: the later stroke wins');
  B.stamp(P.K, P.R, w, h, 15, 5, 15, 5, 3, 'restore');
  B.compose(P.out, P.orig, P.fg, P.base, P.K, P.R, lut, w);
  eq(P.out[c + 3], 255, 'and restore over that wins again');
  B.stamp(P.K, P.R, w, h, 3, 5, 3, 5, 2, 'erase');
  B.compose(P.out, P.orig, P.fg, P.base, P.K, P.R, lut, w);
  eq(P.out[(5 * w + 3) * 4 + 3], 0, 'erasing the subject clears it');
  const before = P.out.slice();
  B.compose(P.out, P.orig, P.fg, P.base, P.K, P.R, B.edgeLut(0.9), w);
  B.compose(P.out, P.orig, P.fg, P.base, P.K, P.R, lut, w);
  eq(arr(P.out).join(), arr(before).join(), 'moving the Edge control away and back changes nothing (touch-ups survive)');
  const P2 = picture(w, h); P2.out.fill(7);
  B.compose(P2.out, P2.orig, P2.fg, P2.base, P2.K, P2.R, lut, w, [2, 2, 4, 4]);
  check(P2.out[0] === 7 && P2.out[(2 * w + 2) * 4 + 3] === 255, 'a rectangle composes only inside it');
}

// ---------------------------------------------------------------------------------------------------------------------
if (suites.includes('stamp')) {
  section('stamp');
  const w = 50, h = 40, K = new Uint8Array(w * h), R = new Uint8Array(w * h);
  const r = B.stamp(K, R, w, h, 25, 20, 25, 20, 10, 'erase');
  eq(R[20 * w + 25], 255, 'the centre of a dab is full strength');
  eq(R[20 * w + 36], 0, 'beyond the radius nothing changes');
  check(R[20 * w + 33] > 0 && R[20 * w + 33] < 255, 'the rim is soft', R[20 * w + 33]);
  let outside = 0; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (R[y * w + x] && (x < r[0] || x >= r[2] || y < r[1] || y >= r[3])) outside++;
  eq(outside, 0, 'every changed pixel lies in the returned rectangle');
  const K2 = new Uint8Array(w * h), R2 = new Uint8Array(w * h);
  B.stamp(K2, R2, w, h, 5, 5, 45, 35, 3, 'restore');
  eq([K2[5 * w + 5], K2[20 * w + 25], K2[35 * w + 45]], [255, 255, 255], 'a segment paints its whole length');
  eq(B.stamp(K2, R2, w, h, -100, -100, -90, -90, 5, 'erase'), null, 'a stroke off the image changes nothing');
  const rr = B.stamp(K2, R2, w, h, -3, 20, 2, 20, 5, 'erase');
  check(rr && rr[0] === 0, 'a stroke that starts off the image is clipped', J(rr));
  const K3 = new Uint8Array(4), R3 = new Uint8Array(4);
  B.stamp(K3, R3, 2, 2, 1, 1, 1, 1, 0.1, 'restore');
  check(K3.some(v => v > 0), 'a tiny brush still paints (radius floor of one pixel)');
}

// ---------------------------------------------------------------------------------------------------------------------
if (suites.includes('blur')) {
  section('blur');
  const naive = (a, w, h, r) => {
    const t = new Float64Array(w * h), o = new Float64Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let s = 0, n = 0; for (let k = Math.max(0, x - r); k <= Math.min(w - 1, x + r); k++) { s += a[y * w + k]; n++; } t[y * w + x] = s / n; }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let s = 0, n = 0; for (let k = Math.max(0, y - r); k <= Math.min(h - 1, y + r); k++) { s += t[k * w + x]; n++; } o[y * w + x] = s / n; }
    return o;
  };
  let worst = 0;
  for (let trial = 0; trial < 40; trial++) {
    const w = rint(1, 30), h = rint(1, 30), r = rint(0, 40), a = new Float32Array(w * h);
    for (let i = 0; i < a.length; i++) a[i] = rnd();
    const got = B.boxBlur(a, w, h, r), want = naive(a, w, h, r);
    for (let i = 0; i < a.length; i++) worst = Math.max(worst, Math.abs(got[i] - want[i]));
  }
  check(worst < 1e-5, 'box blur matches a naive in-bounds mean on 40 random planes, radius 0 to wider than the image', worst);
}

// ---------------------------------------------------------------------------------------------------------------------
if (suites.includes('fg')) {
  section('fg');
  const V = JSON.parse(readFileSync(join(HERE, 'image_background_remover.vectors.json'), 'utf8'));
  for (const c of V.cases) {
    const got = B.estimateForeground(Uint8ClampedArray.from(c.rgba), Uint8Array.from(c.alpha), c.w, c.h);
    let mx = 0, n = 0;
    for (let i = 0; i < c.w * c.h; i++) for (let k = 0; k < 3; k++) { const d = Math.abs(got[i * 4 + k] - c.fg[i * 3 + k]); mx = Math.max(mx, d); if (d) n++; }
    check(mx <= 1, `reference vectors, ${c.name} (${c.w} × ${c.h}): within one level of the paper's code`, `max ${mx}, ${n} values differ`);
  }
  // A true composite: red subject, green background, soft edge. The estimate must be far closer to red than the photo.
  const w = 64, h = 48, rgba = new Uint8ClampedArray(w * h * 4), al = new Uint8Array(w * h), F = [220, 30, 40], Bk = [40, 180, 60];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const a = Math.min(1, Math.max(0, (16 - Math.hypot(x + .5 - 32, y + .5 - 24)) / 6)), i = y * w + x;
    al[i] = Math.round(a * 255);
    for (let k = 0; k < 3; k++) rgba[i * 4 + k] = Math.round(a * F[k] + (1 - a) * Bk[k]);
    rgba[i * 4 + 3] = 255;
  }
  const est = B.estimateForeground(rgba, al, w, h);
  let eIn = 0, eOut = 0, n = 0;
  // What shows is the colour times alpha (placed on any new background), so weigh the error by alpha.
  for (let i = 0; i < w * h; i++) if (al[i] > 0 && al[i] < 255) { const a = al[i] / 255; n++; for (let k = 0; k < 3; k++) { eIn += a * Math.abs(rgba[i * 4 + k] - F[k]); eOut += a * Math.abs(est[i * 4 + k] - F[k]); } }
  check(eOut < eIn * 0.5, 'on a true composite the visible green rim is at least halved', `photo shows ${(eIn / n / 3).toFixed(1)} levels of green rim, the estimate ${(eOut / n / 3).toFixed(1)}`);
  let same = true; for (let i = 0; i < w * h; i++) if ((al[i] === 255 || al[i] === 0) && (est[i * 4] !== rgba[i * 4] || est[i * 4 + 1] !== rgba[i * 4 + 1])) same = false;
  check(same, 'solid and empty pixels keep the photo\'s colour exactly');
  const solid = new Uint8Array(w * h).fill(255), e2 = B.estimateForeground(rgba, solid, w, h);
  check(arr(e2).every((v, i) => i % 4 === 3 ? v === 255 : v === rgba[i]), 'an all-solid matte returns the photo unchanged');
  const t0 = Date.now(); const bw = 1600, bh = 1200, bigA = new Uint8Array(bw * bh), bigI = new Uint8ClampedArray(bw * bh * 4);
  for (let i = 0; i < bigA.length; i++) { bigA[i] = (i % bw) > 800 ? 255 : (i % bw) > 780 ? 128 : 0; bigI[i * 4] = i % 251; }
  B.estimateForeground(bigI, bigA, bw, bh);
  const ms = Date.now() - t0;
  check(ms < 8000, '2 MP in a few seconds (it runs in a worker on the page)', ms + ' ms');
}

// ---------------------------------------------------------------------------------------------------------------------
if (suites.includes('export')) {
  section('export');
  const w = 6, h = 5, px = new Uint8ClampedArray(w * h * 4);
  eq(B.trimBox(px, w, h), null, 'an empty cutout has no box');
  px[(2 * w + 3) * 4 + 3] = 200;
  eq(J(B.trimBox(px, w, h)), J({x: 3, y: 2, w: 1, h: 1}), 'one pixel');
  px[(4 * w + 0) * 4 + 3] = 9;
  eq(J(B.trimBox(px, w, h)), J({x: 0, y: 2, w: 4, h: 3}), 'a faint pixel above the threshold widens it');
  px[(0 * w + 5) * 4 + 3] = 8;
  eq(J(B.trimBox(px, w, h)), J({x: 0, y: 2, w: 4, h: 3}), 'alpha 8 of 255 and below does not count');
  const full = new Uint8ClampedArray(16).fill(255);
  eq(J(B.trimBox(full, 2, 2)), J({x: 0, y: 0, w: 2, h: 2}), 'a full picture keeps its size');
  eq(B.coverage(full), 1, 'coverage of a solid picture is 1');
  eq(B.coverage(new Uint8ClampedArray(0)), 0, 'coverage of nothing is 0');
  eq(arr(B.flatten(Uint8ClampedArray.from([255, 0, 0, 128, 10, 20, 30, 0, 1, 2, 3, 255]), [0, 0, 255])), [128, 0, 127, 255, 0, 0, 255, 255, 1, 2, 3, 255], 'flatten: half red on blue, clear, solid');
  const a = Uint8Array.from([0, 1, 255]), b = Uint8Array.from([9, 8, 7]), c = Uint8Array.from([128, 0, 64]);
  const [a2, b2, c2] = B.unpack3(B.pack3(a, b, c));
  eq([arr(a2), arr(b2), arr(c2)], [arr(a), arr(b), arr(c)], 'pack3 and unpack3 round-trip three planes');
}

// ---------------------------------------------------------------------------------------------------------------------
if (suites.includes('text')) {
  section('text');
  const colors = [['#1e90ff', [30, 144, 255]], ['1E90FF', [30, 144, 255]], ['#fff', [255, 255, 255]], [' #000 ', [0, 0, 0]],
    ['rgb(30, 144, 255)', [30, 144, 255]], ['rgba(1,2,3,0.5)', [1, 2, 3]], ['30 144 255', [30, 144, 255]], ['rgb(1 2 3 / 50%)', [1, 2, 3]],
    ['#ggg', null], ['rgb(256,0,0)', null], ['', null], [null, null], ['#12345', null], ['red', null]];
  for (const [i, want] of colors) eq(J(B.parseColor(i)), J(want), `parseColor(${J(i)})`);
  eq(B.toHex([30, 144, 255]), '#1e90ff', 'toHex');
  eq(B.toHex([0, 5, 255]), '#0005ff', 'toHex pads');
  const names = [['IMG_2041.JPG', 'png', 'IMG_2041-no-bg.png'], ['holiday photo.jpeg', 'png', 'holiday photo-no-bg.png'],
    ['C:\\Users\\a\\Pictures\\dog.webp', 'jpg', 'dog-no-bg.jpg'], ['/home/a/cat.png', 'webp', 'cat-no-bg.webp'],
    ['archive.tar.gz.png', 'png', 'archive.tar.gz-no-bg.png'], ['Straße – München.jpg', 'png', 'Straße – München-no-bg.png'],
    ['写真.heic', 'png', '写真-no-bg.png'], ['what?<now>:"|*.png', 'png', 'what now-no-bg.png'], ['.png', 'png', 'image-no-bg.png'],
    ['', 'png', 'image-no-bg.png'], [undefined, 'png', 'image-no-bg.png'], ['noext', 'png', 'noext-no-bg.png'],
    ['...hidden.jpg', 'png', 'hidden-no-bg.png'], ['a'.repeat(200) + '.jpg', 'png', 'a'.repeat(80) + '-no-bg.png']];
  for (const [n, e, want] of names) eq(B.outputName(n, e), want, `outputName(${String(J(n)).slice(0, 40)})`);
  eq([B.formatBytes(999), B.formatBytes(1500), B.formatBytes(123456), B.formatBytes(4.2e6), B.formatBytes(4.2e7)], ['999 B', '1.5 KB', '123 KB', '4.2 MB', '42 MB'], 'formatBytes');
  eq(B.formatSize(4032, 3024), '4032 × 3024 px', 'formatSize');
}

// ---------------------------------------------------------------------------------------------------------------------
if (suites.includes('sniff')) {
  section('sniff');
  const b = s => Array.from(Buffer.from(s, 'latin1'));
  const cases = [
    [[0xff, 0xd8, 0xff, 0xe0, 0, 0x10], '', '', 'jpeg'], [b('\x89PNG\r\n\x1a\n\0\0'), '', '', 'png'], [b('RIFF\0\0\0\0WEBPVP8 '), '', '', 'webp'],
    [b('GIF89a\x01\0'), '', '', 'gif'], [b('GIF87a'), '', '', 'gif'], [b('BM6\0\0\0'), '', '', 'bmp'],
    [b('\0\0\0\x1cftypavif\0\0\0\0avifmif1'), '', '', 'avif'], [b('\0\0\0\x18ftypheic\0\0\0\0mif1heic'), '', '', 'heic'],
    [b('\0\0\0\x18ftypmif1\0\0\0\0mif1heic'), 'x.heic', '', 'heic'], [b('\0\0\0\x20ftypmif1\0\0\0\0mif1avifmiaf'), '', '', 'avif'],
    [b('II*\0\x08\0'), '', '', 'tiff'], [b('MM\0*\0\0'), '', '', 'tiff'], [b('\0\0\x01\0\x01\0'), '', '', 'ico'], [b('%PDF-1.7'), '', '', 'pdf'],
    [b('<svg xmlns="http://www.w3.org/2000/svg">'), '', '', 'svg'], [b('<?xml version="1.0"?>\n<svg>'), '', '', 'svg'],
    [b('\xef\xbb\xbf<?xml version="1.0"?><svg>'), '', '', 'svg'], [b('<!-- made by hand --><svg>'), '', '', 'svg'],
    [b('hello world'), 'notes.txt', 'text/plain', null], [b('{"a":1}'), 'data.json', 'application/json', null], [[], '', '', null],
    [b('garbage'), 'IMG_1.HEIC', '', 'heic'], [b('PK\x03\x04'), 'photo.zip', 'application/zip', null]];
  for (const [bytes, name, type, want] of cases) eq(B.sniff(bytes, name, type), want, `sniff ${J(String.fromCharCode(...bytes.slice(0, 12))).slice(0, 30)} ${name}`);
}

// ---------------------------------------------------------------------------------------------------------------------
if (suites.includes('page')) {
  section('page');
  let chromium = null;
  try { chromium = createRequire(import.meta.url)('playwright').chromium; } catch (e) {
    try { chromium = createRequire('/opt/node-tools/')('playwright').chromium; } catch (e2) {}
  }
  let up = false;
  try { up = (await fetch(URL_BASE)).ok; } catch (e) {}
  if (!chromium || !up) console.log(`  skipped: ${!chromium ? 'Playwright is not installed' : 'no server at ' + URL_BASE + ' (npx http-server -p 8099)'}`);
  else await pageSuite(chromium);
}

async function pageSuite(chromium) {
  const browser = await chromium.launch();
  const site = new URL(URL_BASE).origin;
  const run = async (opts, fn) => {
    const context = await browser.newContext(opts);
    const page = await context.newPage();
    const errors = [], foreign = [];
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', e => errors.push(e.message));
    if (process.env.VERBOSE) page.on('console', m => console.log('    console:', m.text().slice(0, 200)));
    page.on('request', r => { const u = r.url(); if (!u.startsWith(site) && !u.startsWith('data:') && !u.startsWith('blob:')) foreign.push(r.method() + ' ' + u); if (r.method() !== 'GET') foreign.push(r.method() + ' ' + u); });
    try { await fn(page, context); } finally {
      const real = errors.filter(e => !/favicon/.test(e));
      check(real.length === 0, 'no console errors', real.join(' | '));
      check(foreign.length === 0, 'no request leaves the site and none is a POST (the fake engine needs no model)', foreign.join(' | '));
      await context.close();
    }
  };
  const fake = URL_BASE + '?engine=fake';
  const photo = (() => {                                                 // a 300 × 200 PNG made in Node, no dependency
    const zlib = createRequire(import.meta.url)('zlib');
    const w = 300, h = 200, raw = Buffer.alloc((w * 3 + 1) * h);
    for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; for (let x = 0; x < w; x++) { const o = y * (w * 3 + 1) + 1 + x * 3; raw[o] = 40 + x % 50; raw[o + 1] = 120; raw[o + 2] = 200 - y % 60; } }
    const crc = buf => { let c, t = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } c = 0xffffffff; for (const x of buf) c = t[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
    const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
    const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
    return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
  })();
  const done = page => page.waitForFunction(() => window.__ibr.state && window.__ibr.state.fg && !window.__ibr.state.example && document.getElementById('busy').hidden, null, {timeout: 20000});
  const alphaOf = async (page, blobExpr) => page.evaluate(async expr => {
    const blob = await eval(expr); const bmp = await createImageBitmap(blob); const c = new OffscreenCanvas(bmp.width, bmp.height); const x = c.getContext('2d'); x.drawImage(bmp, 0, 0);
    const d = x.getImageData(0, 0, bmp.width, bmp.height).data; let clear = 0, solid = 0; for (let i = 3; i < d.length; i += 4) { if (d[i] === 0) clear++; if (d[i] === 255) solid++; }
    return {w: bmp.width, h: bmp.height, clear, solid, n: d.length / 4, type: blob.type};
  }, blobExpr);

  await run({viewport: {width: 1280, height: 860}, acceptDownloads: true}, async (page) => {
    await page.goto(fake);
    await page.waitForFunction(() => window.__ibr.state && window.__ibr.state.example && window.__ibr.state.fg);
    eq(await page.textContent('#metaName'), 'puppies.jpg', 'arrival: the worked example is cut out and on screen');
    check(await page.isHidden('#outActions'), 'arrival: no download for the example, the one button is "Choose a photo"');
    const cov = await page.evaluate(() => window.__ibr.BG.coverage(window.__ibr.state.out));
    check(cov > 0.2 && cov < 0.8, 'the example keeps the puppies and drops the lawn', cov);

    await page.setInputFiles('#fileInput', {name: 'My Photo (1).png', mimeType: 'image/png', buffer: photo});
    await done(page);
    eq(await page.textContent('#metaName'), 'My Photo (1).png', 'a chosen photo replaces the example');
    eq(await page.textContent('#metaSize'), '300 × 200 px', 'at its own size');
    check(/Done/.test(await page.textContent('#status')), 'the status says it is done', await page.textContent('#status'));
    check(await page.isVisible('#dlBtn'), 'Download appears');

    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#dlBtn')]);
    eq(dl.suggestedFilename(), 'My Photo (1)-no-bg.png', 'the download is named after the photo');
    const buf = readFileSync(await dl.path());
    const info = await alphaOf(page, `new Blob([new Uint8Array(${J(Array.from(buf))})], {type: 'image/png'})`);
    check(info.w === 300 && info.h === 200 && info.clear > 1000 && info.solid > 1000, 'the PNG is full size with a clear background and a solid subject', J(info));

    await page.click('.sw[data-bg="#000000"]');
    await page.click('#formatSeg [data-fmt="jpg"]');
    eq(await page.textContent('#dlLabel'), 'Download JPG', 'the button names the format');
    const [dl2] = await Promise.all([page.waitForEvent('download'), page.click('#dlBtn')]);
    eq(dl2.suggestedFilename(), 'My Photo (1)-no-bg.jpg', 'JPG name');
    const j = readFileSync(await dl2.path());
    check(j[0] === 0xff && j[1] === 0xd8, 'and it is a JPEG');
    await page.click('#formatSeg [data-fmt="png"]');
    await page.click('.sw[data-bg="transparent"]');

    await page.check('#trim');
    const trimmed = await page.evaluate(async () => { const b = document.getElementById('trim'); return true; });
    const [dl3] = await Promise.all([page.waitForEvent('download'), page.click('#dlBtn')]);
    const t = await alphaOf(page, `new Blob([new Uint8Array(${J(Array.from(readFileSync(await dl3.path())))})], {type: 'image/png'})`);
    check(trimmed && t.w < 300 && t.h < 200 && t.w > 100, 'Crop to the subject makes a smaller file around it', J(t));
    await page.uncheck('#trim');

    // Erase a stroke through the middle, undo, redo.
    const alphaAt = () => page.evaluate(() => { const s = window.__ibr.state; return s.out[(100 * s.w + 150) * 4 + 3]; });
    const before = await alphaAt();
    check(before === 255, 'the middle of the subject is solid before touching up', before);
    await page.click('#toolErase');
    const box = await page.locator('#stage').boundingBox();
    const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
    await page.mouse.move(cx - 30, cy); await page.mouse.down(); await page.mouse.move(cx + 30, cy, {steps: 6}); await page.mouse.up();
    eq(await alphaAt(), 0, 'Erase clears what it passes over');
    check(await page.isVisible('#undoRow'), 'Undo appears once there is something to undo');
    await page.keyboard.press('Control+z');
    eq(await alphaAt(), 255, 'Ctrl+Z brings it back exactly');
    await page.click('#redoBtn');
    eq(await alphaAt(), 0, 'Redo erases it again');
    await page.click('#toolMove');

    // Edge slider: higher keeps less, and the stroke survives it.
    const cov1 = await page.evaluate(() => window.__ibr.BG.coverage(window.__ibr.state.out));
    await page.locator('#edge').fill('0.85');
    await page.waitForTimeout(100);
    const cov2 = await page.evaluate(() => window.__ibr.BG.coverage(window.__ibr.state.out));
    check(cov2 < cov1, 'Edge towards "Keep less" keeps less', `${cov1} -> ${cov2}`);
    eq(await alphaAt(), 0, 'and the erased stroke stays erased');

    // Reload: the photo and the touch-up come back from this browser.
    const editedAt = await page.evaluate(() => Date.now());
    await page.waitForFunction(t => window.__ibr.savedAt > t, editedAt, {timeout: 10000});
    await page.reload();
    await page.waitForFunction(() => window.__ibr.state && window.__ibr.state.fg && !window.__ibr.state.example, null, {timeout: 15000});
    eq(await page.textContent('#metaName'), 'My Photo (1).png', 'after a reload the last photo is back');
    eq(await alphaAt(), 0, 'with its touch-ups');
    eq(await page.inputValue('#edge'), '0.85', 'and the Edge setting');

    // Bad input: text, then a HEIC this Chromium cannot decode. The current picture stays.
    await page.setInputFiles('#fileInput', {name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello')});
    await page.waitForFunction(() => /not a picture/.test(document.getElementById('fileErr').textContent), null, {timeout: 5000}).catch(() => {});
    check(/not a picture/.test(await page.textContent('#fileErr')), 'a text file is refused next to the button', await page.textContent('#fileErr'));
    check(await page.isVisible('#notice'), 'and on the picture');
    eq(await page.textContent('#metaName'), 'My Photo (1).png', 'the current cutout is kept');
    await page.setInputFiles('#fileInput', {name: 'IMG_0001.HEIC', mimeType: 'image/heic', buffer: Buffer.from('\0\0\0\x18ftypheic\0\0\0\0mif1heic', 'latin1')});
    await page.waitForFunction(() => /HEIC/.test(document.getElementById('fileErr').textContent), null, {timeout: 5000}).catch(() => {});
    check(/HEIC/.test(await page.textContent('#fileErr')), 'a HEIC this browser cannot read gets a HEIC answer', await page.textContent('#fileErr'));

    // Paste an image.
    await page.evaluate(async b64 => {
      const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0)), dt = new DataTransfer();
      dt.items.add(new File([bytes], 'image.png', {type: 'image/png'}));
      document.dispatchEvent(new ClipboardEvent('paste', {clipboardData: dt, bubbles: true}));
    }, photo.toString('base64'));
    await done(page);
    check(await page.evaluate(() => window.__ibr.state.w) === 300, 'a pasted picture is cut out too');

    await page.click('#newBtn');
    await page.waitForFunction(() => window.__ibr.state && window.__ibr.state.example);
    await page.reload();
    await page.waitForFunction(() => window.__ibr.state && window.__ibr.state.fg);
    check(await page.evaluate(() => window.__ibr.state.example), 'Start over forgets the photo: a reload shows the example');
  });

  // The old page's theme key still decides the theme.
  await run({viewport: {width: 1280, height: 860}}, async (page) => {
    await page.goto(fake);
    await page.evaluate(() => localStorage.setItem('theme', 'dark'));
    await page.reload();
    eq(await page.evaluate(() => document.documentElement.dataset.theme), 'dark', 'localStorage.theme = "dark" from the old page is honoured');
  });

  // Phone: the result and the buttons are in the first screen.
  await run({viewport: {width: 390, height: 664}, deviceScaleFactor: 2, isMobile: true, hasTouch: true}, async (page) => {
    await page.goto(fake);
    await page.waitForFunction(() => window.__ibr.state && window.__ibr.state.fg);
    const pick = await page.locator('#pickBtn').boundingBox();
    check(pick.y + pick.height <= 664, 'phone: "Choose a photo" is visible without scrolling', J(pick));
    await page.setInputFiles('#fileInput', {name: 'p.png', mimeType: 'image/png', buffer: photo});
    await done(page);
    const d = await page.locator('#dlBtn').boundingBox();
    check(d.y + d.height <= 664, 'phone: Download is visible without scrolling once the cutout is there', J(d));
    const sw = await page.evaluate(() => document.documentElement.scrollWidth);
    check(sw <= 390, 'phone: no sideways scrolling', sw);
  });
  await browser.close();
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
