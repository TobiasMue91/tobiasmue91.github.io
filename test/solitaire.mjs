#!/usr/bin/env node
// Test suite for games/solitaire.html (Patience).
//
// Runs the page's DOM-free <script id="core"> block in Node: the deal, the rules, the tap-to-move choice, the hint and
// the solver. The page promises things nobody can check from the page: every deal it hands out can be won, a card it
// refuses really has nowhere to go, and a hint is a step on a real way out. A wrong one looks exactly like a right one.
//
//   node test/solitaire.mjs                 # everything
//   node test/solitaire.mjs rules seeds     # named suites only
//   node test/solitaire.mjs --seeds=all     # re-solve every winnable deal the page lists (slow), not a sample
//   node test/solitaire.mjs --page=path.html
//   node test/solitaire.mjs --relist=3000  # solve seeds 0..2999 for both draw sizes and print the masks for the page
//
// Suites:
//   deal   - 28 cards in columns of one to seven with only the last face up, 24 in the stock, 52 distinct; same seed same deal
//   rules  - stacked positions: alternate colours one rank down, kings alone on empty columns, foundations by suit from
//            the ace, nothing from under a face-down card, draw one and draw three, recycling only an empty stock
//   play   - thousands of random games: every move offered is legal, apply never touches its input, all 52 cards
//            always somewhere, and a turned card is always the one that was under the move
//   tap    - a tap moves the card somewhere legal, and the page refuses a tap only when there is truly nowhere to go
//   seeds  - the winnable deals: the page's bit masks decode to the seeds, and the solver's way out of each sampled
//            deal, replayed move by move with the rules above, ends with all four suits home
//   hint   - every hint is legal, and a hint the page calls sure is the first step of a win
//   finish - a table with nothing hidden is always finished by sending the lowest card home, as the page does

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (n, d) => { const a = args.find(x => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const PAGE = opt('page', join(HERE, '..', 'games', 'solitaire.html'));
const ALL = ['deal', 'rules', 'play', 'tap', 'seeds', 'hint', 'finish'];
const picked = args.filter(a => !a.startsWith('--'));
const suites = picked.length ? picked : ALL;

let failures = 0, passes = 0;
const fail = (what, detail) => { failures++; console.log(`  FAIL  ${what}${detail ? '\n          ' + detail : ''}`); };
const pass = what => { passes++; if (process.env.VERBOSE) console.log(`  ok    ${what}`); };
const check = (ok, what, detail) => ok ? pass(what) : fail(what, detail);
const section = n => console.log(`\n=== ${n} ===`);

const HTML = readFileSync(PAGE, 'utf8');
const core = HTML.match(/<script id="core">([\s\S]*?)<\/script>/);
if (!core) { console.log('no <script id="core"> block in ' + PAGE); process.exit(1); }
const ctx = vm.createContext({Buffer});
vm.runInContext(core[1] + '\nthis.K = K;', ctx);
const K = ctx.K;
const J = x => JSON.parse(JSON.stringify(x));
const masks = {};
for (const m of HTML.matchAll(/(\d): K\.seedsFrom\('([A-Za-z0-9+/=]*)'\)/g)) masks[m[1]] = m[2];

// Cards by name: 'As', 'Th', 'Kd'. Rank first, suit second; suits in the core's order.
const R = 'A23456789TJQK', SU = 'shcd';
const card = n => R.indexOf(n[0]) + 13 * SU.indexOf(n[1]);
const cs = s => s ? s.split(' ').map(card) : [];
const nm = c => R[c % 13] + SU[c / 13 | 0];
const rnd = seed => { let a = seed >>> 0; return () => { a = a * 1664525 + 1013904223 >>> 0; return a / 4294967296; }; };

// A position built by hand. Columns are 'down|up'; foundations list suits that are home up to a rank.
function table({tab = [], stock = '', waste = '', found = {}, draw = 1}) {
  const s = {seed: 0, draw, stock: cs(stock), waste: cs(waste), found: [[], [], [], []], moves: 0, passes: 0,
    tab: [...Array(7)].map((_, i) => { const [d, u] = (tab[i] || '|').split('|'); return {down: cs(d.trim()), up: cs((u || '').trim())}; })};
  for (const [su, r] of Object.entries(found)) for (let k = 0; k < r; k++) s.found[SU.indexOf(su)].push(SU.indexOf(su) * 13 + k);
  return s;
}
function where(s) { // every card's place, and complaints if any card is missing or twice
  const seen = new Map();
  const put = (c, p) => { if (seen.has(c)) seen.set(c, 'twice'); else seen.set(c, p); };
  s.stock.forEach(c => put(c, 'stock')); s.waste.forEach(c => put(c, 'waste'));
  s.found.forEach((f, i) => f.forEach(c => put(c, 'f' + i)));
  s.tab.forEach((t, i) => { t.down.forEach(c => put(c, 'd' + i)); t.up.forEach(c => put(c, 'u' + i)); });
  return seen;
}
const whole = s => { const w = where(s); return w.size === 52 && [...w.values()].every(v => v !== 'twice'); };

if (opt('relist')) { // after a change to the deal or the solver, the page's lists of winnable deals must be made again
  const N = Math.ceil(+opt('relist') / 8) * 8;
  for (const draw of [1, 3]) {
    const bytes = new Uint8Array(N / 8);
    for (let s = 0; s < N; s++) if (K.solve(K.deal(s, draw), 200000)) bytes[s >> 3] |= 1 << (s & 7);
    console.log(`${draw}: K.seedsFrom('${Buffer.from(bytes).toString('base64')}')`);
  }
  process.exit(0);
}

if (suites.includes('deal')) {
  section('deal');
  for (let seed = 0; seed < 300; seed++) {
    const s = K.deal(seed, 1);
    const shape = s.tab.every((t, i) => t.down.length === i && t.up.length === 1);
    check(shape, `deal ${seed}: columns of one to seven, only the last card up`, JSON.stringify(s.tab.map(t => [t.down.length, t.up.length])));
    check(s.stock.length === 24 && !s.waste.length && s.found.every(f => !f.length), `deal ${seed}: 24 in the stock`);
    check(whole(s), `deal ${seed}: 52 distinct cards`);
    if (seed < 20) check(JSON.stringify(K.deal(seed, 1)) === JSON.stringify(s), `deal ${seed}: same seed, same deal`);
  }
  const a = K.deal(7, 1), b = K.deal(7, 3);
  check(JSON.stringify(a.tab) === JSON.stringify(b.tab) && a.draw === 1 && b.draw === 3, 'draw size changes nothing about the deal');
  check(JSON.stringify(K.deal(1, 1).tab) !== JSON.stringify(K.deal(2, 1).tab), 'different seeds, different deals');
}

if (suites.includes('rules')) {
  section('rules');
  const s = table({tab: ['|Kd', 'Qs|8h', '|', 'Th|Js', '9c|9h 8c', '|Qc', '2s|Ac'], waste: '7h', stock: '3d 4d 5d 6d', found: {d: 1}});
  const L = m => K.legal(s, m);
  check(L({from: 't', i: 5, n: 1, to: 't', j: 0}), 'black queen on a red king');
  check(!L({from: 't', i: 3, n: 1, to: 't', j: 5}), 'no jack of spades on the black queen');
  check(L({from: 't', i: 0, n: 1, to: 't', j: 2}), 'a king may go to an empty column');
  check(!L({from: 't', i: 5, n: 1, to: 't', j: 2}), 'a queen may not');
  check(L({from: 'w', to: 't', j: 4}), 'red seven from the waste onto a black eight');
  check(!L({from: 'w', to: 'f'}), 'a seven of hearts is not ready for home');
  check(L({from: 't', i: 6, n: 1, to: 'f'}), 'an ace goes home');
  check(!L({from: 't', i: 4, n: 2, to: 't', j: 4}), 'nothing moves onto its own column');
  check(!L({from: 't', i: 4, n: 3, to: 't', j: 0}), 'no picking up a face-down card');
  check(!L({from: 't', i: 4, n: 2, to: 'f'}), 'two cards never go home at once');
  check(!L({from: 'f', i: 3, to: 't', j: 1}), 'the ace of diamonds may not come down onto an eight');
  check(!L({t: 'recycle'}), 'no recycling while the stock has cards');
  const r = K.apply(s, {from: 't', i: 6, n: 1, to: 'f'});
  check(r.flipped === card('2s') && r.s.tab[6].up[0] === card('2s') && !r.s.tab[6].down.length, 'the card under a move turns face up');
  check(s.tab[6].up.length === 1 && s.found[2].length === 0, 'apply leaves the old position alone');
  check(!K.legal(s, {from: 't', i: 4, n: 2, to: 't', j: 3}), '9h-8c may not go on the jack of spades');
  const d1 = K.apply(s, {t: 'draw'}).s;
  check(d1.waste.map(nm).join(' ') === '7h 6d' && d1.stock.length === 3, 'draw one turns one card');
  const s3 = {...J(s), draw: 3};
  const d3 = K.apply(s3, {t: 'draw'}).s;
  check(d3.waste.map(nm).join(' ') === '7h 6d 5d 4d' && d3.stock.map(nm).join(' ') === '3d', 'draw three turns three, the last on top');
  const d3b = K.apply(d3, {t: 'draw'}).s;
  check(d3b.waste.length === 5 && !d3b.stock.length, 'draw three turns what is left when fewer than three remain');
  check(K.legal(d3b, {t: 'recycle'}) && !K.legal(d3b, {t: 'draw'}), 'an empty stock may be turned over, not drawn from');
  const rc = K.apply(d3b, {t: 'recycle'}).s;
  check(rc.stock.map(nm).join(' ') === '3d 4d 5d 6d 7h' && !rc.waste.length && rc.passes === 1, 'recycling turns the waste back into the stock in its old order');
  check(K.apply(rc, {t: 'draw'}).s.waste.map(nm).join(' ') === '7h 6d 5d', 'and the next draw turns the same cards as the first time');
  const sf = table({tab: ['|Ks Qh Jc Td 9s'], found: {s: 8, h: 8, c: 10, d: 9}});
  check(K.safeHome(sf, card('9s')) && !K.safeHome(table({found: {s: 8, h: 6, d: 9}}), card('9s')), 'a nine is safe home only once both red eights are');
}

if (suites.includes('play')) {
  section('play');
  let bad = 0, n = 0, flips = 0;
  const GAMES = 600;
  for (let g = 0; g < GAMES && bad < 5; g++) {
    const r = rnd(g + 1); let s = K.deal(g, g % 2 ? 3 : 1);
    for (let step = 0; step < 400; step++) {
      const ms = K.allMoves(s); if (!ms.length) break;
      const m = ms[r() * ms.length | 0];
      if (!K.legal(s, m)) { bad++; fail(`game ${g}: offered move is not legal`, JSON.stringify(m)); break; }
      const before = JSON.stringify(s), res = K.apply(s, m);
      if (JSON.stringify(s) !== before) { bad++; fail(`game ${g}: apply changed its input`); break; }
      if (!whole(res.s)) { bad++; fail(`game ${g}: a card went missing or doubled`, JSON.stringify(m)); break; }
      if (res.flipped != null) { flips++;
        const col = s.tab[m.i]; if (m.from !== 't' || K.top(col.down) !== res.flipped || m.n !== col.up.length) { bad++; fail(`game ${g}: the wrong card turned over`); break; } }
      if (res.s.moves !== s.moves + 1) { bad++; fail(`game ${g}: moves did not count up`); break; }
      s = res.s; n++;
    }
  }
  check(!bad, `${GAMES} random games, ${n} moves, ${flips} cards turned: every move legal, every card accounted for`);
}

if (suites.includes('tap')) {
  section('tap');
  let bad = 0, taps = 0;
  for (let g = 0; g < 300 && bad < 5; g++) {
    const r = rnd(g + 99); let s = K.deal(g, 1);
    for (let step = 0; step < 150; step++) {
      // every pick-up the page allows: waste top, foundation tops, any face-up card in a column
      const picks = [];
      if (s.waste.length) picks.push({from: 'w', n: 1});
      s.found.forEach((f, i) => f.length && picks.push({from: 'f', i, n: 1}));
      s.tab.forEach((t, i) => t.up.forEach((_, k) => picks.push({from: 't', i, n: t.up.length - k})));
      for (const p of picks) {
        taps++;
        const m = K.tapTarget(s, p.from, p.i, p.n);
        const anywhere = [...Array(7)].some((_, j) => K.legal(s, {...p, to: 't', j})) || K.legal(s, {...p, to: 'f'});
        if (m && !K.legal(s, m)) { bad++; fail(`game ${g}: tap target is illegal`, JSON.stringify(m)); }
        if (!m && anywhere) { bad++; fail(`game ${g}: tap refused though the card could go somewhere`, JSON.stringify(p)); }
        if (m && m.to === 't' && p.from !== 'f' && (p.from === 'w' || p.n === 1) && K.legal(s, {...p, to: 'f'})) { bad++; fail(`game ${g}: tap skipped home`); }
      }
      const ms = K.allMoves(s); if (!ms.length) break;
      s = K.apply(s, ms[r() * ms.length | 0]).s;
    }
  }
  check(!bad, `${taps} taps: each lands somewhere legal, home first, and none is refused while a place exists`);
  const s = table({tab: ['|Kd', '|', '|Kh'], found: {}});
  check(!K.tapTarget(s, 't', 0, 1) || K.tapTarget(s, 't', 0, 1).j === 1, 'a king alone in a column may hop to an empty one only if nothing better');
}

if (suites.includes('seeds')) {
  section('seeds');
  const every = opt('seeds', '') === 'all';
  for (const draw of ['1', '3']) {
    if (!masks[draw]) { fail(`no seed mask for draw ${draw} in the page`); continue; }
    const seeds = K.seedsFrom(masks[draw]);
    check(seeds.length >= 1000, `draw ${draw}: ${seeds.length} winnable deals listed`);
    check(seeds.every((x, k) => k === 0 || x > seeds[k - 1]), `draw ${draw}: seeds decode in order, no repeats`);
    const sample = every ? seeds : seeds.filter((_, k) => k % 40 === 0);
    let bad = 0, t0 = Date.now();
    for (const seed of sample) {
      const sol = K.solve(K.deal(seed, +draw), 200000);
      if (!sol) { bad++; fail(`draw ${draw}: listed deal ${seed} not solved`); continue; }
      let s = K.deal(seed, +draw), ok = true;
      for (const m of sol) { if (!K.legal(s, m)) { ok = false; break; } s = K.apply(s, m).s; }
      if (!ok || !K.won(s)) { bad++; fail(`draw ${draw}: the way out of deal ${seed} does not replay to a win`); }
    }
    check(!bad, `draw ${draw}: ${sample.length} listed deals solved and replayed to a win (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  }
}

if (suites.includes('hint')) {
  section('hint');
  let bad = 0, sure = 0, n = 0;
  for (let g = 0; g < 20 && bad < 5; g++) {
    const r = rnd(g + 7); let s = K.deal(g, g % 3 ? 1 : 3);
    for (let step = 0; step < 40; step++) {
      const h = K.hint(s, 20000); n++;
      if (h) {
        if (!K.legal(s, h.m)) { bad++; fail(`game ${g}: hint is illegal`, JSON.stringify(h.m)); break; }
        if (h.sure) { sure++;
          const sol = K.solve(K.apply(s, h.m).s, 200000);
          if (!sol) { bad++; fail(`game ${g}: a sure hint led nowhere`, JSON.stringify(h.m)); } }
      } else if (K.allMoves(s).length) { bad++; fail(`game ${g}: no hint though moves exist`); }
      const ms = K.allMoves(s); if (!ms.length) break;
      s = K.apply(s, ms[r() * ms.length | 0]).s;
    }
  }
  check(!bad, `${n} hints legal; ${sure} were sure and each led on to a win`);
}

if (suites.includes('finish')) {
  section('finish');
  let bad = 0;
  for (let g = 0; g < 300; g++) {
    // deal every card not yet home into columns of alternating colours, the way a finished game looks
    const r = rnd(g + 3), home = [0, 1, 2, 3].map(() => r() * 13 | 0);
    const s = table({});
    s.found = home.map((h, su) => [...Array(h)].map((_, k) => su * 13 + k));
    const left = []; home.forEach((h, su) => { for (let k = h; k < 13; k++) left.push(su * 13 + k); });
    left.sort((a, b) => (b % 13) - (a % 13) || r() - .5);
    for (const c of left) { // highest first: onto a column it fits, else an empty one, else the fullest legal tail
      const fit = s.tab.find(t => t.up.length && K.fits(c, t)) || s.tab.find(t => !t.up.length);
      if (fit) fit.up.push(c); else s.waste.push(c);
    }
    if (s.waste.length) continue;
    if (!K.settled(s)) continue;
    let st = s, guard = 0;
    while (!K.won(st) && guard++ < 60) {
      let best = null;
      st.tab.forEach((t, i) => { const c = K.top(t.up); if (c != null && K.fitsFound(c, st) && (!best || c % 13 < best.c % 13)) best = {from: 't', i, n: 1, to: 'f', c}; });
      if (!best) break;
      st = K.apply(st, best).s;
    }
    if (!K.won(st)) { bad++; fail(`table ${g}: sending the lowest card home stalled`); }
  }
  check(!bad, 'a table with nothing hidden always finishes itself');
}

console.log(`\n${failures ? 'FAILED' : 'passed'}: ${passes} checks passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
