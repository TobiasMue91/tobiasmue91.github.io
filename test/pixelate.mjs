#!/usr/bin/env node
// Test suite for tools/pixelate.html (Pixelate Image).
//
// Runs the page's DOM-free <script id="core"> block in Node. The page promises that every block is the average colour
// of the picture's own pixels under it (opacity-weighted, sRGB values, as Photoshop's Mosaic and GIMP's Pixelize do),
// on one grid anchored at the top-left so areas side by side join without a seam; that only the marked areas change
// and nothing outside them moves by a single value; that the saved size is the picture's own; and that the numbers
// people type are read the way they mean them. So:
//   average  block colours against a brute-force reference written apart from the core, on random pictures with
//            partial edge blocks and random opacity, plus vectors worked by hand (checkerboard, half-clear red, 1x1);
//   mosaic   whole picture and areas: outside untouched, inside exactly the block colour, overlaps, areas past the
//            edge, empty areas, areas grown out to whole blocks (the page's default) so no block is cut, block 1 is the picture itself, a block bigger than the picture is one colour;
//   style    greyscale (Rec. 601), sepia and inverted against hand values; strength 0 is the original and 1 the
//            mosaic; round dots are solid at the centre and clear in the corners;
//   tiny     "1 pixel per block" is the block colours at ceil(W/b) x ceil(H/b);
//   numbers  12, " 12 px", "12,5", "1,000", "-3", "abc", "" and friends, with errors that say what is accepted;
//   slider   the square-root scale is monotonic, hits both ends and round-trips;
//   size     pictures too big for the browser shrink to fit with their shape kept;
//   files    HEIC, TIFF, RAW, PDF, text and empty files get a plain answer; real images pass; safe file names;
//   settings saved settings that trust nothing; link parameters (?size=16&mode=whole).
//
//   node test/pixelate.mjs              # everything
//   node test/pixelate.mjs average      # named suites only

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = join(HERE, '..', 'tools', 'pixelate.html');
const ALL = ['average', 'mosaic', 'style', 'tiny', 'numbers', 'slider', 'size', 'files', 'settings'];
const picked = process.argv.slice(2).filter(a => !a.startsWith('--'));
const suites = picked.length ? picked : ALL;

let failures = 0, passes = 0;
const check = (ok, what, detail) => { if (ok) passes++; else { failures++; console.log(`  FAIL  ${what}${detail ? '\n          ' + detail : ''}`); } };
const eq = (got, want, what) => check(JSON.stringify(got) === JSON.stringify(want), what, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
const section = name => console.log(`\n=== ${name} ===`);

const html = readFileSync(PAGE, 'utf8');
const src = html.match(/<script id="core">([\s\S]*?)<\/script>/)[1];
const ctx = {module: {exports: {}}, Uint8ClampedArray, Float64Array, URLSearchParams};
vm.runInNewContext(src, ctx);
const C = ctx.module.exports;

let seed = 20261120;
const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
function randImage(W, H, alpha) {
  const d = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < d.length; i += 4) {
    d[i] = ri(0, 255); d[i + 1] = ri(0, 255); d[i + 2] = ri(0, 255);
    d[i + 3] = alpha === 'mixed' ? [0, 255, ri(0, 255)][ri(0, 2)] : 255;
  }
  return d;
}
const px = (d, W, x, y) => Array.from(d.slice((y * W + x) * 4, (y * W + x) * 4 + 4));

// The reference, written from the definition and not from the core: for one block, gather its pixels one by one.
function refBlock(d, W, H, b, bx, by) {
  let r = 0, g = 0, bl = 0, a = 0, n = 0;
  for (let y = by * b; y < Math.min(H, by * b + b); y++)
    for (let x = bx * b; x < Math.min(W, bx * b + b); x++) {
      const p = px(d, W, x, y);
      r += p[0] * p[3]; g += p[1] * p[3]; bl += p[2] * p[3]; a += p[3]; n++;
    }
  return a ? [Math.round(r / a), Math.round(g / a), Math.round(bl / a), Math.round(a / n)] : [0, 0, 0, 0];
}

if (suites.includes('average')) {
  section('block averages');
  // hand-worked vectors
  {
    const W = 4, H = 4, d = new Uint8ClampedArray(W * H * 4);
    for (let i = 0; i < 16; i++) d.set([i * 10, 100, 200, 255], i * 4);
    const A = C.blockAverages(d, W, H, 2);
    eq([A.cols, A.rows], [2, 2], '4x4 at 2 px: 2 x 2 blocks');
    eq(Array.from(A.data.slice(0, 4)), [25, 100, 200, 255], 'top-left block of 0,10,40,50 averages to 25');
    eq(Array.from(A.data.slice(12, 16)), [125, 100, 200, 255], 'bottom-right block of 100,110,140,150 averages to 125');
  }
  {
    const d = new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255, 255, 255, 255, 255, 0, 0, 0, 255]);
    eq(Array.from(C.blockAverages(d, 2, 2, 2).data), [128, 128, 128, 255], 'black/white checkerboard: 127.5 rounds to 128 (sRGB mean)');
  }
  {
    // half opaque red, half clear pixels that carry black or white: clear pixels lend no colour
    for (const hidden of [0, 255]) {
      const d = new Uint8ClampedArray([255, 0, 0, 255, hidden, hidden, hidden, 0, 255, 0, 0, 255, hidden, hidden, hidden, 0]);
      eq(Array.from(C.blockAverages(d, 2, 2, 2).data), [255, 0, 0, 128], `half-clear red stays red, half opaque (hidden ${hidden})`);
    }
    eq(Array.from(C.blockAverages(new Uint8ClampedArray(16), 2, 2, 2).data), [0, 0, 0, 0], 'fully clear block stays clear');
  }
  eq(Array.from(C.blockAverages(new Uint8ClampedArray([9, 8, 7, 6]), 1, 1, 5).data), [9, 8, 7, 6], '1x1 picture, block bigger than it');
  {
    // 10 wide at 4 px: blocks of 4, 4, 2; the last averages only its own two columns
    const W = 10, H = 1, d = new Uint8ClampedArray(W * 4);
    for (let x = 0; x < W; x++) d.set([x * 25, 0, 0, 255], x * 4);
    const A = C.blockAverages(d, W, H, 4);
    eq(A.cols, 3, '10 px at 4: three columns');
    eq(A.data[8], Math.round((200 + 225) / 2), 'partial edge block: mean of its two real pixels');
  }
  // random pictures against the reference
  let bad = 0, cases = 0;
  for (let t = 0; t < 300; t++) {
    const W = ri(1, 37), H = ri(1, 29), b = ri(1, 12), d = randImage(W, H, t % 2 ? 'mixed' : 'opaque');
    const A = C.blockAverages(d, W, H, b);
    if (A.cols !== Math.ceil(W / b) || A.rows !== Math.ceil(H / b)) { bad++; continue; }
    for (let by = 0; by < A.rows; by++) for (let bx = 0; bx < A.cols; bx++) {
      cases++;
      const got = Array.from(A.data.slice((by * A.cols + bx) * 4, (by * A.cols + bx) * 4 + 4));
      if (JSON.stringify(got) !== JSON.stringify(refBlock(d, W, H, b, bx, by))) bad++;
    }
  }
  check(bad === 0, `${cases} random blocks match the brute-force reference`, `${bad} differ`);
  // a big picture is still fast enough for a slider
  {
    const W = 4000, H = 3000, d = randImage(W, H, 'opaque'), t0 = Date.now();
    C.mosaic(d, W, H, 37);
    const ms = Date.now() - t0;
    console.log(`  (12 MP mosaic in ${ms} ms)`);
    check(ms < 3000, '12 MP mosaic under 3 s in Node', `${ms} ms`);
  }
}

if (suites.includes('mosaic')) {
  section('whole picture and areas');
  let bad = 0;
  for (let t = 0; t < 120; t++) {
    const W = ri(1, 40), H = ri(1, 40), b = ri(1, 9), d = randImage(W, H, 'mixed');
    const rects = Array.from({length: ri(0, 3)}, () => ({x: ri(-5, W), y: ri(-5, H), w: ri(-10, 30), h: ri(-10, 30)}));
    const out = C.mosaic(d, W, H, b, rects);
    const A = C.blockAverages(d, W, H, b);
    const inside = (x, y) => !rects.length || rects.some(r => {
      const x0 = Math.min(r.x, r.x + r.w), x1 = Math.max(r.x, r.x + r.w), y0 = Math.min(r.y, r.y + r.h), y1 = Math.max(r.y, r.y + r.h);
      return x >= x0 && x < x1 && y >= y0 && y < y1;
    });
    if (out.length !== d.length) { bad++; continue; }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const want = inside(x, y) ? Array.from(A.data.slice((Math.floor(y / b) * A.cols + Math.floor(x / b)) * 4, (Math.floor(y / b) * A.cols + Math.floor(x / b)) * 4 + 4)) : px(d, W, x, y);
      if (JSON.stringify(px(out, W, x, y)) !== JSON.stringify(want)) bad++;
    }
  }
  check(bad === 0, 'every pixel is its block colour inside the areas and untouched outside', `${bad} pixels wrong`);
  {
    const W = 9, H = 7, d = randImage(W, H, 'mixed');
    const id = C.mosaic(d, W, H, 1);
    let same1 = true; for (let i = 0; i < d.length; i += 4) {
      if (id[i + 3] !== d[i + 3]) same1 = false;
      if (d[i + 3] && (id[i] !== d[i] || id[i + 1] !== d[i + 1] || id[i + 2] !== d[i + 2])) same1 = false;
      if (!d[i + 3] && (id[i] || id[i + 1] || id[i + 2])) same1 = false;
    }
    check(same1, 'block 1 is the picture itself (fully clear pixels carry no colour, as a canvas gives them)');
    const one = C.mosaic(d, W, H, 50), first = px(one, W, 0, 0);
    let same = true; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (JSON.stringify(px(one, W, x, y)) !== JSON.stringify(first)) same = false;
    check(same, 'a block bigger than the picture makes one colour');
    eq(Array.from(C.mosaic(d, W, H, 3, [{x: 2, y: 2, w: 0, h: 5}])), Array.from(d), 'an empty area changes nothing');
    eq(Array.from(C.mosaic(d, W, H, 3, [{x: 20, y: 20, w: 5, h: 5}])), Array.from(d), 'an area off the picture changes nothing');
    eq(Array.from(C.mosaic(d, W, H, 3, [{x: -4, y: -4, w: 100, h: 100}])), Array.from(C.mosaic(d, W, H, 3)), 'an area larger than the picture equals the whole picture');
    eq(Array.from(C.mosaic(d, W, H, 3, [{x: 0, y: 0, w: 5, h: 7}, {x: 5, y: 0, w: 4, h: 7}])), Array.from(C.mosaic(d, W, H, 3)),
      'two areas side by side share one grid: no seam');
  }
  eq(C.snapRect({x: 13, y: 7, w: 10, h: 2}, 8, 40, 30), {x: 8, y: 0, w: 16, h: 16}, 'snapped area grows out to whole blocks');
  eq(C.snapRect({x: 33, y: 25, w: 10, h: 10}, 8, 38, 30), {x: 32, y: 24, w: 6, h: 6}, 'snapped area stops at the picture edge');
  eq(C.snapRect({x: 5, y: 5, w: 0, h: 9}, 8, 40, 30), {x: 5, y: 5, w: 0, h: 9}, 'an empty area stays empty when snapped');
  {
    // with snap, a cut block is never left half original: every block is either all mosaic or all original
    let bad = 0;
    for (let t2 = 0; t2 < 60; t2++) {
      const W = ri(4, 40), H = ri(4, 40), b = ri(2, 7), d = randImage(W, H, 'opaque');
      const r = {x: ri(0, W - 1), y: ri(0, H - 1), w: ri(1, 15), h: ri(1, 15)};
      const out = C.mosaic(d, W, H, b, [r], {snap: true}), m = C.mosaic(d, W, H, b);
      for (let by = 0; by * b < H; by++) for (let bx = 0; bx * b < W; bx++) {
        let mos = 0, org = 0;
        for (let y = by * b; y < Math.min(H, by * b + b); y++) for (let x = bx * b; x < Math.min(W, bx * b + b); x++) {
          const i = (y * W + x) * 4, same = out[i] === m[i] && out[i + 1] === m[i + 1] && out[i + 2] === m[i + 2];
          const orig = out[i] === d[i] && out[i + 1] === d[i + 1] && out[i + 2] === d[i + 2];
          if (same && !orig) mos++; else if (orig && !same) org++;
        }
        if (mos && org) bad++;
      }
    }
    check(bad === 0, 'snapped areas never leave a block half pixelated', `${bad} blocks cut`);
  }
  eq(C.clampRect({x: 10, y: 8, w: -6, h: -3}, 20, 20), {x: 4, y: 5, w: 6, h: 3}, 'an area dragged up and left is normalised');
  eq(C.clampRect({x: 2.4, y: 2.6, w: 3.3, h: 0.2}, 4, 4), {x: 2, y: 3, w: 2, h: 0}, 'areas are clamped to whole pixels inside the picture');
}

if (suites.includes('style')) {
  section('colour, strength and dots');
  eq(C.recolour(37, 37, 0, 'grayscale'), [33, 33, 33], 'greyscale (Rec. 601): 0.299*37 + 0.587*37 = 32.8 -> 33');
  eq(C.recolour(255, 255, 255, 'grayscale'), [255, 255, 255], 'greyscale keeps white white');
  eq(C.recolour(100, 50, 20, 'sepia'), [Math.round(39.3 + 38.45 + 3.78), Math.round(34.9 + 34.3 + 3.36), Math.round(27.2 + 26.7 + 2.62)], 'sepia matrix');
  eq(C.recolour(255, 255, 255, 'sepia'), [255, 255, 239], 'sepia clips at 255 (blue: 0.937 x 255 = 238.9)');
  eq(C.recolour(0, 128, 255, 'invert'), [255, 127, 0], 'inverted');
  eq(C.recolour(1, 2, 3, 'nonsense'), [1, 2, 3], 'unknown mode leaves colours alone');
  {
    const W = 8, H = 8, d = randImage(W, H, 'opaque');
    eq(Array.from(C.mosaic(d, W, H, 4, null, {strength: 0})), Array.from(d), 'strength 0 is the original');
    eq(Array.from(C.mosaic(d, W, H, 4, null, {strength: 1})), Array.from(C.mosaic(d, W, H, 4)), 'strength 1 is the mosaic');
    const half = C.mosaic(d, W, H, 4, null, {strength: 0.5}), full = C.mosaic(d, W, H, 4);
    let ok = true; for (let i = 0; i < d.length; i++) if (Math.abs(half[i] - (d[i] + full[i]) / 2) > 0.51) ok = false;
    check(ok, 'strength 0.5 is halfway between original and mosaic on an opaque picture');
    const g = C.mosaic(d, W, H, 4, null, {colour: 'grayscale'});
    check(g[0] === g[1] && g[1] === g[2], 'colour mode applies to the blocks');
  }
  {
    const W = 10, H = 10, d = new Uint8ClampedArray(W * H * 4).fill(200);
    for (let i = 3; i < d.length; i += 4) d[i] = 255;
    const dots = C.mosaic(d, W, H, 10, null, {shape: 'dot'});
    eq(px(dots, W, 5, 5), [200, 200, 200, 255], 'dot: solid at the centre');
    eq(px(dots, W, 0, 0)[3], 0, 'dot: clear in the corner');
    check(px(dots, W, 0, 5)[3] > 100 && px(dots, W, 0, 5)[3] <= 255, 'dot: reaches the block edge at the middle of each side');
    const faded = C.mosaic(d, W, H, 10, null, {shape: 'dot', strength: 0.5});
    eq(px(faded, W, 0, 0)[3], 128, 'dot at half strength: the clear corner fades the original by half');
    const area = C.mosaic(d, W, H, 10, [{x: 0, y: 0, w: 5, h: 10}], {shape: 'dot'});
    eq(px(area, W, 9, 0), [200, 200, 200, 255], 'dot in an area leaves the outside alone');
  }
}

if (suites.includes('tiny')) {
  section('one pixel per block');
  const W = 23, H = 11, d = randImage(W, H, 'mixed'), t = C.tiny(d, W, H, 5);
  eq([t.w, t.h], [5, 3], '23 x 11 at 5 px: 5 x 3');
  eq(Array.from(t.data), Array.from(C.blockAverages(d, W, H, 5).data), 'pixels are the block colours');
  const g = C.tiny(d, W, H, 5, {colour: 'invert'}), A = C.blockAverages(d, W, H, 5).data;
  eq([g.data[0], g.data[3]], [255 - A[0], A[3]], 'colour mode applies, opacity kept');
}

if (suites.includes('numbers')) {
  section('block sizes people type');
  const N = (t, W = 1000, H = 800) => { const r = C.parseBlock(t, W, H); return r.ok ? r.value : 'ERR'; };
  for (const [t, v] of [['12', 12], [' 12 ', 12], ['12px', 12], ['12 px', 12], ['12 pixels', 12], ['+9', 9], ['08', 8], ['12,5', 13], ['12.4', 12],
    ['12,0', 12], ['.6', 1], ['1', 1], ['512', 512], ['１２', 12], ['1,000', 'ERR'], ['1.000', 'ERR'], ['0', 'ERR'], ['0,4', 'ERR'], ['-3', 'ERR'],
    ['abc', 'ERR'], ['', 'ERR'], ['   ', 'ERR'], ['12 34', 'ERR'], ['1e3', 'ERR'], ['513', 'ERR'], [null, 'ERR']]) eq(N(t), v, `"${t}" -> ${v}`);
  eq(C.parseBlock('40', 30, 20).ok, false, '...so 40 on a 30 x 20 picture is refused');
  eq(C.parseBlock('12,5', 100, 100).rounded, true, 'rounding is reported so the page can say so');
  for (const t of ['', 'abc', '-3', '0', '999']) {
    const e = C.parseBlock(t, 1000, 800).error;
    check(/\d/.test(e) && e.length < 90, `error for "${t}" names the accepted range and is short`, e);
  }
  eq(C.defaultBlock(1200, 860), 30, 'default: about 40 blocks across the longer side');
  eq(C.defaultBlock(20, 10), 2, 'default never below 2');
  eq(C.maxBlock(30, 20), 30, 'largest block: the longer side');
  eq(C.maxBlock(9000, 6000), 512, 'largest block: 512 at most');
}

if (suites.includes('slider')) {
  section('slider scale');
  for (const max of [1, 2, 30, 512]) {
    eq(C.sliderToBlock(0, max), 1, `max ${max}: left end is 1`);
    eq(C.sliderToBlock(1, max), max, `max ${max}: right end is ${max}`);
    let mono = true, round = true, prev = 0;
    for (let i = 0; i <= 1000; i++) { const v = C.sliderToBlock(i / 1000, max); if (v < prev) mono = false; prev = v; }
    for (let v = 1; v <= max; v++) if (C.sliderToBlock(C.blockToSlider(v, max), max) !== v) round = false;
    check(mono, `max ${max}: never goes backwards`);
    check(round, `max ${max}: every size round-trips through the slider`);
  }
  check(C.sliderToBlock(0.5, 512) < 140, 'half way is a small block: the sizes that matter get the travel');
}

if (suites.includes('size')) {
  section('pictures too big for the browser');
  eq(C.fitPixels(1200, 800, 16777216), {w: 1200, h: 800, scaled: false}, 'small pictures are kept as they are');
  for (const [W, H] of [[8064, 6048], [12000, 3000], [5000, 5000], [100000, 2]]) {
    const f = C.fitPixels(W, H, 16777216);
    check(f.scaled && f.w * f.h <= 16777216 && f.w <= 16384 && f.h <= 16384, `${W} x ${H} fits under 16.7 MP and 16384 px a side`, JSON.stringify(f));
    check(Math.abs(f.w / f.h - W / H) / (W / H) < 0.02 || f.h <= 2, `${W} x ${H} keeps its shape`, JSON.stringify(f));
  }
}

if (suites.includes('files')) {
  section('files');
  for (const [n, t, s] of [['a.heic', '', 10], ['b.HEIF', 'image/heif', 10], ['c.tif', 'image/tiff', 10], ['d.CR2', '', 10], ['e.pdf', 'application/pdf', 10],
    ['f.txt', 'text/plain', 10], ['g.png', 'image/png', 0], ['notes', '', 10]]) check(C.fileProblem(n, t, s) !== '', `${n} is refused with a reason`);
  for (const [n, t] of [['a.png', 'image/png'], ['b.JPG', 'image/jpeg'], ['c.webp', ''], ['d.gif', 'image/gif'], ['e.avif', 'image/avif'], ['f.svg', 'image/svg+xml'], ['', 'image/png']])
    eq(C.fileProblem(n, t, 100), '', `${n || '(pasted)'} ${t} passes`);
  eq(C.outputName('Holiday photo.JPG', 'jpeg'), 'Holiday-photo-pixelated.jpg', 'file name keeps the original name');
  eq(C.outputName('a/b:c*?.png', 'png'), 'a-b-c-pixelated.png', 'unsafe characters go');
  eq(C.outputName('', 'webp'), 'image-pixelated.webp', 'nameless paste');
  check(C.outputName('x'.repeat(300) + '.png', 'png').length < 80, 'long names are cut');
  eq(C.formatFor('auto', 'image/jpeg'), 'jpeg', 'auto keeps a JPEG a JPEG');
  eq(C.formatFor('auto', 'image/webp'), 'webp', 'auto keeps WebP');
  eq(C.formatFor('auto', 'image/gif'), 'png', 'auto makes everything else PNG');
  eq(C.formatFor('png', 'image/jpeg'), 'png', 'a chosen format wins');
}

if (suites.includes('settings')) {
  section('settings and links');
  const D = JSON.parse(JSON.stringify(C.DEFAULTS));
  for (const raw of [null, '', '{', 'null', '42', '[]', '{"mode":"evil","shape":7,"strength":"x","format":"bmp"}'])
    eq(JSON.parse(JSON.stringify(C.readSettings(raw))), D, `junk ${JSON.stringify(raw)} gives the defaults`);
  eq(JSON.parse(JSON.stringify(C.readSettings('{"mode":"whole","shape":"dot","colour":"sepia","strength":40,"format":"webp","scale":"blocks"}'))),
    {mode: 'whole', shape: 'dot', colour: 'sepia', strength: 40, format: 'webp', scale: 'blocks'}, 'good settings survive');
  eq(C.readSettings('{"strength":140}').strength, 100, 'out-of-range strength is dropped');
  eq(JSON.parse(JSON.stringify(C.readQuery('?size=16&mode=whole'))), {block: 16, mode: 'whole'}, '?size=16&mode=whole');
  eq(JSON.parse(JSON.stringify(C.readQuery('?px=8'))), {block: 8}, '?px=8');
  eq(JSON.parse(JSON.stringify(C.readQuery('?size=-1&mode=zzz'))), {}, 'bad parameters are ignored');
  eq(JSON.parse(JSON.stringify(C.readQuery(''))), {}, 'no parameters');
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
