#!/usr/bin/env node
// Test suite for tools/text_shadow_generator.html (CSS Text Shadow Generator).
//
// Runs the page's DOM-free <script id="core"> block in Node. The page promises that the CSS it shows is the
// shadow you see and that any text-shadow you paste is read the way a browser reads it. Expected values come
// from the specs (CSS Text Decoration 3 for the shape of a shadow, CSS Color 4 for colours and its hsl()
// formula, WCAG 2 for contrast), worked out by hand - not from the page. The `browser` suite hands the same
// strings to Chromium and compares its computed style with what the core read (skipped without Playwright).
//
//   node test/text_shadow.mjs                 # everything
//   node test/text_shadow.mjs color parse     # named suites only
//
// Suites: format, color, number, parse, errors, roundtrip, storage, link, contrast, browser.

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = join(HERE, '..', 'tools', 'text_shadow_generator.html');
const ALL = ['format', 'color', 'number', 'parse', 'errors', 'roundtrip', 'storage', 'link', 'contrast', 'browser'];
const picked = process.argv.slice(2).filter(a => !a.startsWith('--'));
const suites = picked.length ? picked : ALL;

let failures = 0, passes = 0;
const check = (ok, what, detail) => { if (ok) passes++; else { failures++; console.log(`  FAIL  ${what}${detail ? '\n          ' + detail : ''}`); } };
const eq = (got, want, what) => check(JSON.stringify(got) === JSON.stringify(want), what, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
const section = name => console.log(`\n=== ${name} ===`);

const html = readFileSync(PAGE, 'utf8');
const src = html.match(/<script id="core">([\s\S]*?)<\/script>/)[1];
const ctx = {};
vm.runInNewContext(src + '\nthis.TS = TS;', ctx);
const TS = ctx.TS;
const plain = o => JSON.parse(JSON.stringify(o));
const C = (r, g, b, a = 1) => ({r, g, b, a});
const L = (x, y, blur, color) => ({x, y, blur, color});
const list = s => plain(TS.parseList(s));

// A seeded PRNG (mulberry32) so failures reproduce.
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

if (suites.includes('format')) {
  section('format: the old page\'s outputs, byte for byte where the shape is the same');
  // These are the inventory's samples. The value of the property is unchanged; the declaration now ends in
  // "none" instead of nothing when there is no shadow, and several shadows go one per line.
  eq(TS.fmtLayer(L(0, 0, 0, C(0, 0, 0, 1))), '0px 0px 0px rgba(0, 0, 0, 1)', 'defaults');
  eq(TS.fmtLayer(L(2, 2, 4, C(0, 0, 0, 0.5))), '2px 2px 4px rgba(0, 0, 0, 0.5)', 'soft');
  eq(TS.fmtLayer(L(-50, -50, 0, C(255, 255, 255, 0))), '-50px -50px 0px rgba(255, 255, 255, 0)', 'negatives, alpha 0');
  eq(TS.fmtLayer(L(50, 50, 50, C(255, 0, 0, 1))), '50px 50px 50px rgba(255, 0, 0, 1)', 'max');
  eq(TS.fmtLayer(L(0, 5, 10, C(0, 170, 255, 0.01))), '0px 5px 10px rgba(0, 170, 255, 0.01)', 'alpha 0.01');
  eq(TS.fmtList([L(2, 2, 4, C(0, 0, 0, 0.5)), L(-3, 3, 0, C(18, 58, 188, 0.75))]), '2px 2px 4px rgba(0, 0, 0, 0.5), -3px 3px 0px rgba(18, 58, 188, 0.75)', 'two layers, one line');
  eq(TS.fmtLayer(L(1, -1, 0, C(255, 170, 0, 1))), '1px -1px 0px rgba(255, 170, 0, 1)', '#ffaa00');
  eq(TS.declaration([]), 'text-shadow: none;', 'empty list is none, not "text-shadow: ;"');
  eq(TS.declaration([L(2, 2, 4, C(0, 0, 0, 0.5))]), 'text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);', 'one layer on one line');
  eq(TS.declaration([L(1, 1, 0, C(0, 0, 0, 1)), L(2, 2, 0, C(0, 0, 0, 1))]), 'text-shadow:\n  1px 1px 0px rgba(0, 0, 0, 1),\n  2px 2px 0px rgba(0, 0, 0, 1);', 'several, one per line');
  eq(TS.fmtLayer(L(-0, 1.006, 2.499, C(0, 0, 0, 0.333))), '0px 1.01px 2.5px rgba(0, 0, 0, 0.33)', 'no -0, two decimals');
  eq(TS.fmtLayer(L(0.1 + 0.2, 0, 0, C(0, 0, 0, 1))), '0.3px 0px 0px rgba(0, 0, 0, 1)', 'float noise rounded away');
  for (const p of TS.PRESETS) eq(TS.fmtList(TS.parseList(p.css).layers), p.css, `preset ${p.name} is already in canonical form`);
}

if (suites.includes('color')) {
  section('color: CSS Color 4');
  const cases = [
    ['#000', C(0, 0, 0)], ['#FFF', C(255, 255, 255)], ['#0008', C(0, 0, 0, 0.53)], ['#123abc', C(18, 58, 188)],
    ['#123ABC80', C(18, 58, 188, 0.5)], ['123abc', C(18, 58, 188)], ['  #ff0000 ', C(255, 0, 0)],
    ['red', C(255, 0, 0)], ['RebeccaPurple', C(102, 51, 153)], ['transparent', C(0, 0, 0, 0)], ['grey', C(128, 128, 128)],
    ['rgb(0,0,0)', C(0, 0, 0)], ['rgba(0,0,0,0.5)', C(0, 0, 0, 0.5)], ['rgba(0, 170, 255, .8)', C(0, 170, 255, 0.8)],
    ['rgb(0 0 0 / 50%)', C(0, 0, 0, 0.5)], ['rgb(100% 0% 0%)', C(255, 0, 0)], ['rgb(300, -5, 12.6)', C(255, 0, 13)],
    ['rgba(0,0,0,2)', C(0, 0, 0, 1)], ['rgb(none 0 0)', C(0, 0, 0)],
    ['hsl(0, 100%, 50%)', C(255, 0, 0)], ['hsl(120 100% 50%)', C(0, 255, 0)], ['hsl(240deg 100% 50% / 0.25)', C(0, 0, 255, 0.25)],
    ['hsl(120, 100%, 25%)', C(0, 128, 0)], ['hsl(-120, 100%, 50%)', C(0, 0, 255)], ['hsla(0, 0%, 100%, 0.1)', C(255, 255, 255, 0.1)],
    ['hsl(30 50% 60%)', C(204, 153, 102)],
  ];
  for (const [s, want] of cases) eq(plain(TS.parseColor(s)), want, s);
  for (const bad of ['', '   ', '#12', '#12345', '12a', 'reddish', 'rgb(1,2)', 'rgb(1 2 3 4)', 'rgb(a,b,c)', 'hsl(0 0 0 / 1 / 2)', 'abc', 'notacolor', null, 'ff']) eq(TS.parseColor(bad), null, `not a colour: ${JSON.stringify(bad)}`);
  eq(TS.colorHex(C(0, 170, 255)), '#00aaff', 'hex out');
}

if (suites.includes('number')) {
  section('number: what people type into a field');
  const cases = [['4', 4], [' 4 ', 4], ['-2', -2], ['−2', -2], ['–2', -2], ['1.5', 1.5], ['1,5', 1.5], ['.5', 0.5],
    ['4px', 4], ['4 px', 4], ['+3', 3], ['0', 0], ['-0', -0], ['1e2', 100], ['', null], ['  ', null], ['abc', null], ['1.2.3', null],
    ['1,000', 1], ['--1', null], ['Infinity', null], ['NaN', null], [7, 7], [NaN, null]];
  for (const [s, want] of cases) check(Object.is(TS.readNumber(s), want) || (want === -0 && TS.readNumber(s) === 0), `readNumber(${JSON.stringify(s)})`, `got ${TS.readNumber(s)}, want ${want}`);
}

if (suites.includes('parse')) {
  section('parse: what people paste');
  const soft = [L(2, 2, 4, C(0, 0, 0, 0.5))];
  eq(list('2px 2px 4px rgba(0,0,0,0.5)').layers, soft, 'bare value');
  eq(list('text-shadow: 2px 2px 4px rgba(0, 0, 0, .5);').layers, soft, 'declaration');
  eq(list('  TEXT-SHADOW :2px 2px 4px rgba(0,0,0,0.5) !important ;  ').layers, soft, 'case, spaces, !important');
  eq(list('.title { color: red; text-shadow: 2px 2px 4px rgba(0,0,0,.5); font-size: 2em }').layers, soft, 'out of a whole rule');
  eq(list('-webkit-text-shadow: 2px 2px 4px rgba(0,0,0,.5)').layers, soft, 'vendor prefix');
  eq(list('/* soft */ 2px 2px 4px /* blur */ rgba(0,0,0,0.5)').layers, soft, 'comments');
  eq(list('rgba(0,0,0,0.5) 2px 2px 4px').layers, soft, 'colour first');
  eq(list('2px 2px 4px #00000080').layers, soft, '8-digit hex');
  eq(list('2px 2px').layers, [L(2, 2, 0, C(0, 0, 0))], 'blur and colour optional');
  eq(list('0 0 4px red').layers, [L(0, 0, 4, C(255, 0, 0))], 'unitless zero');
  eq(list('1.5px -0.5px .25px navy').layers, [L(1.5, -0.5, 0.25, C(0, 0, 128))], 'decimals');
  eq(list('text-shadow:\n  1px 1px 0 #000,\n  2px 2px 0 #000;').layers, [L(1, 1, 0, C(0, 0, 0)), L(2, 2, 0, C(0, 0, 0))], 'multi-line, as this page writes it');
  eq(list('3px 3px 6pt hsl(0 0% 0% / 40%)').layers, [L(3, 3, 8, C(0, 0, 0, 0.4))], 'pt converted, hsl with slash');
  const em = list('0.1em 0.125rem 3PX #00000099');
  eq(em.layers, [{x: 0.1, y: 0.125, blur: 3, color: C(0, 0, 0, 0.6), u: {x: 'em', y: 'rem', blur: 'px'}}], 'em and rem kept, not turned into px');
  eq(TS.fmtList(em.layers), '0.1em 0.125rem 3px rgba(0, 0, 0, 0.6)', 'and printed in their own units');
  eq(plain(TS.sanitizeLayer(em.layers[0])), em.layers[0], 'units survive a save');
  eq(plain(TS.sanitizeLayer({x: 1, y: 1, blur: 1, color: C(0, 0, 0), u: {x: 'vw', y: 'px', blur: 'px'}})), L(1, 1, 1, C(0, 0, 0)), 'unknown units fall back to px');
  eq(list('1px 1px 0 currentColor').layers, [L(1, 1, 0, C(0, 0, 0))], 'currentColor without a text colour is black');
  eq(plain(TS.parseList('1px 1px 0 currentcolor', C(10, 20, 30))).layers, [L(1, 1, 0, C(10, 20, 30))], 'currentColor is the text colour');
  for (const n of ['none', 'NONE;', 'text-shadow: none;', 'inherit', 'initial']) { const r = list(n); eq([r.layers.length, r.errors.length, r.none], [0, 0, true], `"${n}" is no shadow`); }
  eq(list('').empty, true, 'empty'); eq(list('   \n ').empty, true, 'whitespace'); eq(list('text-shadow: ;').empty, true, 'the old page\'s empty copy');
  // the old page's presets were written without spaces in rgba()
  eq(list('-2px 2px 0px rgba(255,0,0,1), 2px -2px 0px rgba(0,0,255,1)').layers, [L(-2, 2, 0, C(255, 0, 0)), L(2, -2, 0, C(0, 0, 255))], 'old 3D preset');
  eq(list('-2px 2px 0px rgba(255,0,0,1), 2px -2px 0px rgba(0,0,255,1), 0px 0px 0px rgba(0, 0, 0, 1)').layers.length, 3, 'old mixed spacing');
  const big = Array.from({length: 150}, (_, i) => `${i}px 0 0 red`).join(', ');
  const rb = list(big); eq(rb.layers.length, TS.MAX_LAYERS, '150 layers keeps 100'); check(rb.errors.some(e => /first 100/.test(e.message)), 'and says so');
  const t0 = Date.now(); const huge = list('1px 1px 0 red, '.repeat(13000)); check(Date.now() - t0 < 500, '200 kB parses quickly', `${Date.now() - t0} ms`);
  check(huge.layers.length === 100, 'huge input still capped');
  const tooBig = list('x'.repeat(300000)); check(tooBig.errors.length === 1 && /characters/.test(tooBig.errors[0].message), 'over 200,000 characters is refused in words');
}

if (suites.includes('errors')) {
  section('errors: each one names the shadow and says what would work');
  const err = (s, re, what) => { const r = list(s); check(r.errors.length > 0 && re.test(r.errors[0].message), what, JSON.stringify(r.errors)); return r; };
  err('2px 2px 4px 1px red', /spread is only for box-shadow/, 'four lengths');
  err('inset 2px 2px red', /inset/, 'inset');
  err('2px 2px -4px red', /blur cannot be negative/, 'negative blur');
  err('2 2 4 red', /needs a unit, such as 2px/, 'unitless non-zero');
  err('2px red', /at least two lengths/, 'one length');
  err('2px 2px red blue', /two colours/, 'two colours');
  err('2px red 2px', /before or after all the lengths/, 'colour in the middle');
  err('2px 2px 4px reddish', /"reddish" is not a length or a colour/, 'unknown word');
  err('2px 2px 4px 50%', /use px/, 'percent');
  err('2px 2px 2vw red', /use px/, 'viewport units');
  err('1px 1px red,, 2px 2px blue', /empty shadow/, 'double comma');
  err('color: red', /color is not text-shadow/, 'another property');
  const mixed = list('2px 2px 4px #0008, 3px 1px, 1px'); eq([mixed.layers.length, mixed.errors.map(e => e.index)], [2, [2]], 'valid layers are kept, the bad one is pointed at by number');
  eq(list('box-shadow: 2px 2px 4px red').layers, [L(2, 2, 4, C(255, 0, 0))], 'a box-shadow value that fits text-shadow is read');
}

if (suites.includes('roundtrip')) {
  section('roundtrip: whatever the page prints, it reads back the same');
  const r = rng(7);
  for (let i = 0; i < 3000; i++) {
    const n = 1 + Math.floor(r() * 5), layers = [];
    for (let k = 0; k < n; k++) layers.push(L(Math.round((r() * 200 - 100) * 100) / 100 || 0, Math.round((r() * 200 - 100) * 100) / 100 || 0,
      Math.round(r() * 60 * 100) / 100, C(Math.floor(r() * 256), Math.floor(r() * 256), Math.floor(r() * 256), Math.round(r() * 100) / 100)));
    const back = list(TS.declaration(layers));
    if (JSON.stringify(back.layers) !== JSON.stringify(layers) || back.errors.length) { eq(back.layers, layers, `roundtrip ${i}`); break; }
    if (i === 2999) check(true);
  }
  for (const l of [null, 3, {x: 'a'}, {x: 1, y: 1, blur: 1, color: {r: 'x'}}]) eq(TS.sanitizeLayer(l), null, `sanitize refuses ${JSON.stringify(l)}`);
  eq(plain(TS.sanitizeLayer({x: 1e9, y: -2, blur: -5, color: {r: 300, g: -1, b: 2.4, a: 7}})), L(1000, -2, 0, C(255, 0, 2, 1)), 'sanitize clamps');
}

if (suites.includes('storage')) {
  section('storage: the old page\'s keys still load');
  const get = o => k => (k in o ? o[k] : null);
  let s = plain(TS.load(get({textShadowAppShadows: JSON.stringify(['2px 2px 4px rgba(0, 0, 0, 0.5)', '-2px 2px 0px rgba(255,0,0,1)']), textShadowAppText: 'Hello', textShadowAppTheme: 'dark'})));
  eq(s.layers, [L(2, 2, 4, C(0, 0, 0, 0.5)), L(-2, 2, 0, C(255, 0, 0))], 'old shadow array');
  eq([s.text, s.theme], ['Hello', 'dark'], 'old text and theme');
  s = plain(TS.load(get({textShadowAppShadows: '{not json', textShadowAppText: '   ', textShadowAppTheme: 'purple'})));
  eq([s.layers, s.text, s.theme], [null, null, null], 'corrupt values are ignored (the old page crashed on them)');
  s = plain(TS.load(get({textShadowAppShadows: JSON.stringify([5, null, '1px 1px 0 red', 'garbage'])})));
  eq(s.layers, [L(1, 1, 0, C(255, 0, 0))], 'only readable entries kept');
  eq(plain(TS.load(get({textShadowAppShadows: '[]'}))).layers, [], 'an emptied list stays empty');
  s = plain(TS.load(get({textShadowAppStage: JSON.stringify({bg: 'navy', fg: '#FFF', size: '9999', font: 'comic'})})));
  eq(s.stage, {bg: '#000080', fg: '#ffffff', size: 200}, 'stage cleaned');
  eq(plain(TS.load(() => { throw new Error('blocked'); })), {layers: null, text: null, theme: null, stage: null}, 'blocked storage');
  const store = {};
  TS.save((k, v) => { store[k] = v; }, {layers: [L(1, 2, 3, C(4, 5, 6, 0.5))], text: 'Hi', theme: 'light', stage: {bg: '#ffffff'}});
  eq(JSON.parse(store.textShadowAppShadows), ['1px 2px 3px rgba(4, 5, 6, 0.5)'], 'saved in the old shape');
  eq(plain(TS.load(get(store))).layers, [L(1, 2, 3, C(4, 5, 6, 0.5))], 'and read back');
  eq(TS.save(() => { throw new Error('quota'); }, {layers: [], text: '', stage: {}}), false, 'a full store does not throw');
}

if (suites.includes('link')) {
  section('link: the shadow and colours, never the text');
  const layers = [L(2, 2, 4, C(0, 0, 0, 0.5)), L(-1, 0, 0, C(255, 0, 0, 1))];
  const h = TS.toHash(layers, {bg: '#f2e8d5', fg: '#1c1c1e'});
  check(!/Hello/.test(h), 'no text in it');
  const back = plain(TS.fromHash(h));
  eq([back.layers, back.stage], [layers, {bg: '#f2e8d5', fg: '#1c1c1e'}], 'round trip');
  eq(TS.fromHash(''), null, 'no hash'); eq(TS.fromHash('#section'), null, 'unrelated hash');
  eq(plain(TS.fromHash('#ts=none')).layers, [], 'none');
  eq(plain(TS.fromHash('#ts=%E0%A4%A&bg=zzz')).layers, [], 'malformed escapes do not throw');
  eq(plain(TS.fromHash('#ts=1px+1px+0+red&bg=<script>')).stage, {}, 'bad colours dropped');
}

if (suites.includes('contrast')) {
  section('contrast: WCAG 2');
  const near = (a, b) => Math.abs(a - b) < 0.01;
  check(near(TS.contrast(C(0, 0, 0), C(255, 255, 255)), 21), 'black on white 21');
  check(near(TS.contrast(C(255, 255, 255), C(255, 255, 255)), 1), 'same 1');
  check(near(TS.contrast(C(118, 118, 118), C(255, 255, 255)), 4.54), '#767676 on white 4.54');
}

if (suites.includes('browser')) {
  section('browser: Chromium reads the printed CSS as the core does');
  let chromium;
  try { ({chromium} = await import('playwright')); } catch (e) { console.log('  (skipped: no Playwright)'); }
  if (chromium) {
    const b = await chromium.launch();
    const p = await b.newPage();
    const r = rng(11), samples = [];
    for (let i = 0; i < 300; i++) {
      const n = 1 + Math.floor(r() * 4), ls = [];
      for (let k = 0; k < n; k++) ls.push(L(Math.round(r() * 200 - 100), Math.round(r() * 200 - 100), Math.round(r() * 50), C(Math.floor(r() * 256), Math.floor(r() * 256), Math.floor(r() * 256), Math.round(r() * 100) / 100)));
      samples.push(ls);
    }
    // pasted strings in many spellings: Chromium's computed value is the oracle
    const pasted = ['2px 2px 4px #0008', 'hsl(120 100% 50% / .5) 1px 1px', '0 0 4px rebeccapurple', '1px 1px 0 rgb(100% 0% 0%), -1px -1px 0 hsl(240, 100%, 50%)', '3px 3px 6pt #123abc', '2px 2px transparent'];
    const out = await p.evaluate(([decls, pasted]) => {
      const d = document.createElement('div'); document.body.appendChild(d);
      const read = v => { d.style.textShadow = ''; d.style.textShadow = v; return getComputedStyle(d).textShadow; };
      return {printed: decls.map(read), pasted: pasted.map(read)};
    }, [samples.map(s => TS.fmtList(s)), pasted]);
    const norm = s => s.replace(/\s+/g, ' ');
    // Chromium writes "rgba(r, g, b, a) Xpx Ypx Bpx" (rgb() when opaque); bring ours into that shape
    const asChrome = ls => ls.map(l => (l.color.a === 1 ? `rgb(${l.color.r}, ${l.color.g}, ${l.color.b})` : `rgba(${l.color.r}, ${l.color.g}, ${l.color.b}, ${l.color.a})`) + ` ${l.x}px ${l.y}px ${l.blur}px`).join(', ');
    let bad = 0;
    samples.forEach((s, i) => { const want = asChrome(s); if (norm(out.printed[i]) !== want && bad++ < 3) check(false, `Chromium reads ${TS.fmtList(s)}`, `${out.printed[i]} vs ${want}`); });
    check(bad === 0, `${samples.length} printed lists accepted by Chromium unchanged`);
    pasted.forEach((s, i) => {
      const ours = asChrome(TS.parseList(s).layers);
      // Chromium keeps alpha to more places; compare channels and alpha to 2 places
      const nums = t => (t.match(/-?[\d.]+/g) || []).map(Number);
      const a = nums(out.pasted[i]), c = nums(ours);
      check(a.length === c.length && a.every((v, k) => Math.abs(v - c[k]) < 0.6), `"${s}" read like Chromium`, `${out.pasted[i]} vs ${ours}`);
    });
    await b.close();
  }
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
