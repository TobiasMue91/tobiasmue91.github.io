#!/usr/bin/env node
// Test suite for games/freecell.html.
//
// Runs the page's DOM-free <script id="core"> block in Node: the numbered deals, the rules, the tap choice, the safe
// auto-play and the solver behind the hint. The page promises things nobody can check by looking: deal No. 1 is the
// deal everyone knows, a run is carried only as far as the free cells and empty columns allow, a card is sent home
// by itself only when no card could still need it, and a hint is a step on a real way out.
//
//   node test/freecell.mjs                 # everything
//   node test/freecell.mjs rules play      # named suites only
//   node test/freecell.mjs --page=path.html
//
// Suites:
//   deal   - Microsoft deal No. 1 card for card, 52 distinct cards in 4 columns of 7 and 4 of 6, same number
//            same deal, the daily number is valid, stable and never the unwinnable 11982
//   rules  - carrying capacity against a recursive reference, stacked positions for every kind of move, foundations by
//            suit from the ace, an empty column never offered to its own whole column
//   play   - thousands of random moves: every move offered applies and every refused one is illegal by a plain reference,
//            apply never touches its input, all 52 cards always somewhere
//   auto   - a card is sent home on its own only when it is safe, and the chain never gets stuck or sends one too early
//   tap    - a tap refuses only when the card truly has nowhere to go, and never offers an illegal move
//   solve  - the solver wins sampled deals, every step replayed with the rules above; a hint from mid-game is legal

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (n, d) => { const a = args.find(x => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const PAGE = opt('page', join(HERE, '..', 'games', 'freecell.html'));
const ALL = ['deal', 'rules', 'play', 'auto', 'tap', 'solve'];
const picked = args.filter(a => !a.startsWith('--'));
const suites = picked.length ? picked : ALL;

let failures = 0, passes = 0;
const fail = (what, detail) => { failures++; console.log(`  FAIL  ${what}${detail ? '\n          ' + detail : ''}`); };
const check = (ok, what, detail) => { if (ok) passes++; else fail(what, detail); };
const section = n => console.log(`\n=== ${n} ===`);

const core = readFileSync(PAGE, 'utf8').match(/<script id="core">([\s\S]*?)<\/script>/);
if (!core) { console.log('no <script id="core"> block in ' + PAGE); process.exit(1); }
const ctx = vm.createContext({});
vm.runInContext(core[1] + '\nthis.FC = FC;', ctx);
const FC = ctx.FC;
const J = x => JSON.parse(JSON.stringify(x));
const rnd = seed => { let a = seed >>> 0; return () => { a = Math.imul(a, 1664525) + 1013904223 >>> 0; return a / 4294967296; }; };
const cname = c => FC.name(c);
const parse = s => s.trim() ? s.trim().split(/\s+/).map(n => 'A23456789TJQK'.indexOf(n[0]) * 4 + 'CDHS'.indexOf(n[1])) : [];
// A position by hand: columns as strings, cells as a string, foundations as counts per suit C D H S.
const table = ({cols = [], cells = '', found = [0, 0, 0, 0]}) => {
  const cs = parse(cells); while (cs.length < 4) cs.push(-1);
  return {cells: cs, found: found.slice(), cols: [...Array(8)].map((_, i) => parse(cols[i] || ''))};
};
const dump = s => s.cols.map(c => c.map(cname).join(' ')).join(' / ') + ' | ' + s.cells.map(c => c < 0 ? '-' : cname(c)).join(' ');
function conserved(s) {
  const seen = new Set();
  s.cells.forEach(c => c >= 0 && seen.add(c));
  s.cols.forEach(col => col.forEach(c => seen.add(c)));
  s.found.forEach((n, su) => { for (let r = 0; r < n; r++) seen.add(r * 4 + su); });
  return seen.size === 52 && s.cells.filter(c => c >= 0).length + s.cols.reduce((a, c) => a + c.length, 0) + s.found.reduce((a, b) => a + b, 0) === 52;
}

// Plain references, written the other way round.
const redRef = c => 'DH'.includes(cname(c)[1]);
const stackRef = (below, c) => (below >> 2) === (c >> 2) + 1 && redRef(below) !== redRef(c);
const carryRef = (f, e) => e === 0 ? f + 1 : 2 * carryRef(f, e - 1);        // move half to an empty column, half to the target, half back
function legalRef(s, m) {                                                    // the whole rulebook for one move
  const n = m.n || 1;
  let cards;
  if (m.from.t === 'cell') { if (n !== 1 || s.cells[m.from.i] < 0) return false; cards = [s.cells[m.from.i]]; }
  else { const col = s.cols[m.from.i]; if (n > col.length || n < 1) return false; cards = col.slice(col.length - n); }
  for (let k = 1; k < cards.length; k++) if (!stackRef(cards[k - 1], cards[k])) return false;
  const f = s.cells.filter(c => c < 0).length, e = s.cols.filter(c => !c.length).length;
  if (m.to.t === 'found') return n === 1 && s.found[cards[0] & 3] === cards[0] >> 2 && m.to.i === (cards[0] & 3);
  if (m.to.t === 'cell') return n === 1 && m.from.t === 'col' && s.cells[m.to.i] < 0;
  if (m.from.t === 'col' && m.from.i === m.to.i) return false;
  const dst = s.cols[m.to.i]; if (!dst) return false;
  if (dst.length) return stackRef(dst[dst.length - 1], cards[0]) && n <= carryRef(f, e);
  return n <= carryRef(f, e - 1);
}

function randomGame(seed, steps) {      // a random walk of legal moves from deal `seed`
  const R = rnd(seed); let s = FC.deal(seed); const states = [s];
  for (let i = 0; i < steps; i++) {
    const ms = FC.moves(s); if (!ms.length) break;
    s = FC.autoChain(FC.apply(s, ms[Math.floor(R() * ms.length)])).state; states.push(s);
  }
  return states;
}

if (suites.includes('deal')) {
  section('deal');
  // Microsoft deal No. 1 as published, column by column (columns 0-7 across, dealt top to bottom).
  const rows = ['JD 2D 9H JC 5D 7H 7C 5H', 'KD KC 9S 5S AD QC KH 3H', '2S KS 9D QD JS AS AH 3C', '4C 5C TS QH 4H AC 4D 7S', '3S TD 4S TH 8H 2C JH 7D', '6D 8S 8D QS 6C 3D 8C TC', '6S 9C 2H 6H'];
  rows.forEach((row, r) => check(FC.deal(1).cols.map(c => c[r]).filter(c => c !== undefined).map(cname).join(' ') === row, `deal No. 1, row ${r + 1} as published`));
  for (const n of [1, 2, 617, 11982, 20000, 32000]) {
    const s = FC.deal(n);
    check(conserved(s) && s.cols.map(c => c.length).join('') === '77776666', `No. ${n}: 52 distinct cards in four columns of 7 and four of 6`);
    check(JSON.stringify(FC.deal(n)) === JSON.stringify(s), `No. ${n}: the same number deals the same cards`);
  }
  check(JSON.stringify(FC.deal(1)) !== JSON.stringify(FC.deal(2)), 'different numbers deal differently');
  let bad = 0; const seen = new Set();
  for (let y = 2026; y < 2036; y++) for (let m = 1; m <= 12; m++) for (let d = 1; d <= 28; d++) {
    const n = FC.dailyNumber(y, m, d); seen.add(n);
    if (!FC.validDeal(n) || n === 11982 || n !== FC.dailyNumber(y, m, d)) bad++;
  }
  check(bad === 0, 'every daily number in ten years is valid, stable and never the unwinnable one', bad + ' bad');
  check(seen.size > 3000, 'daily numbers rarely repeat', seen.size + ' distinct of 3360');
  check(!FC.validDeal(11982) && !FC.validDeal(0) && !FC.validDeal(32001) && FC.validDeal(1) && FC.validDeal(32000), 'validDeal refuses 0, 11982 and 32001');
}

if (suites.includes('rules')) {
  section('rules');
  for (let f = 0; f <= 4; f++) for (let e = 0; e <= 3; e++) {     // (free cells + 1) * 2^(empty columns not counting the target)
    const cells = ['AS', '2S', '3S', '4S'].slice(0, 4 - f).join(' ');
    const cols = []; for (let i = 0; i < 8 - e; i++) cols.push('KC');
    const s = table({cells, cols});
    check(FC.capacity(s, false) === carryRef(f, e), `carry with ${f} free cells and ${e} empty columns`, FC.capacity(s, false) + ' vs ' + carryRef(f, e));
    if (e) check(FC.capacity(s, true) === carryRef(f, e - 1), `carry to one of ${e} empty columns with ${f} free cells`);
  }
  const mv = (s, fi, n, ti, tt = 'col') => FC.apply(s, {from: {t: 'col', i: fi}, n, to: {t: tt, i: ti}});
  // run 9S 8H 7C onto TD: needs two free cells for three cards
  const base = c => table({cols: ['9S 8H 7C', 'TD', 'KS', 'KD', 'KC', 'KH', 'QS', 'QC'], cells: c});
  check(mv(base('3D 3H'), 0, 3, 1) !== null, 'three cards move with two free cells');
  check(mv(base('3D 3H 4D'), 0, 3, 1) === null, 'three cards do not move with one free cell');
  check(mv(base('3D 3H 4D'), 0, 2, 1) === null, 'a wrong run (7C onto TD) is refused: 8H does not stack on TD');
  check(mv(table({cols: ['8H 7C', 'TD 9S', 'KS', 'KD', 'KC', 'KH', 'QS', 'QC'], cells: '3D 3H 4D'}), 0, 2, 1) !== null, 'two cards move with one free cell');
  // empty columns double the reach
  const withEmpty = table({cols: ['9S 8H 7C 6D', 'TD'], cells: '3D 3H 4D'});          // 1 cell, 6 empty columns
  check(mv(withEmpty, 0, 4, 1) !== null, 'four cards move with one cell and empty columns');
  check(mv(table({cols: ['9S 8H 7C', 'TD', 'KS', 'KD', 'KC', 'KH', 'QS', 'QC'], cells: '3D 3H 4D'}), 0, 3, 7) === null, 'nothing stacks on a queen of the wrong colour');
  // order and colour
  check(mv(table({cols: ['7C', '8S']}), 0, 1, 1) === null, 'black on black is refused');
  check(mv(table({cols: ['7D', '8H']}), 0, 1, 1) === null, 'red on red is refused');
  check(mv(table({cols: ['7D', '8S']}), 0, 1, 1) !== null, 'red on black, one rank down, is allowed');
  check(mv(table({cols: ['6D', '8S']}), 0, 1, 1) === null, 'two ranks down is refused');
  check(mv(table({cols: ['8S', '7D']}), 0, 1, 1) === null, 'a bigger card never goes on a smaller one');
  // empty columns: any card goes, but a whole column to an empty column is refused as pointless
  const onlyOne = table({cols: ['KS', '', 'QD']});
  check(mv(onlyOne, 0, 1, 1) === null || !FC.moves(onlyOne).some(m => m.from.i === 0 && m.n === 1 && m.to.t === 'col' && m.to.i === 1), 'a lone king is not offered an empty column');
  check(mv(table({cols: ['5C 9S', '']}), 0, 1, 1) !== null, 'a card goes to an empty column');
  check(mv(table({cols: ['5C 9S', '']}), 0, 1, 0) === null, 'a card does not move onto its own column');
  // foundations
  const f1 = table({cols: ['2C', 'AC', 'AD']});
  check(FC.apply(f1, {from: {t: 'col', i: 0}, n: 1, to: {t: 'found', i: 0}}) === null, 'a two cannot go home before its ace');
  check(FC.apply(f1, {from: {t: 'col', i: 1}, n: 1, to: {t: 'found', i: 0}}) !== null, 'an ace goes home');
  check(FC.apply(f1, {from: {t: 'col', i: 2}, n: 1, to: {t: 'found', i: 0}}) === null, 'a card goes only to its own suit');
  check(FC.apply(table({cols: ['2C 3C'], found: [1, 0, 0, 0]}), {from: {t: 'col', i: 0}, n: 1, to: {t: 'found', i: 0}}) === null, 'a three does not go home on an ace');
  // cells
  const full = table({cols: ['5C'], cells: '3D 3H 4D 4H'});
  check(FC.apply(full, {from: {t: 'col', i: 0}, n: 1, to: {t: 'cell', i: 0}}) === null, 'four cells hold four cards');
  check(FC.apply(table({cols: ['5C 6D']}), {from: {t: 'col', i: 0}, n: 2, to: {t: 'cell', i: 0}}) === null, 'a cell holds one card, not a run');
  check(FC.won(table({found: [13, 13, 13, 13]})) && !FC.won(table({found: [13, 13, 13, 12]})), 'the game is won with 52 cards home');
}

if (suites.includes('play')) {
  section('play');
  let offered = 0, refused = 0, wrong = 0, mutated = 0, lost = 0, games = 0;
  for (let seed = 1; seed <= 120; seed++) {
    const R = rnd(seed * 7); let s = FC.deal(seed * 263 % 32000 + 1); games++;
    for (let step = 0; step < 90; step++) {
      const before = JSON.stringify(s), ms = FC.moves(s);
      for (const m of ms) { offered++; if (!legalRef(s, m) || !FC.apply(s, m)) wrong++; }
      // every move the reference allows over a grid of sources and targets must be one the core accepts, and vice versa
      for (let fi = 0; fi < 8; fi++) for (const n of [1, 2, 3, 4, 6]) for (let ti = 0; ti < 8; ti++) {
        const m = {from: {t: 'col', i: fi}, n, to: {t: 'col', i: ti}};
        const a = !!FC.apply(s, m), b = legalRef(s, m); if (a !== b) { wrong++; refused++; }
      }
      for (let fi = 0; fi < 4; fi++) for (let ti = 0; ti < 8; ti++) { const m = {from: {t: 'cell', i: fi}, n: 1, to: {t: 'col', i: ti}}; if (!!FC.apply(s, m) !== legalRef(s, m)) wrong++; }
      if (JSON.stringify(s) !== before) mutated++;
      if (!ms.length) break;
      s = FC.autoChain(FC.apply(s, ms[Math.floor(R() * ms.length)])).state;
      if (!conserved(s)) lost++;
    }
  }
  check(wrong === 0, `${games} random games: the core and the plain rulebook agree on every move`, wrong + ' disagreements in ' + offered + ' moves');
  check(mutated === 0, 'apply and moves never change the position they are given', mutated + '');
  check(lost === 0, 'all 52 cards are always somewhere, once', lost + ' positions');
}

if (suites.includes('auto')) {
  section('auto');
  const safeRef = (s, c) => {                      // plain version: nothing left on the table could still need this card
    if (s.found[c & 3] !== c >> 2) return false;
    const r = (c >> 2) + 1; if (r <= 2) return true;
    const opp = redRef(c) ? [0, 3] : [1, 2];
    return opp.every(su => s.found[su] >= r - 1);
  };
  let bad = 0, unsafe = 0, missed = 0, chains = 0;
  for (let seed = 1; seed <= 60; seed++) for (const s of randomGame(seed * 31, 70)) {
    const a = FC.autoChain(s); chains += a.chain.length ? 1 : 0;
    let cur = s;
    for (const m of a.chain) {
      const c = m.from.t === 'cell' ? cur.cells[m.from.i] : cur.cols[m.from.i].at(-1);
      if (!safeRef(cur, c)) unsafe++;
      cur = FC.apply(cur, m); if (!cur) { bad++; break; }
    }
    if (!cur) continue;
    for (const c of [...cur.cells, ...cur.cols.map(x => x.at(-1))]) if (c >= 0 && c !== undefined && safeRef(cur, c)) missed++;
    if (!conserved(a.state)) bad++;
  }
  check(unsafe === 0, 'a card is sent home by itself only when it is safe', unsafe + '');
  check(missed === 0, 'the chain never stops while a safe card is on top or in a cell', missed + '');
  check(bad === 0, 'every automatic move is legal and keeps all 52 cards', bad + '');
  check(chains > 20, 'the chains are actually exercised', chains + '');
}

if (suites.includes('tap')) {
  section('tap');
  let refusedWithMove = 0, illegal = 0, goes = 0, chooses = 0, nones = 0;
  for (let seed = 1; seed <= 50; seed++) for (const s of randomGame(seed * 17, 60)) {
    const ms = FC.moves(s);
    const srcs = [];
    s.cols.forEach((col, i) => { for (let k = 0; k < col.length; k++) srcs.push({t: 'col', i, k}); });
    s.cells.forEach((c, i) => { if (c >= 0) srcs.push({t: 'cell', i}); });
    for (const src of srcs) {
      const r = FC.tap(s, src);
      const n = src.t === 'col' ? s.cols[src.i].length - src.k : 1;
      const any = ms.some(m => m.from.t === src.t && m.from.i === src.i && m.n === n);
      if (r.kind === 'none') { nones++; if (any) refusedWithMove++; }
      else {
        if (!any) illegal++;
        for (const m of r.kind === 'go' ? [r.move] : r.moves) if (!FC.apply(s, m)) illegal++;
        if (r.kind === 'go') goes++; else chooses++;
      }
    }
  }
  check(refusedWithMove === 0, 'a tap is refused only when the card has nowhere to go', refusedWithMove + '');
  check(illegal === 0, 'a tap never offers an illegal move', illegal + '');
  check(goes > 500 && chooses > 100 && nones > 500, 'go, choose and refuse are all exercised', `${goes} ${chooses} ${nones}`);
  // a lone card with only a free cell waits for a second tap; a card that can go home just goes
  const park = table({cols: ['KC', 'KD']});
  const t1 = FC.tap(park, {t: 'col', i: 0, k: 0});
  check(t1.kind === 'choose' || t1.kind === 'go', 'a king with an empty column or a cell has a way');
  const lone = table({cols: ['5C', '7D', '7H', '7S', '7C', '6S', '6C', '8H'], cells: ''});
  const t2 = FC.tap(lone, {t: 'col', i: 0, k: 0});
  check(t2.kind === 'go' && t2.move.to.t === 'col' || t2.kind === 'choose', 'a card with a column to join does not park');
  const park2 = table({cols: ['5C', '9D', '9H', '9S', '9C', '6S', '6C', '8H']});
  const t3 = FC.tap(park2, {t: 'col', i: 0, k: 0});
  check(t3.kind === 'choose' && t3.moves.length === 1 && t3.moves[0].to.t === 'cell', 'a card whose only move is a free cell waits for a second tap');
  const ace = table({cols: ['KC AS']});
  check(FC.tap(ace, {t: 'col', i: 0, k: 1}).kind === 'go' && FC.tap(ace, {t: 'col', i: 0, k: 1}).move.to.t === 'found', 'an ace on top goes home at once');
}

if (suites.includes('solve')) {
  section('solve');
  const sample = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 617, 1000, 5555, 11983, 20000, 31999, 32000];
  for (const n of sample) {
    const t0 = Date.now(), path = FC.solve(FC.deal(n), 300000);
    let s = FC.deal(n), ok = !!path;
    if (path) for (const m of path) { s = FC.apply(s, m); if (!s) { ok = false; break; } }
    check(ok && FC.won(s), `No. ${n}: solved, and every step replays under the rules`, path ? 'bad step' : 'no solution');
    if (ok) check(conserved(s), `No. ${n}: all cards home`);
  }
  // a hint in the middle of a game is legal and its line wins
  for (const n of [3, 617, 4000]) {
    const states = randomGame(n, 25), s = states[states.length - 1];
    const path = FC.solve(s, 300000);
    if (!path) { check(true, `No. ${n}: a random start can be unwinnable; no hint then`); continue; }
    check(!!FC.apply(s, path[0]), `No. ${n}: the first step of a hint is legal`);
    let t = s; for (const m of path) t = t && FC.apply(t, m);
    check(t && FC.won(t), `No. ${n}: the hinted line wins`);
  }
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
