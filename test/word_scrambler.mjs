#!/usr/bin/env node
// Test suite for tools/online_word_scrambler.html (Word Scrambler).
//
// Runs the page's DOM-free <script id="core"> block in Node. A scrambler promises three things a
// person cannot check by eye on a long text: that nothing was lost or invented (every word is a
// rearrangement of its own letters, every space and mark still where it was, no emoji or accent
// torn apart, ß still ß), that a word which can change did change, and that the shuffle is fair
// (every arrangement equally likely). Expectations are written from those rules, not from the page.
//
//   node test/word_scrambler.mjs              # everything
//   node test/word_scrambler.mjs fair edges   # named suites only
//
// Suites: keep, modes, change, fair, seed, sheet, edges, saved.

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = process.env.WS_PAGE || join(HERE, '..', 'tools', 'online_word_scrambler.html');
const ALL = ['keep', 'modes', 'change', 'fair', 'seed', 'sheet', 'edges', 'saved'];
const picked = process.argv.slice(2).filter(a => !a.startsWith('--'));
const suites = picked.length ? picked : ALL;

let failures = 0, passes = 0;
const check = (ok, what, detail) => { if (ok) passes++; else { failures++; console.log(`  FAIL  ${what}${detail ? '\n          ' + detail : ''}`); } };
const eq = (got, want, what) => check(JSON.stringify(got) === JSON.stringify(want), what, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
const section = name => console.log(`\n=== ${name} ===`);

const html = readFileSync(PAGE, 'utf8');
const src = html.match(/<script id="core">([\s\S]*?)<\/script>/)[1];
const ctx = {module: {exports: {}}, Intl};
vm.runInNewContext(src, ctx);
const C = ctx.module.exports;

// Written separately from the core: graphemes by Intl.Segmenter, classes by Unicode property.
const seg = new Intl.Segmenter('en', {granularity: 'grapheme'});
const G = s => [...seg.segment(s)].map(x => x.segment);
const isWord = g => /^\p{L}/u.test(g); // digits keep their place, like punctuation
const isSpace = g => /^\s/u.test(g);
const sorted = a => a.map(g => g.toLowerCase()).sort().join('|');
// Word runs of the input as [start, end) grapheme index pairs. An apostrophe between two letters
// is inside the word (doesn't, l'été), as the page promises.
const inWord = (gs, i) => isWord(gs[i]) || (/^['’]$/.test(gs[i]) && i > 0 && isWord(gs[i - 1]) && isWord(gs[i + 1] || ''));
function runs(gs) { const r = []; let s = -1; gs.forEach((g, i) => { if (inWord(gs, i)) { if (s < 0) s = i; } else if (s >= 0) { r.push([s, i]); s = -1; } }); if (s >= 0) r.push([s, gs.length]); return r; }

const SAMPLES = [
  'Hello, world!', 'a I to', "don't stop-believing", 'ÄÖÜ straße', 'I ❤️ 🍕 pizza', 'abc123 4567',
  'Line one\tTAB\n  second  Line.', 'Supercalifragilisticexpialidocious', 'Ελληνικά κείμενα', 'Привет, мир',
  'naïve café (école)', 'مرحبا بالعالم', 'STRASSE straße Maße', '👨‍👩‍👧 family 🇩🇪 flags', 'x', '',
  'C’est l’été — déjà vu?', 'iPhone XML-HTTP request_id',
];

if (suites.includes('keep')) {
  section('keep: nothing lost, nothing moved that should stay');
  for (const t of SAMPLES) for (let s = 0; s < 30; s++) {
    const out = C.scramble(t, {}, 's' + s), a = G(t), b = G(out);
    if (a.length !== b.length) { check(false, `length kept: ${JSON.stringify(t)}`, JSON.stringify(out)); break; }
    let bad = '';
    a.forEach((g, i) => { if (!isWord(g) && b[i] !== g) bad = `position ${i}: ${JSON.stringify(g)} became ${JSON.stringify(b[i])}`; });
    for (const [x, y] of runs(a)) {
      if (sorted(a.slice(x, y)) !== sorted(b.slice(x, y))) bad = `word ${a.slice(x, y).join('')} became ${b.slice(x, y).join('')}`;
      for (let i = x; i < y; i++) { const up = a[i] !== a[i].toLowerCase() && a[i] === a[i].toUpperCase(), lo = a[i] !== a[i].toUpperCase();
        if (up && b[i] !== b[i].toUpperCase() && b[i] !== 'ß') bad = `capital at ${i} lost in ${out}`;
        if (lo && b[i] !== b[i].toLowerCase() && b[i] !== 'ß'.toUpperCase()) bad = `lower case at ${i} lost in ${out}`; }
    }
    if (out.includes('�') || /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(out)) bad = 'broken surrogate';
    if (bad) { check(false, `keep ${JSON.stringify(t)}`, bad); break; }
    check(true);
  }
  eq(C.scramble('ÄÖÜ straße', {}, 1).length, 'ÄÖÜ straße'.length, 'ß in a capital position never becomes SS');
  eq(C.scramble('SSSß', {}, 2).length, 4, 'all-caps word with ß keeps its length');
  eq(G(C.scramble('école', {}, 3)).sort().join(), G('école').sort().join(), 'a combining accent travels with its letter');
  eq(C.scramble('👨‍👩‍👧 🇩🇪', {}, 4), '👨‍👩‍👧 🇩🇪', 'emoji sequences and flags are punctuation and stay whole and in place');
}

if (suites.includes('modes')) {
  section('modes: the old page\'s four switches');
  for (let s = 0; s < 40; s++) {
    const t = "don't stop-believing, ok?";
    const keepEnds = C.scramble('According to research, letters', {keepEnds: true}, s);
    const words = 'According to research, letters'.split(/\W+/), out = keepEnds.split(/\W+/);
    words.forEach((w, i) => { check(out[i][0] === w[0] && out[i].at(-1) === w.at(-1) && sorted([...out[i]]) === sorted([...w]), `keepEnds keeps first and last of ${w}`, out[i]); });
    const whole = C.scramble(t, {wholeToken: true}, s);
    check([...whole].every((c, i) => /[a-z]/.test(c) === /[a-z]/.test(t[i])), 'wholeToken: punctuation keeps its index', whole);
    check(sorted([...whole.split(' ')[0].replace(/'/g, '')]) === sorted([...'dont']), 'wholeToken: letters mix across the apostrophe', whole);
    const punctFree = C.scramble(t, {fixPunct: false}, s);
    check(punctFree.split(' ').length === 3 && punctFree.split(' ').every((w, i) => sorted([...w]) === sorted([...t.split(' ')[i]])), 'punctuation moves within its space-delimited word', punctFree);
    const spaceFree = C.scramble('ab cd, ef gh', {fixSpaces: false}, s);
    check(spaceFree[5] === ',' && sorted([...spaceFree.slice(0, 5)]) === sorted([...'ab cd']), 'spaces move within the stretch between punctuation', spaceFree);
    const all = C.scramble('Ab, cd!', {fixSpaces: false, fixPunct: false, keepCase: false}, s);
    check(sorted([...all]) === sorted([...'Ab, cd!']), 'everything free: one shuffle of the whole text', all);
    const noCase = C.scramble('ABcd', {keepCase: false}, s);
    check(sorted([...noCase]) === sorted([...'ABcd']) && noCase.replace(/[^A-Z]/g, '').split('').sort().join('') === 'AB', 'keepCase off: letters carry their own case', noCase);
  }
}

if (suites.includes('change')) {
  section('change: a word that can change does');
  const words = ['to', 'at', 'Hello', 'aab', 'books', 'noon', 'rhythm', 'abcdefghij', 'Ab', 'éa'];
  for (const w of words) {
    let unchanged = 0; for (let s = 0; s < 500; s++) if (C.scramble(w, {}, s).toLowerCase() === w.toLowerCase()) unchanged++;
    eq(unchanged, 0, `${w} always changes`);
  }
  for (const w of ['a', 'aa', 'AAa', 'Aa', 'I', '7', '12', '2nd'.slice(0, 1)]) eq(C.scramble(w, {}, 1), w, `${w} cannot change and is left alone`);
  for (const w of ['word', 'abcde', 'letters']) {
    let unchanged = 0; for (let s = 0; s < 500; s++) if (C.scramble(w, {keepEnds: true}, s) === w) unchanged++;
    eq(unchanged, 0, `${w} always changes with first and last kept`);
  }
  for (const w of ['cat', 'beet', 'deed']) eq(C.scramble(w, {keepEnds: true}, 9), w, `${w} has nothing to move with first and last kept`);
  let same = 0; for (let s = 0; s < 4000; s++) if (C.scramble('to', {ensureChange: false}, s) === 'to') same++;
  check(same > 1800 && same < 2200, 'ensureChange off: "to" stays "to" about half the time', same);
}

if (suites.includes('fair')) {
  section('fair: every arrangement equally likely');
  const chi = (counts, n) => { const e = n / counts.size; let x = 0; for (const c of counts.values()) x += (c - e) ** 2 / e; return x; };
  // abcd, chance only: 24 arrangements; 99.9th percentile of chi-square with 23 df is 49.7.
  let c = new Map(), N = 48000; for (let s = 0; s < N; s++) { const o = C.scramble('abcd', {ensureChange: false}, 'f' + s); c.set(o, (c.get(o) || 0) + 1); }
  eq(c.size, 24, 'abcd reaches all 24 arrangements');
  check(chi(c, N) < 49.7, 'abcd arrangements uniform', chi(c, N).toFixed(1));
  // Default: identity excluded, the other 23 still even (99.9th pct, 22 df: 48.3).
  c = new Map(); for (let s = 0; s < N; s++) { const o = C.scramble('abcd', {}, 'g' + s); c.set(o, (c.get(o) || 0) + 1); }
  check(!c.has('abcd') && c.size === 23, 'default never returns abcd and reaches the other 23', c.size);
  check(chi(c, N) < 48.3, 'default: the other 23 arrangements equally likely', chi(c, N).toFixed(1));
  // Each letter lands in each position about equally often.
  const pos = Array.from({length: 6}, () => new Map());
  for (let s = 0; s < 30000; s++) [...C.scramble('abcdef', {ensureChange: false}, 'h' + s)].forEach((ch, i) => pos[i].set(ch, (pos[i].get(ch) || 0) + 1));
  check(pos.every(m => [...m.values()].every(v => Math.abs(v - 5000) < 300)), 'every letter visits every position evenly');
}

if (suites.includes('seed')) {
  section('seed: stable while typing, new on Shuffle again');
  const t = 'The quick brown fox jumps over the lazy dog';
  eq(C.scramble(t, {}, 'abc'), C.scramble(t, {}, 'abc'), 'same seed, same result');
  check(C.scramble(t, {}, 'abc') !== C.scramble(t, {}, 'abd'), 'another seed, another result');
  const a = C.scramble(t, {}, 'k').split(' '), b = C.scramble(t.replace('brown', 'grey'), {}, 'k').split(' ');
  eq(a.filter((w, i) => i !== 2), b.filter((w, i) => i !== 2), 'editing one word changes no other');
  const typed = C.scramble(t + ' again', {}, 'k').split(' ');
  eq(typed.slice(0, a.length), a, 'typing at the end leaves earlier words alone');
  const twice = C.scramble('banana banana banana', {}, 'k').split(' ');
  check(new Set(twice).size > 1, 'a repeated word is not scrambled the same way every time', twice.join(' '));
  check(/^[0-9a-z]{1,7}$/.test(C.newSeed()), 'newSeed is short base 36');
}

if (suites.includes('sheet')) {
  section('sheet: worksheet with answers');
  const items = C.worksheet('necessary\nRhythm, I\nNASA a Wednesday', {}, 1);
  eq(items.map(x => x.answer), ['necessary', 'Rhythm', 'NASA', 'Wednesday'], 'every word of two or more letters, in order');
  check(items.every(x => x.puzzle !== x.answer.toLowerCase() && sorted([...x.puzzle]) === sorted([...x.answer])), 'every puzzle is its answer rearranged');
  check(items[1].puzzle === items[1].puzzle.toLowerCase() && items[3].puzzle === items[3].puzzle.toLowerCase(), 'a capital is not left to give the first letter away');
  check(items[2].puzzle === items[2].puzzle.toUpperCase(), 'an all-caps word stays in capitals');
  const txt = C.worksheetText(items);
  check(/^1\. \S+ +_{3,}\n2\. /.test(txt) && txt.includes('\n\nAnswers\n1. necessary\n2. Rhythm\n3. NASA\n4. Wednesday'), 'text form: numbered puzzles, then the answers', txt);
  const ten = C.worksheetText(C.worksheet(Array.from({length: 12}, (_, i) => 'word' + 'abcdefghijkl'[i]).join(' '), {}, 1));
  check(ten.startsWith(' 1. ') && ten.includes('\n12. '), 'numbers aligned when there are ten or more');
  eq(C.worksheetText([]), '', 'no words, no worksheet');
}

if (suites.includes('edges')) {
  section('edges');
  eq(C.scramble('', {}, 1), '', 'empty');
  eq(C.scramble('   \n\t ', {}, 1), '   \n\t ', 'whitespace only is returned as it is');
  eq(C.scramble(null, {}, 1), '', 'null');
  eq(C.scramble('!!! ??? — …', {}, 1), '!!! ??? — …', 'only punctuation');
  eq(C.scramble('line\r\nnext', {}, 1).includes('\r\n'), true, 'Windows line endings kept');
  const big = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(18000); // ~1 MB
  let t0 = performance.now(); const out = C.scramble(big, {}, 1), ms = performance.now() - t0;
  check(out.length === big.length, '1 MB keeps its length');
  check(ms < 2500, `1 MB scrambles in reasonable time (${ms.toFixed(0)} ms; the page does this in a worker)`);
  const parts = []; const seen = Object.create(null); let i = 0;
  const chunked = ['alpha beta ', 'gamma beta ', 'beta'].map(c => C.scrambleParts(c, {}, 7, seen).map(p => p.to).join('')).join('');
  eq(chunked, C.scramble('alpha beta gamma beta beta', {}, 7), 'chunked with a shared count equals one pass (the worker path)');
  eq(C.scramble('7pm 2nd 1984 mp3 3D', {}, 3), '7pm 2nd 1984 mp3 3D', 'numbers and the letters written against them stay: 7pm never becomes p7m');
  for (let s = 0; s < 50; s++) { const o = C.scramble("doesn't", {}, s); check(o[5] === "'" && o.replace("'", '') !== 'doesnt' && sorted([...o.replace("'", '')]) === sorted([...'doesnt']), "doesn't mixes across its apostrophe, which keeps its place", o); }
  const long = 'x'.repeat(5000) + 'y';
  check(C.scramble(long, {}, 1) !== long, 'a 5,001-letter word still changes');
}

if (suites.includes('saved')) {
  section('saved: settings, the old dark mode, lies');
  const d = C.readSaved(null, null);
  eq([d.text, d.view, d.theme, d.opts.keepCase, d.opts.fixPunct, d.opts.keepEnds], [null, 'text', 'auto', true, true, false], 'defaults');
  eq(C.readSaved(null, 'true').theme, 'dark', 'old darkMode "true" opens dark');
  eq(C.readSaved(null, 'false').theme, 'light', 'old darkMode "false" opens light');
  eq(C.readSaved('{"theme":"auto"}', 'true').theme, 'auto', 'a newer choice wins over the old key');
  const s = C.readSaved(JSON.stringify({text: 'hi', view: 'list', seed: 'zz9', opts: {keepEnds: true, keepCase: 'yes', evil: true}}), null);
  eq([s.text, s.view, s.seed, s.opts.keepEnds, s.opts.keepCase, 'evil' in s.opts], ['hi', 'list', 'zz9', true, true, false], 'valid fields read, wrong types and unknown keys dropped');
  const bad = C.readSaved('{"text":5,"view":"<img>","seed":"../../x","theme":"neon","opts":null}', null);
  eq([bad.text, bad.view, bad.seed, bad.theme], [null, 'text', null, 'auto'], 'lying save falls back to defaults');
  eq(C.readSaved('not json', null).view, 'text', 'garbage');
  eq(C.readSaved(JSON.stringify({text: 'x'.repeat(300000)}), null).text, null, 'an oversized text is not trusted');
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
