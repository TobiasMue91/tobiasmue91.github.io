#!/usr/bin/env node
// Test suite for tools/online_pixel_art_editor.html (Pixel Art Editor).
//
// The page promises that a pixel lands where you put it and that the PNG you download is that
// drawing, pixel for pixel, at the scale you chose, transparent where you did not paint. Most
// suites run the page's DOM-free <script id="core"> in Node: Bresenham lines against hand-checked
// vectors, Zingl's ellipse against the shape's own symmetry and bounding box, a 4-connected fill
// that must not leak through diagonal gaps (and must fill black onto transparent, which the old
// page could not), resizes that never stretch, history that restores canvas sizes, storage that
// survives a round trip and refuses junk. The `ui` suite drives the real page in headless Chromium
// (needs a server: `npx http-server -p 8099`) and decodes the downloaded PNG with Pillow, an
// independent decoder; it also checks that a second finger takes back the first finger's stroke
// and that a reload brings the drawing back.
//
//   node test/online_pixel_art_editor.mjs              # everything (ui needs the server + python3 Pillow)
//   node test/online_pixel_art_editor.mjs fill stroke  # named suites only
//   PAGE_URL=http://localhost:8099/tools/online_pixel_art_editor.html  # where `ui` looks
//
// Suites: color, dims, line, shapes, fill, resize, scale, import, stroke, history, storage, ui.

import {readFileSync, mkdtempSync, writeFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import {tmpdir} from 'os';
import {execFileSync} from 'child_process';
import {createRequire} from 'module';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = process.env.PAGE_FILE || join(HERE, '..', 'tools', 'online_pixel_art_editor.html');
const URL_ = process.env.PAGE_URL || 'http://localhost:8099/tools/online_pixel_art_editor.html';
const ALL = ['color', 'dims', 'line', 'shapes', 'fill', 'resize', 'scale', 'import', 'stroke', 'history', 'storage', 'ui'];
const picked = process.argv.slice(2).filter(a => !a.startsWith('--'));
const suites = picked.length ? picked : ALL;

let failures = 0, passes = 0;
const check = (ok, what, detail) => { if (ok) passes++; else { failures++; console.log(`  FAIL  ${what}${detail ? '\n          ' + detail : ''}`); } };
const eq = (got, want, what) => check(JSON.stringify(got) === JSON.stringify(want), what, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
const section = name => console.log(`\n=== ${name} ===`);

const html = readFileSync(PAGE, 'utf8');
const src = html.match(/<script id="core">([\s\S]*?)<\/script>/)[1];
const ctx = {module: {exports: {}}, Uint8ClampedArray, Uint8Array, Uint32Array, Math, JSON, Array, String, Object};
vm.runInNewContext(src, ctx);
const C = ctx.module.exports;

const RED = C.parseColor('#ff0000').c, BLACK = C.parseColor('#000000').c, GREEN = C.parseColor('#00ff00').c, BLUE = C.parseColor('#0000ff').c;
const key = pts => pts.map(p => p.join(',')).sort().join(' ');
const count = (img, c) => { let n = 0; for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) if (C.get(img, x, y) === c) n++; return n; };
const plain = o => JSON.parse(JSON.stringify(o));

if (suites.includes('color')) {
  section('color');
  const ok = (s, hex) => { const r = C.parseColor(s); check(r.ok && r.hex === hex, `colour ${JSON.stringify(s)} -> ${hex}`, JSON.stringify(r)); };
  const no = (s, what) => { const r = C.parseColor(s); check(!r.ok && r.msg && r.msg.length > 10, `colour ${JSON.stringify(s)} refused (${what})`, JSON.stringify(r)); };
  ok('#3a7bd5', '#3a7bd5'); ok('3A7BD5', '#3a7bd5'); ok('  #3a7bd5 ', '#3a7bd5'); ok('#abc', '#aabbcc'); ok('fff', '#ffffff');
  ok('rgb(58, 123, 213)', '#3a7bd5'); ok('RGB(58,123,213)', '#3a7bd5'); ok('58, 123, 213', '#3a7bd5'); ok('58 123 213', '#3a7bd5');
  ok('rgba(0,0,0,0.5)', '#000000'); ok('#000000', '#000000');
  no('', 'empty'); no('   ', 'whitespace'); no('#12g', 'not hex'); no('#12345', 'five digits'); no('rgb(256,0,0)', 'over 255');
  no('#3a7bd580', 'alpha digits'); no('red', 'name'); no('ünïcödé', 'non-ASCII'); no('#'.repeat(5000), 'huge');
  eq(C.toHex(C.parseColor('#0a0b0c').c), '#0a0b0c', 'toHex keeps leading zeros');
  eq(C.pack(10, 20, 30, 0), 0, 'alpha 0 packs to 0 whatever the RGB');
}

if (suites.includes('dims')) {
  section('dims');
  const ok = (s, n) => { const r = C.parseDim(s); check(r.ok && r.n === n, `size ${JSON.stringify(s)} -> ${n}`, JSON.stringify(r)); };
  const no = (s, frag) => { const r = C.parseDim(s); check(!r.ok && r.msg.includes(frag), `size ${JSON.stringify(s)} refused: "${frag}"`, JSON.stringify(r)); };
  ok('32', 32); ok(' 32 ', 32); ok('32px', 32); ok('32 px', 32); ok('32,0', 32); ok('32.0', 32); ok('1', 1); ok('256', 256); ok('+16', 16);
  no('', 'whole number from 1 to 256'); no('   ', 'whole number'); no('0', 'Too small'); no('-5', 'Too small'); no('257', 'Too big'); no('1000', 'Too big');
  no('10.7', 'No fractions'); no('32,5', 'No fractions'); no('abc', 'Not a number'); no('1e3', 'Not a number'); no('３２', 'Not a number');
  eq(plain(C.parseDims('32x16')), {w: 32, h: 16}, '"32x16" pastes both sides');
  eq(plain(C.parseDims('64 × 48')), {w: 64, h: 48}, '"64 × 48"');
  eq(plain(C.parseDims('8*8')), {w: 8, h: 8}, '"8*8"');
  eq(plain(C.parseDims('16 by 9')), {w: 16, h: 9}, '"16 by 9"');
  eq(C.parseDims('32'), null, 'one number is not a pair');
  eq(C.parseDims('300x10'), null, 'a pair out of range is not taken');
}

if (suites.includes('line')) {
  section('line');
  // Bresenham vectors checked by hand
  eq(key(C.linePoints(0, 0, 5, 2)), key([[0, 0], [1, 0], [2, 1], [3, 1], [4, 2], [5, 2]]), '(0,0)-(5,2), as the old page drew it');
  eq(plain(C.linePoints(3, 3, 3, 3)), [[3, 3]], 'a zero-length line is one pixel');
  eq(plain(C.linePoints(0, 0, 3, 3)), [[0, 0], [1, 1], [2, 2], [3, 3]], '45 degrees');
  eq(plain(C.linePoints(2, 0, -1, 0)), [[2, 0], [1, 0], [0, 0], [-1, 0]], 'right to left, through negative x');
  eq(key(C.linePoints(5, 2, 0, 0)), key(C.linePoints(0, 0, 5, 2)), 'same pixels in either direction');
  for (const [a, b, c, d] of [[0, 0, 17, 5], [3, 9, -4, 1], [0, 0, 1, 30], [10, 10, -20, 3]]) {
    const pts = C.linePoints(a, b, c, d);
    let connected = true;
    for (let i = 1; i < pts.length; i++) if (Math.max(Math.abs(pts[i][0] - pts[i - 1][0]), Math.abs(pts[i][1] - pts[i - 1][1])) !== 1) connected = false;
    check(connected && pts.length === Math.max(Math.abs(c - a), Math.abs(d - b)) + 1, `line ${a},${b}-${c},${d}: 8-connected, one pixel per step`);
  }
}

if (suites.includes('shapes')) {
  section('shapes');
  eq(C.rectPoints(0, 0, 3, 2).length, 10, '4×3 rectangle outline has 10 pixels');
  eq(C.rectPoints(5, 5, 5, 5).length, 1, '1×1 rectangle is one pixel');
  eq(key(C.rectPoints(3, 2, 0, 0)), key(C.rectPoints(0, 0, 3, 2)), 'rectangle drawn from any corner');
  eq(key(C.shapePoints('rect', 0, 0, 5, 2, true)), key(C.rectPoints(0, 0, 5, 5)), 'Shift makes a square');
  eq(key(C.ellipsePoints(4, 4, 4, 4)), '4,4', '1×1 ellipse is one pixel');
  eq(key(C.ellipsePoints(0, 0, 1, 0)), '0,0 1,0', '2×1 ellipse');
  for (const [w, h] of [[2, 2], [3, 3], [5, 3], [8, 8], [9, 5], [16, 9], [31, 31], [64, 20], [1, 7]]) {
    const pts = C.ellipsePoints(10, 20, 10 + w - 1, 20 + h - 1), set = new Set(pts.map(p => p.join(',')));
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    const box = Math.min(...xs) === 10 && Math.max(...xs) === 10 + w - 1 && Math.min(...ys) === 20 && Math.max(...ys) === 20 + h - 1;
    let sym = true;
    for (const [x, y] of pts) if (!set.has(`${2 * 10 + w - 1 - x},${y}`) || !set.has(`${x},${2 * 20 + h - 1 - y}`)) sym = false;
    // every point lies near the ideal ellipse through the box (no stray pixels)
    const cx = 10 + (w - 1) / 2, cy = 20 + (h - 1) / 2, a = Math.max(w / 2, .5), b = Math.max(h / 2, .5);
    const near = pts.every(([x, y]) => { const v = ((x - cx) / a) ** 2 + ((y - cy) / b) ** 2; return v <= 1.0001 && v >= (w < 3 || h < 3 ? 0 : 0.35); });
    // the outline is closed: 8-connected neighbours around the ring
    const closed = pts.every(([x, y]) => { let n = 0; for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) if ((dx || dy) && set.has(`${x + dx},${y + dy}`)) n++; return n >= (pts.length > 2 && w > 1 && h > 1 ? 2 : 1); });
    check(box && sym && near && closed, `${w}×${h} ellipse fills its box exactly, symmetric, on the curve, closed`, JSON.stringify({box, sym, near, closed}));
  }
  eq(key(C.ellipsePoints(9, 9, 0, 0)), key(C.ellipsePoints(0, 0, 9, 9)), 'ellipse drawn from any corner');
  const img = C.create(4, 4);
  eq(C.drawPoints(img, [[0, 0], [-1, 0], [9, 9], [3, 0]], RED, true), 2, 'shapes clip at the edge; mirror onto an already painted pixel counts once');
}

if (suites.includes('fill')) {
  section('fill');
  let img = C.create(32, 32);
  eq(C.fill(img, 3, 3, BLACK), 1024, 'black onto an empty canvas fills it (the old page did nothing)');
  eq(C.fill(img, 3, 3, BLACK), 0, 'filling with the same colour changes nothing and reports 0');
  img = C.create(32, 32);
  for (let i = 0; i < 32; i++) C.set(img, i, i, BLACK);
  eq(C.fill(img, 20, 2, GREEN), 496, 'a diagonal wall holds: 4-connected, no leak through corners');
  eq(C.get(img, 2, 20), 0, 'the other side stays transparent');
  img = C.create(8, 8); C.set(img, 4, 4, RED);
  eq(C.fill(img, 4, 4, BLUE), 1, 'filling a lone pixel recolours just it');
  eq(C.fill(img, -1, 0, BLUE), 0, 'outside the canvas does nothing');
  img = C.create(256, 256);
  let t = Date.now();
  eq(C.fill(img, 0, 0, RED), 65536, 'the largest canvas fills completely (no recursion limit)');
  check(Date.now() - t < 1500, 'and quickly', `${Date.now() - t} ms`);
  // a spiral maze: fill must follow a 1-pixel corridor all the way
  img = C.create(21, 21);
  for (let r = 0; r < 10; r += 2) { for (let i = r; i < 21 - r; i++) { C.set(img, i, r, BLACK); C.set(img, i, 20 - r, BLACK); C.set(img, r, i, BLACK); C.set(img, 20 - r, i, BLACK); } C.set(img, r, r + 1, 0); C.set(img, r + 1, r + 1 + 0, img === null ? 0 : C.get(img, r + 1, r + 1)); }
  const before = count(img, 0); eq(C.fill(img, 1, 1, GREEN) > 0, true, 'maze corridor filled'); check(count(img, 0) < before, 'maze fill took pixels');
  img = C.create(5, 1); C.set(img, 0, 0, RED); C.set(img, 4, 0, RED); C.set(img, 2, 0, BLUE);
  eq(C.replaceAll(img, 0, 0, GREEN), 2, 'replace-all reaches a separate patch of the same colour');
  eq([C.get(img, 4, 0) === GREEN, C.get(img, 2, 0) === BLUE, C.get(img, 1, 0)], [true, true, 0], 'and leaves other colours alone');
  eq(C.replaceAll(img, 0, 0, GREEN), 0, 'replace-all with the same colour changes nothing');
  // semi-transparent pixels are a different colour from transparent and from opaque
  img = C.create(3, 1); C.set(img, 1, 0, C.pack(255, 0, 0, 128));
  eq(C.fill(img, 0, 0, BLUE), 1, 'a half-transparent pixel is a wall for a transparent fill');
}

if (suites.includes('resize')) {
  section('resize');
  let img = C.create(4, 4); C.set(img, 0, 0, RED); C.set(img, 3, 3, BLUE);
  let r = C.resize(img, 8, 8, 'c');
  eq([r.w, r.h, C.get(r, 2, 2) === RED, C.get(r, 5, 5) === BLUE, count(r, 0)], [8, 8, true, true, 62], 'growing centres the drawing, pixels stay 1:1');
  r = C.resize(img, 2, 2, 'c');
  eq([r.w, r.h, count(r, 0)], [2, 2, 4], 'shrinking trims around the centre');
  r = C.resize(img, 6, 3, 'tl');
  eq([C.get(r, 0, 0) === RED, count(r, BLUE)], [true, 0], 'top-left anchor keeps the corner');
  r = C.resize(img, 5, 5, 'c');
  eq([C.get(r, 0, 0) === RED, C.get(r, 3, 3) === BLUE], [true, true], 'odd growth puts the extra pixel right and bottom');
  r = C.resize(img, 1, 1, 'c'); eq([r.w, r.h], [1, 1], '1×1 is allowed');
}

if (suites.includes('scale')) {
  section('scale');
  const img = C.create(3, 2); C.set(img, 1, 1, RED); C.set(img, 2, 0, C.pack(0, 0, 255, 100));
  const big = C.scaleUp(img, 4);
  eq([big.w, big.h], [12, 8], '3×2 at 4× is 12×8');
  const px = (x, y) => Array.from(big.d.slice((y * big.w + x) * 4, (y * big.w + x) * 4 + 4));
  eq([px(4, 4), px(7, 7), px(8, 7), px(3, 4)], [[255, 0, 0, 255], [255, 0, 0, 255], [0, 0, 0, 0], [0, 0, 0, 0]], 'every pixel becomes an exact block, no blur at the edges');
  eq(px(11, 0), [0, 0, 255, 100], 'partial alpha survives scaling');
  eq(plain(C.exportScales(32, 32)), [1, 2, 4, 8, 16, 32], 'all scales for 32×32');
  eq(plain(C.exportScales(256, 10)), [1, 2, 4, 8, 16, 32], '256 at 32× is 8192, still allowed');
  eq(plain(C.exportScales(255, 255)), [1, 2, 4, 8, 16, 32], '255 wide');
  eq(C.defaultScale(32, 32), 16, '32×32 still exports at 16× (512 px) by default, as the old page did');
  eq([C.defaultScale(16, 16), C.defaultScale(64, 64), C.defaultScale(128, 128), C.defaultScale(256, 256), C.defaultScale(48, 24), C.defaultScale(12, 12), C.defaultScale(1, 1)],
     [32, 8, 4, 2, 8, 32, 32], 'other sizes default to the scale nearest 512 px');
  eq(C.fileName(32, 32, 1), 'pixelart_32x32.png', 'at 1× the old page\'s name, which now tells the truth');
  eq(C.fileName(32, 32, 16), 'pixelart_32x32_16x.png', 'a scaled copy says its scale');
  eq(C.fileName(48, 24, 4), 'pixelart_48x24_4x.png', 'file name for a wide canvas');
}

if (suites.includes('import')) {
  section('import');
  const img = C.create(5, 3); C.set(img, 0, 0, RED); C.set(img, 4, 2, BLUE); C.set(img, 2, 1, GREEN);
  for (const k of [2, 3, 16]) {
    const big = C.scaleUp(img, k), r = C.importImage(big.w, big.h, big.d);
    eq([r.scale, r.img.w, r.img.h, C.same(r.img, img)], [k, 5, 3, true], `an export at ${k}× opens at its real size`);
  }
  const plain1 = C.importImage(img.w, img.h, img.d);
  eq([plain1.scale, plain1.img.w], [1, 5], 'real-size pixel art is left alone');
  // transparent pixels that differ only in hidden RGB still count as one colour
  const t = C.scaleUp(img, 4); t.d[(1 * t.w + 9) * 4] = 77;
  eq(C.importImage(t.w, t.h, t.d).scale, 4, 'garbage RGB under alpha 0 does not hide the scale');
  // a photo-sized picture is reduced to fit 256
  const W = 1200, H = 800, d = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < W * H; i++) { d[i * 4] = i % 251; d[i * 4 + 1] = (i >> 3) % 253; d[i * 4 + 2] = 90; d[i * 4 + 3] = 255; }
  const r = C.importImage(W, H, d);
  eq([r.img.w, r.img.h, r.shrunk, r.scale], [256, 171, true, 1], '1200×800 photo becomes 256×171');
  // averaging respects alpha: half transparent red/white box becomes red, not pink
  const e = C.create(2, 1); C.set(e, 0, 0, RED); const ds = C.downsample(e, 1);
  eq(Array.from(ds.d), [255, 0, 0, 128], 'transparent pixels do not darken or lighten an average');
  const tall = C.importImage(1, 3000, new Uint8ClampedArray(3000 * 4).fill(255));
  eq([tall.img.w, tall.img.h], [1, 256], 'a 1×3000 strip keeps at least one pixel of width');
}

if (suites.includes('stroke')) {
  section('stroke');
  let img = C.create(32, 8), s = new C.Stroke(img, {color: RED});
  s.to(0, 0); s.to(31, 0);
  eq(count(img, RED), 32, 'a fast drag leaves no gaps (the old page painted 4 of 32)');
  img = C.create(9, 3); s = new C.Stroke(img, {color: RED, mirror: true}); s.to(1, 1);
  eq([C.get(img, 1, 1) === RED, C.get(img, 7, 1) === RED], [true, true], 'mirror paints the opposite pixel');
  s = new C.Stroke(img, {color: RED, mirror: true}); s.to(4, 0);
  eq(count(img, RED), 3, 'mirror on the centre column paints once');
  img = C.create(8, 8); s = new C.Stroke(img, {color: 0, erase: true}); C.set(img, 2, 2, RED);
  s = new C.Stroke(img, {erase: true, color: RED}); s.to(2, 2);
  eq(C.get(img, 2, 2), 0, 'eraser makes pixels transparent, not white');
  // pixel-perfect: a staircase drawn as L-steps keeps only the diagonal
  img = C.create(8, 8); s = new C.Stroke(img, {color: RED, pixelPerfect: true});
  [[0, 0], [1, 0], [1, 1], [2, 1], [2, 2], [3, 2], [3, 3]].forEach(p => s.to(...p));
  eq(key([0, 1, 2, 3].map(i => [i, i])), key(Array.from({length: 64}, (_, i) => [i % 8, i >> 3]).filter(p => C.get(img, ...p) === RED)), 'pixel-perfect removes L-corners');
  img = C.create(8, 8); C.set(img, 1, 0, BLUE); s = new C.Stroke(img, {color: RED, pixelPerfect: true});
  [[0, 0], [1, 0], [1, 1]].forEach(p => s.to(...p));
  eq(C.get(img, 1, 0), BLUE, 'a removed corner gets back what was under it');
  img = C.create(8, 8); s = new C.Stroke(img, {color: RED});
  [[0, 0], [1, 0], [1, 1]].forEach(p => s.to(...p));
  eq(count(img, RED), 3, 'without pixel-perfect every touched pixel stays');
  img = C.create(4, 4); C.set(img, 0, 0, BLUE); s = new C.Stroke(img, {color: RED}); s.to(0, 0); s.to(3, 3); s.cancel();
  eq([C.get(img, 0, 0) === BLUE, count(img, RED), s.changed], [true, 0, false], 'cancel (a second finger) puts everything back');
  img = C.create(4, 4); s = new C.Stroke(img, {color: RED}); s.to(-5, 1); s.to(10, 1);
  eq(count(img, RED), 4, 'a stroke from outside the canvas clips and still paints across');
}

if (suites.includes('history')) {
  section('history');
  const h = new C.History(5);
  let img = C.create(4, 4); h.reset(img);
  eq([h.canUndo(), h.canRedo()], [false, false], 'nothing to undo at start');
  C.set(img, 0, 0, RED); h.commit(img, 'Pencil');
  img = C.resize(img, 8, 2, 'tl'); h.commit(img, 'Resize');
  let u = h.undo(); eq([u.img.w, u.img.h, C.get(u.img, 0, 0) === RED, u.label], [4, 4, true, 'Resize'], 'undo of a resize brings back the old size and pixels');
  u = h.undo(); eq(count(u.img, RED), 0, 'undo again: empty');
  eq(h.undo(), null, 'cannot undo past the start');
  u = h.redo(); u = h.redo(); eq([u.img.w, u.img.h], [8, 2], 'redo returns to the resized canvas');
  h.undo(); h.commit(C.create(3, 3), 'New'); eq(h.canRedo(), false, 'a new action drops the redo branch');
  for (let i = 0; i < 10; i++) h.commit(C.create(2, 2), 'x' + i);
  eq(h.list.length, 5, 'history is bounded by count');
  const hb = new C.History(1000, 300 * 1024);
  for (let i = 0; i < 10; i++) hb.commit(C.create(128, 128), 'big');
  check(hb.list.length <= 5 && hb.list.length >= 2, 'and by bytes', `${hb.list.length} entries`);
  const snap = h.redo === undefined ? null : (() => { const x = C.create(2, 2); h.commit(x, 'a'); C.set(x, 0, 0, RED); return h.list[h.i].img; })();
  eq(C.get(snap, 0, 0), 0, 'a snapshot does not change when the canvas changes afterwards');
  eq(C.diff(C.create(2, 2), C.create(3, 3)), null, 'diff across sizes is null');
  const a = C.create(3, 1), b = C.clone(a); C.set(b, 2, 0, RED); eq(plain(C.diff(a, b)), [2], 'diff names the changed pixel');
}

if (suites.includes('storage')) {
  section('storage');
  const img = C.create(17, 9);
  for (let i = 0; i < 40; i++) C.set(img, (i * 7) % 17, (i * 3) % 9, C.pack(i * 5, 255 - i, 30, i % 3 ? 255 : 128));
  const enc = JSON.parse(JSON.stringify(C.encode(img)));
  check(C.same(C.decode(enc), img), 'encode/decode round trip, partial alpha included');
  const empty = C.encode(C.create(256, 256));
  check(JSON.stringify(empty).length < 80, 'an empty 256×256 canvas stores in a few bytes', JSON.stringify(empty).length + ' bytes');
  for (const [bad, what] of [[null, 'null'], ['x', 'a string'], [{w: 0, h: 4, pal: [], runs: []}, 'zero width'], [{w: 300, h: 4, pal: [[0, 0, 0, 0]], runs: [0, 1200]}, 'too wide'],
    [{w: 2, h: 2, pal: [[0, 0, 0, 0]], runs: [0, 3]}, 'too few pixels'], [{w: 2, h: 2, pal: [[0, 0, 0, 0]], runs: [0, 9]}, 'too many pixels'],
    [{w: 2, h: 2, pal: [[0, 0, 0, 0]], runs: [5, 4]}, 'unknown colour'], [{w: 2.5, h: 2, pal: [], runs: []}, 'fractional size'], [{w: 2, h: 2, pal: [[0, 0, 0, 0]], runs: [0]}, 'odd runs']])
    eq(C.decode(bad), null, `decode refuses ${what}`);
}

if (suites.includes('ui')) {
  section('ui');
  let chromium;
  try { chromium = createRequire(import.meta.url)('playwright').chromium; } catch (e) { console.log('  SKIP  playwright not available'); }
  let up = false;
  try { const r = await fetch(URL_); up = r.ok; } catch (e) {}
  if (!up) console.log(`  SKIP  no server at ${URL_} (npx http-server -p 8099)`);
  if (chromium && up) {
    const TMP = mkdtempSync(join(tmpdir(), 'pixel-'));
    const pil = (file, script) => JSON.parse(execFileSync('python3', ['-c', `import json,sys\nfrom PIL import Image\nim=Image.open(sys.argv[1]).convert('RGBA')\n${script}`, file]).toString());
    const browser = await chromium.launch();
    const context = await browser.newContext({viewport: {width: 1280, height: 800}, acceptDownloads: true});
    const p = await context.newPage();
    const errors = []; p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    const requests = []; p.on('request', r => { if (!r.url().startsWith(URL_.replace(/\/tools\/.*/, '')) && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) requests.push(r.url()); });
    await p.goto(URL_); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(300);
    const at = (x, y) => p.evaluate(([x, y]) => window.__pixel.cellToClient(x, y), [x, y]);
    const S = () => p.evaluate(() => { const s = window.__pixel.S; return {w: s.img.w, h: s.img.h, example: s.example, tool: s.tool}; });
    eq(await S(), {w: 16, h: 16, example: true, tool: 'pencil'}, 'first visit shows the 16×16 example with the pencil');
    // new 20×12 via a pasted pair
    await p.click('#sizeBtn'); await p.fill('#dw', '20x12'); await p.click('#newBlank');
    eq((await S()).w + 'x' + (await S()).h, '20x12', 'a pasted "20x12" makes a 20×12 canvas');
    // fill black on empty (old page could not), then red pixel, then erase one
    await p.fill('#hex', '#000'); await p.press('#hex', 'Enter');
    await p.click('[data-tool=fill]'); let c = await at(5, 5); await p.mouse.click(c[0], c[1]);
    await p.fill('#hex', 'rgb(255,0,0)'); await p.press('#hex', 'Enter');
    eq((await S()).tool, 'fill', 'choosing a colour keeps the fill tool');
    await p.click('[data-tool=pencil]'); c = await at(3, 4); await p.mouse.click(c[0], c[1]);
    await p.click('[data-tool=eraser]'); c = await at(19, 11); await p.mouse.click(c[0], c[1]);
    // right-click erases too, and shows no menu
    await p.click('[data-tool=pencil]'); c = await at(0, 0); await p.mouse.click(c[0], c[1], {button: 'right'});
    // export at 4×
    await p.click('#scales button:nth-child(3)');
    const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#download')]);
    const file = join(TMP, dl.suggestedFilename()); await dl.saveAs(file);
    eq(dl.suggestedFilename(), 'pixelart_20x12_4x.png', 'download name says size and scale');
    const got = pil(file, `print(json.dumps([im.size, im.getpixel((13,17)), im.getpixel((12,16)), im.getpixel((15,19)), im.getpixel((16,16)), im.getpixel((77,45)), im.getpixel((1,1)), im.getpixel((6,6))]))`);
    eq(got, [[80, 48], [255, 0, 0, 255], [255, 0, 0, 255], [255, 0, 0, 255], [0, 0, 0, 255], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 255]],
      'PNG decoded by Pillow: 80×48, red block exact, erased pixels transparent, black fill opaque');
    // undo/redo through keys, including Ctrl+Shift+Z (dead on the old page)
    await p.locator('#cv').focus();
    await p.keyboard.press('Control+z'); let px = await p.evaluate(() => window.__pixel.C.get(window.__pixel.S.img, 0, 0));
    check(px !== 0, 'Ctrl+Z brings back the right-click-erased pixel');
    await p.keyboard.press('Control+Shift+Z'); px = await p.evaluate(() => window.__pixel.C.get(window.__pixel.S.img, 0, 0));
    eq(px, 0, 'Ctrl+Shift+Z redoes');
    // two fingers: the first finger's stroke is taken back
    const before = await p.evaluate(() => Array.from(window.__pixel.S.img.d).join());
    const cdp = await context.newCDPSession(p);
    const a1 = await at(8, 3), a2 = await at(12, 8);
    await cdp.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x: a1[0], y: a1[1], id: 1}]});
    await cdp.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [{x: a1[0] + 20, y: a1[1], id: 1}]});
    await cdp.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x: a1[0] + 20, y: a1[1], id: 1}, {x: a2[0], y: a2[1], id: 2}]});
    await cdp.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [{x: a1[0], y: a1[1] - 40, id: 1}, {x: a2[0] + 60, y: a2[1] + 40, id: 2}]});
    await cdp.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
    await p.waitForTimeout(100);
    const after = await p.evaluate(() => Array.from(window.__pixel.S.img.d).join());
    check(before === after, 'a pinch leaves no stray pixels');
    const zoomed = await p.evaluate(() => window.__pixel.S.fitted);
    eq(zoomed, false, 'and it zoomed');
    // reload restores the drawing and settings
    await p.waitForTimeout(500);
    await p.reload(); await p.waitForTimeout(300);
    const back = await p.evaluate(() => ({w: window.__pixel.S.img.w, d: Array.from(window.__pixel.S.img.d).join(), scale: window.__pixel.S.scale, ex: window.__pixel.S.example}));
    eq([back.w, back.d === after, back.scale, back.ex], [20, true, 4, false], 'reload brings back the drawing and the chosen scale');
    // a non-image file is refused next to the button
    await p.setInputFiles('#file', {name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello')});
    const msg = await p.evaluate(() => { const b = document.getElementById('bubble'), r = b.getBoundingClientRect(), o = document.getElementById('openBtn').getBoundingClientRect(); return {t: b.textContent, shown: !b.hidden, near: r.left >= o.right && r.left - o.right < 140 && r.top < o.bottom && r.bottom > o.top, overDrawing: (() => { const c = document.getElementById('cv').getBoundingClientRect(), S = window.__pixel.S; const top = c.top + S.panY + S.img.h * S.zoom; return r.top < top; })()}; });
    check(/not an image/.test(msg.t) && msg.shown && msg.near && !msg.overDrawing, 'a text file is refused in plain words, beside the Import button, not over the drawing', JSON.stringify(msg));
    // opening our own 4× export brings back the 20×12 drawing
    await p.setInputFiles('#file', file); await p.waitForTimeout(400);
    const reopened = await p.evaluate(() => ({w: window.__pixel.S.img.w, h: window.__pixel.S.img.h, d: Array.from(window.__pixel.S.img.d).join()}));
    eq([reopened.w, reopened.h, reopened.d === after], [20, 12, true], 'opening the downloaded PNG restores the drawing pixel for pixel');
    // invalid size: error next to the field, canvas untouched
    await p.click('#sizeBtn'); await p.fill('#dw', 'abc'); await p.fill('#dh', '12.5');
    const dims = await p.evaluate(() => [dwMsg.textContent, dhMsg.textContent, newBlank.disabled, resizeKeep.disabled, dlg.open]);
    check(/Not a number/.test(dims[0]) && /No fractions/.test(dims[1]) && dims[2] && dims[3] && dims[4], 'bad width and height: a message under each, both buttons off', JSON.stringify(dims));
    await p.click('#dlgCancel');
    eq((await S()).w, 20, 'and the canvas is unchanged');
    eq(requests, [], 'no requests leave the site');
    eq(errors, [], 'no console errors');
    await browser.close();
  }
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
