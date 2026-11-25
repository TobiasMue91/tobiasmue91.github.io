#!/usr/bin/env node
// Test suite for tools/image_to_sketch_converter.html (Image to Sketch Converter).
//
// Runs the page's DOM-free <script id="core"> block in Node; no browser or server needed. The page promises:
//   - gray is ITU-R BT.601 luma, with transparent pixels laid on white paper (not on black, as the old page did);
//   - the pencil look is the W3C Compositing Level 1 color-dodge of the gray image with its blurred negative;
//   - the blur is a Gaussian: a sampled kernel below sigma 3, above it four fractional box passes whose variance is
//     exactly sigma^2; both checked here against a directly convolved Gaussian, alone and through the pencil pipeline;
//   - the ink outline is XDoG (Winnemoeller, Kyprianidis & Olsen 2012): flat areas stay paper, edges get a dark line;
//   - settings are fractions of the long edge, so the preview and the full-size download look the same;
//   - every output pixel is opaque (no transparent frame), any size from 0x0 works, the same input gives the same bytes;
//   - file names, saved settings and ?style= links survive what people and browsers throw at them.
//
//   node test/image_to_sketch_converter.mjs              # everything
//   node test/image_to_sketch_converter.mjs blur render  # named suites only
//
// Suites: luma, dodge, blur, pencil, render, styles, scale, fit, names, saves, links.

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = join(HERE, '..', 'tools', 'image_to_sketch_converter.html');
const ALL = ['luma', 'dodge', 'blur', 'pencil', 'render', 'styles', 'scale', 'fit', 'names', 'saves', 'links'];
const picked = process.argv.slice(2).filter(a => !a.startsWith('--'));
const suites = picked.length ? picked : ALL;

let failures = 0, passes = 0;
const check = (ok, what, detail) => { if (ok) passes++; else { failures++; console.log(`  FAIL  ${what}${detail ? '\n          ' + detail : ''}`); } };
const eq = (got, want, what) => check(JSON.stringify(got) === JSON.stringify(want), what, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
const near = (got, want, tol, what) => check(Math.abs(got - want) <= tol, what, `got ${got}, want ${want} ±${tol}`);

const html = readFileSync(PAGE, 'utf8');
const src = /<script id="core">([\s\S]*?)<\/script>/.exec(html)[1];
const ctx = {module: {exports: {}}};
vm.createContext(ctx);
vm.runInContext(src, ctx);
const S = ctx.module.exports;

// ---- helpers -------------------------------------------------------------------------------------------------
function image(w, h, f) { // f(x, y) -> [r, g, b, a?]
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = f(x, y), i = (y * w + x) * 4;
    d[i] = p[0]; d[i + 1] = p[1]; d[i + 2] = p[2]; d[i + 3] = p.length > 3 ? p[3] : 255;
  }
  return d;
}
const grayAt = (out, w, x, y) => out[(y * w + x) * 4];
const meanOf = (out) => { let s = 0; for (let i = 0; i < out.length; i += 4) s += out[i]; return s / (out.length / 4); };
// Reference Gaussian: direct separable convolution with a sampled kernel out to 5 sigma, edges clamped.
function gaussExact(src, w, h, sigma) {
  const R = Math.ceil(sigma * 5), k = [];
  let sum = 0;
  for (let i = -R; i <= R; i++) { const v = Math.exp(-i * i / (2 * sigma * sigma)); k.push(v); sum += v; }
  for (let i = 0; i < k.length; i++) k[i] /= sum;
  const tmp = new Float64Array(w * h), out = new Float64Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let a = 0; for (let i = -R; i <= R; i++) a += k[i + R] * src[y * w + Math.min(w - 1, Math.max(0, x + i))];
    tmp[y * w + x] = a;
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let a = 0; for (let i = -R; i <= R; i++) a += k[i + R] * tmp[Math.min(h - 1, Math.max(0, y + i)) * w + x];
    out[y * w + x] = a;
  }
  return out;
}
// A photo-like test card: soft gradient, a dark disc, a hard bar, fine stripes and some texture.
function card(w, h) {
  return image(w, h, (x, y) => {
    const u = x / w, v = y / h;
    let g = 70 + 150 * u * (1 - v * 0.4);
    const dx = u - 0.35, dy = v - 0.5;
    if (dx * dx + dy * dy < 0.04) g = 40 + 30 * v;
    if (u > 0.65 && u < 0.72) g = 15;
    if (v > 0.8 && Math.floor(x / Math.max(2, w / 60)) % 2) g -= 50;
    g += 10 * Math.sin(x * 0.37) * Math.sin(y * 0.29);
    return [g * 1.05, g, g * 0.9];
  });
}

const T = {
  luma() {
    const px = (r, g, b, a = 255) => S.gray(new Uint8ClampedArray([r, g, b, a]), 1)[0];
    near(px(255, 0, 0), 76.245, 1e-3, 'BT.601: pure red');
    near(px(0, 255, 0), 149.685, 1e-3, 'BT.601: pure green');
    near(px(0, 0, 255), 29.07, 1e-3, 'BT.601: pure blue');
    near(px(255, 255, 255), 255, 1e-3, 'white stays 255');
    near(px(0, 0, 0, 0), 255, 1e-9, 'fully transparent black is white paper');
    near(px(0, 0, 0, 128), 255 - 128 / 255 * 255, 1e-3, 'half-transparent black is mid grey over paper');
    near(px(10, 20, 30, 255), 0.299 * 10 + 0.587 * 20 + 0.114 * 30, 1e-4, 'arbitrary opaque colour');
  },

  dodge() {
    // W3C Compositing and Blending Level 1, color-dodge: B(cb, cs) = 0 if cb = 0; 1 if cs = 1; min(1, cb / (1 - cs)).
    eq(S.dodge(0, 255), 0, 'backdrop 0 wins over source 1');
    eq(S.dodge(0, 100), 0, 'backdrop 0 gives 0');
    eq(S.dodge(1, 255), 255, 'source 1 gives 1');
    eq(S.dodge(100, 0), 100, 'source 0 leaves the backdrop');
    near(S.dodge(100, 127.5), 200, 1e-9, 'halfway source doubles the backdrop');
    eq(S.dodge(200, 200), 255, 'clipped at 1');
    near(S.dodge(64, 64), 64 * 255 / 191, 1e-9, 'cb / (1 - cs)');
  },

  blur() {
    for (const v of [0.1, 0.5, 1, 2.3, 7.7, 40]) near(S.boxVar(S.boxRadius(v)), v, 1e-6, `box radius reproduces variance ${v}`);
    near(S.boxVar(1), 2 / 3, 1e-12, 'a 3-tap box has variance 2/3');
    near(S.boxVar(0), 0, 1e-12, 'a 1-tap box has variance 0');
    // Impulse response: unit mass, variance sigma^2 exactly, close to the Gaussian shape.
    for (const sigma of [0.8, 1.7, 3, 6.4, 15]) {
      const w = 201, src = new Float32Array(w); src[100] = 1;
      const b = S.blur(src, w, 1, sigma);
      let m = 0, v = 0; for (let i = 0; i < w; i++) { m += b[i]; v += b[i] * (i - 100) * (i - 100); }
      near(m, 1, 1e-5, `σ ${sigma}: blur keeps mass`);
      near(v, sigma * sigma, 2e-3 * sigma * sigma + 1e-3, `σ ${sigma}: impulse variance is σ²`);
      const ref = gaussExact(src, w, 1, sigma);
      let worst = 0; for (let i = 0; i < w; i++) worst = Math.max(worst, Math.abs(b[i] - ref[i]));
      check(worst < (sigma < 3 ? 0.002 : 0.045) * ref[100] + 1e-4, `σ ${sigma}: matches a true Gaussian (exact below 3, within 4.5% of the peak above)`, `worst ${worst}, peak ${ref[100]}`);
    }
    // 2-D on an image, edges clamped, a constant stays constant.
    const w = 37, h = 23, flat = new Float32Array(w * h).fill(123.5);
    const fb = S.blur(flat, w, h, 4.2);
    check(fb.every(v => Math.abs(v - 123.5) < 1e-3), 'constant image survives the blur, edges included');
    for (const sg of [2.5, 4.5, 9]) {
      const g = S.gray(card(96, 72), 96 * 72), a = S.blur(g, 96, 72, sg), r = gaussExact(g, 96, 72, sg);
      let mae = 0, mx = 0; for (let i = 0; i < a.length; i++) { const d = Math.abs(a[i] - r[i]); mae += d; mx = Math.max(mx, d); }
      mae /= a.length;
      check(mae < 0.8 && mx < 9, `card σ ${sg}: page blur vs exact Gaussian`, `mean ${mae.toFixed(3)}, max ${mx.toFixed(2)} levels`);
    }
    // Wide blurs (σ ≥ 5) are computed on a shrunk copy; they must still match a true Gaussian.
    { const W = 600, H = 400, g = S.gray(card(W, H), W * H);
      for (const sg of [5, 12, 30]) {
        const a = S.blur(g, W, H, sg), r = gaussExact(g, W, H, sg);
        let mae = 0, mx = 0; for (let i = 0; i < a.length; i++) { const d = Math.abs(a[i] - r[i]); mae += d; mx = Math.max(mx, d); }
        mae /= a.length;
        check(mae < 0.8 && mx < 6, `shrunk blur σ ${sg} vs exact Gaussian`, `mean ${mae.toFixed(3)}, max ${mx.toFixed(2)} levels`);
      } }
    eq(Array.from(S.blur(new Float32Array([5]), 1, 1, 3)), [5], '1×1 blur');
    eq(S.blur(new Float32Array(0), 0, 0, 3).length, 0, '0×0 blur');
    eq(Array.from(S.blur(new Float32Array([1, 2, 3]), 3, 1, 0)), [1, 2, 3], 'σ 0 is a copy');
  },

  pencil() {
    // The whole pencil pipeline with the exact Gaussian in place of the box approximation.
    // Settings: line width 40 -> sigma (0.4 + 0.4 * 7) per thousandth of the long edge; darkness 50 -> gamma 3;
    // the gray is pre-smoothed by 0.6 thousandths, and dodge values above WHITE count as paper. Contours: XDoG with
    // sigma 0.9 thousandths + 0.15 of the pencil sigma, tau 0.985, phi 30, laid over with strength 0.3 + 0.45 * darkness.
    const w = 800, h = 600, d = card(w, h), o = {style: 'pencil', lines: 40, dark: 50, shade: 0, paper: 'white'};
    const got = S.render(d, w, h, o), s = Math.max(w, h) / S.REF;
    const Y = gaussExact(S.gray(d, w * h), w, h, 0.6 * s), inv = Y.map(v => 255 - v);
    const sigma = (0.4 + 0.4 * 7) * s, gamma = 1 + 0.5 * 4;
    const b = gaussExact(inv, w, h, sigma);
    const Y0 = S.gray(d, w * h), cs = 0.9 * s + sigma * 0.15, c1 = gaussExact(Y0, w, h, cs), c2 = gaussExact(Y0, w, h, cs * 1.6);
    let mae = 0, mx = 0;
    for (let i = 0; i < w * h; i++) {
      const D = (c1[i] - 0.985 * c2[i]) / 255, C = D >= 0 ? 1 : Math.max(0, 1 + Math.tanh(30 * D));
      const want = 255 * Math.pow(Math.min(1, S.dodge(Y[i], b[i]) / 255 / S.WHITE), gamma) * (1 - 0.525 * (1 - C)), dlt = Math.abs(got[i * 4] - want);
      mae += dlt; mx = Math.max(mx, dlt);
    }
    mae /= w * h;
    check(mae < 1.5 && mx < 20, 'pencil equals dodge(gray, gauss(255 - gray))^γ × XDoG contours', `mean ${mae.toFixed(2)}, max ${mx.toFixed(1)}`);
    // A flat area is blank paper whatever its grey (that is what colour dodge does), except true black.
    for (const g of [1, 40, 128, 230, 255]) {
      const out = S.render(image(9, 7, () => [g, g, g]), 9, 7, o);
      check(out.every((v, i) => i % 4 === 3 ? v === 255 : v === 255), `pencil: flat ${g} is white paper`);
    }
    const blk = S.render(image(9, 7, () => [0, 0, 0]), 9, 7, o);
    check(blk.every((v, i) => i % 4 === 3 ? v === 255 : v === 0), 'pencil: flat black stays black');
    // An edge gets a dark line on its dark side and nothing far away.
    const e = S.render(image(1000, 20, x => x < 500 ? [90, 90, 90] : [220, 220, 220]), 1000, 20, o);
    check(grayAt(e, 1000, 498, 10) < 160, 'pencil: dark line next to the edge', `got ${grayAt(e, 1000, 498, 10)}`);
    eq([grayAt(e, 1000, 100, 10), grayAt(e, 1000, 900, 10)], [255, 255], 'pencil: paper away from the edge');
    // Darkness only ever darkens; shading only ever darkens.
    const lo = S.render(d, w, h, {...o, dark: 10}), hi = S.render(d, w, h, {...o, dark: 90}), sh = S.render(d, w, h, {...o, shade: 80});
    check(meanOf(hi) < meanOf(got) && meanOf(got) < meanOf(lo), 'darkness slider darkens', `${meanOf(lo)} > ${meanOf(got)} > ${meanOf(hi)}`);
    check(sh.every((v, i) => v <= got[i]), 'shading never lightens a pixel');
  },

  render() {
    for (const st of S.STYLES) {
      for (const [w, h] of [[1, 1], [2, 1], [1, 5], [3, 3], [17, 4]]) {
        const out = S.render(card(w, h), w, h, {style: st});
        check(out.length === w * h * 4 && out.every((v, i) => i % 4 !== 3 || v === 255), `${st}: ${w}×${h} is opaque, right size`);
      }
      eq(S.render(new Uint8ClampedArray(0), 0, 0, {style: st}).length, 0, `${st}: 0×0 gives nothing, no throw`);
      const a = S.render(card(50, 40), 50, 40, {style: st}), b = S.render(card(50, 40), 50, 40, {style: st});
      check(a.every((v, i) => v === b[i]), `${st}: same input, same bytes`);
      // A transparent PNG: what is transparent comes out as blank paper, not black (the old page's bug).
      const t = S.render(image(40, 30, (x) => x < 20 ? [0, 0, 0, 0] : [0, 0, 0, 0]), 40, 30, {style: st, paper: 'white'});
      check(t.every((v, i) => i % 4 === 3 || v >= 250), `${st}: fully transparent image is white paper`);
      // Nonsense options fall back to that style's defaults instead of NaN.
      const n = S.render(card(20, 10), 20, 10, {style: st, lines: 'x', dark: NaN, shade: -Infinity, paper: 'pink'});
      check(n.every(v => v >= 0 && v <= 255) && n.every((v, i) => v === S.render(card(20, 10), 20, 10, {style: st})[i]), `${st}: garbage options act as defaults`);
    }
    eq(Array.from(S.render(card(4, 4), 4, 4, {style: 'nonsense'})), Array.from(S.render(card(4, 4), 4, 4, {style: 'pencil'})), 'unknown style is pencil');
    // Paper colours.
    const wp = S.render(image(5, 5, () => [255, 255, 255]), 5, 5, {style: 'pencil', paper: 'aged'});
    eq([wp[0], wp[1], wp[2]], [246, 236, 214], 'aged paper colour');
    const gp = S.render(image(64, 64, () => [255, 255, 255]), 64, 64, {style: 'pencil', paper: 'grain'});
    const m = meanOf(gp);
    check(m > 238 && m < 252, 'grain paper is a light texture', `mean ${m}`);
    // Progress is reported and ends at 1.
    const seen = []; S.render(card(30, 20), 30, 20, {style: 'hatching', progress: f => seen.push(f)});
    check(seen.length >= 3 && seen[seen.length - 1] === 1 && seen.every((f, i) => !i || f >= seen[i - 1]), 'progress rises to 1', JSON.stringify(seen));
  },

  styles() {
    const w = 1000, h = 30;
    const step = image(w, h, x => x < 500 ? [60, 60, 60] : [230, 230, 230]);
    // Ink outline (XDoG): flat paper, a line at the edge, darker lines with "line amount".
    const ink = S.render(step, w, h, {style: 'outline', dark: 60, shade: 0});
    eq([grayAt(ink, w, 100, 15), grayAt(ink, w, 900, 15)], [255, 255], 'outline: flat areas stay paper');
    let mn = 255; for (let x = 485; x < 515; x++) mn = Math.min(mn, grayAt(ink, w, x, 15));
    check(mn < 80, 'outline: the edge is inked', `darkest ${mn}`);
    const flatInk = S.render(image(30, 30, () => [128, 128, 128]), 30, 30, {style: 'outline'});
    check(flatInk.every((v, i) => i % 4 === 3 || v === 255), 'outline: a flat mid grey is blank');
    // Charcoal: edges come out dark (the old page drew them white).
    const ch = S.render(step, w, h, {style: 'charcoal', paper: 'white'});
    mn = 255; for (let x = 485; x < 515; x++) mn = Math.min(mn, grayAt(ch, w, x, 15));
    check(mn < 120, 'charcoal: the edge is dark', `darkest ${mn}`);
    // Cross-hatch: white stays white, a dark area gets lines (not a flat fill), more lines as it darkens.
    const white = S.render(image(60, 60, () => [255, 255, 255]), 60, 60, {style: 'hatching'});
    check(white.every((v, i) => i % 4 === 3 || v === 255), 'hatching: white is untouched');
    const tones = [200, 130, 60].map(g => S.render(image(80, 80, () => [g, g, g]), 80, 80, {style: 'hatching', paper: 'white'}));
    const tm = tones.map(meanOf);
    check(tm[0] > tm[1] && tm[1] > tm[2], 'hatching: darker tones, more ink', tm.join(' > '));
    const darkHatch = tones[2]; let lightPx = 0; for (let i = 0; i < darkHatch.length; i += 4) if (darkHatch[i] > 200) lightPx++;
    check(lightPx > 80 * 80 * 0.05, 'hatching: dark area is lines with paper between, not a flat fill', `${lightPx} light pixels`);
    // Tall images hatch the same at the top and in the bottom-left (the old page filled it solid).
    const tall = S.render(image(40, 200, () => [130, 130, 130]), 40, 200, {style: 'hatching'});
    const band = (y0) => { let s = 0; for (let y = y0; y < y0 + 30; y++) for (let x = 0; x < 20; x++) s += grayAt(tall, 40, x, y); return s / 600; };
    near(band(160), band(10), 25, 'hatching: tall image, bottom-left matches top-left');
    // Colour pencil keeps hue: a red patch comes out reddish, and the colour slider at 0 is neutral grey.
    const red = image(60, 60, () => [200, 40, 40]);
    const cp = S.render(red, 60, 60, {style: 'colour', shade: 80});
    const c = (60 * 30 + 30) * 4;
    check(cp[c] > cp[c + 1] + 30, 'colour pencil: red stays red', `${cp[c]},${cp[c + 1]},${cp[c + 2]}`);
    const cp0 = S.render(red, 60, 60, {style: 'colour', shade: 0});
    eq([cp0[c], cp0[c + 1], cp0[c + 2]], [255, 255, 255], 'colour pencil: colour 0 is paper in a flat area');
  },

  scale() {
    // Settings are fractions of the long edge: the full-size result, shrunk, looks like the small preview.
    // The small image is the big one shrunk 2×2, so both are the same picture.
    const big = card(480, 360), small = new Uint8ClampedArray(240 * 180 * 4);
    for (let y = 0; y < 180; y++) for (let x = 0; x < 240; x++) for (let c = 0; c < 4; c++) {
      let a = 0; for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) a += big[((2 * y + dy) * 480 + 2 * x + dx) * 4 + c];
      small[(y * 240 + x) * 4 + c] = a / 4;
    }
    for (const st of ['pencil', 'outline', 'colour']) {
      const B = S.render(big, 480, 360, {style: st}), Sm = S.render(small, 240, 180, {style: st});
      let mae = 0;
      for (let y = 0; y < 180; y++) for (let x = 0; x < 240; x++) {
        let a = 0; for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) a += B[((2 * y + dy) * 480 + 2 * x + dx) * 4];
        mae += Math.abs(a / 4 - Sm[(y * 240 + x) * 4]);
      }
      mae /= 240 * 180;
      check(mae < 14, `${st}: full size shrunk ≈ preview`, `mean difference ${mae.toFixed(2)} levels`);
    }
  },

  fit() {
    eq(S.fit(4000, 3000, 0, 1400), {w: 1400, h: 1050, scaled: true}, 'long edge capped');
    eq(S.fit(3000, 4000, 0, 1400), {w: 1050, h: 1400, scaled: true}, 'portrait long edge capped');
    eq(S.fit(800, 600, 16e6, 1400), {w: 800, h: 600, scaled: false}, 'never upscales');
    const f = S.fit(8000, 6000, 16e6, 0);
    check(f.w * f.h <= 16e6 && f.scaled && Math.abs(f.w / f.h - 4 / 3) < 0.002, 'area cap keeps the aspect', JSON.stringify(f));
    eq(S.fit(6000, 4000, 40e6, 0), {w: 6000, h: 4000, scaled: false}, '24 MP fits under 40 MP');
    eq(S.fit(0, 0, 16e6, 0), {w: 0, h: 0, scaled: false}, '0×0');
    eq(S.fit(100000, 1, 0, 1400), {w: 1400, h: 1, scaled: true}, 'panorama strip keeps one row');
  },

  names() {
    eq(S.fileName('IMG_2041.JPG', 'pencil', 'png'), 'IMG_2041-pencil-sketch.png', 'camera file');
    eq(S.fileName('Holiday photo (2).jpeg', 'charcoal', 'jpg'), 'Holiday photo (2)-charcoal-sketch.jpg', 'spaces and brackets kept');
    eq(S.fileName('Grüße aus Köln.webp', 'colour', 'png'), 'Grüße aus Köln-colour-sketch.png', 'non-ASCII kept');
    eq(S.fileName('a/b\\c:d*e?.png', 'outline', 'png'), 'a_b_c_d_e_-outline-sketch.png', 'path and reserved characters replaced');
    eq(S.fileName('', 'pencil', 'png'), 'photo-pencil-sketch.png', 'empty name');
    eq(S.fileName('.png', 'pencil', 'png'), 'photo-pencil-sketch.png', 'only an extension');
    eq(S.fileName('archive.tar.gz', 'hatching', 'gif'), 'archive.tar-hatching-sketch.png', 'one extension removed, unknown format is png');
    eq(S.fileName('x'.repeat(300) + '.png', 'pencil', 'png').length, 80 + '-pencil-sketch.png'.length, 'long names cut');
    eq(S.fileName('photo', 'evil', 'png'), 'photo-pencil-sketch.png', 'unknown style');
  },

  saves() {
    const d = S.loadState(null);
    eq(d.style, 'pencil', 'nothing saved: pencil');
    eq(d.per.charcoal, {style: 'charcoal', ...S.DEFAULTS.charcoal}, 'nothing saved: charcoal defaults');
    eq(d.format, 'png', 'nothing saved: PNG');
    for (const bad of ['', '{', 'null', '[]', '42', '"x"', 'undefined']) eq(S.loadState(bad).style, 'pencil', `broken save ${JSON.stringify(bad)}`);
    const s = S.loadState(JSON.stringify({style: 'hatching', format: 'jpg', per: {hatching: {lines: '70', dark: 140, shade: -3, paper: 'aged'}, pencil: {lines: 12.6}}}));
    eq([s.style, s.format], ['hatching', 'jpg'], 'saved style and format');
    eq(s.per.hatching, {style: 'hatching', lines: 70, dark: 100, shade: 0, paper: 'aged'}, 'saved values clamped and numeric');
    eq(s.per.pencil, {style: 'pencil', lines: 13, dark: S.DEFAULTS.pencil.dark, shade: S.DEFAULTS.pencil.shade, paper: 'white'}, 'partial save keeps the rest default');
    const round = S.loadState(JSON.stringify(s));
    eq(round, s, 'save → load round trip');
  },

  links() {
    eq(S.styleFromUrl('?style=charcoal', ''), 'charcoal', '?style=charcoal');
    eq(S.styleFromUrl('', '#style=hatching'), 'hatching', '#style=hatching');
    eq(S.styleFromUrl('?utm_source=x&style=Outline', ''), 'outline', 'case-insensitive, among other parameters');
    eq(S.styleFromUrl('?style=color', ''), 'colour', 'US spelling');
    eq(S.styleFromUrl('?style=ink', ''), 'outline', 'ink means outline');
    eq(S.styleFromUrl('?style=hatch', ''), 'hatching', 'hatch');
    eq(S.styleFromUrl('?style=watercolour', ''), null, 'unknown style ignored');
    eq(S.styleFromUrl('', ''), null, 'no parameters');
    eq(S.styleFromUrl('?lifestyle=pencil', ''), null, 'only the style parameter counts');
  }
};

for (const name of suites) {
  if (!T[name]) { console.log(`unknown suite ${name}`); failures++; continue; }
  const before = failures;
  T[name]();
  console.log(`${failures === before ? 'ok  ' : 'FAIL'}  ${name}`);
}
console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
