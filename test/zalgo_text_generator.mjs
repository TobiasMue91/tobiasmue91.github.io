#!/usr/bin/env node
// Test suite for tools/zalgo_text_generator.html (Zalgo Text Generator).
//
// Runs the page's DOM-free <script id="core"> block in Node. A Zalgo generator promises that the
// letters you typed come back intact under the marks (no split emoji, nothing on spaces or line
// breaks), that every mark it adds is a real combining mark of the kind its slider names (above,
// through, below - checked against canonical combining classes taken from Python's unicodedata,
// Unicode 15.1, not from the page), that no mark changes under NFC so a platform's normalisation
// cannot alter the count, that the same seed gives the same text and typing only adds marks to
// what is new, that "fit to" never exceeds the limit and thins rather than empties, and that
// "remove" gives back plain text while keeping accents typed as one letter. No browser, no server.
//
//   node test/zalgo_text_generator.mjs              # everything
//   node test/zalgo_text_generator.mjs fit remove   # named suites only
//
// Suites: marks, generate, stable, fit, remove, settings, edges.

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = join(HERE, '..', 'tools', 'zalgo_text_generator.html');
const ALL = ['marks', 'generate', 'stable', 'fit', 'remove', 'settings', 'edges'];
const picked = process.argv.slice(2).filter(a => !a.startsWith('--'));
const suites = picked.length ? picked : ALL;

let failures = 0, passes = 0;
const check = (ok, what, detail) => { if (ok) passes++; else { failures++; console.log(`  FAIL  ${what}${detail ? '\n          ' + detail : ''}`); } };
const eq = (got, want, what) => check(JSON.stringify(got) === JSON.stringify(want), what, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
const section = name => console.log(`\n=== ${name} ===`);

const html = readFileSync(PAGE, 'utf8');
const src = html.match(/<script id="core">([\s\S]*?)<\/script>/)[1];
const ctx = {module: {exports: {}}, Intl, globalThis: {}};
vm.runInNewContext(src, ctx);
const Z = ctx.module.exports;

const hex = s => [...s].map(c => c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0'));
const H = s => s.split(' ');
// From unicodedata.combining() over U+0300-036F, Unicode 15.1.
const CCC_ABOVE = H('0300 0301 0302 0303 0304 0305 0306 0307 0308 0309 030A 030B 030C 030D 030E 030F 0310 0311 0312 0313 0314 0315 031A 031B 033D 033E 033F 0342 0346 034A 034B 034C 0350 0351 0352 0357 0358 035B 0363 0364 0365 0366 0367 0368 0369 036A 036B 036C 036D 036E 036F');
const CCC_OVERLAY = H('0334 0335 0336 0337 0338');
const CCC_BELOW = H('0316 0317 0318 0319 031C 031D 031E 031F 0320 0321 0322 0323 0324 0325 0326 0327 0328 0329 032A 032B 032C 032D 032E 032F 0330 0331 0332 0333 0339 033A 033B 033C 0345 0347 0348 0349 034D 034E 0353 0354 0355 0356 0359 035A');
const NFC_UNSTABLE = H('0340 0341 0343 0344');
const ALLMARKS = new Set([...Z.UP, ...Z.MID, ...Z.DOWN]);
const marksIn = s => [...s].filter(c => ALLMARKS.has(c));
const loneSurrogate = s => /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(s);
const O = (o = {}) => ({up: 4, mid: 2, down: 4, seed: 12345, ...o});

if (suites.includes('marks')) {
  section('marks');
  eq([...hex(Z.UP.join(''))].sort(), [...CCC_ABOVE].sort(), 'above = every ccc 230/232/216 mark without a decomposition');
  eq(hex(Z.MID.join('')), [...CCC_OVERLAY, '0489'], 'through = the five overlays (ccc 1) + U+0489');
  eq([...hex(Z.DOWN.join(''))].sort(), [...CCC_BELOW].sort(), 'below = every ccc 220/202/240 mark');
  eq(ALLMARKS.size, Z.UP.length + Z.MID.length + Z.DOWN.length, 'the three sets do not overlap');
  check(![...ALLMARKS].some(c => NFC_UNSTABLE.includes(hex(c)[0])), 'no mark NFC rewrites (U+0340/0341/0343/0344)');
  check(!ALLMARKS.has('͏'), 'no invisible grapheme joiner U+034F');
  check(![...ALLMARKS].some(c => c >= '͜' && c <= '͢'), 'no double marks that reach into the next letter');
  for (const c of ALLMARKS) if (c.normalize('NFC') !== c || c.normalize('NFD') !== c) check(false, `mark ${hex(c)} is normalisation-stable`);
  check(/^\p{M}+$/u.test([...ALLMARKS].join('')), 'every mark is a Unicode combining mark (\\p{M})');
}

if (suites.includes('generate')) {
  section('generate');
  const out = Z.zalgo('hello', O());
  eq(Z.strip(out), 'hello', 'stripping the marks gives the letters back');
  check(out.length > 'hello'.length, 'marks were added');
  eq(Z.zalgo('hello', O({up: 0, mid: 0, down: 0})), 'hello', 'all sliders at 0 gives the input');
  const up = Z.zalgo('abcdefgh', O({mid: 0, down: 0}));
  check(marksIn(up).every(c => Z.UP.includes(c)), 'only above-marks when only Above is on');
  const dn = Z.zalgo('abcdefgh', O({up: 0, mid: 0}));
  check(marksIn(dn).every(c => Z.DOWN.includes(c)), 'only below-marks when only Below is on');
  const md = Z.zalgo('abcdefgh', O({up: 0, down: 0, mid: 3}));
  check(marksIn(md).every(c => Z.MID.includes(c)), 'only through-marks when only Middle is on');
  // The setting is the average: over many letters, marks per letter per direction ≈ setting.
  const long = 'x'.repeat(4000);
  for (const lv of [1, 4, 15]) {
    const o = Z.zalgo(long, {up: lv, mid: 0, down: 0, seed: 9});
    const per = (o.length - 4000) / 4000;
    check(Math.abs(per - lv) < lv * 0.06 + 0.05, `Above ${lv}: about ${lv} marks per letter on average`, `got ${per.toFixed(2)}`);
  }
  const maxPer = Math.max(...Z.build('x'.repeat(2000), {up: 15, mid: 15, down: 15, seed: 3}).parts.map(p => p[1].length));
  check(maxPer <= 3 * Math.floor(15 * 1.5 + 0.5), 'no letter gets more than 1.5× the setting per direction', `max ${maxPer}`);
  // Spaces, tabs and line breaks get no marks.
  const sp = Z.zalgo('a b\tc\nd\r\ne', O());
  eq(sp.replace(/\p{M}/gu, ''), 'a b\tc\nd\r\ne', 'whitespace kept');
  check(!/[ \t\n\r]\p{M}/u.test(sp), 'no mark follows a space, tab or line break');
  eq(Z.zalgo('   ', O()), '   ', 'spaces only: unchanged');
  // Gradient: first letter bare, last letter full.
  const g = Z.build('abcdefghij', {up: 10, mid: 0, down: 0, gradient: true, seed: 4}).parts;
  eq(g[0][1], '', 'gradient: first letter has no marks');
  check(g[9][1].length >= 5, 'gradient: last letter has the full amount', `${g[9][1].length}`);
  const ga = Z.build('x'.repeat(400), {up: 10, mid: 0, down: 0, gradient: true, seed: 4}).parts.map(p => p[1].length);
  const avg = a => a.reduce((s, x) => s + x, 0) / a.length;
  check(avg(ga.slice(0, 100)) < avg(ga.slice(300)) / 3, 'gradient grows along the text');
  const g1 = Z.build('a', {up: 6, mid: 0, down: 0, gradient: true, seed: 4}).parts;
  check(g1[0][1].length > 0, 'gradient on one letter: full amount');
  const gs = Z.build('a b', {up: 10, mid: 0, down: 0, gradient: true, seed: 4}).parts;
  eq([gs[0][1].length === 0, gs[1][1], gs[2][1].length > 0], [true, '', true], 'gradient counts letters, not spaces');
}

if (suites.includes('stable')) {
  section('stable');
  eq(Z.zalgo('Do not look', O()), Z.zalgo('Do not look', O()), 'same seed, same text');
  check(Z.zalgo('Do not look', O()) !== Z.zalgo('Do not look', O({seed: 99})), 'other seed, other marks');
  const a = Z.zalgo('Do not', O()), b = Z.zalgo('Do not look', O());
  check(b.startsWith(a), 'typing more keeps the marks already there');
  // Raising a setting only adds marks: each letter's marks at level n are a prefix of those at n+1.
  const p3 = Z.build('abcdef', {up: 3, mid: 0, down: 0, seed: 5}).parts, p6 = Z.build('abcdef', {up: 6, mid: 0, down: 0, seed: 5}).parts;
  check(p3.every((p, i) => p6[i][1].startsWith(p[1])), 'more Above only adds marks');
  const lens = [0, .1, .25, .5, .75, 1].map(s => Z.build('the quick brown fox', O({up: 15, mid: 5, down: 15}), s).text.length);
  check(lens.every((l, i) => i === 0 || l >= lens[i - 1]), 'length never shrinks as marks grow', lens.join(','));
}

if (suites.includes('fit')) {
  section('fit');
  const t = 'xX_D3ATH_Xx says: hello there';
  for (const lim of [32, 50, 150, 280, 2000]) {
    const r = Z.fit(t, O({up: 15, mid: 5, down: 15}), lim);
    check(r.ok && r.text.length <= lim, `fits ${lim}`, `${r.text.length}`);
    eq(Z.strip(r.text), t, `fit ${lim}: letters intact`);
  }
  const r280 = Z.fit(t, O({up: 15, mid: 5, down: 15}), 280);
  check(r280.fitted && r280.text.length >= 280 - 25, 'thins to just under the limit rather than emptying', `${r280.text.length}`);
  const small = Z.fit('hi', O(), 280);
  eq([small.ok, small.fitted, small.text], [true, false, Z.zalgo('hi', O())], 'already fits: untouched');
  const over = Z.fit('this text is longer than thirty-two characters', O(), 32);
  eq([over.ok, over.base, over.text], [false, 46, 'this text is longer than thirty-two characters'], 'text alone over the limit: not ok, no marks');
  const exact = Z.fit('a'.repeat(32), O(), 32);
  eq([exact.ok, exact.text], [true, 'a'.repeat(32)], 'text exactly at the limit: ok, no room for marks');
  eq(Z.fit('abc', O(), 0).text, Z.zalgo('abc', O()), 'limit 0 = no limit');
  // Length is UTF-16 units (what Discord and most text fields count); emoji count as 2.
  const em = Z.fit('💀💀', O({up: 15, mid: 0, down: 15}), 20);
  check(em.text.length <= 20 && !loneSurrogate(em.text), 'emoji: counted in UTF-16, never split');
}

if (suites.includes('remove')) {
  section('remove');
  for (const s of ['hello', 'Do not look behind you', 'a b\nc', '💀 skull 👨‍👩‍👧', 'Ünïcödé ß ñ', 'Привет', 'नमस्ते', 'สวัสดี', '日本語']) {
    eq(Z.remove(Z.zalgo(s, O({up: 15, mid: 5, down: 15}))), Z.remove(s), `round trip ${JSON.stringify(s)}`);
  }
  eq(Z.remove('héllo Ångström ñ'), 'héllo Ångström ñ', 'precomposed accents stay (the old page stripped them)');
  eq(Z.remove('नमस्ते'), 'नमस्ते', 'Devanagari vowel signs and virama are not Zalgo marks');
  eq(Z.remove('สวัสดี'), 'สวัสดี', 'Thai marks are not Zalgo marks');
  eq(Z.remove('a⃒⃣b᪰c᷀d︠e҉f'), 'abcdef', 'marks from the other combining blocks go too');
  eq(Z.remove('😀̖́x'), '😀x', 'marks inside an emoji are removed and the pair rejoins');
  eq(Z.countMarks('á̴̖b'), 3, 'counts removed marks');
  eq(Z.remove(''), '', 'empty');
  eq(Z.remove(null), '', 'null');
}

if (suites.includes('settings')) {
  section('settings');
  eq(Z.PRESETS.mild, {up: 1, mid: 0, down: 1}, 'mild');
  eq(Z.PRESETS.medium, {up: 4, mid: 0, down: 4}, 'medium (no overlays: they read as strikethrough)');
  eq(Z.PRESETS.strong, {up: 7, mid: 2, down: 7}, 'strong');
  eq(Z.PRESETS.extreme, {up: 15, mid: 5, down: 15}, 'extreme');
  const r = Z.readSettings(null);
  eq([r.preset, r.up, r.mid, r.down, r.gradient, r.limit], ['medium', 4, 0, 4, false, 0], 'nothing saved: defaults');
  eq(Z.readSettings('{nope').preset, 'medium', 'broken JSON: defaults');
  eq(Z.readSettings('"x"').up, 4, 'JSON that is not an object: defaults');
  const w = Z.readSettings(JSON.stringify({up: 99, mid: -3, down: '7', gradient: 'yes', limit: 'custom', custom: 0}));
  eq([w.up, w.mid, w.down, w.gradient, w.limit, w.custom, w.preset], [15, 0, 7, false, 'custom', 500, 'custom'], 'wild values clamped');
  eq(Z.readSettings({up: 15, mid: 5, down: 15}).preset, 'extreme', 'levels that match a preset name it');
  eq(Z.readSettings({preset: 'random', up: 2, mid: 9, down: 4}).preset, 'random', 'random kept');
  for (let i = 0; i < 50; i++) { const l = Z.randomLevels(); if (![l.up, l.mid, l.down].every(x => Number.isInteger(x) && x >= 0 && x <= 15)) { check(false, 'random levels in 0..15'); break; } }
  eq(['500', ' 1 000 ', '2.000', '2,000', '280 chars', '280 characters', '0', '-5', 'abc', '', '1e3', '12.5'].map(Z.parseLimit),
    [500, 1000, 2000, 2000, 280, 280, null, null, null, null, null, 125], 'custom limit parsing');
}

if (suites.includes('edges')) {
  section('edges');
  eq(Z.zalgo('', O()), '', 'empty');
  eq(Z.zalgo(null, O()), '', 'null');
  eq(Z.zalgo(undefined, O()), '', 'undefined');
  const emo = Z.zalgo('😀x👨‍👩‍👧y🇩🇪', O({up: 8, mid: 3, down: 8}));
  check(!loneSurrogate(emo), 'surrogate pairs never split (the old page broke emoji)');
  eq(Z.strip(emo), '😀x👨‍👩‍👧y🇩🇪', 'emoji, ZWJ families and flags intact');
  check(Z.graphemes(emo).length === 5, 'still five graphemes: marks sit after the whole cluster', `${Z.graphemes(emo).length}`);
  // Already-Zalgo input is cleaned first, so pasting a result back in does not compound.
  const once = Z.zalgo('abc', O());
  eq(Z.zalgo(once, O()), once, 'Zalgo pasted back in gives the same result, not a pile-up');
  eq(Z.strip(Z.zalgo('123 !?', O())), '123 !?', 'digits and punctuation');
  eq(Z.strip(Z.zalgo('नमस्ते', O())), 'नमस्ते', 'Devanagari clusters kept whole');
  const huge = 'The quick brown fox jumps over the lazy dog. '.repeat(2300);
  let t0 = Date.now(); const h = Z.zalgo(huge, O({up: 15, mid: 5, down: 15})); const ms = Date.now() - t0;
  check(ms < 2500, `100k characters at Extreme in ${ms} ms`);
  eq(Z.strip(h), huge, '100k characters: letters intact');
  t0 = Date.now(); const hf = Z.fit(huge, O(), 2000); eq(hf.ok, false, 'huge text over a small limit: refused quickly');
  check(Date.now() - t0 < 2500, 'refusal is fast');
  eq(Z.zalgo('ab', {up: 'x', mid: NaN, down: Infinity, seed: 1}), 'ab', 'nonsense levels act as 0');
  check(Z.zalgo('ab', {up: 3, mid: 0, down: 0}).length > 2, 'missing seed still works');
  // Browsers without Intl.Segmenter: the fallback keeps emoji, ZWJ sequences and marks together.
  const c2 = {module: {exports: {}}, Intl: {}, globalThis: {}};
  vm.runInNewContext(src, c2);
  const F = c2.module.exports;
  eq(F.graphemes('e\u0301😀👨‍👩‍👧x'), ['e\u0301', '😀', '👨‍👩‍👧', 'x'], 'fallback segmentation');
  const fe = F.zalgo('😀👨‍👩‍👧x', O());
  check(!loneSurrogate(fe) && F.strip(fe) === '😀👨‍👩‍👧x', 'fallback: emoji intact');
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
