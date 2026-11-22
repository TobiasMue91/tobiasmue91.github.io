#!/usr/bin/env node
// Test suite for tools/roman_numeral_converter.html (Roman Numeral Converter).
//
// The page promises: a number written correctly in Roman numerals, a numeral read correctly or refused with the rule it
// breaks, dates and lists converted part by part, and the working that proves each result. The logic lives in the
// page's DOM-free <script id="core"> block, which this suite runs in Node's vm. What checks each promise:
//   vectors   published values (Wikipedia, the Super Bowl numbering, film copyright years) in both directions
//   encode    every number 1..3,999,999 against an independent greedy encoder written here; the working adds up
//   grammar   every string of up to 6 letters from IVXLCDM: accepted exactly when the textbook regexes accept it
//             (strict, and additive IIII/VIIII/XXXX...), refused otherwise, and every refusal names a rule
//   input     what people paste: spaces, thousands in five styles, decimal comma, other scripts' digits, full-width
//             and Unicode numerals (Ⅻ, ↀ), dotted letters, overlines and macrons, zero, negative, decimal, huge, empty
//   text      a numeral or number inside a sentence (Louis XIV, Super Bowl LIX, chapter 12), and English words made of
//             numeral letters (Mix, Did, Civil) not taken for numerals beside a real one
//   dates     numeric and Roman dates both ways, separators kept, 1.000.000 still a number
//   list      a pasted column, one result per line, blanks where unreadable; 100,000 lines with the cap
//   page      (Chromium, needs `npx http-server -p 8099`) the example on arrival, live results, copy, errors and the
//             suggestion button, case and separator choices kept, ?q= links, a reload keeping the input, a long list
//             read in the worker, no console errors, no request leaving the site
//
//   npm run test:roman                                # or: node test/roman_numeral_converter.mjs
//   node test/roman_numeral_converter.mjs grammar     # named suites only

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import {createRequire} from 'module';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const ALL = ['vectors', 'encode', 'grammar', 'input', 'text', 'dates', 'list', 'page'];
const picked = process.argv.slice(2).filter(a => !a.startsWith('--'));
const suites = picked.length ? picked : ALL;
const URL_BASE = 'http://localhost:8099/tools/roman_numeral_converter.html';

let failures = 0, passes = 0;
const check = (ok, what, detail) => { if (ok) passes++; else { failures++; console.log(`  FAIL  ${what}${detail !== undefined ? '\n          ' + detail : ''}`); } };
const eq = (got, want, what) => check(JSON.stringify(got) === JSON.stringify(want), what, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
const section = name => console.log(`\n=== ${name} ===`);

const html = readFileSync(join(ROOT, 'tools', 'roman_numeral_converter.html'), 'utf8');
const src = html.match(/<script id="core">([\s\S]*?)<\/script>/)[1];
const ctx = {module: {exports: {}}};
vm.runInNewContext(src, ctx);
const R = ctx.module.exports;
const B = '̅';
const bar = s => [...s].map(c => c + B).join('');
const an = s => R.analyse(s);
const out = s => R.answerText(an(s));

// ---------------------------------------------------------------------------------------------------------------------
if (suites.includes('vectors')) {
  section('vectors');
  const V = [[1, 'I'], [3, 'III'], [4, 'IV'], [9, 'IX'], [14, 'XIV'], [39, 'XXXIX'], [40, 'XL'], [49, 'XLIX'], [90, 'XC'],
    [160, 'CLX'], [207, 'CCVII'], [246, 'CCXLVI'], [400, 'CD'], [444, 'CDXLIV'], [789, 'DCCLXXXIX'], [900, 'CM'],
    [999, 'CMXCIX'], [1009, 'MIX'], [1066, 'MLXVI'], [1776, 'MDCCLXXVI'], [1918, 'MCMXVIII'], [1944, 'MCMXLIV'],
    [1954, 'MCMLIV'], [1990, 'MCMXC'], [1994, 'MCMXCIV'], [2014, 'MMXIV'], [2421, 'MMCDXXI'], [2025, 'MMXXV'],
    [2026, 'MMXXVI'], [3888, 'MMMDCCCLXXXVIII'], [3999, 'MMMCMXCIX'],
    // Super Bowls
    [50, 'L'], [53, 'LIII'], [58, 'LVIII'], [59, 'LIX'], [60, 'LX'],
    // vinculum
    [4000, bar('IV')], [5000, bar('V')], [10000, bar('X')], [4001, bar('IV') + 'I'], [12345, bar('XII') + 'CCCXLV'],
    [1000000, bar('M')], [3999999, bar('MMMCMXCIX') + 'CMXCIX']];
  for (const [n, r] of V) {
    eq(out(String(n)), r, `${n} → ${r}`);
    eq(out(r), String(n), `${r} → ${n}`);
  }
}

// ---------------------------------------------------------------------------------------------------------------------
if (suites.includes('encode')) {
  section('encode');
  const T = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  const greedy = n => { let s = ''; for (const [v, r] of T) while (n >= v) { s += r; n -= v; } return s; };
  const ref = n => (n < 4000 ? greedy(n) : bar(greedy(Math.floor(n / 1000))) + greedy(n % 1000));
  let bad = 0, badSum = 0, badBack = 0, first = '';
  for (let n = 1; n <= 3999999; n++) {
    const r = R.toRoman(n);
    if (r.roman !== ref(n)) { bad++; if (!first) first = `${n}: ${r.roman} vs ${ref(n)}`; }
    if (r.parts.reduce((a, p) => a + p.value, 0) !== n || r.parts.map(p => p.roman).join('') !== r.roman) badSum++;
    if (n % 97 === 0 || n < 5000) { const back = R.readNumeral(r.roman); if (back.kind !== 'toNumber' || back.value !== n || back.note) badBack++; }
  }
  check(bad === 0, 'every number 1..3,999,999 matches an independent greedy encoder', `${bad} differ, first ${first}`);
  check(badSum === 0, 'the working adds up to the number and spells the numeral', `${badSum} differ`);
  check(badBack === 0, 'reading the numeral back gives the number, without a note', `${badBack} differ`);
  for (const n of [0, -1, 4000000, 1.5, NaN]) {
    let threw = false;
    try { R.toRoman(n); } catch (e) { threw = true; }
    check(threw, `toRoman(${n}) refuses`);
  }
}

// ---------------------------------------------------------------------------------------------------------------------
if (suites.includes('grammar')) {
  section('grammar');
  const strict = /^M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/;
  const loose = /^M{0,4}(CM|DCCCC|CD|CCCC|D?C{0,3})(XC|LXXXX|XL|XXXX|L?X{0,3})(IX|VIIII|IV|IIII|V?I{0,3})$/;
  const L = 'IVXLCDM';
  let n = 0, wrong = 0, noRule = 0, noteWrong = 0, first = '';
  const walk = (s, depth) => {
    if (s) {
      n++;
      const r = R.readNumeral(s);
      const ok = r.kind === 'toNumber';
      if (ok !== loose.test(s)) { wrong++; if (!first) first = `${s}: ${ok ? r.value : r.message}`; }
      if (ok && !!r.note !== !strict.test(s)) { noteWrong++; if (!first) first = `${s} note: ${r.note}`; }
      if (!ok && !(r.reason && r.reason.length > 20 || /larger than/.test(r.message))) noRule++;
    }
    if (depth < 6) for (const c of L) walk(s + c, depth + 1);
  };
  walk('', 0);
  check(wrong === 0, `${n} strings: accepted exactly when the textbook (or additive) regex accepts`, `${wrong} wrong, first ${first}`);
  check(noteWrong === 0, 'a note exactly when the form is not the standard one', first);
  check(noRule === 0, 'every refusal names the rule it breaks', `${noRule} without`);
  const why = s => R.readNumeral(s).reason;
  check(/I can only be subtracted from V and X/.test(why('IC')), 'IC: I subtracted only from V and X', why('IC'));
  check(/V is never put before/.test(why('VX')), 'VX: V is never subtracted', why('VX'));
  check(/L is never repeated: LL is written C/.test(why('LL')), 'LL: never repeated', why('LL'));
  check(/at most three times/.test(why('IIIII')), 'IIIII: three in a row', why('IIIII'));
  check(/single I/.test(why('IIX')), 'IIX: only a single I subtracts', why('IIX'));
  check(/out of order/.test(why('IXI')), 'IXI: out of order', why('IXI'));
  eq(R.readNumeral('IC').suggestion, {value: 99, roman: 'XCIX'}, 'IC suggests 99 = XCIX');
  eq(R.readNumeral('IIIII').suggestion, {value: 5, roman: 'V'}, 'IIIII suggests V');
  eq(R.readNumeral('MMMMM').kind, 'error', 'MMMMM refused');
  eq(R.readNumeral('IIII').standard, 'IV', 'IIII: standard form IV');
  eq(R.readNumeral('MCMXXXX').value, 1940, 'MCMXXXX (mixed subtractive and additive) reads 1940 with a note');
  eq(R.readNumeral('M' + bar('V')).value, 4000, 'MV̄ (another way to write 4,000) reads 4,000 with a note');
  eq(R.readNumeral(bar('M') + bar('M') + bar('M') + bar('M')).kind, 'error', 'M̄M̄M̄M̄ refused (beyond 3,999,999)');
}

// ---------------------------------------------------------------------------------------------------------------------
if (suites.includes('input')) {
  section('input');
  const cases = [
    [' 42 ', 'XLII'], ['42\t', 'XLII'], ['1,994', 'MCMXCIV'], ['1 994', 'MCMXCIV'], ["1'994", 'MCMXCIV'], ['1 994', 'MCMXCIV'],
    ['1.994', 'MCMXCIV'], ['01994', 'MCMXCIV'], ['+12', 'XII'], ['12.0', 'XII'], ['12,00', 'XII'], ['3,999', 'MMMCMXCIX'],
    ['1.000.000', bar('M')], ['١٩٩٤', 'MCMXCIV'], ['۱۹۹۴', 'MCMXCIV'], ['१९९४', 'MCMXCIV'], ['１９９４', 'MCMXCIV'],
    ['mcmxciv', '1994'], ['XxIv', '24'], [' XLII ', '42'], ['XIV.', '14'], ['(XIV)', '14'], ['M.D.C.C.L.X.X.V.I', '1776'],
    ['Ⅻ', '12'], ['ⅿⅽⅿ', '1900'], ['ↀ', '1000'], ['ↁ', '5000'], ['ↂ', '10000'], ['X̄', '10000'], ['Ī', '1000'],
    ['IIII', '4'], ['VIIII', '9'], ['MDCCCCX', '1910'],
  ];
  for (const [i, o] of cases) eq(out(i), o, `${JSON.stringify(i)} → ${o}`);
  const errs = [
    ['0', /no Roman numeral for zero/], ['-5', /no negative/], ['−5', /no negative/], ['12.5', /whole numbers/],
    ['1,5', /whole numbers/], ['1e3', /written out/], ['4000000', /too large/], ['99999999999999999999', /too large/],
    ['2,0000', /not grouped/], ['1,99', /whole numbers/], ['12 34', /not grouped/], ['abc', /No Roman numeral or number/], ['IC', /not a valid numeral/], ['MMMMM', /not a valid|larger/],
  ];
  for (const [i, re] of errs) { const r = an(i); check(r.kind === 'error' && re.test(r.message), `${JSON.stringify(i)} refused: ${re}`, r.message); }
  for (const r of errs.map(([i]) => an(i))) check(r.message.length < 220 && /[.)]$/.test(r.message), 'a refusal is a short sentence', r.message);
  eq(an('').kind, 'empty', 'empty → nothing, no error');
  eq(an('   \n \t ').kind, 'empty', 'whitespace only → nothing');
  eq(an('x'.repeat(5000)).kind, 'error', 'a 5,000-character line is refused, not hung on');
  check(an('4000').note && /bar/.test(an('4000').note), '4,000 says what the bar means');
}

// ---------------------------------------------------------------------------------------------------------------------
if (suites.includes('text')) {
  section('text');
  const T = [['Louis XIV', '14'], ['Super Bowl LIX', '59'], ['Rocky IV', '4'], ['chapter vii', '7'], ['henry viii', '8'],
    ['Did XIV', '14'], ['I am XIV', '14'], ['Chapter 12', 'XII'], ['born in 1994!', 'MCMXCIV'], ['MCM XCIV', '1994'],
    ['Mix', '1009'], ['© MCMXCIV Paramount', '1994']];
  for (const [i, o] of T) eq(out(i), o, `${JSON.stringify(i)} → ${o}`);
  eq(an('Louis XIV').found, 'XIV', 'says which word it took');
  eq(an('Civil war').kind, 'error', '"Civil war" is not a numeral');
  const sev = an('Henry VIII and George V');
  eq([sev.kind, sev.items.map(x => x.result.value)], ['several', [8, 5]], 'two numerals in a sentence: both converted');
  eq(R.answerText(sev), '8\n5', 'copy gives one result per line');
  const sev2 = an('XIV XV');
  eq([sev2.kind, sev2.items.map(x => x.result.value)], ['several', [14, 15]], 'XIV XV: two numerals, not one broken one');
  eq(an('pages 12 and 40').items.map(x => x.result.roman), ['XII', 'XL'], 'two numbers in a sentence');
}

// ---------------------------------------------------------------------------------------------------------------------
if (suites.includes('dates')) {
  section('dates');
  const D = [['14.07.1789', 'XIV.VII.MDCCLXXXIX'], ['4.7.1776', 'IV.VII.MDCCLXXVI'], ['7/4/1776', 'VII/IV/MDCCLXXVI'],
    ['2026-11-22', 'MMXXVI-XI-XXII'], ['12 · 05 · 1994', 'XII·V·MCMXCIV'], ['XII.V.MCMXCIV', '12.5.1994'],
    ['xiv-vii-mdcclxxxix', '14-7-1789'], ['XII·V·MCMXCIV', '12·5·1994'],
    ['23 March 2019', 'XXIII.III.MMXIX'], ['March 23, 2019', 'III.XXIII.MMXIX'], ['4th Jul 1776', 'IV.VII.MDCCLXXVI'],
    ['Sept 11 2001', 'IX.XI.MMI']];
  for (const [i, o] of D) eq(out(i), o, `${i} → ${o}`);
  eq(R.answerText(an('14.07.1789'), {sep: '·'}), 'XIV·VII·MDCCLXXXIX', 'separator can be chosen');
  eq(R.answerText(an('14.07.1789'), {lower: true}), 'xiv.vii.mdcclxxxix', 'lowercase');
  eq(an('00.07.1789').kind, 'error', 'a zero part is refused');
  eq(an('XII.IC.MM').kind, 'error', 'a malformed part is refused');
  eq(an('1.000.000').kind, 'toRoman', '1.000.000 is a number, not a date');
}

// ---------------------------------------------------------------------------------------------------------------------
if (suites.includes('list')) {
  section('list');
  const r = an('1994\nMMXXVI\n\nIC\r\n14.07.1789\nhello\n  4  ');
  eq(r.kind, 'list', 'several lines → a list');
  eq(r.rows.length, 6, 'blank lines skipped');
  eq(R.answerText(r), 'MCMXCIV\n2026\n\nXIV.VII.MDCCLXXXIX\n\nIV', 'copy: one result per line, blank where unreadable');
  const big = Array.from({length: 120000}, (_, i) => String(i % 3999 + 1)).join('\n');
  const t = Date.now();
  const rb = an(big);
  const ms = Date.now() - t;
  eq([rb.rows.length, rb.truncated], [R.LIST_CAP, 120000], 'capped at 100,000 lines and says how many there were');
  check(ms < 5000, `120,000 lines read in ${ms} ms`);
  let calls = 0;
  R.analyseList(R.lines(big).slice(0, 20000), () => calls++);
  check(calls >= 3, 'progress is reported while reading', calls);
}

// ---------------------------------------------------------------------------------------------------------------------
if (suites.includes('page')) {
  section('page');
  let chromium = null;
  try { ({chromium} = createRequire(import.meta.url)('playwright')); } catch (e) { /* skipped below */ }
  let up = false;
  try { up = (await fetch(URL_BASE)).ok; } catch (e) { up = false; }
  if (!chromium || !up) console.log('  skipped (needs Playwright and `npx http-server -p 8099`)');
  else {
    const browser = await chromium.launch();
    const ctx2 = await browser.newContext({viewport: {width: 390, height: 844}, permissions: ['clipboard-read', 'clipboard-write']});
    const page = await ctx2.newPage();
    const errors = [], foreign = [];
    page.on('pageerror', e => errors.push(String(e)));
    page.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.text())) errors.push(m.text()); });
    page.on('request', rq => { const u = new URL(rq.url()); if (!/^(localhost|fonts\.(googleapis|gstatic)\.com)$/.test(u.hostname) && !u.protocol.startsWith('blob')) foreign.push(rq.url()); });
    const ans = () => page.$eval('#ans', e => e.textContent).catch(() => null);
    const type = async v => { await page.fill('#q', v); await page.waitForTimeout(60); };

    await page.goto(URL_BASE);
    await page.waitForTimeout(400);
    const year = String(new Date().getFullYear());
    eq(await page.inputValue('#q'), year, 'arrives with this year as the example');
    check(/Example/i.test(await page.textContent('#cap')), 'the example is labelled');
    eq(await ans(), R.toRoman(+year).roman, 'and its numeral is shown');
    const box = await page.$eval('#ans', e => e.getBoundingClientRect().bottom);
    check(box < 844, 'the result is visible without scrolling on a phone', box);

    await page.click('#q');
    await page.keyboard.type('1994');
    await page.waitForTimeout(80);
    eq(await page.inputValue('#q'), '1994', 'typing replaces the example');
    eq(await ans(), 'MCMXCIV', 'result while typing');
    const proof = await page.$$eval('.proof .r', els => els.map(e => e.textContent.trim()));
    eq(proof.slice(0, 4), ['M', 'CM', 'XC', 'IV'], 'the working is shown');

    await page.click('[data-act="copy"]');
    await page.waitForTimeout(100);
    eq(await page.evaluate(() => navigator.clipboard.readText()), 'MCMXCIV', 'copy puts just the numeral on the clipboard');

    const cardTop1 = await page.$eval('#card', e => e.getBoundingClientRect().top);
    await type('IC');
    check(await page.$eval('#q', e => e.getAttribute('aria-invalid')) === 'true', 'IC marks the field invalid');
    check(/I can only be subtracted/.test(await page.textContent('#card')), 'and says which rule');
    const cardTop2 = await page.$eval('#card', e => e.getBoundingClientRect().top);
    eq(cardTop2, cardTop1, 'the error appears where the result was, nothing above moves');
    await page.click('[data-use]');
    await page.waitForTimeout(80);
    eq(await page.inputValue('#q'), 'XCIX', 'the suggestion button puts XCIX in the field');
    eq(await ans(), '99', 'and reads it');
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(80);
    eq(await page.inputValue('#q'), 'IC', 'undo brings the typed text back');

    await type('2026');
    await page.click('[data-case="lower"]');
    eq(await ans(), 'mmxxvi', 'lowercase on request');
    await type('14.07.1789');
    await page.click('[data-sep="·"]');
    eq(await ans(), 'xiv·vii·mdcclxxxix', 'separator chosen, case kept');
    await page.reload();
    await page.waitForTimeout(300);
    eq(await page.inputValue('#q'), '14.07.1789', 'a reload keeps the input');
    eq(await ans(), 'xiv·vii·mdcclxxxix', 'and the case and separator chosen');
    await page.click('[data-case="upper"]');

    await page.goto(URL_BASE + '?q=' + encodeURIComponent('Louis XIV'));
    await page.waitForTimeout(300);
    eq(await ans(), '14', '?q= links open with their input');
    await page.goto(URL_BASE + '#MCMXCIV');
    await page.waitForTimeout(300);
    eq(await ans(), '1994', '#hash links too');

    const many = Array.from({length: 40000}, (_, i) => String(i % 3999 + 1)).join('\n');
    await page.evaluate(v => { const q = document.getElementById('q'); q.value = v; q.dispatchEvent(new Event('input')); }, many);
    await page.waitForFunction(() => /40,000/.test(document.getElementById('cap').textContent) && !document.getElementById('cap').classList.contains('busy'), null, {timeout: 20000});
    check(/40,000/.test(await page.textContent('#cap')), 'a 40,000-line paste is read in the worker and counted');
    eq(await page.$$eval('table.list tbody tr', r => r.length), 500, 'the table shows the first 500 rows');

    await page.emulateMedia({colorScheme: 'dark'});
    await type('MCMXCIV');
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    check(bg !== 'rgb(242, 238, 229)', 'dark mode changes the page', bg);

    eq(errors, [], 'no console errors');
    eq(foreign, [], 'no request leaves the site (fonts aside)');
    await browser.close();
  }
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
