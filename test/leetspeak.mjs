#!/usr/bin/env node
// Test suite for tools/1337.html (Leetspeak Converter).
//
// Runs the page's DOM-free <script id="core"> block in Node. A leetspeak converter promises that
// each letter becomes the symbol its alphabet says (basic: a4 e3 i1 o0 s5 t7 l1; advanced: all 26),
// that a share below 100% is exactly that share and the same every time, that decoding reads
// symbols back to the English words people meant, that numbers which are numbers stay numbers, and
// that empty, huge, non-ASCII and multi-line input survive. Expected values are written by hand
// from the alphabets; the "contract" suite holds the outputs the previous version of the page gave
// at full intensity. No browser, no server.
//
//   node test/leetspeak.mjs                # everything
//   node test/leetspeak.mjs decode edges   # named suites only
//
// Suites: contract, intensity, style, decode, settings, edges.

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = join(HERE, '..', 'tools', '1337.html');
const ALL = ['contract', 'intensity', 'style', 'decode', 'settings', 'edges'];
const picked = process.argv.slice(2).filter(a => !a.startsWith('--'));
const suites = picked.length ? picked : ALL;

let failures = 0, passes = 0;
const check = (ok, what, detail) => { if (ok) passes++; else { failures++; console.log(`  FAIL  ${what}${detail ? '\n          ' + detail : ''}`); } };
const eq = (got, want, what) => check(JSON.stringify(got) === JSON.stringify(want), what, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
const section = name => console.log(`\n=== ${name} ===`);

const html = readFileSync(PAGE, 'utf8');
const src = html.match(/<script id="core">([\s\S]*?)<\/script>/)[1];
const ctx = {module: {exports: {}}, Intl, URLSearchParams};
vm.runInNewContext(src, ctx);
const L = ctx.module.exports;
const B = {}, A = {advancedMode: true};

if (suites.includes('contract')) {
  section('contract');
  const T = [
    ['Hello World', 'H3110 W0r1d', '|-|3110 \\/\\/0|21[)'],
    ['', '', ''],
    ['   ', '', ''],
    ['leet speak', '1337 5p34k', '1337 5|°34|<'],
    ['1337', '1337', '1337'],
    ['The quick brown fox jumps over the lazy dog', '7h3 qu1ck br0wn f0x jump5 0v3r 7h3 14zy d0g',
      '7|-|3 9|_|1(|< 8|20\\/\\/|\\| ph0>< _||_||v||°5 0\\/3|2 7|-|3 142`/ [)09'],
    ['UPPER lower', 'UPP3R 10w3r', '|_||°|°3|2 10\\/\\/3|2'],
    ['emoji 😀 ok', '3m0j1 😀 0k', '3|v|0_|1 😀 0|<'],
    ['a\nb', '4\nb', '4\n8'],
  ];
  for (const [i, b, a] of T) { eq(L.encode(i, B), b, `basic ${JSON.stringify(i)}`); eq(L.encode(i, A), a, `advanced ${JSON.stringify(i)}`); }
  // Changed on purpose: accented letters now swap like their base letter (the old page left them).
  eq(L.encode('ÄÖÜ ß café', B), '40Ü ß c4f3', 'accents follow their base letter; ß stays');
  eq(L.encode('ÄÖÜ ß café', A), '40|_| ß (4ph3', 'accents, advanced');
  eq(Object.keys(L.MAPS.advanced).join(''), 'abcdefghijklmnopqrstuvwxyz', 'advanced covers a-z');
  eq(L.PRESETS.hacker, {leetIntensity: 75, emojiIntensity: 0, advancedMode: true, selectedStyle: 'none'}, 'hacker preset');
  eq(L.PRESETS.gamer, {leetIntensity: 50, emojiIntensity: 20, advancedMode: false, selectedStyle: 'uppercase'}, 'gamer preset');
}

if (suites.includes('intensity')) {
  section('intensity');
  const t = 'Sometimes the elite are lost in translation, still';
  const swapped = s => L.segments(t, s).filter(x => x[1]).length;
  const n = L.swapCount(t, B).letters;
  eq(swapped({leetIntensity: 100}), n, '100% swaps every candidate');
  eq(L.encode(t, {leetIntensity: 0}), t, '0% swaps nothing');
  for (const p of [10, 25, 50, 60, 75, 90]) eq(swapped({leetIntensity: p}), Math.round(n * p / 100), `${p}% swaps exactly ${p}% of ${n}`);
  eq(L.encode(t, {leetIntensity: 50, seed: 7}), L.encode(t, {leetIntensity: 50, seed: 7}), 'same seed, same output');
  check(L.encode(t, {leetIntensity: 50, seed: 7}) !== L.encode(t, {leetIntensity: 50, seed: 8}), 'another seed, another mix');
  // Appending must not reshuffle much of what is already there.
  const a = L.segments(t, {leetIntensity: 50}), b = L.segments(t + ' more', {leetIntensity: 50});
  const pos = segs => { const r = []; let at = 0; for (const [p, s] of segs) { if (s) r.push(at); at += s ? 1 : [...p].length; } return r; };
  const pa = pos(a), pb = new Set(pos(b));
  check(pa.filter(x => pb.has(x)).length >= pa.length - 3, 'typing at the end keeps earlier picks', `${pa.filter(x => pb.has(x)).length}/${pa.length}`);
  eq(L.swapCount('Hello', B), {letters: 4, swapped: 4}, 'swapCount counts only letters the alphabet has');
}

if (suites.includes('style')) {
  section('style');
  const S = st => L.encode('Hi you', {leetIntensity: 0, selectedStyle: st});
  eq(S('uppercase'), 'HI YOU', 'uppercase');
  eq(S('lowercase'), 'hi you', 'lowercase');
  eq(S('alternating'), 'Hi YoU', 'alternating counts letters only');
  eq(S('spaced'), 'H i   y o u', 'spaced');
  eq(S('reverse'), 'uoy iH', 'reverse');
  eq(L.reverse('a😀é'), 'é😀a', 'reverse keeps emoji and accents whole');
  eq(L.reverse('👍🏽x'), 'x👍🏽', 'reverse keeps skin-tone emoji whole');
  eq(L.encode('a\nb', {leetIntensity: 0, selectedStyle: 'spaced'}), 'a\nb', 'spaced keeps line breaks');
  const e = L.encode('one two three', {leetIntensity: 0, emojiIntensity: 100});
  check(/^one \S+ two \S+ three \S+$/u.test(e), 'emoji 100% adds one after every word', e);
  eq(L.encode('one two', {leetIntensity: 0, emojiIntensity: 100, seed: 3}), L.encode('one two', {leetIntensity: 0, emojiIntensity: 100, seed: 3}), 'emoji repeatable');
  eq(L.toggleCase('aB 1é'), 'Ab 1É', 'toggle case');
}

if (suites.includes('decode')) {
  section('decode');
  const D = [
    ['H3110 W0r1d', 'Hello World'],
    ['|-|3110 \\/\\/0|21[)', 'hello world'],
    ['7h3 qu1ck br0wn f0x jump5 0v3r 7h3 14zy d0g', 'the quick brown fox jumps over the lazy dog'],
    ['1337 5p34k', 'leet speak'],
    ['1337', 'leet'],
    ['h3ll0, w0r1d!!', 'hello, world!!'],
    ['5UP3R H4X0R', 'SUPER HAXOR'],
    ['gUy5 Gr34t', 'guys Great'],
    ['ph0n3', 'phone'],
    ['c00l', 'cool'],
    ['n00b', 'noob'],
    ['pwn3d', 'pwned'],
    ['g00d 9ame', 'good game'],
    ['1 4m 4 h4ck3r', 'I am a hacker'],
    ['@ll g00d', 'all good'],
    ['$7up1d', 'stupid'],
    ['|\\|1c3 |<1773|\\|', 'nice kitten'],
    ['3l173', 'elite'],
    ['1 c4n|\\|07 83l13v3 7h15', 'I cannot believe this'],
  ];
  for (const [i, w] of D) eq(L.decode(i), w, `decode ${JSON.stringify(i)}`);
  eq(L.decode('Meeting at 10:30, room 4'), 'Meeting at 10:30, room 4', 'plain text with numbers is left alone');
  eq(L.decode('I have 4 cats and 2024 dogs'), 'I have 4 cats and 2024 dogs', 'counts and years stay numbers');
  eq(L.decode('pi is 3.14 or 3,14'), 'pi is 3.14 or 3,14', 'decimals stay');
  eq(L.decode('wow!'), 'wow!', 'trailing ! is punctuation');
  eq(L.decode('d0w|\\| :( c4|\\| :) ;-)'), 'down :( can :) ;-)', 'emoticons stay emoticons');
  eq(L.decode('caf€'), 'cafe', 'euro sign reads as e');
  eq(L.decode('3uro', {u: '3'}), L.decode('3uro', {u: '3'}), 'custom map does not throw');
  eq(L.decode('x7z'), 'xtz', 'unknown word falls back to the likeliest letters');
  eq(L.decode('a\n\n  b'), 'a\n\n  b', 'whitespace kept exactly');
  // Every encode, decoded, gives the words back (for words in the lexicon).
  for (const t of ['the elite hacker speaks leet', 'good people like this tool']) {
    eq(L.decode(L.encode(t, B)), t, `round trip basic: ${t}`);
    eq(L.decode(L.encode(t, A)), t, `round trip advanced: ${t}`);
  }
}

if (suites.includes('settings')) {
  section('settings');
  // What the previous page saved under localStorage 'leetSettings'.
  const old = {advancedMode: true, autoConvert: false, leetIntensity: 50, emojiIntensity: 20, selectedStyle: 'alternating', customLeetMap: {e: '€', A: '/\\'}, darkMode: true};
  const n = L.normalize(old);
  eq([n.advancedMode, n.leetIntensity, n.emojiIntensity, n.selectedStyle, n.customLeetMap, n.seed],
    [true, 50, 20, 'alternating', {e: '€', a: '/\\'}, 1], 'old settings migrate');
  eq(L.normalize(null).leetIntensity, 100, 'no settings: full intensity');
  eq(L.normalize({leetIntensity: '250', emojiIntensity: -5, selectedStyle: 'bogus', customLeetMap: 'x'}),
    {advancedMode: false, leetIntensity: 100, emojiIntensity: 0, selectedStyle: 'none', customLeetMap: {}, seed: 1}, 'junk settings clamp');
  eq(L.encode('hello', {customLeetMap: {h: '#', e: '€'}}), '#€110', 'custom letters override the alphabet');
  const h = L.toHash('Héllo & bye #1', {advancedMode: true, leetIntensity: 60, seed: 9, customLeetMap: {x: '%'}}, true);
  const back = L.fromHash(h);
  eq([back.text, back.decode, back.settings.advancedMode, back.settings.leetIntensity, back.settings.seed, back.settings.customLeetMap],
    ['Héllo & bye #1', true, true, 60, 9, {x: '%'}], 'link round trip');
  eq(L.fromHash(''), null, 'no hash, no text');
  eq(L.fromHash('#t=hi&c=%7Bbad').settings.customLeetMap, {}, 'broken custom map in a link is ignored');
  const lv = L.leetLevel('aaaaa', '44444');
  eq(lv, {pct: 100, label: 'L33t M4st3r'}, 'level label');
  eq(L.leetLevel('', ''), {pct: 0, label: 'N0t L33t'}, 'level of nothing');
  let i = 0; const pw = L.password(14, a => { for (let k = 0; k < a.length; k++) a[k] = (i++ * 2654435761) >>> 0; return a; });
  check(pw.length === 14 && /^[A-Za-z0-9!@#$%^&*()]+$/.test(pw), 'password charset and length', pw);
}

if (suites.includes('edges')) {
  section('edges');
  eq(L.encode(null, B), '', 'null');
  eq(L.encode(undefined, B), '', 'undefined');
  eq(L.decode('   \n '), '', 'whitespace-only decode');
  eq(L.encode('😀🎉', B), '😀🎉', 'emoji only');
  eq(L.encode('Ελληνικά тест 日本', B), 'Ελληνικά тест 日本', 'other scripts untouched');
  eq(L.encode('0 -1 2,5 3.5', B), '0 -1 2,5 3.5', 'numbers untouched');
  const big = 'The elite hacker speaks leet. '.repeat(35000);   // ~1 MB
  let t0 = Date.now(); const e = L.encode(big, {leetIntensity: 60});
  check(Date.now() - t0 < 3000, `1 MB encode at 60% in ${Date.now() - t0} ms`);
  check(e.length > big.length * 0.9, '1 MB encode output complete');
  t0 = Date.now(); const d = L.decode(L.encode(big.slice(0, 200000), B));
  check(Date.now() - t0 < 4000, `200 kB decode in ${Date.now() - t0} ms`);
  eq(d.slice(0, 30).toLowerCase(), big.slice(0, 30).toLowerCase(), 'big decode correct (a swapped first letter cannot tell its case)');
  eq(L.decode('|||||||'), '|||||||', 'only bars');
  eq(L.decode('1111111111111111'), '1111111111111111', 'long digit run stays a number');
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
