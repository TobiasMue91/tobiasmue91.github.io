#!/usr/bin/env node
// Test suite for tools/aspect_ratio_calculator.html (Aspect Ratio Calculator).
//
// The page promises a correct ratio with its common name, a correct other side, and an honest word whenever a number
// is rounded or a name is only close. The arithmetic lives in the page's DOM-free <script id="core"> block, which this
// suite runs in Node's vm. What checks each promise:
//   arith    exact fractions: reduction agrees with an independent Euclid on 20,000 random sizes, floor/ceil/round on
//            halves and negatives, toNum on numbers far beyond 2^53
//   parse    one box as people fill it: units, stray spaces, either decimal separator, thousands in five styles,
//            digits of other scripts, full-width forms, an O for a zero, negative, zero, empty, junk, too long
//   pairs    one string holding a size: 1920x1080 ... "3.840 x 2.160 Pixel" (a German shop's 4K), "1920,1080" from a
//            CSV, labels, named sizes (4K, 1080p, A4, Letter), and the reading of ambiguous separators across a pair
//   ratio    reduction against Python's fractions on published resolutions; names: exact, within 0.5 % (1366 × 768
//            is ≈ 16:9, 0.05 % wider), never approximately one of the exact-only shapes (2048 × 858 is scope, not an
//            ultrawide monitor); portrait flips; every table entry names itself; decimals in film style
//   solve    the other side against Python's fractions; a round trip gives the size back; the nearby exact sizes
//            and the whole-number roundings with how far the ratio drifts
//   frame    fit, fill and crop against hand-worked cases, and their invariants on 2,000 random frames
//   format   whole, short decimals, small fractions (3413 1⁄3), ≈ for the rest, small values keep their digits,
//            decimal comma, plain digits for the clipboard
//   list     a pasted column or spreadsheet (tabs, CSV, semicolons, junk lines); a million lines in under a second
//   page     (Chromium, needs `npx http-server -p 8099`) the real page on a phone: the worked example on arrival, live
//            results while typing, a pasted pair split across both boxes, presets and turn with undo, errors next to
//            their box, copy, state kept over a reload, the list table, no console errors, no request leaving the site
//
// No browser or server for anything but `page`, which is skipped when Chromium or the server is missing.
//
//   npm run test:aspect                          # or: node test/aspect_ratio_calculator.mjs
//   node test/aspect_ratio_calculator.mjs ratio solve   # named suites only
//   node test/aspect_ratio_calculator.mjs --page=old.html

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import {createRequire} from 'module';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const ALL = ['arith', 'parse', 'pairs', 'ratio', 'solve', 'frame', 'format', 'list', 'page'];
const picked = process.argv.slice(2).filter(a => !a.startsWith('--'));
const suites = picked.length ? picked : ALL;
const arg = name => (process.argv.find(a => a.startsWith(`--${name}=`)) || '').slice(name.length + 3);
const PAGE = arg('page') || join(ROOT, 'tools', 'aspect_ratio_calculator.html');
const URL_BASE = arg('url') || 'http://localhost:8099/tools/aspect_ratio_calculator.html';

let failures = 0, passes = 0;
const check = (ok, what, detail) => { if (ok) passes++; else { failures++; console.log(`  FAIL  ${what}${detail !== undefined ? '\n          ' + detail : ''}`); } };
const J = v => JSON.stringify(v, (k, x) => (typeof x === 'bigint' ? x.toString() : x));
const eq = (got, want, what) => check(J(got) === J(want), what, `got ${J(got)}, want ${J(want)}`);
const section = name => console.log(`\n=== ${name} ===`);

const html = readFileSync(PAGE, 'utf8');
const src = arg('core') ? readFileSync(arg('core'), 'utf8') : html.match(/<script id="core">([\s\S]*?)<\/script>/)[1];
const ctx = {module: {exports: {}}};
vm.runInNewContext(src, ctx);
const A = ctx.module.exports;
const Q = (n, d) => A.Q(BigInt(n), d === undefined ? 1n : BigInt(d));
const qs = q => (q.d === 1n ? q.n.toString() : `${q.n}/${q.d}`);                 // a fraction as text, for comparing
const dec = s => { const [i, f = ''] = String(s).split('.'); return A.Q(BigInt(i + f), 10n ** BigInt(f.length)); };

// Seeded so a failure can be replayed.
let seed = 20261029;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x80000000; };
const rint = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));

// ---------------------------------------------------------------------------------------------------------------------
if (suites.includes('arith')) {
  section('arith');
  const gcdN = (a, b) => { while (b) [a, b] = [b, a % b]; return a; };
  let bad = 0;
  for (let i = 0; i < 20000; i++) {
    const w = rint(1, 20000), h = rint(1, 20000), g = gcdN(w, h);
    const r = A.div(Q(w), Q(h));
    if (r.n !== BigInt(w / g) || r.d !== BigInt(h / g)) bad++;
  }
  check(bad === 0, 'reduction matches an independent Euclid on 20,000 random sizes', `${bad} differ`);
  eq(qs(A.div(Q(1920), Q(1080))), '16/9', '1920 / 1080 = 16/9');
  eq(qs(Q(-6, 4)), '-3/2', 'the sign lives on the numerator');
  eq(qs(Q(6, -4)), '-3/2', 'a negative denominator moves its sign up');
  eq(qs(A.add(Q(1, 3), Q(1, 6))), '1/2', '1/3 + 1/6');
  eq(qs(A.sub(Q(1, 3), Q(1, 2))), '-1/6', '1/3 - 1/2');
  eq(A.cmp(Q(2, 3), Q(3, 5)), 1, '2/3 > 3/5');
  eq(A.cmp(Q(4, 6), Q(2, 3)), 0, '4/6 = 2/3');
  eq([A.floorQ(Q(7, 2)), A.ceilQ(Q(7, 2)), A.roundQ(Q(7, 2))].map(String), ['3', '4', '4'], 'floor, ceil, round of 3.5');
  eq([A.floorQ(Q(-7, 2)), A.ceilQ(Q(-7, 2))].map(String), ['-4', '-3'], 'floor and ceil of -3.5');
  eq(String(A.roundQ(Q(1125, 2))), '563', '562.5 rounds half up to 563');
  eq(String(A.roundQ(Q(10240, 3))), '3413', '3413 1/3 rounds to 3413');
  const huge = A.div(Q(10n ** 400n * 16n), Q(10n ** 400n * 9n));
  check(Math.abs(A.toNum(huge) - 16 / 9) < 1e-12, 'toNum of 16·10^400 / 9·10^400', A.toNum(huge));
  const lop = A.Q(10n ** 500n + 1n, 3n * 10n ** 500n);
  check(Math.abs(A.toNum(lop) - 1 / 3) < 1e-12, 'toNum of a fraction with 500-digit terms', A.toNum(lop));
  let threw = false; try { Q(1, 0); } catch (e) { threw = true; }
  check(threw, 'a zero denominator throws');
}

// ---------------------------------------------------------------------------------------------------------------------
if (suites.includes('parse')) {
  section('parse');
  const ok = (text, want, what, extra) => {
    const r = A.parseNumber(text);
    check(r.ok && qs(r.q) === want, `${what}: ${J(text)} -> ${want}`, r.ok ? `got ${qs(r.q)}` : `error ${r.code}: ${r.msg}`);
    if (r.ok && extra) extra(r);
  };
  const bad = (text, code, what) => {
    const r = A.parseNumber(text);
    check(!r.ok && r.code === code, `${what}: ${J(text)} is refused (${code})`, r.ok ? `read as ${qs(r.q)}` : `code ${r.code}`);
    return r;
  };
  ok('1920', '1920', 'plain');
  ok('  1920  ', '1920', 'stray spaces');
  ok('\t1920\n', '1920', 'tab and newline around it');
  ok('+1920', '1920', 'a plus sign');
  ok('1920px', '1920', 'px stuck on', r => eq(r.unit, 'px', '  unit px'));
  ok('1920 px', '1920', 'px with a space');
  ok('1920 pixels', '1920', 'pixels spelled out', r => eq(r.unit, 'px', '  unit px'));
  ok('10 in', '10', 'inches', r => eq(r.unit, 'in', '  unit in'));
  ok('10"', '10', 'inch mark', r => eq(r.unit, 'in', '  unit in from "'));
  ok('29.7cm', '297/10', 'centimetres', r => eq(r.unit, 'cm', '  unit cm'));
  ok('1080p', '1080', '1080p in one box is 1080');
  ok('19.5', '39/2', 'decimal point');
  ok('19,5', '39/2', 'decimal comma', r => eq(r.comma, true, '  remembers the comma'));
  ok('2,39', '239/100', 'decimal comma, two places');
  ok('.5', '1/2', 'no leading zero');
  ok('5.', '5', 'half typed: "5." while typing 5.5');
  ok('5,', '5', 'half typed with a comma');
  ok('1,920', '1920', 'English thousands', r => check(!!r.amb, '  flagged as ambiguous (1.92 elsewhere)'));
  ok('1.920', '1920', 'German thousands', r => check(!!r.amb && qs(r.amb.dec) === '48/25', '  the decimal reading is kept: 1.92'));
  ok('1,920,000', '1920000', 'two English groups');
  ok('1.920.000', '1920000', 'two German groups');
  ok('1,920.5', '3841/2', 'English thousands and decimal');
  ok('1.920,5', '3841/2', 'German thousands and decimal');
  ok("1'920", '1920', 'Swiss apostrophe');
  ok('1’920', '1920', 'Swiss typographic apostrophe');
  ok('1 920', '1920', 'French no-break space');
  ok('1 920', '1920', 'narrow no-break space');
  ok('1 920', '1920', 'thin space');
  ok('12 345', '12345', 'thousands with a plain space');
  ok('١٩٢٠', '1920', 'Arabic-Indic digits');
  ok('۱۹۲۰', '1920', 'Persian digits');
  ok('१९२०', '1920', 'Devanagari digits');
  ok('１９２０', '1920', 'full-width digits');
  ok('​1920﻿', '1920', 'zero-width junk from a copy');
  ok('0,125', '1/8', 'a leading zero is never thousands');
  ok('0.0001', '1/10000', 'tiny but positive');
  ok('99999999999999999999999999999999', '99999999999999999999999999999999', '32 digits stay exact');
  ok('1O80', '1080', 'a letter O for a zero', r => check(r.typo && r.typo.letter === 'O', '  says it read an O as 0'));
  ok('l920', '1920', 'an l for a one', r => check(r.typo && r.typo.letter === 'l', '  says it read an l as 1'));
  ok('I080', '1080', 'an I for a one');
  const n1 = bad('-1080', 'neg', 'negative');
  eq(n1.fix, '1080', '  offers 1080 instead');
  bad('−1080', 'neg', 'Unicode minus');
  bad('0', 'zero', 'zero');
  bad('0.000', 'zero', 'zero with decimals');
  eq(bad('', 'empty', 'empty').msg, '', '  says nothing while empty');
  bad('   ', 'empty', 'only spaces');
  bad('abc', 'nan', 'letters');
  bad('auto', 'nan', 'a CSS keyword');
  bad('lo', 'nan', 'letters that look like digits but hold none');
  bad('1e3', 'exp', 'scientific notation');
  bad('1.2.3', 'nan', 'two decimal points');
  bad('1,,2', 'nan', 'doubled separator');
  bad('12,34,567', 'nan', 'broken grouping');
  bad('x'.repeat(50), 'long', 'fifty characters');
  bad('-', 'nan', 'a lone minus');
  for (const t of ['abc', 'auto', '-1080', '0', 'x'.repeat(50), '1.2.3']) {
    const r = A.parseNumber(t);
    check(/[a-z]/i.test(r.msg) && r.msg.length < 90, `message for ${J(t.slice(0, 12))} is short plain words`, r.msg);
  }
  check(/1920|1080/.test(A.parseNumber('abc').msg), 'a junk message says what would be accepted', A.parseNumber('abc').msg);
  // 10,000 strings of the characters people paste, in random order: nothing throws, nothing at or below zero is a size.
  const CH = ['0', '1', '2', '5', '9', '.', ',', ' ', 'x', '×', ':', '/', '*', '-', '+', 'e', 'O', 'l', '\u00a0', '\u202f', "'", '’', '"', 'p', 'k',
    'm', 'A', '\n', '\t', ';', '٣', '１', '≈', '…', '⁄', '½', '%', '\u200b', 'é', '中'];
  let thrown = 0, wrong = 0, firstBad = '';
  for (let i = 0; i < 10000; i++) {
    let t = '';
    for (let j = rint(0, 13); j > 0; j--) t += CH[rint(0, CH.length - 1)];
    try {
      const r = A.parseNumber(t);
      if (r.ok && r.q.n <= 0n) { wrong++; firstBad = firstBad || t; }
      const z = A.readSize(t, i % 3 ? '' : t);
      if (z.ok) { const d = A.describe(z.w, z.h); A.resize({a: d.a, b: d.b}, 'w', Q(rint(1, 5000)), {px: true}); A.working(z.w, z.h); }
      A.lineToPair(t); A.looksLikeList(t + '\n' + t);
    } catch (e) { thrown++; firstBad = firstBad || t; }
  }
  check(thrown === 0 && wrong === 0, '10,000 random pastes: nothing throws, nothing at or below zero is read as a size', `${thrown} threw, ${wrong} wrong, first ${J(firstBad)}`);
}

// ---------------------------------------------------------------------------------------------------------------------
if (suites.includes('pairs')) {
  section('pairs');
  const pair = (text, w, h, what, extra) => {
    const r = A.readSize(text, '');
    check(r.ok && qs(r.w) === w && qs(r.h) === h, `${what}: ${J(text)} -> ${w} × ${h}`,
      r.ok ? `got ${qs(r.w)} × ${qs(r.h)}` : `error ${J([r.w && r.w.code, r.h && r.h.code])}`);
    if (r.ok && extra) extra(r);
  };
  pair('1920x1080', '1920', '1080', 'x');
  pair('1920X1080', '1920', '1080', 'capital X');
  pair('1920 x 1080', '1920', '1080', 'x with spaces');
  pair('1920×1080', '1920', '1080', 'multiplication sign');
  pair('1920 ✕ 1080', '1920', '1080', 'another multiplication sign');
  pair('1920*1080', '1920', '1080', 'asterisk');
  pair('16:9', '16', '9', 'colon');
  pair('16 : 9', '16', '9', 'colon with spaces');
  pair('16∶9', '16', '9', 'ratio colon');
  pair('16：9', '16', '9', 'full-width colon');
  pair('4/3', '4', '3', 'slash');
  pair('1920 by 1080', '1920', '1080', 'by');
  pair('16 to 9', '16', '9', 'to');
  pair('1920, 1080', '1920', '1080', 'comma and space');
  pair('1920,1080', '1920', '1080', 'bare comma, as a CSV writes it');
  pair('800,600', '800', '600', 'bare comma, three digits each side');
  pair('1920 1080', '1920', '1080', 'just a space');
  pair('2.39:1', '239/100', '1', 'decimal ratio');
  pair('2,39:1', '239/100', '1', 'decimal comma ratio');
  pair('1.85 : 1', '37/20', '1', 'flat');
  pair('1.333:1', '1333/1000', '1', 'three decimals against a 1 stay decimals');
  pair('3.840 x 2.160 Pixel', '3840', '2160', 'how a German shop prints 4K', r => {
    eq(r.unit, 'px', '  unit px');
    check(r.notes.length === 2 && r.notes.every(n => n.group), '  both readings are reported as thousands');
  });
  pair('1,920 x 1,080', '1920', '1080', 'English thousands on both sides');
  pair('1.920 x 1080', '1920', '1080', 'thousands on one side, a big whole number on the other');
  pair('1 920 × 1 080', '1920', '1080', 'French grouping with plain spaces');
  pair('1 920 × 1 080', '1920', '1080', 'French grouping with narrow no-break spaces');
  pair('1920 × 1080 px', '1920', '1080', 'unit after the pair', r => eq(r.unit, 'px', '  unit px'));
  pair('1920px x 1080px', '1920', '1080', 'unit on both sides');
  pair('3840,2160 px', '3840', '2160', 'bare comma pair with a unit');
  pair('10" x 8"', '10', '8', 'inches', r => eq(r.unit, 'in', '  unit in'));
  pair('W: 1920 H: 1080', '1920', '1080', 'W and H labels');
  pair('width 1920, height 1080', '1920', '1080', 'width and height labels');
  pair('１９２０×１０８０', '1920', '1080', 'full width');
  pair('١٩٢٠×١٠٨٠', '1920', '1080', 'Arabic-Indic');
  pair('3024 × 4032', '3024', '4032', 'an iPhone photo');
  pair('4K', '3840', '2160', '4K', r => eq(r.named, '4K UHD', '  named'));
  pair('uhd', '3840', '2160', 'UHD');
  pair('1080p', '1920', '1080', '1080p alone is Full HD', r => eq(r.named, 'Full HD', '  named'));
  pair('720p', '1280', '720', '720p');
  pair('DCI 4K', '4096', '2160', 'DCI 4K');
  pair('A4', '210', '297', 'A4', r => eq(r.unit, 'mm', '  in mm'));
  pair('din a3', '297', '420', 'DIN A3');
  pair('Letter', '17/2', '11', 'US Letter', r => eq(r.unit, 'in', '  in inches'));
  // Not pairs: one grouped number, or one box's worth.
  for (const t of ['1 080', '1,080', '250,000', '2,39', '16,9', '1920']) {
    const sp = A.splitPair(t);
    check(sp.ok && sp.single, `${J(t)} is one number, not a pair`, J(sp));
  }
  // Two boxes.
  const two = (w, h, ww, hh, what, extra) => {
    const r = A.readSize(w, h);
    check(r.ok && qs(r.w) === ww && qs(r.h) === hh, `${what}: ${J(w)} × ${J(h)} -> ${ww} × ${hh}`,
      r.ok ? `got ${qs(r.w)} × ${qs(r.h)}` : `error ${J([r.w.code, r.h.code])}`);
    if (r.ok && extra) extra(r);
  };
  two('1920', '1080', '1920', '1080', 'two boxes');
  two('2,39', '1', '239/100', '1', 'decimal comma in one box', r => eq(r.comma, true, '  output will use commas'));
  two('3.840', '2.160', '3840', '2160', 'both boxes in German thousands');
  two('1.333', '1', '1333/1000', '1', 'a decimal against a 1');
  two('1920', '1O80', '1920', '1080', 'a typo in the height', r => check(r.notes.some(n => n.typo), '  reported'));
  const e = A.readSize('1920', 'auto');
  check(!e.ok && e.w.ok && !e.h.ok && e.h.code === 'nan', 'one bad box: the error is on that box only', J(e));
  const e2 = A.readSize('', '');
  check(!e2.ok && e2.w.code === 'empty' && e2.h.code === 'empty', 'both empty');
  const e3 = A.readSize('1920', '');
  check(!e3.ok && e3.w.ok && e3.h.code === 'empty', 'a width alone waits for a height');
}

// ---------------------------------------------------------------------------------------------------------------------
if (suites.includes('ratio')) {
  section('ratio');
  // Reduced with Python's fractions.Fraction, an implementation independent of the page's.
  const PY = [[640, 480, 4, 3], [800, 600, 4, 3], [1024, 768, 4, 3], [1152, 864, 4, 3], [1280, 720, 16, 9], [1280, 768, 5, 3],
    [1280, 800, 8, 5], [1280, 1024, 5, 4], [1360, 768, 85, 48], [1366, 768, 683, 384], [1440, 900, 8, 5], [1400, 1050, 4, 3],
    [1600, 900, 16, 9], [1600, 1200, 4, 3], [1680, 1050, 8, 5], [1920, 1080, 16, 9], [1920, 1200, 8, 5], [2048, 1080, 256, 135],
    [2048, 1536, 4, 3], [2560, 1080, 64, 27], [2560, 1440, 16, 9], [2560, 1600, 8, 5], [2880, 1800, 8, 5], [3440, 1440, 43, 18],
    [3840, 1600, 12, 5], [3840, 2160, 16, 9], [4096, 2160, 256, 135], [5120, 1440, 32, 9], [5120, 2160, 64, 27],
    [5120, 2880, 16, 9], [7680, 4320, 16, 9], [2436, 1125, 812, 375], [2532, 1170, 422, 195], [2400, 1080, 20, 9],
    [1080, 1350, 4, 5], [1080, 1440, 3, 4], [1200, 630, 40, 21], [1998, 1080, 37, 20], [2048, 858, 1024, 429], [210, 297, 70, 99],
    [1024, 600, 128, 75], [3024, 4032, 3, 4], [6000, 4000, 3, 2], [1080, 1920, 9, 16], [1170, 2532, 195, 422]];
  for (const [w, h, a, b] of PY) {
    const d = A.describe(Q(w), Q(h));
    check(d.a === BigInt(a) && d.b === BigInt(b), `${w} × ${h} reduces to ${a} : ${b}`, `got ${d.a} : ${d.b}`);
  }
  const named = (w, h, headline, what, extra) => {
    const d = A.describe(typeof w === 'object' ? w : Q(w), typeof h === 'object' ? h : Q(h));
    d.all = `${d.label} ${d.more}`;
    check(d.headline === headline, `${what}: headline ${headline}`, `got ${d.headline}`);
    if (extra) extra(d);
    return d;
  };
  named(1920, 1080, '16 : 9', 'Full HD', d => { check(d.exactName && !d.approx, '  exact'); check(/video/i.test(d.all), '  note says video', d.all); });
  named(1080, 1920, '9 : 16', 'vertical video', d => check(/TikTok|Reels|Shorts/.test(d.all), '  portrait note', d.all));
  named(1366, 768, '≈ 16 : 9', '1366 × 768', d => {
    check(d.approx && d.approx.dir === 'wider' && Math.abs(d.approx.pct - 0.0488) < 0.001, '  0.05 % wider than 16 : 9', J(d.approx));
    eq(d.terms, '683 : 384', '  exact terms still given');
  });
  named(1360, 768, '≈ 16 : 9', '1360 × 768', d => check(d.approx.dir === 'narrower' && Math.abs(d.approx.pct - 0.39) < 0.01, '  0.39 % narrower', J(d.approx)));
  named(2560, 1080, '64 : 27', 'the ultrawide sold as 21:9', d => check(/21:9/.test(d.all) && /3440/.test(d.all), '  says it is sold as 21:9, and that 3440 × 1440 differs', d.all));
  named(3440, 1440, '43 : 18', 'the other ultrawide sold as 21:9', d => check(/21:9/.test(d.all), '  sold as 21:9', d.all));
  named(2048, 858, '≈ 2.39 : 1', 'DCI scope is scope, not an ultrawide monitor', d => check(/scope/.test(d.all), '  scope', d.all));
  named(3840, 1600, '≈ 2.39 : 1', '3840 × 1600 (12 : 5)', d => check(d.approx && d.approx.dir === 'wider', '  a little wider than scope'));
  named(4096, 2160, '256 : 135', 'DCI 4K', d => check(/1\.90/.test(d.all), '  called 1.90 : 1', d.all));
  named(2048, 1080, '256 : 135', 'DCI 2K');
  named(1200, 630, '40 : 21', 'link preview', d => check(/1\.91/.test(d.all), '  called 1.91 : 1', d.all));
  named(1200, 627, '≈ 1.91 : 1', 'LinkedIn link image');
  named(1080, 566, '≈ 1.91 : 1', 'Instagram landscape');
  named(1998, 1080, '1.85 : 1', 'DCI flat');
  named(dec('2.39'), Q(1), '2.39 : 1', 'typed as 2.39 : 1');
  named(dec('1.85'), Q(1), '1.85 : 1', 'typed as 1.85 : 1');
  named(1080, 1350, '4 : 5', 'Instagram portrait', d => check(/Instagram/.test(d.all), '  Instagram', d.all));
  named(1080, 1440, '3 : 4', 'Instagram grid', d => check(/Instagram/.test(d.all), '  Instagram', d.all));
  named(3024, 4032, '3 : 4', 'a phone photo held upright');
  named(6000, 4000, '3 : 2', 'a camera photo');
  named(210, 297, '≈ 1 : √2', 'A4', d => check(/A4/.test(d.all) && d.approx.pct < 0.01, '  ISO paper, 0.005 % off', J(d.approx)));
  named(297, 210, '≈ √2 : 1', 'A4 on its side');
  named(2436, 1125, '≈ 19.5 : 9', 'iPhone X screen');
  named(1170, 2532, '≈ 9 : 19.5', 'iPhone 12 screen held upright');
  named(2340, 1080, '19.5 : 9', 'exactly 13 : 6');
  named(2400, 1080, '20 : 9', 'Android');
  named(1440, 900, '16 : 10', '1440 × 900 is 8 : 5, named 16 : 10', d => eq(d.terms, '8 : 5', '  exact terms 8 : 5'));
  named(5120, 1440, '32 : 9', 'super ultrawide');
  named(1500, 500, '3 : 1', 'X header');
  named(1584, 396, '4 : 1', 'LinkedIn banner');
  named(1, 1, '1 : 1', 'square');
  named(35, 45, '7 : 9', 'passport photo');
  named(17, 22, '8.5 : 11', 'US Letter');
  named(1024, 600, '128 : 75', 'no name, small terms: the terms', d => check(!d.name && !d.label && !d.more, '  no name, no note'));
  named(1234, 789, '≈ 1.56 : 1', 'no name, big terms: the decimal, marked as rounded', d => eq(d.terms, '1234 : 789', '  terms still given'));
  named(789, 1234, '≈ 1 : 1.56', 'no name, big terms, upright');
  named(1234, 567, '≈ 19.5 : 9', '0.45 % from 19.5 : 9 is within the 0.5 % line');
  named(3, 1000, '≈ 1 : 333.33', 'long terms and no 1: the decimal');
  // Every entry of the table names a size of exactly its shape as itself, both ways round.
  for (const e of A.RATIOS) {
    if (!e.q) continue;
    const d = A.describe(Q(e.q.n), Q(e.q.d)), p = A.describe(Q(e.q.d), Q(e.q.n));
    check(d.headline === e.name && d.exactName, `table: ${e.name} names itself`, d.headline);
    if (e.q.n !== e.q.d) check(p.headline === e.pname, `table: ${e.pname} names itself upright`, p.headline);
    for (const [w, h] of (e.sizes || [])) {
      const s = A.describe(Q(w), Q(h));
      check(s.headline === e.name, `table: ${w} × ${h} listed under ${e.name} is exactly that`, s.headline);
    }
    for (const [w, h] of (e.psizes || [])) {
      const s = A.describe(Q(w), Q(h));
      check(s.headline === e.pname, `table: ${w} × ${h} listed under ${e.pname} is exactly that`, s.headline);
    }
  }
  // No two entries claim the same exact shape, and nothing is approximately an exact-only shape.
  const seen = new Map();
  for (const e of A.RATIOS) if (e.q) { const k = qs(e.q); check(!seen.has(k), `table: ${e.name} is the only entry for ${k}`, seen.get(k)); seen.set(k, e.name); }
  for (const e of A.RATIOS) if (e.exactOnly) {
    const near = A.describe(A.mul(e.q, Q(1001, 1000)), Q(1));
    check(near.headline !== '≈ ' + e.name, `table: 0.1 % off ${e.name} is not called ≈ ${e.name}`, near.headline);
  }
  // The 0.5 % line.
  const r169 = A.describe(A.mul(Q(16, 9), Q(1005, 1000)), Q(1)), r169b = A.describe(A.mul(Q(16, 9), Q(1006, 1000)), Q(1));
  check(r169.headline === '≈ 16 : 9', '0.5 % wider is still ≈ 16 : 9', r169.headline);
  check(r169b.headline !== '≈ 16 : 9', '0.6 % wider is no longer 16 : 9', r169b.headline);
  // Decimals in film style: two places, ≈ when rounded.
  const d169 = A.describe(Q(16), Q(9)), d32 = A.describe(Q(3), Q(2));
  check(d169.decimal === '1.78 : 1' && !d169.decimalExact, '16 : 9 is ≈ 1.78 : 1', `${d169.decimal} ${d169.decimalExact}`);
  check(d32.decimal === '1.50 : 1' && d32.decimalExact, '3 : 2 is exactly 1.50 : 1', `${d32.decimal} ${d32.decimalExact}`);
  eq(A.describe(Q(9), Q(16)).decimal, '1 : 1.78', 'upright decimals put the 1 first');
  const big = A.describe(Q(10n ** 30n * 16n), Q(10n ** 30n * 9n));
  check(big.headline === '16 : 9', '16 : 9 with 30 more zeros on each side');
  const odd = A.describe(Q(10n ** 30n + 1n), Q(10n ** 30n));
  check(odd.headline === '≈ 1 : 1' && odd.approx.pct < 1e-20, '10^30 + 1 against 10^30 is ≈ 1 : 1', `${odd.headline} ${odd.approx && odd.approx.pct}`);
  check(A.describe(dec('0.0001'), Q(1)).headline === '1 : 10000', 'a tiny width against 1', A.describe(dec('0.0001'), Q(1)).headline);
  eq(A.describe(Q(32), Q(9)).decimal, '3.56 : 1', 'decimals keep two places');
  eq(A.describe(Q(12345), Q(1)).headline, '12345 : 1', 'a long thin strip: terms, since one side is 1');
}

// ---------------------------------------------------------------------------------------------------------------------
if (suites.includes('solve')) {
  section('solve');
  // The other side, exact, against Python's fractions.Fraction.
  const PY = [[16, 9, 'w', [1280, 1], [720, 1]], [16, 9, 'w', [1000, 1], [1125, 2]], [16, 9, 'h', [1080, 1], [1920, 1]],
    [16, 9, 'h', [1001, 1], [16016, 9]], [64, 27, 'h', [1440, 1], [10240, 3]], [4, 3, 'w', [1080, 1], [810, 1]],
    [3, 2, 'w', [21, 2], [7, 1]], [239, 100, 'w', [1920, 1], [192000, 239]], [683, 384, 'h', [1000, 1], [85375, 48]],
    [1, 1, 'w', [512, 1], [512, 1]], [37, 20, 'h', [1080, 1], [1998, 1]], [256, 135, 'w', [1920, 1], [2025, 2]],
    [9, 16, 'w', [1080, 1], [1920, 1]], [4, 5, 'w', [1080, 1], [1350, 1]], [70, 99, 'w', [21, 1], [297, 10]],
    [13, 6, 'h', [1179, 1], [5109, 2]]];
  for (const [a, b, g, [vn, vd], [rn, rd]] of PY) {
    const r = A.solve({a: BigInt(a), b: BigInt(b)}, g, Q(vn, vd));
    check(r.q.n === BigInt(rn) && r.q.d === BigInt(rd), `${a} : ${b}, ${g === 'w' ? 'width' : 'height'} ${vn}${vd > 1 ? '/' + vd : ''} -> ${rn}${rd > 1 ? '/' + rd : ''}`, `got ${qs(r.q)}`);
    eq(r.int, rd === 1, `  whole: ${rd === 1}`);
  }
  // A round trip gives the size back, on 5,000 random ratios and sizes.
  let bad = 0;
  for (let i = 0; i < 5000; i++) {
    const ratio = A.describe(Q(rint(1, 5000)), Q(rint(1, 5000)));
    const R = {a: ratio.a, b: ratio.b}, v = Q(rint(1, 100000), rint(1, 7));
    const h = A.solve(R, 'w', v).q, w = A.solve(R, 'h', h).q;
    if (A.cmp(w, v) !== 0 || A.cmp(A.div(w, h), A.Q(R.a, R.b)) !== 0) bad++;
  }
  check(bad === 0, 'width -> height -> width returns the width, keeping the ratio, 5,000 times', `${bad} failed`);
  // Nearby exact sizes.
  const R169 = {a: 16n, b: 9n};
  eq(A.nearby(R169, 'w', Q(1000)).map(s => [s.w, s.h]), [[992n, 558n], [1008n, 567n]], '16 : 9 near 1000 wide: 992 × 558 and 1008 × 567');
  eq(A.nearby({a: 64n, b: 27n}, 'h', Q(1440)).map(s => [s.w, s.h]), [[3392n, 1431n], [3456n, 1458n]], '64 : 27 near 1440 high: 3392 × 1431 and 3456 × 1458');
  eq(A.nearby(R169, 'w', Q(1280)), [], 'already exact: nothing nearby to offer');
  eq(A.nearby(R169, 'w', dec('10.5')), [], 'not for a value that is not whole');
  eq(A.nearby(R169, 'w', Q(10)).map(s => [s.w, s.h]), [[16n, 9n]], 'below the first step: only the size above');
  for (const s of A.nearby({a: 239n, b: 100n}, 'w', Q(1920))) check(A.cmp(A.div(Q(s.w), Q(s.h)), Q(239, 100)) === 0, `nearby ${s.w} × ${s.h} is exactly 2.39 : 1`);
  // Rounding to whole numbers, with how far the ratio drifts.
  const r1 = A.rounded(R169, 'w', Q(1000), Q(1125, 2));
  check(r1.h.n === 563n && Math.abs(r1.pct - 0.0888) < 0.001, '562.5 rounds to 563, 0.09 % off 16 : 9', J(r1));
  const r2 = A.rounded({a: 64n, b: 27n}, 'h', Q(1440), Q(10240, 3));
  check(r2.w.n === 3413n && Math.abs(r2.pct - 0.00977) < 0.0001, '3413 1/3 rounds to 3413, 0.01 % off', J(r2));
  check(A.rounded(R169, 'h', Q(1, 1000), Q(16, 9000)) === null, 'nothing to round to below one unit');
  // What the page shows: the nearest whole number, an exact tie going to the even one, and the even one offered
  // beside an odd answer when the typed side is even.
  const show = (a, b, g, v) => { const r = A.resize({a: BigInt(a), b: BigInt(b)}, g, Q(v), {px: true}); return [r.show, r.rule, r.even ? String(r.even.n) : null]; };
  eq(show(16, 9, 'w', 1000), ['562', 'whole', null], '562.5 shows 562: a tie goes to the even number');
  eq(show(3, 4, 'h', 1350), ['1012', 'whole', null], '1012.5 shows 1012');
  eq(show(16, 9, 'w', 1080), ['608', 'whole', null], '607.5 shows 608');
  eq(show(64, 27, 'h', 1440), ['3413', 'whole', '3414'], '3413 1/3 shows 3413, with 3414 offered as the even one');
  eq(show(16, 9, 'w', 1520), ['855', 'exact', '856'], 'an exact odd 855 stays 855, with 856 offered for video');
  eq(show(16, 9, 'w', 1001), ['563', 'whole', null], 'an odd typed side gets no even offer: the pair cannot be even anyway');
  eq(show(16, 9, 'w', 1280), ['720', 'exact', null], 'exact and even: nothing else to offer');
  eq(String(A.roundEven(Q(5, 2))) + String(A.roundEven(Q(7, 2))) + String(A.roundEven(Q(10240, 3))), '243413', 'roundEven: 2.5 -> 2, 3.5 -> 4, 3413 1/3 -> 3413');
  const tiny = A.resize(R169, 'h', Q(1, 1000), {px: false});
  eq([tiny.show, tiny.rule], ['0.00178', 'decimal'], 'below one unit: the value itself, with its digits');
  // The formula's terms are the reduced ratio's.
  const f = A.solve(R169, 'w', Q(1280));
  check(f.k1 === 9n && f.k2 === 16n, 'formula: 1280 × 9 ÷ 16', `${f.k1} ${f.k2}`);
}

// ---------------------------------------------------------------------------------------------------------------------
if (suites.includes('frame')) {
  section('frame');
  const S = (w, h) => ({w: Q(w), h: Q(h)});
  const F = (src, dst) => A.frame(src, dst);
  const t1 = F(S(1920, 1080), S(1080, 1350));
  eq([qs(t1.fit.w), qs(t1.fit.h), qs(t1.fit.barX), qs(t1.fit.barY)], ['1080', '1215/2', '0', '1485/4'], '16 : 9 into 1080 × 1350: fit 1080 × 607.5, bars 371.25 top and bottom');
  eq([qs(t1.fill.w), qs(t1.fill.h), qs(t1.fill.cutX), qs(t1.fill.cutY)], ['2400', '1350', '660', '0'], '  fill 2400 × 1350, 660 cut each side');
  eq([qs(t1.crop.w), qs(t1.crop.h), qs(t1.crop.x), qs(t1.crop.y)], ['864', '1080', '528', '0'], '  crop 864 × 1080 from x 528');
  check(Math.abs(t1.fill.kept - 0.45) < 1e-12 && Math.abs(t1.crop.kept - 0.45) < 1e-12, '  45 % of the picture is kept');
  const t2 = F(S(1440, 1080), S(1920, 1080));
  eq([qs(t2.fit.w), qs(t2.fit.barX)], ['1440', '240'], '4 : 3 on a 16 : 9 screen: 1440 wide, 240 bars each side');
  const t3 = F(S(4000, 3000), S(1920, 1080));
  eq([qs(t3.crop.w), qs(t3.crop.h), qs(t3.crop.y)], ['4000', '2250', '375'], 'a 4 : 3 photo cropped to 16 : 9: 4000 × 2250, 375 off top and bottom');
  const t4 = F(S(1920, 1080), S(1280, 720));
  check(t4.same && qs(t4.fit.barX) === '0' && qs(t4.fill.cutY) === '0', 'same shape: no bars, nothing cut');
  const t5 = F({w: dec('2.39'), h: Q(1)}, S(1920, 1080));
  eq([qs(t5.fit.w), qs(t5.fit.h)], ['1920', '192000/239'], 'scope on a 16 : 9 screen: 1920 × 803.35');
  let bad = [];
  for (let i = 0; i < 2000; i++) {
    const src = S(rint(1, 9000), rint(1, 9000)), dst = S(rint(1, 9000), rint(1, 9000));
    const r = F(src, dst);
    const sr = A.div(src.w, src.h), dr = A.div(dst.w, dst.h);
    const okFit = A.cmp(r.fit.w, dst.w) <= 0 && A.cmp(r.fit.h, dst.h) <= 0 && (A.cmp(r.fit.w, dst.w) === 0 || A.cmp(r.fit.h, dst.h) === 0) && A.cmp(A.div(r.fit.w, r.fit.h), sr) === 0;
    const okFill = A.cmp(r.fill.w, dst.w) >= 0 && A.cmp(r.fill.h, dst.h) >= 0 && (A.cmp(r.fill.w, dst.w) === 0 || A.cmp(r.fill.h, dst.h) === 0) && A.cmp(A.div(r.fill.w, r.fill.h), sr) === 0;
    const okCrop = A.cmp(r.crop.w, src.w) <= 0 && A.cmp(r.crop.h, src.h) <= 0 && A.cmp(A.div(r.crop.w, r.crop.h), dr) === 0 &&
      A.cmp(A.add(A.mul(r.crop.x, Q(2)), r.crop.w), src.w) === 0 && A.cmp(A.add(A.mul(r.crop.y, Q(2)), r.crop.h), src.h) === 0;
    const okBars = A.cmp(A.add(A.mul(r.fit.barX, Q(2)), r.fit.w), dst.w) === 0 && A.cmp(A.add(A.mul(r.fit.barY, Q(2)), r.fit.h), dst.h) === 0;
    if (!(okFit && okFill && okCrop && okBars)) bad.push(`${qs(src.w)}×${qs(src.h)} into ${qs(dst.w)}×${qs(dst.h)}`);
  }
  check(bad.length === 0, 'on 2,000 random frames: fit fits and touches, fill covers and touches, crop keeps the target shape, all centred', bad.slice(0, 3).join('; '));
}

// ---------------------------------------------------------------------------------------------------------------------
if (suites.includes('format')) {
  section('format');
  const P = (q, text, kind, what) => { const p = A.pretty(q); check(p.text === text && p.kind === kind, `${what}: ${text}`, J(p)); };
  P(Q(720), '720', 'int', 'whole');
  P(Q(1125, 2), '562.5', 'dec', 'a half');
  P(Q(45, 8), '5.625', 'dec', 'three places, exact');
  P(Q(10240, 3), '3413 1⁄3', 'frac', 'a third: 3413 1⁄3, thin space and fraction slash');
  P(Q(1, 3), '1⁄3', 'frac', 'below one: just the fraction');
  P(Q(17, 16), '1 1⁄16', 'frac', 'sixteenths');
  P(Q(192000, 239), '≈ 803.35', 'approx', 'anything else: ≈ and two places');
  P(Q(4, 1000), '0.004', 'dec', 'small values keep their digits');
  P(Q(1, 30000), '≈ 0.0000333', 'approx', 'very small values keep three significant digits');
  eq(A.pretty(Q(5, 2), {comma: true}).text, '2,5', 'decimal comma when the person used one');
  eq(A.pretty(Q(192000, 239), {comma: true}).text, '≈ 803,35', 'rounded, with a decimal comma');
  eq(A.plain(Q(10240, 3)), '3413.3333', 'plain digits for the clipboard: no ≈, no fraction');
  eq(A.plain(Q(1920)), '1920', 'plain whole number');
  eq(A.fmt(Q(999995, 1000)).text, '1000', '999.995 rounds up to 1000');
  eq(A.fmt(Q(1), {places: 2, fixed: true}).text, '1.00', 'fixed places');
  eq(A.fmt(Q(-1, 3)).text, '-0.333', 'negative, three significant digits below 1');
  eq(A.show(Q(10240, 3)), '≈ 3413.33', 'show marks rounding with ≈');
  eq(A.show(Q(1125, 2)), '562.5', 'show leaves exact decimals alone');
  eq(A.fmt(Q(10n ** 40n + 1n)).text, '10000000000000000000000000000000000000001', '41 digits, every one');
}

// ---------------------------------------------------------------------------------------------------------------------
if (suites.includes('list')) {
  section('list');
  const L = A.parseList('1920x1080\nhero.jpg\t1920\t1080\nbanner.png,728,90\n300 × 250\nnot a size\n4K\n1,920 x 1,080\n320;50\n' +
    'hero.jpg 1920x1080\nicon 512 512\n\n   \nA4\n3.840 x 2.160 Pixel\n');
  const got = L.rows.map(r => (r.ok ? `${qs(r.w)}x${qs(r.h)}` : 'BAD'));
  eq(got, ['1920x1080', '1920x1080', '728x90', '300x250', 'BAD', '3840x2160', '1920x1080', '320x50', '1920x1080', '512x512', '210x297', '3840x2160'],
    'a mixed paste: pairs, a spreadsheet row, CSV, semicolons, names, a junk line, blank lines skipped');
  eq([L.total, L.bad, L.capped], [12, 1, false], 'counts: 12 sizes, 1 not a size');
  eq(L.rows[2].d.headline, '728 : 90'.replace('728 : 90', A.describe(Q(728), Q(90)).headline), 'each row carries its description');
  check(A.looksLikeList('1920x1080\n1280x720'), 'two sizes on two lines is a list');
  check(!A.looksLikeList('1920x1080'), 'one size is not a list');
  check(!A.looksLikeList('1920\n1080'), 'two lone numbers are not a list (the box splits them)');
  check(!A.looksLikeList('hello\nworld'), 'two lines of words are not a list');
  let big = '';
  for (let i = 0; i < 1000000; i++) big += (1000 + i % 3000) + 'x' + (500 + i % 1700) + '\n';
  const t0 = Date.now(), LL = A.parseList(big), ms = Date.now() - t0;
  check(LL.rows.length === A.LIST_MAX && LL.total === 1000000 && LL.capped, `a million lines: the first ${A.LIST_MAX} read, all counted`, J([LL.rows.length, LL.total, LL.capped]));
  check(ms < 1500, `  in ${ms} ms`);
}

// ---------------------------------------------------------------------------------------------------------------------
if (suites.includes('page')) {
  section('page');
  let chromium = null;
  try { chromium = createRequire(import.meta.url)('playwright').chromium; } catch (e) { /* not installed */ }
  let up = false;
  try { up = (await fetch(URL_BASE, {method: 'HEAD'})).ok; } catch (e) { /* no server */ }
  if (!chromium || !up) console.log(`  skipped: ${!chromium ? 'Playwright not found' : 'no server at ' + URL_BASE + ' (npx http-server -p 8099)'}`);
  else await pageSuite(chromium);
}

async function pageSuite(chromium) {
  const browser = await chromium.launch();
  const origin = new URL(URL_BASE).origin;
  const ctx = await browser.newContext({viewport: {width: 390, height: 844}, deviceScaleFactor: 2, isMobile: true, hasTouch: true});
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], {origin});
  const page = await ctx.newPage();
  const problems = [], outside = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') problems.push(m.text()); });
  page.on('pageerror', e => problems.push(e.message));
  page.on('request', r => { const u = r.url(); if (!u.startsWith(origin) && !u.startsWith('blob:') && !u.startsWith('data:')) outside.push(u); });
  const val = sel => page.$eval(sel, e => e.value);
  const txt = sel => page.$eval(sel, e => e.textContent.replace(/\u202f/g, ' ').replace(/\u2009/g, ' '));
  const has = (sel, cls) => page.$eval(sel, (e, c) => e.classList.contains(c), cls);
  const type = async (sel, v) => { await page.fill(sel, ''); await page.type(sel, v); };
  const paste = (sel, v) => page.evaluate(([s, t]) => {
    const el = document.querySelector(s); el.focus();
    const dt = new DataTransfer(); dt.setData('text/plain', t);
    el.dispatchEvent(new ClipboardEvent('paste', {clipboardData: dt, bubbles: true, cancelable: true}));
  }, [sel, v]);
  const top = sel => page.$eval(sel, e => Math.round(e.getBoundingClientRect().top + window.scrollY));

  await page.goto(URL_BASE);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(150);

  // Arrival: a worked example, not an empty box.
  eq([await val('#w1'), await val('#h1'), await val('#w2'), await val('#h2')], ['1920', '1080', '1280', '720'], 'arrival: the example 1920 × 1080 resized to 1280 wide');
  eq(await txt('#big'), '16 : 9', '  its ratio, 16 : 9');
  eq(await txt('#copy'), 'Copy 720', '  the copy button names what it copies');
  check(/example/i.test(await txt('#msg1')), '  says it is an example');
  check(await page.$eval('#w1', e => e.inputMode === 'decimal' && e.type === 'text'), '  number keyboard on phones, text box so pasting 1920x1080 works');

  // Typing: results follow every key.
  await type('#w1', '2560');
  eq(await txt('#big'), '64 : 27', 'typing 2560 × 1080: 64 : 27 without pressing anything');
  check(/Ultrawide/.test(await txt('#name')) && /43 : 18/.test(await txt('#more')), '  named as the ultrawide sold as 21:9, and told apart from 3440 × 1440');
  await type('#h2', '1440');
  eq(await val('#w2'), '3413', 'a new height of 1440: the width is 3413');
  eq(await page.$eval('#bw2 b', e => e.textContent), 'W ≈', '  marked as rounded');
  check(/3413 1⁄3/.test(await txt('#eq')) && /0\.01 %/.test(await txt('#eq')), '  the exact 3413 1⁄3 and the drift are shown', await txt('#eq'));
  eq([await txt('#copy'), await txt('#copy2')], ['Copy 3413', 'Copy 3414 · even'], '  copy the nearest whole number, or the nearest even one');
  await page.click('#copy');
  await page.waitForTimeout(100);
  eq(await page.evaluate(() => navigator.clipboard.readText()), '3413', '  the clipboard gets just the number');
  check(/Copied 3413/.test(await txt('#copied')), '  and says so');
  await page.click('#copy2');
  await page.waitForTimeout(100);
  eq(await page.evaluate(() => navigator.clipboard.readText()), '3414', '  the even one');
  const ansTop = await top('#ans');

  // The worked-out box can be typed in: it becomes the side you typed.
  await type('#h2', '1080');
  eq(await top('#ans'), ansTop, 'typing a new size moves nothing below it');
  await type('#w2', '1280');
  eq(await val('#h2'), '540', 'typing in the worked-out box makes it the typed side: 1280 wide is 540 high at 64 : 27');
  eq(await page.$eval('#bh2 b', e => e.textContent), 'H =', '  exact, marked =');
  // Tapping a box you already typed in selects its number, so typing replaces it (a tester typed 1440 into 1080 once).
  await page.tap('#h1');
  await page.keyboard.type('1440');
  eq(await val('#h1'), '1440', 'tapping a filled box and typing replaces its number');
  await page.tap('#h1'); await page.keyboard.type('1080');

  // A size pasted whole into one box is split across both.
  await paste('#w1', '3.840 x 2.160 Pixel');
  eq([await val('#w1'), await val('#h1')], ['3840', '2160'], 'pasting "3.840 x 2.160 Pixel": 3840 and 2160');
  check(/Read “3\.840 x 2\.160 Pixel” as 3840 × 2160 px/.test(await txt('#msg1')), '  says how it read the dots', await txt('#msg1'));
  await page.click('#msg1 button[data-undo]');
  eq([await val('#w1'), await val('#h1')], ['2560', '1080'], '  Undo puts the boxes back');
  await paste('#w1', '1080p');
  eq([await val('#w1'), await val('#h1')], ['1920', '1080'], 'pasting "1080p": Full HD');

  // Errors sit by their box, in words, and clear what depended on them without moving anything.
  const before = {in2: await top('.in2'), chips: await top('#chips')};
  await type('#h1', 'auto');
  check(await has('#bh1', 'bad') && await has('#msg1', 'err'), 'typing "auto" as the height: that box is marked');
  check(/use New size below/.test(await txt('#msg1')), '  and the message points to where a height is worked out', await txt('#msg1'));
  check(await has('#res', 'none') && await has('#ans', 'none'), '  the ratio and the answer are cleared, not left stale');
  check(await page.$eval('#copy', e => e.disabled), '  copy is off');
  eq(await val('#h2'), '', '  no stale worked-out height');
  eq([await top('.in2'), await top('#chips')], [before.in2, before.chips], '  nothing moved when the error appeared');
  await type('#h1', '-1080');
  check(/negative/.test(await txt('#msg1')), 'a negative height is refused in words', await txt('#msg1'));
  await page.click('#msg1 button[data-fix]');
  eq(await val('#h1'), '1080', '  "Use 1080" fixes it');
  await type('#h1', '0');
  check(/above 0/.test(await txt('#msg1')), 'zero is refused', await txt('#msg1'));
  await type('#h1', '1O80');
  check(!(await has('#bh1', 'bad')) && /Read “1O80” as 1080/.test(await txt('#msg1')), 'a letter O for a zero is read as 1080, and said so', await txt('#msg1'));
  eq(await txt('#big'), '16 : 9', '  and the ratio is back');
  await type('#h1', '1,080');
  eq(await txt('#big'), '16 : 9', '"1,080" is a thousand and eighty');
  await type('#w1', '2,39'); await type('#h1', '1');
  eq(await txt('#big'), '2,39 : 1', 'a decimal comma comes back as a decimal comma');

  // Presets and swap, with undo.
  await page.click('#chips button:nth-child(3)');
  eq([await val('#w1'), await val('#h1')], ['4', '3'], 'the 4 : 3 chip sets 4 × 3');
  eq(await page.$eval('#chips button:nth-child(3)', e => e.getAttribute('aria-pressed')), 'true', '  and shows as pressed');
  await page.click('#swap');
  eq([await val('#w1'), await val('#h1')], ['3', '4'], 'swap: 3 × 4');
  await page.keyboard.press('Control+z');
  eq([await val('#w1'), await val('#h1')], ['4', '3'], '  Ctrl+Z after a change the page made undoes it');
  await page.keyboard.press('Control+z');
  eq([await val('#w1'), await val('#h1')], ['2,39', '1'], '  and the one before');

  // Typing "16:9" into the first box moves on at the colon.
  await page.fill('#w1', '');
  await page.click('#w1');
  await page.keyboard.type('16:9');
  eq([await val('#w1'), await val('#h1')], ['16', '9'], 'typing "16:9" in the width box fills both boxes');
  // Phone keyboards often send input with no key name: the separator is caught when it lands in the box.
  await page.$eval('#w1', e => { e.focus(); e.value = '21x'; e.setSelectionRange(3, 3); e.dispatchEvent(new Event('input', {bubbles: true})); });
  await page.keyboard.type('9');
  eq([await val('#w1'), await val('#h1')], ['21', '9'], '  and so does "21x" arriving without a key name, then 9');
  await page.fill('#w1', '16'); await page.fill('#h1', '9');

  // Same state after a reload.
  await type('#w2', '1000');
  await page.waitForTimeout(400);
  await page.reload();
  await page.waitForTimeout(150);
  eq([await val('#w1'), await val('#h1'), await val('#w2'), await val('#h2')], ['16', '9', '1000', '562'], 'a reload brings back the last values, not the example (562.5 rounds to the even 562)');
  check(!/example/i.test(await txt('#msg1')), '  and no longer calls them an example');

  // A size of another shape pasted as the new size opens Fit or crop.
  await paste('#w2', '1080x1350');
  check(await page.$eval('#fitfold', e => e.open), 'pasting 1080x1350 as the new size of a 16 : 9 opens Fit or crop');
  check(/607\.5/.test(await txt('#fits')) && /2400 × 1350/.test(await txt('#fits')), '  fit 1080 × 607.5, fill 2400 × 1350', await txt('#fits'));
  eq(await txt('#crop'), '', '  a ratio typed as 16 × 9 gets no crop-in-pixels line');

  // A pasted list becomes a table, read off the page.
  await paste('#w1', 'hero.jpg\t1920\t1080\nbanner.png,728,90\n300 × 250\nnot a size\n1366x768');
  await page.waitForSelector('#list:not([hidden]) table');
  eq(await page.$$eval('#tbl tbody tr', r => r.length), 5, 'a pasted list of five lines: a table of five rows');
  check(/4 sizes/.test(await txt('#listh')) && /1 line had no size/.test(await txt('#listmsg')), '  four sizes, one line without', await txt('#listh'));
  eq([await val('#w1'), await val('#h1')], ['16', '9'], '  the boxes are left as they were');
  let big = '';
  for (let i = 0; i < 200000; i++) big += (1000 + i % 3000) + 'x' + (500 + i % 1700) + '\n';
  const t0 = Date.now();
  await paste('#w1', big);
  await page.waitForFunction(() => /^[\d,]+ sizes$/.test(document.getElementById('listh').textContent), null, {timeout: 20000});
  check(/first 5,000 of 200,000/.test(await txt('#listmsg')), `200,000 pasted lines: the first 5,000 read, in ${Date.now() - t0} ms`, await txt('#listmsg'));
  await page.click('#listclose');

  // Dark mode and reduced motion are honoured.
  await page.emulateMedia({colorScheme: 'dark', reducedMotion: 'reduce'});
  check(await page.evaluate(() => getComputedStyle(document.body).backgroundColor) === 'rgb(17, 18, 19)', 'dark mode: a dark sheet');

  check(problems.length === 0, 'no console errors or warnings', problems.join(' | '));
  check(outside.length === 0, 'no request leaves the site', outside.join(' '));
  await browser.close();
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
