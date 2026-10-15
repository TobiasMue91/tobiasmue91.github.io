#!/usr/bin/env node
// Test suite for tools/image_cropper.html (Image Cropper).
//
// Runs the page's DOM-free <script id="core"> block in Node. The page promises that the file holds exactly the
// part of the photo inside the frame, turned and flipped the way the screen shows, at the size it names. So:
// the draw matrix is checked pixel for pixel against crops, quarter turns and flips done the plain way on a
// grid of numbered pixels; every drag, move, ratio change and straighten on thousands of random photos keeps
// the frame inside the photo (against brute-force corner tests) with the anchor still and the ratio held; the
// largest frame for a ratio really is the largest; whole-number ratios give files of exactly that ratio;
// brightness and contrast follow the CSS Filter Effects formulas; and the numbers people type (1 080 px,
// 12,5, 1,080, 16:9, 4x5, 1.91) are read the way they mean them, with errors that say what is accepted.
//
//   node test/image_cropper.mjs              # everything
//   node test/image_cropper.mjs drag matrix  # named suites only
//
// Suites: numbers, ratio, fit, drag, snap, matrix, output, adjust, files, settings.

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = join(HERE, '..', 'tools', 'image_cropper.html');
const ALL = ['numbers', 'ratio', 'fit', 'drag', 'snap', 'matrix', 'output', 'adjust', 'files', 'settings'];
const picked = process.argv.slice(2).filter(a => !a.startsWith('--'));
const suites = picked.length ? picked : ALL;

let failures = 0, passes = 0;
const check = (ok, what, detail) => { if (ok) passes++; else { failures++; console.log(`  FAIL  ${what}${detail ? '\n          ' + detail : ''}`); } };
const eq = (got, want, what) => check(JSON.stringify(got) === JSON.stringify(want), what, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
const near = (got, want, tol, what) => check(Math.abs(got - want) <= tol, what, `got ${got}, want ${want} ± ${tol}`);
const section = name => console.log(`\n=== ${name} ===`);

const html = readFileSync(PAGE, 'utf8');
const src = html.match(/<script id="core">([\s\S]*?)<\/script>/)[1];
const ctx = {module: {exports: {}}, Uint8ClampedArray};
vm.runInNewContext(src, ctx);
const C = ctx.module.exports;

let seed = 20261015;
const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));

// A plain inside test written apart from the core: every corner, rotated back, within the photo.
function inside(r, W, H, a, tol = 1e-4) {
  const c = Math.cos(-a), s = Math.sin(-a);
  for (const [x, y] of [[r.x, r.y], [r.x + r.w, r.y], [r.x, r.y + r.h], [r.x + r.w, r.y + r.h]]) {
    const dx = x - W / 2, dy = y - H / 2, u = c * dx - s * dy, v = s * dx + c * dy;
    if (Math.abs(u) > W / 2 + tol || Math.abs(v) > H / 2 + tol) return false;
  }
  return r.w > 0 && r.h > 0;
}
const randPhoto = () => ({W: ri(1, 6000), H: ri(1, 6000), a: rnd() < 0.4 ? 0 : (rnd() - 0.5) * Math.PI / 2});

if (suites.includes('numbers')) {
  section('numbers people type');
  const N = t => { const r = C.parseNumber(t); return r.ok ? r.value : 'ERR'; };
  const cases = [['1080', 1080], [' 1080 ', 1080], ['1080px', 1080], ['1080 px', 1080], ['1 080', 1080], ['1 080', 1080],
    ['1,080', 1080], ['1.080.000', 1080000], ['12,345,678', 12345678], ['12,5', 12.5], ['12.5', 12.5], ['0,5', 0.5], ['.5', 0.5],
    ['1.080', 1.08], ['１０８０', 1080], ['−5', -5], ['-5', -5], ['0', 0], ['', 'ERR'], ['  ', 'ERR'], ['abc', 'ERR'], ['12a', 'ERR'],
    ['1e3', 'ERR'], ['1,2,3', 'ERR'], ['Infinity', 'ERR'], ['NaN', 'ERR'], ["1'080", 1080], ['1080 pixels', 1080]];
  for (const [t, w] of cases) eq(N(t), w, `parseNumber(${JSON.stringify(t)})`);
  const P = t => { const r = C.parsePixels(t); return r.ok ? r.value : r.error; };
  eq(P('1080'), 1080, 'pixels 1080'); eq(P('100.7'), 101, 'pixels round, not truncate'); eq(P('12,5'), 13, 'decimal comma rounds');
  eq(P('0.4'), 'must be at least 1 px', 'below one pixel'); eq(P('-5'), 'must be at least 1 px', 'negative');
  eq(P('0'), 'must be at least 1 px', 'zero'); eq(P('16384'), 16384, 'largest side'); eq(P('16385'), 'can be at most 16,384 px', 'over the canvas limit');
  eq(P(''), 'is empty – enter pixels, like 1080', 'empty names what to enter'); eq(P('ten'), 'needs digits only, like 1080', 'words');
}

if (suites.includes('ratio')) {
  section('ratios');
  const R = t => { const r = C.parseRatio(t); return r.ok ? +r.value.toFixed(6) : 'ERR'; };
  for (const [t, w] of [['16:9', 16 / 9], ['16/9', 16 / 9], ['16x9', 16 / 9], ['16 × 9', 16 / 9], ['16 X 9', 16 / 9], ['4:5', .8], ['4 by 5', .8],
    ['1.91', 1.91], ['1.91:1', 1.91], ['1,91:1', 1.91], ['4,5:3', 1.5], [' 1 : 1 ', 1], ['１６：９', 16 / 9], ['1080x1350', .8], ['2:3:4', 'ERR'],
    ['16:', 'ERR'], [':9', 'ERR'], ['0:1', 'ERR'], ['-4:5', 'ERR'], ['', 'ERR'], ['abc', 'ERR'], ['1:1000', 'ERR'], ['100:1', 100]])
    eq(R(t), w === 'ERR' ? w : +w.toFixed(6), `parseRatio(${JSON.stringify(t)})`);
  eq(C.parseRatio('16:').error, 'Use two numbers, like 4:5.', 'error says what is accepted');
  const L = C.ratioLabel;
  eq(L(1080, 1080), '1:1', 'label 1:1'); eq(L(1080, 1350), '4:5', 'label 4:5'); eq(L(1920, 1080), '16:9', 'label 16:9');
  eq(L(852, 1065), '4:5', 'label of a snapped 4:5'); eq(L(1280, 853), '≈ 3:2', 'near a common ratio is marked ≈');
  eq(L(1000, 333), '≈ 3:1', 'near 3:1'); eq(L(1234, 567), '2.18:1', 'no common ratio');
}

if (suites.includes('fit')) {
  section('largest frame, ratio changes, straighten');
  let bad = 0, notMax = 0;
  for (let i = 0; i < 4000; i++) {
    const {W, H, a} = randPhoto(), ratio = rnd() < 0.2 ? null : Math.exp((rnd() - 0.5) * 6);
    const m = C.maxRect(W, H, a, ratio);
    if (!inside(m, W, H, a, 1e-6 * Math.max(W, H))) bad++;
    const g = {x: m.x - m.w * 0.0005, y: m.y - m.h * 0.0005, w: m.w * 1.001, h: m.h * 1.001};
    if (inside(g, W, H, a, 0)) notMax++;
    if (ratio && Math.abs(m.w / m.h - ratio) > 1e-9 * ratio) bad++;
  }
  eq(bad, 0, 'the largest frame for a ratio stays inside the straightened photo, at that ratio (4000 photos)');
  eq(notMax, 0, 'and 0.1 % larger it would not');
  eq(C.maxRect(4000, 3000, 0, 1), {x: 500, y: 0, w: 3000, h: 3000}, '1:1 on 4000×3000 is the middle 3000×3000');
  const m45 = C.maxRect(600, 900, 0, 1); eq([m45.w, m45.h], [600, 600], '1:1 on a portrait 600×900 is 600×600');
  bad = 0;
  for (let i = 0; i < 3000; i++) {
    const {W, H, a} = randPhoto(), w = rnd() * W, h = rnd() * H;
    const r0 = C.fit({x: rnd() * W - w / 2, y: rnd() * H - h / 2, w: w + 0.01, h: h + 0.01}, W, H, a);
    if (!inside(r0, W, H, a, 1e-6 * Math.max(W, H))) bad++;
    const ratio = Math.exp((rnd() - 0.5) * 5), r1 = C.setRatio(r0, ratio, W, H, a);
    if (!inside(r1, W, H, a, 1e-6 * Math.max(W, H)) || Math.abs(r1.w / r1.h / ratio - 1) > 1e-6) bad++;
  }
  eq(bad, 0, 'fit and setRatio always land inside, at the asked ratio (3000 random frames)');
  const r = {x: 100, y: 100, w: 200, h: 100}, f = C.fit(r, 1000, 1000, 0);
  eq(f, r, 'a frame already inside is left exactly where it is');
  const s = C.setRatio({x: 400, y: 400, w: 200, h: 200}, 4, 1000, 1000, 0);
  near(s.x + s.w / 2, 500, 1e-9, 'a ratio change keeps the centre'); near(s.w * s.h, 40000, 1e-6, 'and the area');
}

if (suites.includes('drag')) {
  section('drags and moves');
  const H8 = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
  let out = 0, ratioOff = 0, anchorMoved = 0, small = 0, sizeChanged = 0;
  for (let i = 0; i < 6000; i++) {
    const {W, H, a} = randPhoto(), ratio = rnd() < 0.5 ? null : Math.exp((rnd() - 0.5) * 4);
    let r = C.maxRect(W, H, a, ratio || null); r = C.scaleRect(r, 0.3 + rnd() * 0.6, W, H, a, 1);
    const h = H8[ri(0, 7)], dx = (rnd() - 0.5) * W * 2.5, dy = (rnd() - 0.5) * H * 2.5;
    const n = C.dragHandle(r, h, dx, dy, ratio, W, H, a, 1);
    if (!inside(n, W, H, a, 1e-6 * Math.max(W, H))) out++;
    if (ratio && Math.abs(n.w / n.h / ratio - 1) > 1e-6) ratioOff++;
    if (!ratio || h.length === 2) {
      // the opposite corner (or edge) stays put
      const ax = h.includes('w') ? r.x + r.w : h.includes('e') ? r.x : null, ay = h.includes('n') ? r.y + r.h : h.includes('s') ? r.y : null;
      const nx = h.includes('w') ? n.x + n.w : n.x, ny = h.includes('n') ? n.y + n.h : n.y;
      if ((ax !== null && Math.abs(nx - ax) > 1e-6 * W) || (ay !== null && Math.abs(ny - ay) > 1e-6 * H)) anchorMoved++;
    }
    if (n.w < 1 - 1e-9 && r.w >= 1 || n.h < 1 - 1e-9 && r.h >= 1) small++;
    const m = C.moveRect(r, dx, dy, W, H, a);
    if (!inside(m, W, H, a, 1e-6 * Math.max(W, H))) out++;
    if (Math.abs(m.w - r.w) > 1e-9 || Math.abs(m.h - r.h) > 1e-9) sizeChanged++;
  }
  eq(out, 0, 'no drag or move ever leaves the photo (6000 random drags, straightened or not)');
  eq(ratioOff, 0, 'a locked ratio holds through every drag');
  eq(anchorMoved, 0, 'the corner or edge opposite the handle stays put');
  eq(small, 0, 'a frame never collapses below one pixel');
  eq(sizeChanged, 0, 'moving never resizes');
  // a frame pushed into a wall slides along it instead of stopping
  const sl = C.moveRect({x: 0, y: 100, w: 100, h: 100}, -50, 50, 1000, 1000, 0);
  eq([sl.x, sl.y], [0, 150], 'a move into the left edge still slides down');
  const e = C.dragHandle({x: 100, y: 100, w: 100, h: 100}, 'e', 5000, 0, null, 1000, 1000, 0, 1);
  eq([e.x, e.w], [100, 900], 'dragging the right edge far stops at the photo edge');
  const nw = C.dragHandle({x: 100, y: 100, w: 100, h: 100}, 'nw', 500, 500, null, 1000, 1000, 0, 1);
  eq([nw.w, nw.h], [1, 1], 'dragging a corner past its opposite stops at one pixel');
}

if (suites.includes('snap')) {
  section('whole-number ratios are exact');
  let bad = 0;
  for (let i = 0; i < 4000; i++) {
    const W = ri(10, 8000), H = ri(10, 8000), p = ri(1, 21), q = ri(1, 21);
    let r = C.maxRect(W, H, 0, p / q); r = C.scaleRect(r, 0.2 + rnd() * 0.8, W, H, 0, 1);
    const s = C.snapToRatio(r, p, q);
    if (s === r) continue;
    const px = C.cropPixels(s);
    if (px.w * q !== px.h * p || !inside(s, W, H, 0, 1e-9) || s.x < r.x - 1e-6 || s.x + s.w > r.x + r.w + 1e-6 ||
        !Number.isInteger(s.x) || !Number.isInteger(s.y) || s.w < r.w - p - 2 * p || px.w !== s.w) bad++;
  }
  eq(bad, 0, 'snapped frames are whole pixels, exactly p:q, inside the frame they came from and at most one step smaller');
  const s = C.snapToRatio({x: 373.6, y: 0, w: 853.4, h: 1066.8}, 4, 5);
  eq([s.w, s.h], [852, 1065], '4:5 on the example photo gives 852 × 1065');
  eq(C.snapToRatio({x: 103.4, y: 50.6, w: 2792, h: 2792}, 1, 1), {x: 103, y: 51, w: 2792, h: 2792}, 'a frame that was only moved keeps its size');
  eq(C.snapToRatio({x: 0, y: 0, w: 3, h: 3}, 16, 9), {x: 0, y: 0, w: 3, h: 3}, 'too small to snap: left alone');
}

if (suites.includes('matrix')) {
  section('the file holds exactly the crop, turned and flipped');
  // Reference written the plain way: a numbered source grid, turned with array indices, flipped, cropped.
  const grid = (w, h) => Array.from({length: h}, (_, y) => Array.from({length: w}, (_, x) => y * w + x));
  const turnCW = g => g[0].map((_, x) => g.map(row => row[x]).reverse());
  const ref = (w, h, q, fh, fv, px) => {
    let g = grid(w, h); for (let i = 0; i < q; i++) g = turnCW(g);
    if (fh) g = g.map(r => r.slice().reverse()); if (fv) g = g.slice().reverse();
    return g.slice(px.y, px.y + px.h).map(r => r.slice(px.x, px.x + px.w));
  };
  // The core's way: sample the source at the centre of each output pixel through the inverse matrix.
  const inv = M => { const d = M[0] * M[3] - M[1] * M[2]; return [M[3] / d, -M[1] / d, -M[2] / d, M[0] / d, (M[2] * M[5] - M[3] * M[4]) / d, (M[1] * M[4] - M[0] * M[5]) / d]; };
  const render = (w, h, q, fh, fv, a, r, ow, oh) => {
    const I = inv(C.drawMatrix(w, h, q, fh, fv, a, r, ow, oh)), out = [];
    for (let y = 0; y < oh; y++) { const row = []; for (let x = 0; x < ow; x++) { const [sx, sy] = C.apply(I, x + 0.5, y + 0.5); row.push(sx >= 0 && sy >= 0 && sx < w && sy < h ? Math.floor(sy) * w + Math.floor(sx) : -1); } out.push(row); }
    return out;
  };
  let bad = 0, n = 0;
  for (let i = 0; i < 1500; i++) {
    const w = ri(1, 13), h = ri(1, 13), q = ri(0, 3), fh = rnd() < .5, fv = rnd() < .5, T = C.turnedSize(w, h, q);
    const x = ri(0, T.w - 1), y = ri(0, T.h - 1), px = {x, y, w: ri(1, T.w - x), h: ri(1, T.h - y)};
    const got = render(w, h, q, fh, fv, 0, px, px.w, px.h), want = ref(w, h, q, fh, fv, px);
    n++; if (JSON.stringify(got) !== JSON.stringify(want)) { bad++; if (bad < 3) console.log('   ', {w, h, q, fh, fv, px}, JSON.stringify(got), JSON.stringify(want)); }
  }
  eq(bad, 0, `${n} random crops of turned and flipped grids match the plain reference pixel for pixel`);
  // with q turns the work space has the turned size, and the four turns come back home
  eq(C.turnedSize(4000, 3000, 1), {w: 3000, h: 4000}, 'a quarter turn swaps the sides'); eq(C.turnedSize(4000, 3000, -2), {w: 4000, h: 3000}, 'a half turn does not');
  // scaling: a 2x enlargement of a crop repeats each source pixel in a 2x2 block
  const big = render(4, 4, 0, false, false, 0, {x: 1, y: 1, w: 2, h: 2}, 4, 4);
  eq(big, [[5, 5, 6, 6], [5, 5, 6, 6], [9, 9, 10, 10], [9, 9, 10, 10]], 'resizing scales the crop, not something else');
  // straighten: the centre of the photo stays the centre, and every output pixel of a fitted crop comes from the photo
  let outside = 0;
  for (let i = 0; i < 400; i++) {
    const w = ri(20, 400), h = ri(20, 400), q = ri(0, 3), a = (rnd() - .5) * Math.PI / 2, T = C.turnedSize(w, h, q);
    const r = C.scaleRect(C.maxRect(T.w, T.h, a, null), .5 + rnd() * .5, T.w, T.h, a, 1);
    const M = C.drawMatrix(w, h, q, rnd() < .5, rnd() < .5, a, r, 50, 50), I = inv(M);
    for (const [ox, oy] of [[0, 0], [50, 0], [0, 50], [50, 50], [25, 25]]) { const [sx, sy] = C.apply(I, ox, oy); if (sx < -1e-6 || sy < -1e-6 || sx > w + 1e-6 || sy > h + 1e-6) outside++; }
    const [cx, cy] = C.apply(C.drawMatrix(w, h, q, false, false, a, {x: 0, y: 0, w: T.w, h: T.h}, T.w, T.h), w / 2, h / 2);
    if (Math.abs(cx - T.w / 2) > 1e-6 || Math.abs(cy - T.h / 2) > 1e-6) outside++;
  }
  eq(outside, 0, 'a straightened crop never reaches past the photo, so no empty corners');
  // a positive straighten angle turns the photo clockwise on screen (y points down)
  const [tx, ty] = C.apply(C.drawMatrix(100, 100, 0, false, false, Math.PI / 2, {x: 0, y: 0, w: 100, h: 100}, 100, 100), 100, 50);
  near(tx, 50, 1e-9, 'clockwise: the right edge goes to the bottom (x)'); near(ty, 100, 1e-9, 'clockwise: the right edge goes to the bottom (y)');
}

if (suites.includes('snap')) {
  section('edges a released handle lands on');
  eq(C.findEdge([30, 30, 30, 30, 250, 250, 250]), 4, 'dark desk to white receipt: the boundary before the first white column');
  eq(C.findEdge([250, 249, 251, 30, 31, 30]), 3, 'white to dark');
  eq(C.findEdge([30, 32, 34, 36, 38, 40]), -1, 'a gradient is not an edge');
  eq(C.findEdge([100, 110, 100, 110, 100]), -1, 'texture is not an edge');
  eq(C.findEdge([0, 10, 20, 30, 60, 70]), -1, 'a step not four times the usual one is not an edge');
  eq(C.findEdge([5, 200]), -1, 'too short to judge');
  let wrong = 0;
  for (let i = 0; i < 2000; i++) {
    const n = ri(6, 60), at = ri(1, n - 1), a = ri(0, 255), b = (a + ri(40, 215)) % 256;
    if (Math.abs(a - b) < 40) continue;
    const prof = Array.from({length: n}, (_, k) => (k < at ? a : b) + (rnd() - .5) * 4);
    if (C.findEdge(prof) !== at) wrong++;
  }
  eq(wrong, 0, '2000 noisy steps are found at the exact column');
}

if (suites.includes('output')) {
  section('output size');
  const r = {x: 10.4, y: 0, w: 99.2, h: 50};
  eq(C.cropPixels(r), {x: 10, y: 0, w: 100, h: 50}, 'pixels snap to the grid by the edges');
  const o = C.outputSize({x: 0, y: 0, w: 3000, h: 2000}, {mode: 'none'}); eq([o.w, o.h, o.upscaled, o.error], [3000, 2000, false, null], 'no resize: the crop as it is');
  const w = C.outputSize({x: 0, y: 0, w: 3000, h: 2000}, {mode: 'width', w: 1200}); eq([w.w, w.h], [1200, 800], 'to a width keeps the shape');
  const h = C.outputSize({x: 0, y: 0, w: 3000, h: 2000}, {mode: 'height', h: 333}); eq([h.w, h.h], [500, 333], 'to a height rounds the other side');
  const x = C.outputSize({x: 0, y: 0, w: 600, h: 600}, {mode: 'exact', w: 1200, h: 1200}); eq([x.w, x.h, x.upscaled], [1200, 1200, true], 'enlarging is flagged');
  check(!!C.outputSize({x: 0, y: 0, w: 100, h: 10}, {mode: 'width', w: 16384}).error === false, '16384 wide is allowed');
  check(!!C.outputSize({x: 0, y: 0, w: 10, h: 100}, {mode: 'width', w: 16384}).error, 'but not when the height would be 163840');
  eq(C.outputSize({x: 0, y: 0, w: 1, h: 1}, {mode: 'exact', w: 16384, h: 16384}).error, null, 'the largest square a browser draws is allowed');
  eq(C.outputSize({x: 0, y: 0, w: 0.3, h: 0.3}, {mode: 'none'}).w, 1, 'a 1×1 photo still gives a 1×1 file');
}

if (suites.includes('adjust')) {
  section('brightness and contrast (Filter Effects 1)');
  const px = v => { const d = new Uint8ClampedArray([v, v, v, 77]); return C.adjustPixels(d, 0, 0) && d; };
  const adj = (v, b, c) => { const d = new Uint8ClampedArray([v, 0, 255, 77]); C.adjustPixels(d, b, c); return [...d]; };
  eq(adj(100, 0, 0), [100, 0, 255, 77], 'zero changes nothing');
  eq(adj(100, 50, 0), [150, 0, 255, 77], 'brightness +50 multiplies by 1.5');
  eq(adj(200, 50, 0), [255, 0, 255, 77], 'and clamps at white');
  eq(adj(100, -100, 0), [0, 0, 0, 77], 'brightness -100 is black');
  eq(adj(200, 0, 100), [255, 0, 255, 77], 'contrast +100 doubles the distance from the middle');
  eq(adj(100, 0, 100), [73, 0, 255, 77], 'contrast below the middle: (100/255 - .5)*2 + .5');
  eq(adj(100, 0, -100), [128, 128, 128, 77], 'contrast -100 is flat grey');
  eq(adj(200, 50, -50), [191, 64, 191, 77], 'brightness first, then contrast');
  check(px(5)[3] === 77, 'alpha is never touched');
}

if (suites.includes('files')) {
  section('file names and types');
  eq(C.fileName('IMG_0001.HEIC', 1080, 1080, 'image/jpeg'), 'IMG_0001-cropped-1080x1080.jpg', 'camera name');
  eq(C.fileName('holiday photo.png', 800, 600, 'image/png'), 'holiday photo-cropped-800x600.png', 'spaces kept');
  eq(C.fileName('a/b:c*?.jpg', 1, 1, 'image/webp'), 'a-b-c-cropped-1x1.webp', 'characters no file system allows');
  eq(C.fileName('x-cropped-100x100.jpg', 50, 50, 'image/jpeg'), 'x-cropped-50x50.jpg', 'a re-crop does not stack suffixes');
  eq(C.fileName('', 10, 10, 'image/png'), 'image-cropped-10x10.png', 'no name');
  eq(C.fileName('..jpg', 10, 10, 'image/png'), 'image-cropped-10x10.png', 'only dots');
  eq(C.fileName('Ünïcödé 写真.webp', 3, 4, 'image/webp'), 'Ünïcödé 写真-cropped-3x4.webp', 'non-ASCII kept');
  eq(C.fileName('x'.repeat(300) + '.png', 1, 1, 'image/png').length, 80 + '-cropped-1x1.png'.length, 'long names cut');
  eq(C.defaultFormat('image/jpeg'), 'image/jpeg', 'JPEG stays JPEG'); eq(C.defaultFormat('image/png'), 'image/png', 'PNG stays PNG');
  eq(C.defaultFormat('image/webp'), 'image/webp', 'WebP stays WebP'); eq(C.defaultFormat('image/gif'), 'image/png', 'GIF becomes PNG');
  eq(C.defaultFormat('image/heic'), 'image/png', 'HEIC becomes PNG'); eq(C.defaultFormat(''), 'image/png', 'unknown becomes PNG');
  eq([C.formatBytes(0), C.formatBytes(999), C.formatBytes(1000), C.formatBytes(45231), C.formatBytes(2345678), C.formatBytes(23456789)],
     ['0 B', '999 B', '1.0 KB', '45 KB', '2.35 MB', '23.5 MB'], 'byte counts');
}

if (suites.includes('settings')) {
  section('saved settings trust nothing');
  const d = {ratio: 'free', type: 'auto', quality: 0.92, resize: {mode: 'none'}};
  for (const raw of [null, '', 'not json', '[]', '{"ratio":5}', '{"__proto__":{"x":1}}']) eq(C.cleanSettings(raw), d, `defaults from ${JSON.stringify(raw)}`);
  eq(C.cleanSettings({ratio: '4:5', type: 'image/webp', quality: 0.8, resize: {mode: 'width', w: '1200'}}),
     {ratio: '4:5', type: 'image/webp', quality: 0.8, resize: {mode: 'width', w: 1200}}, 'a good save round-trips');
  eq(C.cleanSettings({ratio: '<img onerror>', type: 'text/html', quality: 9, resize: {mode: 'exact', w: 99999, h: 5}}), d, 'hostile values fall back');
  eq(C.cleanSettings(JSON.stringify({ratio: 'original', quality: 0.05})).quality, 0.92, 'quality below 10 % is refused');
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
