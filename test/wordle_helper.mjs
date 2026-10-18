#!/usr/bin/env node
// Test suite for tools/wordle_helper.html (Wordle Helper).
//
// The page promises the best next guess and says why. Its promises, and what checks each:
//   feedback  colours exactly as Wordle gives them, repeated letters included (greens first, then yellows left
//             to right only while the answer has an unmatched copy), against hand-worked cases
//   filter    the candidates left are exactly the words that would have given every row's colours, and the
//             site's Wordle game accepts every guess the helper accepts
//   hard      Hard Mode refuses what the NYT refuses (greens moved, revealed letters dropped) and nothing else
//   tree      data/wordle_helper/tree_salet.json, played on all 2,315 answers, wins every game in 7,920
//             guesses (3.421 on average) and never needs more than five - Bertsimas and Paskov's optimum
//   human     the SLANT / PRICE / any-fitting-word strategy, scored exactly on every answer as a random pick
//             among the fitting words, averages about 3.67 (3.669)
//   engine    the page's own exact search (the worker's) agrees with the optimal tree on every set it solves,
//             and its cached feedback agrees with the plain feedback function
//   analyse   what the page shows: the regression path SALET, LEMON, FIELD leaves BUGLE and CYCLE; the tree's
//             guess comes first on the SALET path; Hard Mode suggestions are all playable; an answer outside the
//             original list is still found; the explanation names the counts it claims
//   page      (Chromium, needs `npx http-server -p 8099`) the real page on a phone: typing, tapping tiles,
//             a suggestion filling the next row, the worker answering, state surviving a reload
//
// No browser or server for anything but `page`, which is skipped when Chromium or the server is missing.
//
//   npm run test:wordlehelper              # or: node test/wordle_helper.mjs
//   node test/wordle_helper.mjs tree human # named suites only
//   node test/wordle_helper.mjs --page=old.html

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const ALL = ['feedback', 'filter', 'hard', 'tree', 'human', 'engine', 'analyse', 'page'];
const picked = process.argv.slice(2).filter(a => !a.startsWith('--'));
const suites = picked.length ? picked : ALL;
const pageArg = (process.argv.find(a => a.startsWith('--page=')) || '').slice(7);
const PAGE = pageArg || join(ROOT, 'tools', 'wordle_helper.html');

let failures = 0, passes = 0;
const check = (ok, what, detail) => { if (ok) passes++; else { failures++; console.log(`  FAIL  ${what}${detail !== undefined ? '\n          ' + detail : ''}`); } };
const eq = (got, want, what) => check(JSON.stringify(got) === JSON.stringify(want), what, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
const near = (got, want, tol, what) => check(Math.abs(got - want) <= tol, what, `got ${got}, want ${want} +- ${tol}`);
const section = name => console.log(`\n=== ${name} ===`);

const html = readFileSync(PAGE, 'utf8');
const src = html.match(/<script id="core">([\s\S]*?)<\/script>/)[1];
const ctx = {module: {exports: {}}};
vm.runInNewContext(src, ctx);
const W = ctx.module.exports;
const load = f => JSON.parse(readFileSync(join(ROOT, 'data', 'wordle_helper', f), 'utf8'));
const ANSWERS = load('answers.json'), GUESSES = load('guesses.json'), META = load('tree_salet.json');
let engine = null;
const getEngine = () => {
  if (!engine) engine = new W.Engine(ANSWERS, GUESSES, META.fit);
  return engine;
};
// '.' grey, 'y' yellow, 'g' green
const show = p => W.colors(p).map(c => '.yg'[c]).join('');
const read = s => W.pattern([...s].map(ch => '.yg'.indexOf(ch)));
const row = (guess, s) => ({guess, pattern: read(s)});

if (suites.includes('feedback')) {
  section('feedback');
  const cases = [
    ['speed', 'abide', '..y.y', 'two Es guessed, one in the answer: the first is yellow, the second grey'],
    ['erase', 'speed', 'y..yy', 'both Es yellow: the answer has two, neither in place'],
    ['eerie', 'theme', 'y...g', 'three Es, two in the answer: the green takes one, only the first other E is yellow'],
    ['geese', 'eerie', '.gy.g', 'greens first: two greens and one yellow use up all three Es of EERIE'],
    ['melee', 'eerie', '.g.yg', 'three Es against three: green, then the leftover E yellow'],
    ['robot', 'floor', 'yy.g.', 'the green O is matched first, so only one O is left to make the other yellow'],
    ['sassy', 'essay', 'yyg.g', 'three Ss, two in the answer: the green S and the first other S'],
    ['llama', 'hello', 'yy...', 'two Ls, both in the answer but out of place'],
    ['crane', 'crane', 'ggggg', 'the answer itself'],
    ['fuzzy', 'crane', '.....', 'nothing in common'],
  ];
  for (const [g, a, want, why] of cases) eq(show(W.feedback(g, a)), want, `${g.toUpperCase()} on ${a.toUpperCase()}: ${why}`);
  let bad = 0;
  for (let p = 0; p < 243; p++) if (W.pattern(W.colors(p)) !== p) bad++;
  eq(bad, 0, 'all 243 patterns survive colours -> pattern -> colours');
  eq(W.feedback('salet', 'salet'), 242, 'five greens is pattern 242');
  // yellow count never exceeds what the answer has, and greens are exactly the matching positions
  let wrong = 0;
  for (let i = 0; i < 20000; i++) {
    const g = GUESSES[(i * 7919) % GUESSES.length], a = ANSWERS[(i * 104729) % ANSWERS.length], c = W.colors(W.feedback(g, a));
    for (let k = 0; k < 5; k++) if ((c[k] === 2) !== (g[k] === a[k])) wrong++;
    for (const L of new Set(g)) {
      const marked = [...g].filter((x, k) => x === L && c[k] > 0).length, inA = [...a].filter(x => x === L).length, inG = [...g].filter(x => x === L).length;
      if (marked !== Math.min(inA, inG)) wrong++;
    }
  }
  eq(wrong, 0, '20,000 guess/answer pairs: greens exactly where letters match, coloured copies = min(copies in guess, copies in answer)');
}

if (suites.includes('filter')) {
  section('filter');
  eq(ANSWERS.length, 2315, 'the original answer list has 2,315 words');
  eq(GUESSES.length, 12972, 'the accepted-guess list has 12,972 words');
  check(ANSWERS.every(w => GUESSES.includes(w)), 'every answer is an accepted guess');
  const rows = [row('salet', '..yy.'), row('lemon', 'yy...'), row('field', '..yg.')];
  eq(W.filter(ANSWERS, rows), ['bugle', 'cycle'], 'SALET (L, E yellow), LEMON (L, E yellow), FIELD (L green, E yellow) leaves BUGLE and CYCLE');
  // the Wordle game on the site accepts every word the helper does (it once lacked 889 answers, ALOFT and BLOAT among them)
  const game = readFileSync(join(ROOT, 'games', 'wordle.html'), 'utf8');
  const gameWords = new Set([...game.match(/const VALID_WORDS = new Set\("([A-Z,]+)"/)[1].split(','), ...game.match(/const ANSWERS = "([A-Z,]+)"/)[1].split(',')]);
  const lacking = GUESSES.filter(w => !gameWords.has(w.toUpperCase()));
  eq(lacking.slice(0, 10), [], `games/wordle.html accepts all ${GUESSES.length.toLocaleString('en-US')} accepted guesses (${lacking.length} missing)`);
  // brute force: a word survives iff it would have produced every row
  const r2 = [row('crane', '..y.g')];
  const want = ANSWERS.filter(a => W.feedback('crane', a) === read('..y.g'));
  eq(W.filter(ANSWERS, r2), want, `CRANE ..y.g: ${want.length} words, exactly the ones that give those colours`);
  check(want.every(w => w.endsWith('e') && w.includes('a') && w[2] !== 'a' && !/[crn]/.test(w)), 'and each ends in E, has an A not in the middle, and no C, R or N');
  // every answer is the only survivor of its own full-green row, and survives every row it produced
  let bad = 0;
  for (let i = 0; i < ANSWERS.length; i += 7) {
    const a = ANSWERS[i], rs = ['salet', 'crony', 'dumpy'].map(g => ({guess: g, pattern: W.feedback(g, a)}));
    if (!W.filter(ANSWERS, rs).includes(a)) bad++;
  }
  eq(bad, 0, 'an answer always survives the feedback it would itself give');
}

if (suites.includes('hard')) {
  section('hard');
  const rows = [row('salet', '..yy.')];
  eq(W.hardCheck('lemon', rows), '', 'LEMON uses both revealed letters (in other places is fine)');
  eq(W.hardCheck('mound', rows), 'Guess must contain L', 'MOUND drops the revealed L');
  eq(W.hardCheck('lunch', rows), 'Guess must contain E', 'LUNCH drops the revealed E');
  eq(W.hardCheck('salet', rows), '', 'repeating the same yellow positions is allowed (the NYT only checks letters)');
  eq(W.hardCheck('sssss', rows), 'Guess must contain L', 'grey letters may be reused, but yellows are still needed');
  const g = [row('crane', 'gg..g')];
  eq(W.hardCheck('crude', g), '', 'CRUDE keeps C, R and E in place');
  eq(W.hardCheck('ocree', g), '1st letter must be C', 'a green that moves is refused with the NYT message');
  const two = [row('eerie', 'yy..g')]; // the answer has three Es
  eq(W.hardCheck('there', two), 'Guess must contain E 3 times', 'three revealed Es need three Es');
  eq(W.hardCheck('geese', two), '', 'and three Es with the green in place is fine');
}

if (suites.includes('tree')) {
  section('tree');
  const T = META.tree;
  let total = 0, worst = 0, lost = 0, notGuess = 0;
  const hist = {};
  const allowed = new Set(GUESSES);
  for (const a of ANSWERS) {
    let node = T, n = 0;
    for (;;) {
      const g = W.nodeGuess(node);
      if (!allowed.has(g)) notGuess++;
      n++;
      const p = W.feedback(g, a);
      if (p === 242) break;
      node = typeof node === 'string' ? null : node[1][p];
      if (!node || n > 10) { lost++; break; }
    }
    total += n; worst = Math.max(worst, n); hist[n] = (hist[n] || 0) + 1;
  }
  console.log(`  SALET tree: ${total} guesses over ${ANSWERS.length} answers, average ${(total / ANSWERS.length).toFixed(4)}, at most ${worst}, ${JSON.stringify(hist)}`);
  eq(lost, 0, 'every answer is solved (100% wins)');
  eq(total, 7920, '7,920 guesses in all');
  eq((total / ANSWERS.length).toFixed(3), '3.421', 'average 3.421 (Bertsimas & Paskov 2025)');
  eq(worst, 5, 'never more than five guesses');
  eq(notGuess, 0, 'every guess in the tree is an accepted word');
  eq([META.opener, META.total, META.max], ['salet', 7920, 5], 'the file says what it holds');
  eq(W.treeStats(T, ANSWERS), {total: 7920, max: 5}, 'treeStats (the page\'s own count) agrees');
  eq(META.openers[0], ['salet', 7920], 'SALET is the best of the openers the build compared');
  const op = Object.fromEntries(META.openers);
  // published totals for these openers under the same lists (Selby; Bertsimas & Paskov)
  for (const [w, t] of [['reast', 7923], ['crate', 7926], ['trace', 7926]]) eq(op[w], t, `${w.toUpperCase()} totals ${t}`);
  check(META.openers.every((o, i, a) => !i || a[i - 1][1] <= o[1]), 'openers are sorted best first');
  const kb = readFileSync(join(ROOT, 'data', 'wordle_helper', 'tree_salet.json')).length / 1024;
  check(kb < 60, `the tree file is small enough for a phone (${kb.toFixed(1)} KB)`);
}

if (suites.includes('human')) {
  section('human');
  const e = getEngine();
  eq(W.humanGuess([], ANSWERS.length), 'slant', 'opens SLANT');
  eq(W.humanGuess([row('slant', '...y.')], 30), 'price', 'mostly grey SLANT (three or more greys) is followed by PRICE');
  eq(W.humanGuess([row('slant', 'y.y..')], 30), 'price', 'three greys is still mostly grey');
  eq(W.humanGuess([row('slant', 'yy.y.')], 30), null, 'two greys: any word that fits');
  eq(W.humanGuess([row('slant', '....y'), row('price', '.....')], 30), null, 'after PRICE: any word that fits');
  // the expectation is exact: check it against playing every pick by hand on a small set
  const small = W.filter(ANSWERS, [row('salet', '..yy.'), row('lemon', 'yy...')]);
  const brute = words => words.length === 1 ? 1 : words.reduce((t, g) => {
    const by = {};
    for (const a of words) { const p = W.feedback(g, a); if (p !== 242) (by[p] = by[p] || []).push(a); }
    return t + words.length + Object.values(by).reduce((s, w) => s + brute(w), 0);
  }, 0) / words.length;
  near(W.humanExpected(e, [row('salet', '..yy.'), row('lemon', 'yy...'), row('crony', '.....')], small), brute(small) / small.length, 1e-9,
    `random pick among ${small.length} fitting words: the page's expectation equals playing out every pick`);
  const t = Date.now(), avg = W.humanExpected(e, [], ANSWERS);
  console.log(`  human strategy: ${avg.toFixed(4)} guesses on average, optimal ${(7920 / 2315).toFixed(4)} (${Date.now() - t} ms)`);
  near(avg, 3.67, 0.01, 'SLANT / PRICE / any fitting word averages about 3.67 over all 2,315 answers');
  check(avg - 7920 / 2315 > 0.2, `that is ${(avg - 7920 / 2315).toFixed(3)} guesses a game slower than optimal`);
}

if (suites.includes('engine')) {
  section('engine');
  const e = getEngine();
  let bad = 0;
  for (let i = 0; i < 30000; i++) {
    const g = (i * 7919) % e.G, a = e.answers[(i * 104729) % e.answers.length];
    if (e.pat(g, a) !== W.feedback(GUESSES[g], GUESSES[a])) bad++;
  }
  eq(bad, 0, 'the worker\'s cached feedback agrees with feedback() on 30,000 pairs');
  const t0 = Date.now(); e.column(e.index['zymic']);
  console.log(`  one candidate's feedback column: ${Date.now() - t0} ms`);
  // every group SALET leaves, up to 40 words: the page's exact search finds what the optimal tree achieves
  const groups = {};
  for (const a of ANSWERS) { const p = W.feedback('salet', a); (groups[p] = groups[p] || []).push(a); }
  const all = Array.from({length: e.G}, (_, i) => i);
  let compared = 0, differ = [], t = Date.now();
  for (const [p, words] of Object.entries(groups)) {
    if (words.length < 3 || words.length > 40) continue;
    const s = new W.Search(e, {budget: 1e6, depth: 9});
    const v = s.solve(words.map(w => e.index[w]), all, Infinity, 1);
    const want = W.treeStats(META.tree[1][p], words).total;
    compared++;
    if (v !== want) differ.push(`${show(+p)}: ${v} vs ${want}`);
  }
  eq(differ, [], `exact search equals the optimal tree on ${compared} SALET groups of 3-40 words (${Date.now() - t} ms)`);
  // a deeper case: the top five from the search include the tree's own move with the same total
  const rows = [row('salet', '.y...')];
  const S = W.filter(ANSWERS, rows).map(w => e.index[w]);
  const s = new W.Search(e, {budget: 1e6, depth: 9});
  const top = s.top(S, all, 5), tg = W.treeWalk(META.tree, rows);
  eq(top[0].total, W.treeStats(tg, W.filter(ANSWERS, rows)).total, `top move after SALET .y... (${S.length} words) costs what the tree's ${W.nodeGuess(tg).toUpperCase()} does`);
  check(top.every((x, i) => !i || top[i - 1].total <= x.total), 'top five are in order');
  // the estimate never claims less than the lower bound
  check([3, 5, 10, 50, 200, 2315].every(k => e.est(k) >= 2 * k - 1), 'estimates respect the 2n - 1 bound');
}

if (suites.includes('analyse')) {
  section('analyse');
  const e = getEngine();
  const rows = [row('salet', '..yy.'), row('lemon', 'yy...'), row('field', '..yg.')];
  const r = W.analyse(e, META, rows, {});
  eq(r.candidates, ['bugle', 'cycle'], 'regression: BUGLE and CYCLE left');
  check(['bugle', 'cycle'].includes(r.suggestions[0].word), `and a candidate is suggested (${r.suggestions[0].word.toUpperCase()})`);
  near(r.suggestions[0].expected, 1.5, 1e-9, 'with 1.5 guesses expected');
  eq(r.suggestions[0].chance, 0.5, 'and a 1 in 2 chance of being the answer');
  // the empty board: the build's exact opener totals
  const r0 = W.analyse(e, META, [], {});
  eq(r0.suggestions.map(s => s.word), META.openers.slice(0, 5).map(o => o[0]), 'empty board: the five best openers the build solved');
  near(r0.suggestions[0].expected, 7920 / 2315, 1e-9, 'SALET at 3.421');
  const r0h = W.analyse(e, META, [], {hard: true});
  check(r0h.source === 'bound' && r0h.suggestions.every(s => s.bound && !s.exact), 'in Hard Mode the same figures are shown as lower bounds, not as exact');
  // on the tree path the tree's guess comes first, with its exact cost
  const rs = [row('salet', '.....')];
  const r1 = W.analyse(e, META, rs, {});
  const node = W.treeWalk(META.tree, rs);
  eq(r1.source, 'tree', 'after SALET the tree is followed');
  eq(r1.suggestions[0].word, W.nodeGuess(node), `its guess (${W.nodeGuess(node).toUpperCase()}) first`);
  near(r1.suggestions[0].expected, W.treeStats(node, r1.candidates).total / r1.candidates.length, 1e-9, 'with the tree\'s exact average');
  eq(r1.suggestions.length, 5, 'five suggestions');
  check(r1.explanation.startsWith(r1.candidates.length.toLocaleString('en-US') + ' words left.'), 'the explanation leads with the count', r1.explanation);
  check(r1.explanation.includes(`${r1.suggestions[0].groups} groups`), 'and names the number of groups', r1.explanation);
  console.log('  e.g. ' + r1.explanation);
  // off the tree: another opener, solved live
  const rc = [row('crane', '..y.g')];
  const r2 = W.analyse(e, META, rc, {});
  check(r2.source === 'exact' || r2.candidates.length > 100, `off the tree (${r2.candidates.length} words): ${r2.source}`);
  check(r2.suggestions.every(s => s.expected >= 1), 'expected guesses are at least one');
  console.log('  e.g. ' + r2.explanation);
  // information word beats going for the answer
  const many = [row('crane', '.....')];
  const r3 = W.analyse(e, META, many, {});
  check(!r3.suggestions[0].inS && /cannot be the answer, but it beats going for one/.test(r3.explanation), 'says when an information word beats guessing a candidate', r3.explanation);
  const beat = r3.explanation.match(/needs (?:about )?(\d+\.\d+) guesses on average, \w+ (?:about )?(\d+\.\d+)/);
  check(beat && +beat[1] > +beat[2], 'and only when it really is faster', r3.explanation);
  console.log('  e.g. ' + r3.explanation);
  // Hard Mode: every suggestion is playable
  const rh = [row('crane', '.g..g')];
  const r4 = W.analyse(e, META, rh, {hard: true});
  eq(r4.suggestions.filter(s => W.hardCheck(s.word, rh)).map(s => s.word), [], `Hard Mode: all ${r4.suggestions.length} suggestions reuse every revealed letter`);
  check(r4.source !== 'tree', 'and Hard Mode never claims the normal-mode tree');
  // an answer outside the original list (here SALET itself, an accepted guess but never an answer)
  const ro = ['crane', 'stale', 'tales'].map(g => ({guess: g, pattern: W.feedback(g, 'salet')}));
  const r5 = W.analyse(e, META, ro, {});
  check(r5.outside && r5.candidates.includes('salet'), `no original answer fits, so accepted guesses are used (${r5.candidates.join(', ')})`);
  const bad = W.analyse(e, META, [row('crane', 'ggggy')], {});
  eq(bad.candidates, [], 'impossible colours leave nothing, and say so');
  check(/Check the colours/.test(bad.explanation), 'with a hint to check them');
  const won = W.analyse(e, META, [row('salet', '.....'), row('round', 'ggggg')], {});
  eq([won.solved, won.explanation], [true, 'Solved in 2.'], 'five greens is solved');
  const hu = W.analyse(e, META, [row('slant', '.....')], {human: true});
  eq(hu.human.word, 'price', 'the human strategy is reported alongside');
  check(hu.human.expected > hu.suggestions[0].expected, `and is slower from here (${hu.human.expected.toFixed(2)} vs ${hu.suggestions[0].expected.toFixed(2)})`);
}

if (suites.includes('page')) {
  section('page');
  let chromium;
  try { ({chromium} = await import('playwright')); } catch {
    try { ({chromium} = await import('/opt/node22/lib/node_modules/playwright/index.mjs')); } catch { console.log('  skipped: playwright is not installed'); }
  }
  const base = 'http://localhost:8099';
  let up = false;
  if (chromium) try { up = (await fetch(base + '/tools/wordle_helper.html')).ok; } catch {}
  if (chromium && !up) console.log('  skipped: start `npx http-server -p 8099` first');
  if (chromium && up) {
    let browser;
    try { browser = await chromium.launch(); } catch { browser = await chromium.launch({executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium'}); }
    const pg = await (await browser.newContext({viewport: {width: 390, height: 844}, hasTouch: true, isMobile: true})).newPage();
    const errors = [];
    pg.on('pageerror', err => errors.push(String(err)));
    await pg.goto(base + '/tools/wordle_helper.html');
    await pg.waitForSelector('#suggestions .sugg');
    eq(await pg.$$eval('#suggestions .sugg .word', els => els.map(e => e.firstChild.textContent.trim().toLowerCase())).then(a => a[0]), 'salet', 'opens with SALET suggested');
    for (const ch of 'salet') await pg.keyboard.press(ch);
    const tiles = await pg.$$('#grid .row:first-child .tile');
    await tiles[2].tap(); await tiles[3].tap();
    await pg.keyboard.press('Enter');
    await pg.waitForFunction(() => /words? left/.test(document.querySelector('#explain').textContent));
    const count = await pg.textContent('#count');
    check(/^\s*\d+/.test(count), `after SALET (L, E yellow) a count is shown: ${count.trim()}`);
    await pg.tap('#suggestions .sugg:nth-child(1)');
    const filled = await pg.$$eval('#grid .row:nth-child(2) .tile', els => els.map(e => e.textContent.trim()).join(''));
    check(/^[A-Z]{5}$/.test(filled), `tapping a suggestion fills row 2 (${filled})`);
    // on-screen keyboard
    for (let i = 0; i < 5; i++) await pg.tap('#keyboard [data-key="back"]');
    for (const ch of 'lemon') await pg.tap(`#keyboard [data-key="${ch}"]`);
    const t2 = await pg.$$('#grid .row:nth-child(2) .tile');
    await t2[0].tap(); await t2[1].tap();
    await pg.tap('#keyboard [data-key="enter"]');
    await pg.waitForFunction(() => /words? left/.test(document.querySelector('#explain').textContent) && !document.body.classList.contains('busy'));
    await pg.reload();
    await pg.waitForSelector('#suggestions .sugg');
    const kept = await pg.$$eval('#grid .row:nth-child(2) .tile', els => els.map(e => e.textContent.trim()).join(''));
    eq(kept, 'LEMON', 'the board survives a reload');
    const marks = await pg.$$eval('#grid .tile.y, #grid .tile.g', els => els.every(e => getComputedStyle(e, '::after').content !== 'none'));
    check(marks, 'yellow and green tiles carry a mark, not just a colour');
    await pg.tap('#newGame');
    eq(await pg.$$eval('#grid .tile', els => els.filter(e => e.textContent.trim()).length), 0, 'New game clears the board');
    await pg.tap('#modeHard');
    for (const ch of 'salet') await pg.keyboard.press(ch);
    const h = await pg.$$('#grid .row:first-child .tile');
    await h[2].tap();
    await pg.keyboard.press('Enter');
    for (const ch of 'mound') await pg.keyboard.press(ch);
    await pg.keyboard.press('Enter');
    eq((await pg.textContent('#status')).trim(), 'Guess must contain L', 'Hard Mode refuses a guess that drops a revealed letter, with the NYT message');
    for (let i = 0; i < 5; i++) await pg.keyboard.press('Backspace');
    await pg.waitForFunction(() => document.querySelector('#quick button') && !document.body.classList.contains('busy'));
    const quick = (await pg.$eval('#quick button', b => b.firstChild.textContent)).toLowerCase();
    await pg.tap('#quick button');
    eq((await pg.$$eval('#grid .row:nth-child(2) .tile', els => els.map(e => e.textContent).join(''))).toLowerCase(), quick, `the Best next chip under the grid fills the row (${quick.toUpperCase()})`);
    // Enter after clicking a button submits the row instead of pressing the button again
    for (const sel of ['#newGame', '#suggestions .sugg', '#modeNormal']) {
      await pg.tap('#newGame'); await pg.tap(sel);
      for (let i = 0; i < 5; i++) await pg.keyboard.press('Backspace');
      for (const ch of 'slate') await pg.keyboard.press(ch);
      await pg.keyboard.press('Enter');
      const done = await pg.evaluate(() => JSON.parse(localStorage.getItem('wordleHelper.v1')).rows.map(r => r.w + (r.done ? '+' : '')).join(' ').trim());
      eq(done, 'slate+', `all-grey SLATE goes in with Enter after clicking ${sel}`);
    }
    const scroll = await pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
    check(scroll, 'no sideways scrolling on a phone');
    eq(errors, [], 'no page errors');
    await browser.close();
  }
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
