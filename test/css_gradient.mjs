#!/usr/bin/env node
// Test suite for tools/css_gradient_generator.html (CSS Gradient Generator).
//
// Runs the page's DOM-free <script id="core"> block in Node. The page promises that the CSS it prints draws the
// gradient you see, and that a gradient you paste is read the way a browser reads it. Expected values come from the
// specs (CSS Color 4 for colours, Oklab and interpolation; CSS Images 3/4 for gradient syntax and stop fix-up), worked
// out by hand - not from the page. The `browser` suite has Chromium draw what was pasted and what the page prints
// side by side and wants the same pixels (skipped without Playwright).
//
//   node test/css_gradient.mjs              # everything
//   node test/css_gradient.mjs parse color  # named suites only
//
// Suites: color, oklab, mix, parse, resolve, errors, contract, fallback, storage, huge, browser.

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = join(HERE, '..', 'tools', 'css_gradient_generator.html');
const ALL = ['color', 'oklab', 'mix', 'parse', 'resolve', 'errors', 'contract', 'fallback', 'storage', 'huge', 'browser'];
const picked = process.argv.slice(2).filter(a => !a.startsWith('--'));
const suites = picked.length ? picked : ALL;

let failures = 0, passes = 0;
const check = (ok, what, detail) => { if (ok) passes++; else { failures++; console.log(`  FAIL  ${what}${detail ? '\n          ' + detail : ''}`); } };
const eq = (got, want, what) => check(JSON.stringify(got) === JSON.stringify(want), what, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
const near = (got, want, tol, what) => check(Math.abs(got - want) <= tol, what, `got ${got}, want ${want} ±${tol}`);
const section = name => console.log(`\n=== ${name} ===`);

const html = readFileSync(PAGE, 'utf8');
const src = html.match(/<script id="core">([\s\S]*?)<\/script>/)[1];
const ctx = {};
vm.runInNewContext(src + '\nthis.GR = GR;', ctx);
const GR = ctx.GR;
const hex = s => { const c = GR.parseColor(s, {bare: true}); return c && GR.colorToCss(c); };
const out = s => { const r = GR.parse(s); return r.ok ? GR.value(r.g) : 'ERR ' + r.error; };
let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;

if (suites.includes('color')) {
  section('color');
  const cases = [
    ['#4A6CF7', '#4a6cf7'], ['#abc', '#aabbcc'], ['#abcd', '#aabbccdd'], ['#11223344', '#11223344'], ['4a6cf7', '#4a6cf7'],
    ['  #FFF ', '#ffffff'], ['#ff000080', '#ff000080'], ['red', '#ff0000'], ['RebeccaPurple', '#663399'], ['transparent', 'transparent'],
    ['rgb(255, 0, 0)', '#ff0000'], ['rgb(255 0 0)', '#ff0000'], ['rgba(255,0,0,.5)', '#ff000080'], ['rgb(255 0 0 / 50%)', '#ff000080'],
    ['rgb(100%, 50%, 0%)', '#ff8000'], ['rgb(300, -20, 0)', '#ff0000'], ['rgb(12.6 0 0)', '#0d0000'],
    // CSS Color 4 hsl() examples and the named colours they equal
    ['hsl(120, 100%, 25%)', '#008000'], ['hsl(120 100% 25%)', '#008000'], ['hsl(0.5turn 100% 50%)', '#00ffff'], ['hsl(-120 100% 50%)', '#0000ff'],
    ['hsla(240, 100%, 50%, 0.5)', '#0000ff80'], ['hsl(120deg 75% 25%)', '#107010'], ['hsl(200,80%,50%)', '#1aa2e6'], // Chromium: rgb(26 162 230); 25.5 rounds up
    ['hwb(0 0% 0%)', '#ff0000'], ['hwb(120 0% 50%)', '#008000'], ['hwb(0 60% 60%)', '#808080'],
    ['#ff00zz', null], ['#12345', null], ['rgb(1,2)', null], ['rgb(1 2 3 4)', null], ['hwb(0, 0%, 0%)', null], ['banana', null], ['', null], ['   ', null]
  ];
  for (const [i, w] of cases) eq(hex(i), w, `colour ${JSON.stringify(i)}`);
  check(GR.parseColor('4a6cf7') === null, 'bare hex only when asked for');
}

if (suites.includes('oklab')) {
  section('oklab');
  // CSS Color 4: rgb(255 0 0) is oklab(62.8% 0.2249 0.1258); white is oklab(100% 0 0); black oklab(0 0 0)
  const r = GR.toOklab({r: 255, g: 0, b: 0});
  near(r[0], 0.62796, 1e-4, 'red L'); near(r[1], 0.22486, 1e-4, 'red a'); near(r[2], 0.12585, 1e-4, 'red b');
  const w = GR.toOklab({r: 255, g: 255, b: 255});
  near(w[0], 1, 1e-6, 'white L'); near(Math.hypot(w[1], w[2]), 0, 1e-6, 'white has no chroma');
  check(Number.isNaN(GR.toOklch({r: 128, g: 128, b: 128})[2]), 'grey has no hue (powerless)');
  // blue: oklch(45.2% 0.313 264.05)
  const b = GR.toOklch({r: 0, g: 0, b: 255});
  near(b[0], 0.452, 1e-3, 'blue L'); near(b[1], 0.3132, 1e-3, 'blue C'); near(b[2], 264.05, 0.05, 'blue h');
  let worst = 0;
  for (let i = 0; i < 2000; i++) {
    const c = {r: rnd() * 255, g: rnd() * 255, b: rnd() * 255, a: 1}, o = GR.toOklab(c), back = GR.fromOklab(o[0], o[1], o[2], 1);
    worst = Math.max(worst, Math.abs(back.r - c.r), Math.abs(back.g - c.g), Math.abs(back.b - c.b));
  }
  near(worst, 0, 1e-3, 'sRGB -> Oklab -> sRGB round trip');
}

if (suites.includes('mix')) {
  section('mix');
  const K = {r: 0, g: 0, b: 0, a: 1}, W = {r: 255, g: 255, b: 255, a: 1}, R = {r: 255, g: 0, b: 0, a: 1}, B = {r: 0, g: 0, b: 255, a: 1}, T = {r: 0, g: 0, b: 0, a: 0};
  near(GR.mix(K, W, .5, 'srgb').r, 127.5, 1e-9, 'sRGB midpoint is the channel average');
  // Oklab L = 0.5 is linear 0.5^3 = 0.125, sRGB 1.055 * 0.125^(1/2.4) - 0.055 = 0.38857 -> 99.09
  near(GR.mix(K, W, .5, 'oklab').r, 99.09, 0.05, 'Oklab midpoint of black and white');
  const m = GR.mix(R, B, .5, 'oklch');
  check(m.g < 40 && m.r > 150 && m.b > 150, 'red to blue in OKLCH passes through magenta (the shorter way)', JSON.stringify(m));
  const t = GR.mix(T, R, .5, 'srgb');
  eq([Math.round(t.r), t.g, t.b, t.a], [255, 0, 0, .5], 'premultiplied: transparent to red never darkens');
  const t2 = GR.mix(T, R, .5, 'oklab');
  near(t2.r, 255, 0.5, 'premultiplied in Oklab too');
  const g = GR.mix({r: 128, g: 128, b: 128, a: 1}, B, .5, 'oklch');
  check(g.b > g.r && g.b > g.g, 'a grey takes the other colour\'s hue in OKLCH (missing hue)', JSON.stringify(g));
  for (const sp of ['srgb', 'oklab', 'oklch']) {
    const a = GR.mix(R, B, 0, sp), z = GR.mix(R, B, 1, sp);
    check(Math.abs(a.r - 255) < .5 && Math.abs(z.b - 255) < .5, `${sp}: ends are the stops`);
  }
}

if (suites.includes('parse')) {
  section('parse');
  const cases = [
    ['linear-gradient(red, blue)', 'linear-gradient(180deg, #ff0000 0%, #0000ff 100%)'],
    ['background: linear-gradient(90deg,#4a6cf7 0%, #8e44ad 100%);', 'linear-gradient(90deg, #4a6cf7 0%, #8e44ad 100%)'],
    ['background-image:linear-gradient(to right,red,blue) !important;', 'linear-gradient(90deg, #ff0000 0%, #0000ff 100%)'],
    ['linear-gradient(to top, red, blue)', 'linear-gradient(0deg, #ff0000 0%, #0000ff 100%)'],
    ['linear-gradient(to left top, red, blue)', 'linear-gradient(to top left, #ff0000 0%, #0000ff 100%)'],
    ['linear-gradient(0.25turn, red, blue)', 'linear-gradient(90deg, #ff0000 0%, #0000ff 100%)'],
    ['linear-gradient(-45deg, red, blue)', 'linear-gradient(315deg, #ff0000 0%, #0000ff 100%)'],
    ['linear-gradient(450deg, red, blue)', 'linear-gradient(90deg, #ff0000 0%, #0000ff 100%)'],
    ['linear-gradient(90, red, blue)', 'linear-gradient(90deg, #ff0000 0%, #0000ff 100%)'],
    ['linear-gradient(in oklab 45deg, red, blue)', 'linear-gradient(in oklab 45deg, #ff0000 0%, #0000ff 100%)'],
    ['linear-gradient(45deg in oklch, red, blue)', 'linear-gradient(in oklch 45deg, #ff0000 0%, #0000ff 100%)'],
    ['linear-gradient(in oklch shorter hue, red, blue)', 'linear-gradient(in oklch 180deg, #ff0000 0%, #0000ff 100%)'],
    ['linear-gradient(in srgb, red, blue)', 'linear-gradient(180deg, #ff0000 0%, #0000ff 100%)'],
    ['repeating-linear-gradient(45deg, red 0 10%, blue 10% 20%)', 'repeating-linear-gradient(45deg, #ff0000 0%, #ff0000 10%, #0000ff 10%, #0000ff 20%)'],
    ['radial-gradient(red, blue)', 'radial-gradient(#ff0000 0%, #0000ff 100%)'],
    ['radial-gradient(circle farthest-corner at center,#4a6cf7 0%, #8e44ad 100%)', 'radial-gradient(circle, #4a6cf7 0%, #8e44ad 100%)'],
    ['radial-gradient(circle closest-side at left top, red, blue)', 'radial-gradient(circle closest-side at top left, #ff0000 0%, #0000ff 100%)'],
    ['radial-gradient(at 30% 70%, red, blue)', 'radial-gradient(at 30% 70%, #ff0000 0%, #0000ff 100%)'],
    ['radial-gradient(120px at center, red, blue)', 'radial-gradient(circle 120px, #ff0000 0%, #0000ff 100%)'],
    ['radial-gradient(200px 100px, red, blue)', 'radial-gradient(200px 100px, #ff0000 0%, #0000ff 100%)'],
    ['conic-gradient(red, blue)', 'conic-gradient(#ff0000 0%, #0000ff 100%)'],
    ['conic-gradient(from 90deg at 25% 25%, red 0deg, blue 0.5turn, red)', 'conic-gradient(from 90deg at 25% 25%, #ff0000 0%, #0000ff 50%, #ff0000 100%)'],
    ['-webkit-linear-gradient(left, red, blue)', 'linear-gradient(90deg, #ff0000 0%, #0000ff 100%)'],
    ['-webkit-linear-gradient(top, red, blue)', 'linear-gradient(180deg, #ff0000 0%, #0000ff 100%)'],
    ['-webkit-linear-gradient(45deg, red, blue)', 'linear-gradient(45deg, #ff0000 0%, #0000ff 100%)'],
    ['-moz-linear-gradient(0deg, red, blue)', 'linear-gradient(90deg, #ff0000 0%, #0000ff 100%)'],
    ['background: -webkit-linear-gradient(left, red, blue);\nbackground: linear-gradient(to bottom, red, blue);', 'linear-gradient(180deg, #ff0000 0%, #0000ff 100%)'],
    ['LINEAR-GRADIENT( 90DEG , RGB( 255 , 0 , 0 ) 10% , Blue )', 'linear-gradient(90deg, #ff0000 10%, #0000ff 100%)'],
    ['linear-gradient(90deg, /* brand */ red, blue)', 'linear-gradient(90deg, #ff0000 0%, #0000ff 100%)'],
    ['linear-gradient(90deg, rgba(0,0,0,0) 0%, hsl(0 0% 100% / .5) 100%)', 'linear-gradient(90deg, transparent 0%, #ffffff80 100%)'],
    ['linear-gradient(90deg, red 12.345%, blue 99.999%)', 'linear-gradient(90deg, #ff0000 12.35%, #0000ff 100%)'],
    ['linear-gradient(90deg, red 0, blue 50%)', 'linear-gradient(90deg, #ff0000 0%, #0000ff 50%)'],
    ['linear-gradient(90deg, red -20%, blue 150%)', 'linear-gradient(90deg, #ff0000 -20%, #0000ff 150%)'],
  ];
  for (const [i, w] of cases) eq(out(i), w, `paste ${JSON.stringify(i)}`);
  const bare = GR.parse('#ff7e5f #feb47b');
  check(bare.ok && bare.colorsOnly && bare.g.stops.length === 2, 'two colours alone are read as stops');
  const bare2 = GR.parse('red, rgb(0 0 255), #0f0');
  check(bare2.ok && bare2.colorsOnly && bare2.g.stops.length === 3, 'a comma list of colours is read as stops');
}

if (suites.includes('resolve')) {
  section('resolve');
  const P = (...ps) => ps.map(p => ({c: {r: 0, g: 0, b: 0, a: 1}, p}));
  // CSS Images 3 §3.5.3 fix-up, its own examples
  eq(GR.resolve(P(null, null)), [0, 100], 'two bare colours');
  eq(GR.resolve(P(null, 30, null, null)), [0, 30, 65, 100], 'red, yellow 30%, green, blue');
  eq(GR.resolve(P(40, 30, null)), [40, 40, 100], 'a stop before an earlier one moves up to it');
  eq(GR.resolve(P(null, 20, null, null, null, 100)), [0, 20, 40, 60, 80, 100], 'gaps shared evenly');
  eq(GR.resolve(P(-20, null, 150)), [-20, 65, 150], 'out-of-range stops kept, gap shared');
  eq(GR.resolve(P(50, 50)), [50, 50], 'hard stop');
  eq(out('linear-gradient(red 80%, blue 20%, green)'), 'linear-gradient(180deg, #ff0000 80%, #0000ff 80%, #008000 100%)', 'printed positions are the resolved ones');
}

if (suites.includes('errors')) {
  section('errors');
  const bad = [
    ['', /Paste a gradient/], ['   ', /Paste a gradient/],
    ['linear-gradient(45deg, #ff00zz 0%, blue 100%)', /“#ff00zz” is not a colour/],
    ['linear-gradient(red)', /at least two colours/], ['rgb(255 , 99, 71) , #FFD70 0 ,  hsl(200,80%,50%)', /Did you mean “#ffd700”/], ['red', /at least two colours/],
    ['linear-gradient(red 10px, blue)', /depends on the size of the box/],
    ['linear-gradient(red, 30%, blue)', /colour hint/],
    ['linear-gradient(to middle, red, blue)', /not a direction/], ['linear-gradient(to top bottom, red, blue)', /not a direction/],
    ['linear-gradient(red, blue), radial-gradient(red, blue)', /several gradients/],
    ['linear-gradient(red, blue', /not closed/], ['linear-gradient(in display-p3, red, blue)', /not a colour space/],
    ['linear-gradient(in oklch longer hue, red, blue)', /longer hue/],
    ['radial-gradient(ellipse 50px, red, blue)', /two sizes/], ['radial-gradient(circle 50%, red, blue)', /percentage/],
    ['radial-gradient(at middle, red, blue)', /not a position/], ['conic-gradient(45deg, red, blue)', /from/],
    ['linear-gradient(90deg, red 10% 20% 30%, blue)', /too many parts/], ['linear-gradient(90deg, red,, blue)', /empty item/],
    ['linear-gradient(90deg, red abc, blue)', /not a position/],
    ['linear-gradient(90deg, ' + Array(40).fill('red').join(', ') + ')', /32/],
  ];
  for (const [i, re] of bad) { const r = GR.parse(i); check(!r.ok && re.test(r.error), `refuses ${JSON.stringify(i.slice(0, 60))}`, r.ok ? 'accepted' : r.error); }
}

if (suites.includes('contract')) {
  section('contract');
  // What the old page printed, read back here: every one must keep its meaning (format may be tidier).
  const old = [
    ['background: linear-gradient(90deg,#4a6cf7 0%, #8e44ad 100%);', 'linear-gradient(90deg, #4a6cf7 0%, #8e44ad 100%)'],
    ['background: linear-gradient(0deg,#4a6cf7 0%, #8e44ad 100%);', 'linear-gradient(0deg, #4a6cf7 0%, #8e44ad 100%)'],
    ['background: linear-gradient(360deg,#4a6cf7 0%, #8e44ad 100%);', 'linear-gradient(0deg, #4a6cf7 0%, #8e44ad 100%)'],
    ['background: linear-gradient(90deg,#4a6cf7 0%, #6c58d2 50%, #8e44ad 100%);', 'linear-gradient(90deg, #4a6cf7 0%, #6c58d2 50%, #8e44ad 100%)'],
    ['background: radial-gradient(circle farthest-corner at center,#4a6cf7 0%, #8e44ad 100%);', 'radial-gradient(circle, #4a6cf7 0%, #8e44ad 100%)'],
    ['background: conic-gradient(from 0deg at center,#4a6cf7 0%, #8e44ad 100%);', 'conic-gradient(#4a6cf7 0%, #8e44ad 100%)'],
    ['background: linear-gradient(90deg,#4a6cf7 50%, #8e44ad 50%);', 'linear-gradient(90deg, #4a6cf7 50%, #8e44ad 50%)'],
    ['background: linear-gradient(90deg,#8e44ad 20%, #4a6cf7 80%);', 'linear-gradient(90deg, #8e44ad 20%, #4a6cf7 80%)'],
    ['background: linear-gradient(90deg,#4a6cf7 -20%, #8e44ad 150%);', 'linear-gradient(90deg, #4a6cf7 -20%, #8e44ad 150%)'],
    ['background: conic-gradient(from 45deg at top,#1D976C 0%, #93F9B9 100%);', 'conic-gradient(from 45deg at top, #1d976c 0%, #93f9b9 100%)'],
  ];
  for (const [i, w] of old) eq(out(i), w, `old output ${i.slice(12, 60)}`);
  eq(GR.PRESETS.map(p => p[0]), ['Blue to Purple', 'Sunset', 'Green', 'Dark', 'Purple', 'Mojito', 'Rainbow'], 'the seven presets are kept');
  eq(out(GR.PRESETS[6][1]), 'linear-gradient(90deg, #ff0000 0%, #ff9900 16%, #ffff00 33%, #00ff00 50%, #0099ff 66%, #6633ff 83%, #ff00ff 100%)', 'Rainbow stops');
  eq(GR.css(GR.parse('linear-gradient(90deg, red, blue)').g), 'background: linear-gradient(90deg, #ff0000 0%, #0000ff 100%);', 'CSS line');
}

if (suites.includes('fallback')) {
  section('fallback');
  const css = GR.css(GR.parse('linear-gradient(in oklab 90deg, #0000ff, #ffff00)').g, 'background', true).split('\n');
  check(css.length === 2 && !/ in /.test(css[0]) && /in oklab/.test(css[1]), 'fallback first, perceptual line last (the cascade keeps the last one it understands)');
  eq(GR.css(GR.parse('linear-gradient(in oklab 90deg, red, blue)').g).split('\n').length, 1, 'no fallback unless asked');
  // The fallback, blended in sRGB between its samples, must stay close to the true perceptual blend everywhere.
  for (const sp of ['oklab', 'oklch']) {
    let worst = 0;
    for (let n = 0; n < 300; n++) {
      const c1 = {r: rnd() * 255 | 0, g: rnd() * 255 | 0, b: rnd() * 255 | 0, a: 1}, c2 = {r: rnd() * 255 | 0, g: rnd() * 255 | 0, b: rnd() * 255 | 0, a: 1};
      const g = GR.parse(`linear-gradient(in ${sp}, ${GR.colorToCss(c1)}, ${GR.colorToCss(c2)})`).g;
      const st = GR.sampled(g).map(s => ({c: GR.parseColor(GR.colorToCss(s.c)), p: s.p}));
      for (let t = 0; t <= 1.0001; t += 0.01) {
        const truth = GR.mix(c1, c2, t, sp), p = t * 100;
        let i = 1; while (i < st.length - 1 && st[i].p < p) i++;
        const a = st[i - 1], b = st[i], u = (p - a.p) / (b.p - a.p), f = GR.mix(a.c, b.c, Math.max(0, Math.min(1, u)), 'srgb');
        const o1 = GR.toOklab(truth), o2 = GR.toOklab(f);
        worst = Math.max(worst, Math.hypot(o1[0] - o2[0], o1[1] - o2[1], o1[2] - o2[2]));
      }
    }
    check(worst < 0.02, `${sp} fallback within ΔEok 0.02 of the real blend (just noticeable)`, `worst ${worst.toFixed(4)}`);
  }
}

if (suites.includes('storage')) {
  section('storage');
  for (const s of [null, '', 'null', '{"a":1}', '<img src=x onerror=alert(1)>', 'red, blue', 'linear-gradient(red, url(javascript:alert(1)))', 'x'.repeat(1e5)])
    eq(GR.load(s), null, `refuses saved ${JSON.stringify(String(s).slice(0, 40))}`);
  const g = GR.load('linear-gradient(in oklch 30deg, red 10%, blue)');
  eq(g && GR.value(g), 'linear-gradient(in oklch 30deg, #ff0000 10%, #0000ff 100%)', 'a saved gradient comes back');
  // a link round-trips exactly
  const v = 'radial-gradient(circle at top left, #ff5e62e6 0%, #ff9966 35%, transparent 100%)';
  eq(GR.value(GR.load(decodeURIComponent(encodeURIComponent(v)))), v, 'link value round-trips');
}

if (suites.includes('huge')) {
  section('huge');
  const big = 'linear-gradient(90deg, ' + Array(30).fill('rgb(1 2 3) 5%').join(', ') + ')';
  let t = performance.now(); for (let i = 0; i < 100; i++) GR.parse(big); t = (performance.now() - t) / 100;
  check(t < 5, '30-stop gradient parses fast', `${t.toFixed(2)} ms`);
  const mb = 'linear-gradient(90deg, ' + 'red, '.repeat(200000) + 'blue)';
  t = performance.now(); const r = GR.parse(mb); t = performance.now() - t;
  check(!r.ok && t < 1500, 'a megabyte of stops is refused without hanging', `${t.toFixed(0)} ms, ${r.error}`);
  t = performance.now(); const r2 = GR.parse('x'.repeat(1e6)); t = performance.now() - t;
  check(!r2.ok && t < 1500, 'a megabyte of junk is refused without hanging', `${t.toFixed(0)} ms`);
  check(!GR.parse('((((((((((').ok && !GR.parse(')))').ok, 'unbalanced brackets refused');
  check(GR.parse('linear-gradient(90deg, #ff0000 0%, 😀 100%)').error.includes('😀'), 'non-ASCII named in the error');
}

if (suites.includes('browser')) {
  section('browser');
  let chromium;
  try { ({chromium} = await import('playwright')); } catch (e) { console.log('  (skipped: no playwright)'); }
  if (chromium) {
    let b;
    try { b = await chromium.launch(); } catch (e) { b = await chromium.launch({executablePath: '/opt/pw-browsers/chromium'}); }
    const page = await b.newPage({viewport: {width: 240, height: 140}, deviceScaleFactor: 1});
    const pairs = [
      'linear-gradient(to top right, red 20%, blue)', 'linear-gradient(red, yellow 30%, green, blue)', 'linear-gradient(red 80%, blue 20%, green)',
      '-webkit-linear-gradient(left, red, blue)', '-webkit-linear-gradient(30deg, red, blue)', 'linear-gradient(0.3turn, rgba(0,0,0,0), hsl(200 80% 50%))',
      'radial-gradient(circle at top left, rgba(255, 94, 98, .9), #FF9966 35%, hsl(48 100% 67%) 60%, transparent)', 'radial-gradient(200px 80px at 30% 70%, red, blue)',
      'radial-gradient(farthest-side, red, blue)', 'conic-gradient(from 45deg at top, #1D976C, #93F9B9)', 'conic-gradient(red 0deg, blue 0.25turn, red)',
      'repeating-linear-gradient(45deg, red 0 10%, blue 10% 20%)', 'linear-gradient(in oklab 90deg, blue, yellow)', 'linear-gradient(in oklch 90deg, red, blue)',
      'linear-gradient(90deg, red -20%, blue 150%)', 'linear-gradient(90deg, hwb(120 10% 20%), rebeccapurple)',
    ];
    for (const p of pairs) {
      const mine = GR.value(GR.parse(p).g);
      const shot = async v => { await page.setContent(`<body style="margin:0"><div id=d style="width:240px;height:140px"></div>`); await page.$eval('#d', (d, v) => d.style.background = v, v); return page.screenshot(); };
      const supported = await page.evaluate(v => CSS.supports('background-image', v), mine);
      check(supported, `Chromium accepts ${mine.slice(0, 60)}`);
      const a = await shot(p.startsWith('-') ? p : p), z = await shot(mine);
      // compare decoded pixels via the browser
      const diff = await page.evaluate(async ([A, Z]) => {
        const load = async b64 => { const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode(); const c = new OffscreenCanvas(im.width, im.height), x = c.getContext('2d'); x.drawImage(im, 0, 0); return x.getImageData(0, 0, im.width, im.height).data; };
        const p = await load(A), q = await load(Z); let m = 0; for (let i = 0; i < p.length; i++) m = Math.max(m, Math.abs(p[i] - q[i])); return m;
      }, [a.toString('base64'), z.toString('base64')]);
      check(diff <= 2, `same pixels: ${p.slice(0, 64)}`, `max channel difference ${diff}`);
    }
    await b.close();
  }
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
