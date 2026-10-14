#!/usr/bin/env node
// Test suite for tools/color_picker.html (Color Picker).
//
// Runs the page's DOM-free <script id="core"> block in Node. The page promises that every code it prints names
// the same colour and that the contrast badge is the WCAG verdict, so the expected values come from the sources:
// CSS Color 4 (named colours, the hsl() and hwb() examples, the oklab/oklch values it prints for sRGB primaries),
// WCAG 2.2's contrast definition and well-known WebAIM pairs (#767676 passes on white, #777777 fails), and
// round trips through the core's own parser for every format it prints. Also: what people paste, the inputs
// that break tools, gamut mapping, links and saved recent colours.
//
//   node test/color_picker.mjs                 # everything
//   node test/color_picker.mjs parse contrast  # named suites only
//
// Suites: named, convert, roundtrip, contrast, parse, gamut, related, saves, contract.

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = join(HERE, '..', 'tools', 'color_picker.html');
const ALL = ['named', 'convert', 'roundtrip', 'contrast', 'parse', 'gamut', 'related', 'saves', 'contract'];
const picked = process.argv.slice(2).filter(a => !a.startsWith('--'));
const suites = picked.length ? picked : ALL;

let failures = 0, passes = 0;
const check = (ok, what, detail) => { if (ok) passes++; else { failures++; console.log(`  FAIL  ${what}${detail ? '\n          ' + detail : ''}`); } };
const eq = (got, want, what) => check(JSON.stringify(got) === JSON.stringify(want), what, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
const near = (got, want, tol, what) => check(Math.abs(got - want) <= tol, what, `got ${got}, want ${want} ±${tol}`);
const section = name => console.log(`\n=== ${name} ===`);

const html = readFileSync(PAGE, 'utf8');
const src = html.match(/<script id="core">([\s\S]*?)<\/script>/)[1];
const ctx = {module: {exports: {}}, URLSearchParams};
vm.runInNewContext(src, ctx);
const K = ctx.module.exports;
const hexOf = s => { const p = K.parse(s); return p.ok ? K.describe(p).formats.hex : 'ERR: ' + p.error; };
const D = s => K.describe(K.parse(s));
// a small seeded PRNG so failures repeat
let seed = 12345; const rnd = () => (seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296;

if (suites.includes('named')) {
  section('named');
  eq(Object.keys(K.NAMED).length, 148, 'CSS Color 4 has 148 named colours (with grey spellings)');
  for (const [n, h] of [['rebeccapurple', '#663399'], ['aliceblue', '#f0f8ff'], ['darkgrey', '#a9a9a9'], ['lightgoldenrodyellow', '#fafad2'], ['yellowgreen', '#9acd32']])
    eq(hexOf(n), h, n);
  eq(hexOf('RebeccaPurple'), '#663399', 'names ignore case');
  eq(hexOf('Light Goldenrod Yellow'), '#fafad2', 'spaces in a name are ignored');
  eq(D('#808080').name, 'gray', '#808080 is gray (not grey)');
  eq(D('#00ffff').name, 'cyan', '#00ffff reads as cyan');
  eq(D('#4a6fff').name, null, '#4a6fff has no exact name');
  eq(D('#4a6fff').nearest, 'royalblue', 'nearest name to #4a6fff in OKLab');
  eq(D('#fe0000').nearest, 'red', 'one step off red is still nearest red');
  eq(K.guessName('stelblue'), 'steelblue', 'typo stelblue');
  eq(K.guessName('gren'), 'green', 'typo gren -> green, not grey');
  eq(K.guessName('xyzzy'), null, 'no guess for nonsense');
  check(/Did you mean steelblue/.test(K.parse('stelblue').error), 'the error offers the guess');
}

if (suites.includes('convert')) {
  section('convert');
  // CSS Color 4 §7 examples
  for (const [s, h] of [['hsl(0 100% 50%)', '#ff0000'], ['hsl(120 100% 25%)', '#008000'], ['hsl(120 100% 50%)', '#00ff00'], ['hsl(240 100% 50%)', '#0000ff'],
    ['hsl(60 100% 50%)', '#ffff00'], ['hsl(0 0% 50%)', '#808080'], ['hsl(360 100% 50%)', '#ff0000'], ['hsl(-120 100% 50%)', '#0000ff'],
    ['hsl(0.5turn 100% 50%)', '#00ffff'], ['hsl(3.14159265rad 100% 50%)', '#00ffff'], ['hsl(200grad 100% 50%)', '#00ffff'],
    ['hwb(0 0% 0%)', '#ff0000'], ['hwb(120 50% 50%)', '#808080'], ['hwb(0 60% 60%)', '#808080'], ['hsv(120 100% 100%)', '#00ff00'], ['hsb(0, 0%, 50%)', '#808080'],
    ['cmyk(0%, 100%, 100%, 0%)', '#ff0000'], ['cmyk(0 0 0 1)', '#000000'], ['rgb(100% 50% 0%)', '#ff8000']])
    eq(hexOf(s), h, s);
  // OKLab for sRGB primaries, as CSS Color 4 and Ottosson print them
  for (const [h, L, a, b] of [['#ffffff', 1, 0, 0], ['#ff0000', 0.62796, 0.22486, 0.12585], ['#00ff00', 0.86644, -0.23389, 0.1795], ['#0000ff', 0.45201, -0.03246, -0.31153]]) {
    const p = K.parse(h), o = K.rgbToOklab(p.r, p.g, p.b);
    near(o[0], L, 2e-4, h + ' OKLab L'); near(o[1], a, 2e-4, h + ' OKLab a'); near(o[2], b, 2e-4, h + ' OKLab b');
  }
  eq(D('#ff0000').formats.oklch, 'oklch(62.8% 0.2577 29.23)', 'red in OKLCH: 0.258 would sit outside sRGB, so one more decimal');
  eq(D('#000000').formats.oklch, 'oklch(0% 0 0)', 'black in OKLCH, no -0');
  eq(D('#808080').oklch[1], 0, 'grey has zero chroma');
  eq(D('#808080').formats.hslLegacy, 'hsl(0, 0%, 50%)', 'grey 128 is 50% (127.5 rounds to 128)');
  eq(D('#ffffff').formats.cmyk, 'cmyk(0%, 0%, 0%, 0%)', 'white CMYK');
  eq(D('#000000').formats.cmyk, 'cmyk(0%, 0%, 0%, 100%)', 'black CMYK, no NaN');
  eq(D('#00000080').formats.rgbLegacy, 'rgba(0, 0, 0, 0.502)', 'alpha 128/255');
  eq(D('#0000').formats.hex, '#00000000', '4-digit hex with alpha');
  eq(D('transparent').A, 0, 'transparent');
}

if (suites.includes('roundtrip')) {
  section('roundtrip');
  // every printed format must read back as the same 8-bit colour (CMYK is printed in whole percent and is not exact)
  const keys = ['hex', 'rgb', 'rgbLegacy', 'hsl', 'hslLegacy', 'hsv', 'oklch', 'plain'];
  let bad = {}; keys.forEach(k => bad[k] = 0);
  const cases = ['#000000', '#ffffff', '#808080', '#010101', '#fefefe', '#ff0000', '#00ff00', '#0000ff', '#7f7f80'];
  for (let i = 0; i < 20000; i++) cases.push('#' + Math.floor(rnd() * 0x1000000).toString(16).padStart(6, '0'));
  for (const h of cases) {
    const d = D(h);
    for (const k of keys) { const p = K.parse(d.formats[k]); if (!p.ok || K.describe(p).hex !== h) { if (bad[k]++ < 3) console.log(`    ${k}: ${h} -> ${d.formats[k]} -> ${p.ok ? K.describe(p).hex : p.error}`); } }
    if (d.name && hexOf(d.name) !== h) bad.hex++;
  }
  for (const k of keys) eq(bad[k], 0, `${k} round-trips on ${cases.length} colours`);
  let longest = 0; for (const h of cases.slice(0, 3000)) longest = Math.max(longest, D(h).formats.oklch.length);
  check(longest <= 30, 'OKLCH strings stay short enough for a phone row', 'longest ' + longest);
  // alpha survives
  for (const a of [0, 0.25, 0.5, 0.749, 1]) { const d = K.describe({r: 0.2, g: 0.4, b: 0.6, a}); const p = K.parse(d.formats.rgb); near(p.a, d.A, 1e-9, 'alpha ' + a + ' round-trips'); }
}

if (suites.includes('contrast')) {
  section('contrast');
  const C = h => K.contrast(D(h));
  near(C('#000000').white.ratio, 21, 1e-9, 'black on white is 21');
  near(C('#ffffff').white.ratio, 1, 1e-9, 'white on white is 1');
  check(C('#767676').white.grade.aa, '#767676 passes AA on white (4.54)');
  check(!C('#777777').white.grade.aa, '#777777 fails AA on white (4.48)');
  eq(C('#767676').white.shown, '4.54', '#767676 shows 4.54');
  eq(C('#777777').white.shown, '4.47', '#777777 shows 4.47 (4.4784, cut)');
  eq(C('#4a6fff').white.shown, '4.19', 'the worked example on white');
  eq(C('#ff0000').white.shown, '3.99', 'red on white is 3.998, never shown as a 4');
  // brute force: no colour shows a passing number while failing, or the other way round
  let lies = 0;
  for (let v = 0; v < 0x1000000; v += 97) {
    const h = '#' + v.toString(16).padStart(6, '0'), c = C(h);
    for (const bg of ['white', 'black']) { const x = c[bg]; if ((+x.shown >= 4.5) !== x.grade.aa || (+x.shown >= 3) !== x.grade.aaLarge || (+x.shown >= 7) !== x.grade.aaa) lies++; }
  }
  eq(lies, 0, 'shown ratio and verdict always agree (172,000 colours)');
  // WCAG luminance uses 0.04045 (IEC 61966-2-1); 0.03928 gives the same result for every 8-bit value
  near(K.luminance(10, 10, 10), (10 / 255) / 12.92, 1e-12, 'linear segment at 10/255');
  near(K.luminance(11, 11, 11), Math.pow((11 / 255 + 0.055) / 1.055, 2.4), 1e-12, 'curve at 11/255');
  // translucent colour is judged as it lands on the background
  near(C('#00000080').white.ratio, K.ratio([127, 127, 127], [255, 255, 255]), 1e-9, 'half-black on white is judged as grey 127');
  eq(C('#ffff00').better, 'black', 'yellow labels in black');
  eq(C('#000080').better, 'white', 'navy labels in white');
}

if (suites.includes('parse')) {
  section('parse');
  for (const [s, h] of [['#FFF', '#ffffff'], ['fff', '#ffffff'], ['FFF', '#ffffff'], ['  #ABCDEF ', '#abcdef'], ['ABCDEF', '#abcdef'], ['abcdef', '#abcdef'],
    ['0x4a6fff', '#4a6fff'], ['#4A6FFF;', '#4a6fff'], ['color: #4a6fff;', '#4a6fff'], ['background-color: steelblue !important;', '#4682b4'], ['"#4a6fff"', '#4a6fff'],
    ['rgb(255,0,0)', '#ff0000'], ['rgb(255 0 0)', '#ff0000'], ['RGB( 255 , 0 , 0 )', '#ff0000'], ['rgba(255, 0, 0, 0.5)', '#ff000080'], ['rgb(255 0 0 / 50%)', '#ff000080'],
    ['rgb(74, 111, 255', '#4a6fff'], ['  background:hsl(204,70%,53% ;', '#3398db'], ['74, 111, 255', '#4a6fff'], ['74 111 255', '#4a6fff'], ['rgb 74 111 255', '#4a6fff'], ['rgb(74.4, 110.6, 255)', '#4a6fff'],
    ['hsl(120, 100%, 50%)', '#00ff00'], ['hsla(120,100%,50%,1)', '#00ff00'], ['hsl(120deg 100% 50%)', '#00ff00'], ['hsl(120 100 50)', '#00ff00'],
    ['oklch(62.8% 0.2577 29.23)', '#ff0000'], ['oklch(0.628 0.2577 29.23)', '#ff0000'], ['oklch(62,8% 0,2577 29,23)', '#ff0000'], ['hsl(227,7 100% 64,5%)', '#4a6fff'],
    ['oklab(0.62796 0.22486 0.12585)', '#ff0000'], ['rgb(-10, 300, 0)', '#00ff00'], ['#4a6fff​', '#4a6fff'], ['﻿red', '#ff0000'], ['808080', '#808080'], ['123456', '#123456']])
    eq(hexOf(s), h, JSON.stringify(s));
  eq(K.parse('rgb(-10, 300, 0)').clipped, 'rgb', 'out-of-range rgb is clipped and says so');
  const errs = [['', /Type or paste/], ['   ', /Type or paste/], ['#12345', /5 digits; a hex colour has 3, 4, 6 or 8/], ['#ggg', /not hex digits/],
    ['banana', /not a CSS colour name/], ['rgb(1,2)', /takes 3 values, not 2/], ['rgb(1,2,3,4,5)', /takes 3 values/], ['hsl(red 1% 1%)', /not a number/],
    ['zzz(1,2,3)', /not a colour format I know/], ['rgb(1 2 3 / x)', /alpha/], ['x'.repeat(5000), /5000 characters/], ['#fffé', /not hex digits/],
    ['€%&', /Not a colour I can read/], ['rgb(1 2 3 / 4 / 5)', /separated/]];
  for (const [s, re] of errs) { const p = K.parse(s); check(!p.ok && re.test(p.error), 'error for ' + JSON.stringify(s.slice(0, 20)), p.error); }
  check(K.parse('').empty === true && !K.parse('#12').empty, 'empty is told apart from invalid');
  // 1000 random strings never throw
  let threw = 0; const al = '#()%,./ 0123456789abcdefghlmnorstuvwxyz-+é中';
  for (let i = 0; i < 20000; i++) { let s = ''; const n = 1 + Math.floor(rnd() * 30); for (let j = 0; j < n; j++) s += al[Math.floor(rnd() * al.length)]; try { const p = K.parse(s); if (p.ok) K.describe(p); } catch (e) { threw++; } }
  eq(threw, 0, '20,000 random strings never throw');
  const t0 = Date.now(); K.parse('rgb(' + '1,'.repeat(100000) + ')'); check(Date.now() - t0 < 50, 'a 200 kB paste returns at once');
}

if (suites.includes('gamut')) {
  section('gamut');
  for (const s of ['oklch(62.8% 0.26 29)', 'oklch(90% 0.4 140)', 'oklch(50% 0.37 300)', 'oklab(0.7 0.4 0.4)']) {
    const p = K.parse(s), m = /okl(ch|ab)\(([\d.]+)%?/.exec(s), L = +m[2] > 1 ? m[2] / 100 : +m[2];
    eq(p.clipped, 'gamut', s + ' is flagged out of gamut');
    check([p.r, p.g, p.b].every(v => v >= 0 && v <= 1), s + ' lands inside sRGB');
    near(K.rgbToOklab(p.r, p.g, p.b)[0], L, 0.01, s + ' keeps its lightness');
  }
  const p = K.parse('oklch(70% 0.3 140)'), o = K.rgbToOklab(p.r, p.g, p.b);
  near(Math.atan2(o[2], o[1]) * 180 / Math.PI, 140, 1.5, 'mapping keeps the hue');
  eq(K.parse('oklch(62.8% 0.2577 29.23)').clipped, undefined, 'red itself is not flagged');
  eq(hexOf('oklch(120% 0.1 20)'), '#ffffff', 'lightness above 100% is white');
}

if (suites.includes('related')) {
  section('related');
  const H = h => Object.fromEntries(K.harmonies(D(h)).map(x => [x.name, x.hexes]));
  eq(H('#ff0000').Complementary, ['#00ffff'], 'complement of red');
  eq(H('#ff0000').Analogous, ['#ff0080', '#ff8000'], 'analogous of red');
  eq(H('#ff0000').Triadic, ['#00ff00', '#0000ff'], 'triadic of red');
  eq(H('#808080').Complementary, ['#808080'], 'a grey has no hue to turn');
  const sc = K.scale(D('#4a6fff'));
  eq(sc.length, 9, 'nine tints and shades');
  let mono = true; for (let i = 1; i < sc.length; i++) { const a = D(sc[i - 1].hex), b = D(sc[i].hex); if (K.luminance(a.R, a.G, a.B) <= K.luminance(b.R, b.G, b.B)) mono = false; }
  check(mono, 'tints and shades darken step by step');
  check(K.scale(D('#ffff00')).every(s => /^#[0-9a-f]{6}$/.test(s.hex)), 'a vivid yellow scale stays valid');
}

if (suites.includes('saves')) {
  section('saves');
  eq(K.cleanRecent(null), [], 'no save');
  eq(K.cleanRecent('#fff'), [], 'a string is not a list');
  eq(K.cleanRecent(['#ABCDEF', '#abcdef', 'red', 5, '<img>', '#00000080', null]), ['#abcdef', '#00000080'], 'junk, case duplicates and names dropped');
  eq(K.cleanRecent(Array.from({length: 40}, (_, i) => '#0000' + i.toString(16).padStart(2, '0'))).length, 12, 'at most twelve');
  eq(K.pushRecent(['#111111', '#222222'], '#222222'), ['#222222', '#111111'], 'a repeat moves to the front');
  eq(K.fromLink('', '#4a6fff'), '#4a6fff', 'hash link');
  eq(K.fromLink('', '4a6fff'), '#4a6fff', 'hash without #');
  eq(K.fromLink('', '#ff000080'), '#ff000080', 'hash with alpha');
  eq(K.fromLink('?color=steelblue', ''), 'steelblue', '?color=');
  eq(K.fromLink('?c=fff', ''), '#fff', '?c=');
  eq(K.fromLink('', '#%3Cscript%3E'), null, 'a hostile hash is ignored');
  eq(K.fromLink('', ''), null, 'no link');
  eq(K.linkFor(D('#4a6fff')), '#4a6fff', 'a link is just the hex');
}

if (suites.includes('contract')) {
  section('contract');
  // the old page's outputs (recorded from its code) that were right stay right
  const d = D('ABCDEF');
  eq([d.formats.rgbLegacy, d.formats.cmyk], ['rgb(171, 205, 239)', 'cmyk(28%, 14%, 0%, 6%)'], 'ABCDEF rgb and cmyk');
  eq(D('#4a6fff').formats.cmyk, 'cmyk(71%, 56%, 0%, 0%)', 'default cmyk');
  eq(D('#ff0000').formats.hslLegacy, 'hsl(0, 100%, 50%)', 'red hsl');
  eq(D('#ff7f00').formats.hslLegacy, 'hsl(29.9, 100%, 50%)', '#ff7f00 hsl: the old page printed 30, which reads back as #ff8000');
  eq(hexOf('hsl(30, 100%, 50%)'), '#ff8000', '...and this is why');
  eq(K.contrast(D('ABCDEF')).black.shown, '12.71', 'ABCDEF on black');
  eq(K.contrast(D('#4a6fff')).black.shown, '5.00', 'default on black: 5.008 (the old page rounded to 5.01)');
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
