#!/usr/bin/env node
// Test suite for tools/image_comparison_slider.html (Image Comparison Slider).
//
// Runs the page's DOM-free <script id="core"> block in Node. The page promises that the slider shows the two images
// lined up the way it says (same size: pixel on pixel; same shape: scaled; other shape: fitted and centred; or actual
// pixels from the top-left), that "x % of pixels differ" and "Identical" are true, and that the saved PNG is the
// comparison on screen at the images' own resolution. So:
//   delta   the colour difference is pixelmatch's YIQ delta (Kotsarenko & Ramos 2010): checked against a separate
//           scalar re-derivation, symmetry, alpha blending on white, and - with pixelmatch installed
//           (npm i --no-save pixelmatch@5.3.0) - its own count of differing pixels on random and edited images
//           at every sensitivity the page offers;
//   diff    images whose answer is known: identical, one pixel changed, a block changed (its box exact), tiny
//           noise below the threshold, transparent pixels with different hidden colours, 1x1, wide 1-row;
//   areas   separate changes give separate outlined spots, nearby specks join, huge areas are not outlined;
//   words   percentages never round a real change to 0 % or a partial one to 100 %; the verdict says how it measured;
//   layout  fit/stretch/actual against plain arithmetic; the size note says what was done;
//   view    zoom keeps the point under the finger still, never zooms out past fit, pans never lose the image;
//   divider keys follow the ARIA slider pattern and stay in 0..1;
//   export  sizes of every saved layout, the 8192 px cap, the cut where the divider is; safe file names;
//   files   HEIC, TIFF, PDF, RAW, text and empty files get a plain answer; real images pass;
//   settings saved settings that trust nothing; link parameters (?mode=fade&dir=v&pos=30).
//
//   node test/image_comparison_slider.mjs            # everything
//   node test/image_comparison_slider.mjs diff areas # named suites only

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import {createRequire} from 'module';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = join(HERE, '..', 'tools', 'image_comparison_slider.html');
const ALL = ['delta', 'diff', 'areas', 'words', 'layout', 'view', 'divider', 'export', 'files', 'settings'];
const picked = process.argv.slice(2).filter(a => !a.startsWith('--'));
const suites = picked.length ? picked : ALL;

let failures = 0, passes = 0;
const check = (ok, what, detail) => { if (ok) passes++; else { failures++; console.log(`  FAIL  ${what}${detail ? '\n          ' + detail : ''}`); } };
const eq = (got, want, what) => check(JSON.stringify(got) === JSON.stringify(want), what, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
const near = (got, want, tol, what) => check(Math.abs(got - want) <= tol, what, `got ${got}, want ${want} ± ${tol}`);
const section = name => console.log(`\n=== ${name} ===`);

const html = readFileSync(PAGE, 'utf8');
const src = html.match(/<script id="core">([\s\S]*?)<\/script>/)[1];
const ctx = {module: {exports: {}}, URLSearchParams};
vm.runInNewContext(src, ctx);
const C = ctx.module.exports;

let seed = 20261118;
const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const img = (w, h, f) => { const d = new Uint8ClampedArray(w * h * 4); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const p = f(x, y); d.set(p.length === 4 ? p : [...p, 255], (y * w + x) * 4); } return d; };
const solid = (w, h, c) => img(w, h, () => c);

let pixelmatch = null;
try { pixelmatch = createRequire(import.meta.url)('pixelmatch'); } catch (e) { /* optional */ }

if (suites.includes('delta')) {
  section('colour delta (pixelmatch YIQ)');
  // written out apart from the core, straight from the paper's coefficients
  const Y = (r, g, b) => 0.29889531 * r + 0.58662247 * g + 0.11448223 * b;
  const I = (r, g, b) => 0.59597799 * r - 0.27417610 * g - 0.32180189 * b;
  const Q = (r, g, b) => 0.21147017 * r - 0.52261711 * g + 0.31114694 * b;
  const onWhite = (c, a) => 255 + (c - 255) * a / 255;
  const ref = (p, q) => {
    const [r1, g1, b1] = p[3] < 255 ? p.slice(0, 3).map(c => onWhite(c, p[3])) : p;
    const [r2, g2, b2] = q[3] < 255 ? q.slice(0, 3).map(c => onWhite(c, q[3])) : q;
    const y = Y(r1, g1, b1) - Y(r2, g2, b2), i = I(r1, g1, b1) - I(r2, g2, b2), qq = Q(r1, g1, b1) - Q(r2, g2, b2);
    return 0.5053 * y * y + 0.299 * i * i + 0.1957 * qq * qq;
  };
  eq(C.colorDelta(10, 20, 30, 255, 10, 20, 30, 255), 0, 'same colour: 0');
  near(C.colorDelta(0, 0, 0, 255, 255, 255, 255, 255), 0.5053 * 255 * 255, 1, 'black vs white: luma only, 0.5053·255²');
  let worst = 0, maxSeen = 0;
  for (let n = 0; n < 20000; n++) {
    const p = [ri(0, 255), ri(0, 255), ri(0, 255), rnd() < 0.2 ? ri(0, 255) : 255], q = [ri(0, 255), ri(0, 255), ri(0, 255), rnd() < 0.2 ? ri(0, 255) : 255];
    const d = C.colorDelta(...p, ...q);
    worst = Math.max(worst, Math.abs(d - ref(p, q)));
    if (Math.abs(d - C.colorDelta(...q, ...p)) > 1e-6) { check(false, 'symmetric', JSON.stringify([p, q])); break; }
    maxSeen = Math.max(maxSeen, d);
  }
  check(worst < 1e-6, '20 000 random pairs match the written-out formula', `worst error ${worst}`);
  check(maxSeen <= C.MAX_YIQ, 'no delta exceeds pixelmatch\'s 35215 ceiling', `saw ${maxSeen}`);
  eq(C.colorDelta(0, 0, 0, 0, 255, 0, 0, 0), 0, 'two fully transparent pixels look the same, whatever colour they hide');
  near(C.colorDelta(0, 0, 0, 0, 255, 255, 255, 255), 0, 1e-9, 'transparent is white on white');
  check(C.colorDelta(0, 0, 0, 128, 0, 0, 0, 255) > 0, 'half-transparent black differs from black');

  if (!pixelmatch) console.log('  SKIP  pixel counts against pixelmatch itself (npm i --no-save pixelmatch@5.3.0)');
  else {
    const cases = [];
    for (let n = 0; n < 24; n++) {
      const w = ri(1, 90), h = ri(1, 70), kind = n % 4;
      const a = img(w, h, () => [ri(0, 255), ri(0, 255), ri(0, 255), rnd() < 0.15 ? ri(0, 255) : 255]);
      const b = new Uint8ClampedArray(a);
      for (let k = 0; k < b.length; k += 4) {
        if (kind === 0) { b[k] += ri(-6, 6); b[k + 1] += ri(-6, 6); b[k + 2] += ri(-6, 6); }           // compression-like noise
        else if (kind === 1 && rnd() < 0.1) { b[k] = ri(0, 255); b[k + 1] = ri(0, 255); }               // scattered edits
        else if (kind === 2) { b[k] = Math.min(255, b[k] * 1.1 + 8); }                                    // a grade
        else if (kind === 3 && rnd() < 0.5) { b[k + 3] = ri(0, 255); }                                     // alpha changes
      }
      cases.push([w, h, a, b]);
    }
    let bad = 0;
    for (const [w, h, a, b] of cases) for (const t of Object.values(C.SENSITIVITY)) {
      const mine = C.diff(a, b, w, h, {threshold: t}).count;
      const theirs = pixelmatch(a, b, null, w, h, {threshold: t, includeAA: true});
      if (mine !== theirs) { bad++; if (bad < 4) check(false, `count = pixelmatch at threshold ${t} on ${w}×${h}`, `mine ${mine}, pixelmatch ${theirs}`); }
    }
    check(bad === 0, `${cases.length * 3} image pairs: same count as pixelmatch at every sensitivity`, `${bad} differ`);
  }
}

if (suites.includes('diff')) {
  section('difference on images whose answer is known');
  const A = img(40, 30, (x, y) => [x * 6, y * 8, 128]);
  let r = C.diff(A, new Uint8ClampedArray(A), 40, 30, {threshold: 0.1, picture: true});
  eq([r.count, r.any, r.box, r.areas.length, r.maxDelta], [0, 0, null, 0, 0], 'identical: nothing at all');
  eq(r.picture.length, 40 * 30 * 4, 'picture has every pixel');
  eq(C.verdict(r).kind, 'same', 'identical says so');

  const B = new Uint8ClampedArray(A); B.set([255, 0, 255, 255], (12 * 40 + 7) * 4);
  r = C.diff(A, B, 40, 30, {threshold: 0});
  eq([r.count, r.box], [1, {x: 7, y: 12, w: 1, h: 1}], 'one pixel changed: count 1, box on it');
  eq(r.areas.length, 1, 'one pixel: one spot');

  const D = new Uint8ClampedArray(A);
  for (let y = 5; y < 9; y++) for (let x = 20; x < 31; x++) D.set([0, 0, 0, 255], (y * 40 + x) * 4);
  r = C.diff(A, D, 40, 30, {threshold: 0.1});
  eq([r.count, r.box], [44, {x: 20, y: 5, w: 11, h: 4}], 'a dark 11×4 block: 44 px, box exact');

  const N = img(40, 30, (x, y) => [x * 6 + 1, y * 8, 128]); // +1 in red everywhere
  r = C.diff(A, N, 40, 30, {threshold: 0.1});
  eq([r.count, r.any], [0, 1200], 'noise below the threshold: 0 counted, all 1200 seen');
  eq(C.verdict(r).kind, 'near', 'noise only: "Only faint differences", not "Identical"');
  check(/100 % of pixels/.test(C.verdict(r).sub), 'and says how many', C.verdict(r).sub);
  r = C.diff(A, N, 40, 30, {threshold: 0});
  eq(r.count, 1200, '"every change" counts the noise');

  const T1 = solid(3, 3, [255, 0, 0, 0]), T2 = solid(3, 3, [0, 0, 255, 0]);
  eq(C.diff(T1, T2, 3, 3, {threshold: 0}).any, 0, 'transparent pixels hiding different colours are the same');

  eq(C.diff(solid(1, 1, [0, 0, 0]), solid(1, 1, [255, 255, 255]), 1, 1, {}).count, 1, '1×1 black vs white');
  const wide = C.diff(solid(5000, 1, [9, 9, 9]), img(5000, 1, x => x === 4999 ? [200, 9, 9] : [9, 9, 9]), 5000, 1, {});
  eq([wide.count, wide.box], [1, {x: 4999, y: 0, w: 1, h: 1}], '5000×1: the last pixel');
  let prog = []; C.diff(solid(300, 3000, [1, 2, 3]), solid(300, 3000, [1, 2, 3]), 300, 3000, {onProgress: f => prog.push(f)});
  check(prog.length > 1 && prog.every((f, i) => f > 0 && f <= 1 && (i === 0 || f > prog[i - 1])), 'progress rises within 0..1', JSON.stringify(prog.slice(0, 5)));

  const pic = C.diff(A, D, 40, 30, {threshold: 0.1, picture: true}).picture;
  const at = (x, y) => [...pic.slice((y * 40 + x) * 4, (y * 40 + x) * 4 + 4)];
  check(at(25, 6)[0] > at(25, 6)[1] * 3 && at(25, 6)[2] > at(25, 6)[1], 'changed pixel drawn magenta', JSON.stringify(at(25, 6)));
  const picN = C.diff(A, N, 40, 30, {threshold: 0.1, picture: true}).picture;
  check(picN[0] !== picN[1], 'a faint change is still drawn, not grey', JSON.stringify([...picN.slice(0, 4)]));
  check(at(0, 0)[0] === at(0, 0)[1] && at(0, 0)[1] === at(0, 0)[2] && at(0, 0)[3] === 255, 'unchanged pixel drawn grey, opaque', JSON.stringify(at(0, 0)));
}

if (suites.includes('areas')) {
  section('outlined spots');
  const W = 400, H = 300, A = solid(W, H, [100, 100, 100]);
  const paint = (B, x0, y0, w, h) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) B.set([250, 20, 20, 255], (y * W + x) * 4); };
  let B = new Uint8ClampedArray(A); paint(B, 20, 20, 10, 10); paint(B, 300, 200, 30, 20);
  let r = C.diff(A, B, W, H, {});
  eq(r.areas.length, 2, 'two separate changes: two spots');
  const cell = C.cellSize(W, H);
  const covers = (a, x, y, w, h) => a.x <= x && a.y <= y && a.x + a.w >= x + w && a.y + a.h >= y + h && a.w <= w + 2 * cell && a.h <= h + 2 * cell;
  check(r.areas.some(a => covers(a, 300, 200, 30, 20)) && r.areas.some(a => covers(a, 20, 20, 10, 10)), 'each spot covers its change, within a cell', JSON.stringify(r.areas));
  check(r.areas[0].w * r.areas[0].h >= r.areas[1].w * r.areas[1].h, 'largest first');
  B = new Uint8ClampedArray(A); paint(B, 100, 100, 2, 2); paint(B, 100 + cell * 2, 100, 2, 2);
  eq(C.diff(A, B, W, H, {}).areas.length, 1, 'specks a couple of cells apart join into one spot');
  B = new Uint8ClampedArray(A); paint(B, 0, 0, W, H);
  r = C.diff(A, B, W, H, {});
  check(r.areas.length === 1 && r.areas[0].broad, 'a change over the whole image is one broad area, not outlined');
  check(/most of the image/.test(C.verdict(r).sub), 'and the verdict says it is spread', C.verdict(r).sub);
  B = new Uint8ClampedArray(A); for (let i = 0; i < 40; i++) paint(B, (i % 8) * 50 + 5, Math.floor(i / 8) * 60 + 5, 3, 3);
  r = C.diff(A, B, W, H, {});
  eq(r.areas.length, 40, '40 scattered specks: 40 spots');
  check(/40 separate spots/.test(C.verdict(r).sub), 'more than 12: counted, not "outlined"', C.verdict(r).sub);
}

if (suites.includes('words')) {
  section('percentages and verdicts');
  const P = C.percent;
  eq([P(0, 100), P(100, 100), P(1, 1e7), P(1, 10000), P(5, 100), P(445, 1000), P(9999999, 1e7), P(99999, 100000), P(1, 3)],
     ['0 %', '100 %', '< 0.01 %', '0.01 %', '5.00 %', '44.5 %', '> 99.99 %', '> 99.99 %', '33.3 %'], 'never 0 % for a change, never 100 % for a partial one');
  eq(P(9995, 10000), '99.9 %', '99.95 % does not round to 100.0 %');
  eq(P(0, 0), '0 %', 'empty image');
  eq(C.group(712475), '712 475', 'thin-space thousands');
  const base = {w: 1600, h: 1000, total: 1.6e6, threshold: 0.1, areas: [{x: 1, y: 1, w: 9, h: 9}]};
  let v = C.verdict({...base, count: 712475, any: 900000});
  eq(v.head, '44.5 % of pixels differ', 'headline');
  check(/noise threshold/.test(v.sub) && /1600×1000/.test(v.sub) && /1 spot outlined/.test(v.sub), 'says how and at what size', v.sub);
  check(/187 525 px more changed faintly/.test(v.sub), 'names the faint changes it did not count', v.sub);
  v = C.verdict({...base, count: 10, any: 10, threshold: 0}, {w: 8000, h: 5000});
  check(/JPEG noise ignored/.test(C.verdict({...base, count: 5, any: 5}).sub), 'no faint changes: says what it ignores', C.verdict({...base, count: 5, any: 5}).sub);
  check(/every change counted/.test(v.sub) && /scaled from 8000×5000/.test(v.sub), 'says when it measured a scaled copy', v.sub);
  eq(C.measureSize(4000, 3000), {w: 4000, h: 3000, scaled: false}, '12 MP is measured as is');
  const m = C.measureSize(8000, 6000);
  check(m.scaled && m.w * m.h <= C.MAX_DIFF_PIXELS && Math.abs(m.w / m.h - 4 / 3) < 0.002, '48 MP scaled under the cap, shape kept', JSON.stringify(m));
  eq(C.measureSize(100000, 1, 1000).h, 1, 'a 1-px strip never scales to 0');
}

if (suites.includes('layout')) {
  section('lining the two up');
  eq(C.layout(800, 600, 800, 600, 'fit'), {w: 800, h: 600, a: {x: 0, y: 0, w: 800, h: 600}, b: {x: 0, y: 0, w: 800, h: 600}}, 'same size: pixel on pixel');
  eq(C.layout(800, 600, 1600, 1200, 'fit').b, {x: 0, y: 0, w: 800, h: 600}, 'same shape, larger: scaled exactly');
  eq(C.layout(1920, 1080, 1280, 721, 'fit').b, {x: 0, y: 0, w: 1920, h: 1080}, 'one pixel of rounding is still the same shape');
  eq(C.layout(800, 600, 400, 800, 'fit').b, {x: 250, y: 0, w: 300, h: 600}, 'portrait into landscape: fitted, centred');
  eq(C.layout(800, 600, 1000, 300, 'fit').b, {x: 0, y: 180, w: 800, h: 240}, 'panorama: fitted, centred');
  eq(C.layout(800, 600, 400, 800, 'stretch').b, {x: 0, y: 0, w: 800, h: 600}, 'stretch fills A');
  eq(C.layout(800, 600, 1000, 300, 'actual'), {w: 1000, h: 600, a: {x: 0, y: 0, w: 800, h: 600}, b: {x: 0, y: 0, w: 1000, h: 300}}, 'actual: no scaling, the frame holds both');
  for (let n = 0; n < 2000; n++) {
    const aw = ri(1, 9000), ah = ri(1, 9000), bw = ri(1, 9000), bh = ri(1, 9000), L = C.layout(aw, ah, bw, bh, 'fit'), b = L.b;
    if (!(b.x >= -1e-9 && b.y >= -1e-9 && b.x + b.w <= aw + 1e-6 && b.y + b.h <= ah + 1e-6 && Math.abs(b.w / b.h - bw / bh) / (bw / bh) < (C.sameAspect(aw, ah, bw, bh) ? 0.02 : 1e-9)
      && (Math.abs(b.w - aw) < 1e-6 || Math.abs(b.h - ah) < 1e-6))) { check(false, 'fit stays inside A, keeps B\'s shape, touches two sides', JSON.stringify([aw, ah, bw, bh, b])); break; }
  }
  passes++;
  eq(C.alignNote({w: 10, h: 10}, {w: 10, h: 10}, 'fit'), '', 'same size: no note');
  check(/scaled to 800×600/.test(C.alignNote({w: 800, h: 600}, {w: 1600, h: 1200}, 'fit')), 'note: scaled');
  check(/fitted inside 800×600/.test(C.alignNote({w: 800, h: 600}, {w: 400, h: 800}, 'fit')), 'note: fitted');
  check(/stretched/.test(C.alignNote({w: 800, h: 600}, {w: 400, h: 800}, 'stretch')), 'note: stretched');
  check(/actual pixels/.test(C.alignNote({w: 800, h: 600}, {w: 400, h: 800}, 'actual')), 'note: actual');
}

if (suites.includes('view')) {
  section('zoom and pan');
  const fw = 4000, fh = 3000, sw = 800, sh = 500;
  let v = C.fitView(fw, fh, sw, sh);
  near(v.scale, 500 / 3000, 1e-12, 'fit scale'); near(v.x, (800 - 4000 * v.scale) / 2, 1e-9, 'fit centred');
  const px = 610, py = 140, before = {x: (px - v.x) / v.scale, y: (py - v.y) / v.scale};
  const z = C.zoomAt(v, 3, px, py, fw, fh, sw, sh);
  near((px - z.x) / z.scale, before.x, 1e-6, 'zoom keeps the image point under the pointer (x)');
  near((py - z.y) / z.scale, before.y, 1e-6, 'zoom keeps the image point under the pointer (y)');
  eq(C.zoomAt(v, 0.1, 10, 10, fw, fh, sw, sh), v, 'never zooms out past fit');
  near(C.zoomAt(v, 1e6, 10, 10, fw, fh, sw, sh).scale, C.MAX_ZOOM, 1e-9, 'zoom stops at 32×');
  for (let n = 0; n < 3000; n++) {
    v = rnd() < 0.5 ? C.zoomAt(v, Math.exp((rnd() - 0.45) * 2), rnd() * sw, rnd() * sh, fw, fh, sw, sh) : C.panBy(v, (rnd() - 0.5) * 3000, (rnd() - 0.5) * 3000, fw, fh, sw, sh);
    const w = fw * v.scale, h = fh * v.scale;
    const ok = (w <= sw + 1e-6 ? Math.abs(v.x - (sw - w) / 2) < 1e-6 : v.x <= 1e-6 && v.x + w >= sw - 1e-6) && (h <= sh + 1e-6 ? Math.abs(v.y - (sh - h) / 2) < 1e-6 : v.y <= 1e-6 && v.y + h >= sh - 1e-6);
    if (!ok) { check(false, 'the image always covers the stage or sits centred', JSON.stringify(v)); break; }
  }
  passes++;
  eq([C.zoomLabel(1), C.zoomLabel(2), C.zoomLabel(0.6349), C.zoomLabel(0.05)], ['100%', '200%', '63%', '5.0%'], 'zoom labels');
}

if (suites.includes('divider')) {
  section('divider keys');
  eq([C.keyStep(0.5, 'ArrowLeft'), C.keyStep(0.5, 'ArrowRight'), C.keyStep(0.5, 'ArrowRight', true), C.keyStep(0.5, 'Home'), C.keyStep(0.5, 'End'), C.keyStep(0.5, 'PageDown')],
     [0.49, 0.51, 0.6, 0, 1, 0.4], 'arrows 1 %, Shift 10 %, Home/End, PageUp/Down');
  eq([C.keyStep(0, 'ArrowLeft'), C.keyStep(1, 'ArrowRight', true), C.keyStep(0.95, 'PageUp')], [0, 1, 1], 'clamped at the ends (0 stays 0)');
  eq(C.keyStep(0.5, 'x'), null, 'other keys ignored');
}

if (suites.includes('export')) {
  section('saved images');
  let p = C.exportPlan(1600, 1000, 'split', 0.3, false);
  eq([p.w, p.h, p.cut, p.scale], [1600, 1000, 480, 1], 'slider: the images\' own size, cut where the divider is');
  eq([p.panels[0].clip, p.panels[1].clip], [{x: 0, y: 0, w: 480, h: 1000}, {x: 480, y: 0, w: 1120, h: 1000}], 'A left of the cut, B right of it, no gap or overlap');
  p = C.exportPlan(1600, 1000, 'split', 0.25, true);
  eq([p.cut, p.panels[0].clip.h + p.panels[1].clip.h], [250, 1000], 'vertical divider: A above, B below');
  p = C.exportPlan(1600, 1000, 'side', 0.5, false);
  eq([p.w, p.h, p.panels[1].x], [1600 * 2 + 5, 1000, 1605], 'side by side: two full images and a thin gap');
  p = C.exportPlan(1600, 1000, 'stack', 0.5, false);
  eq([p.w, p.h, p.panels[1].y], [1600, 2005, 1005], 'one above the other');
  p = C.exportPlan(6000, 4000, 'side', 0.5, false);
  check(Math.max(p.w, p.h) <= 8192 && p.scale < 1 && p.panels[1].x + p.panels[1].w === p.w, 'wide pairs scaled to 8192 px, panels still fill', JSON.stringify([p.w, p.h, p.panels]));
  p = C.exportPlan(1, 1, 'side', 0.5, false);
  check(p.w >= 2 && p.h === 1, '1×1 still exports', JSON.stringify(p));
  eq([C.exportPlan(100, 50, 'split', -3, false).cut, C.exportPlan(100, 50, 'split', 7, false).cut], [0, 100], 'divider out of range is clamped');
  eq(C.fileName('Before', 'After', 'split'), 'Before-vs-After-comparison.png', 'file name');
  eq(C.fileName('Raw / v1:*', '  ', 'diff'), 'Raw-v1-vs-after-difference.png', 'unsafe characters removed, empty label falls back');
  eq(C.fileName('Été 2024', 'Ｆｉｎａｌ', 'side'), 'Été-2024-vs-Final-side.png', 'non-ASCII kept, full-width folded');
}

if (suites.includes('files')) {
  section('files people pick');
  for (const [n, t] of [['a.jpg', 'image/jpeg'], ['b.PNG', 'image/png'], ['c.webp', ''], ['d.svg', 'image/svg+xml'], ['e.avif', 'image/avif'], ['f.bmp', 'image/bmp'], ['g.gif', 'image/gif'], ['pasted', 'image/png']])
    eq(C.fileProblem(n, t, 1000), '', `${n} accepted`);
  check(/HEIC/.test(C.fileProblem('IMG_0001.HEIC', '', 100)), 'HEIC explained');
  check(/HEIC/.test(C.fileProblem('x', 'image/heic', 100)), 'HEIC by type');
  check(/TIFF/.test(C.fileProblem('scan.tif', 'image/tiff', 100)), 'TIFF explained');
  check(/PDF/.test(C.fileProblem('page.pdf', 'application/pdf', 100)), 'PDF explained');
  check(/RAW/.test(C.fileProblem('DSC_1.NEF', '', 100)), 'RAW explained');
  check(/^isn’t an image. Use PNG/.test(C.fileProblem('notes.txt', 'text/plain', 5)), 'text refused with what is accepted');
  check(/empty/.test(C.fileProblem('a.png', 'image/png', 0)), 'empty file');
  const F = names => names.map(n => ({name: n, type: /\.txt$/.test(n) ? 'text/plain' : 'image/png', size: 10}));
  const pp = names => { const r = C.pickPair(F(names)); return [r.pair.map(i => names[i]), r.skipped.map(i => names[i]), r.unused.map(i => names[i])]; };
  eq(pp(['notes.txt', 'compressed.webp', 'original.png']), [['original.png', 'compressed.webp'], ['notes.txt'], []], 'text left out, the original goes first');
  eq(pp(['after.jpg', 'before.jpg']), [['before.jpg', 'after.jpg'], [], []], 'before/after named the wrong way round');
  eq(pp(['IMG_2.jpg', 'IMG_1.jpg']), [['IMG_2.jpg', 'IMG_1.jpg'], [], []], 'no hints: the order given');
  eq(pp(['login_v1.png', 'login_v2@2x.png']), [['login_v1.png', 'login_v2@2x.png'], [], []], 'v1 before v2');
  eq(pp(['a.png', 'b.png', 'c.png']), [['a.png', 'b.png'], [], ['c.png']], 'a third image is named as left out');
  eq(pp(['x.txt', 'only.png']), [['only.png'], ['x.txt'], []], 'one image left');
  eq(pp(['newsletter.png', 'oldham.png']), [['newsletter.png', 'oldham.png'], [], []], 'words inside other words are not hints');
}

if (suites.includes('settings')) {
  section('saved settings and links');
  eq(C.readSettings(null), C.DEFAULTS, 'nothing saved: defaults');
  eq(C.readSettings('{bad json'), C.DEFAULTS, 'broken JSON: defaults');
  eq(C.readSettings('[1,2]'), C.DEFAULTS, 'an array: defaults');
  const s = C.readSettings(JSON.stringify({mode: 'fade', vertical: true, align: 'actual', sens: 'exact', labels: false, la: 'x'.repeat(100), lb: 5, outline: 'yes', evil: 1}));
  eq([s.mode, s.vertical, s.align, s.sens, s.labels, s.la.length, s.lb, s.outline, 'evil' in s], ['fade', true, 'actual', 'exact', false, 60, 'After', false, false], 'good values kept, bad ones dropped');
  eq(C.readSettings({mode: 'diagonal'}).mode, 'split', 'unknown mode falls back to the slider');
  eq(C.readSettings({sens: 'toString'}).sens, 'normal', 'prototype names are not sensitivities');
  eq(C.readParams('?mode=fade&dir=v&pos=30'), {mode: 'fade', vertical: true, pos: 0.3}, 'link parameters');
  eq(C.readParams('#mode=difference&pos=0,25'), {mode: 'diff', pos: 0.25}, 'hash, alias and decimal comma');
  eq(C.readParams('?mode=slider&orientation=horizontal&pos=250'), {mode: 'split', vertical: false, pos: 1}, 'out of range clamped');
  eq(C.readParams('?mode=<script>&pos=abc'), {}, 'junk ignored');
  eq(C.readParams(''), {}, 'nothing');
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
