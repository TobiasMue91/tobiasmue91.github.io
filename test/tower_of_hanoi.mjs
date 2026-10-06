#!/usr/bin/env node
// Test suite for games/tower_of_hanoi.html (Benares).
//
// Runs the page's DOM-free <script id="core"> block in Node. The page promises two things nobody can
// see from the page: that "par" really is the fewest moves, and that Show me, from any position the
// player has reached, names the first move of a shortest way home. No browser, no server.
//
//   node test/tower_of_hanoi.mjs                 # everything
//   node test/tower_of_hanoi.mjs rules bfs       # named suites only
//   node test/tower_of_hanoi.mjs --page=path.html
//
// Suites: rules, bfs, hint, save, notes.

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name, dflt) => { const a = args.find(x => x.startsWith(`--${name}=`)); return a ? a.split('=')[1] : dflt; };
const PAGE = opt('page', join(HERE, '..', 'games', 'tower_of_hanoi.html'));
const ALL = ['rules', 'bfs', 'hint', 'save', 'notes'];
const picked = args.filter(a => !a.startsWith('--'));
const suites = picked.length ? picked : ALL;

let failures = 0, passes = 0;
const fail = (what, detail) => { failures++; console.log(`  FAIL  ${what}${detail ? '\n          ' + detail : ''}`); };
const pass = what => { passes++; if (process.env.VERBOSE) console.log(`  ok    ${what}`); };
const check = (ok, what, detail) => ok ? pass(what) : fail(what, detail);
const section = name => console.log(`\n=== ${name} ===`);

const HTML = readFileSync(PAGE, 'utf8');
const core = HTML.match(/<script id="core">([\s\S]*?)<\/script>/);
if (!core) { console.log('no <script id="core"> block in ' + PAGE); process.exit(1); }
const ctx = vm.createContext({});
vm.runInContext(core[1] + '\nthis.H = HANOI;', ctx);
const H = ctx.H;

// Tiny seeded generator so failures repeat.
let seed = 12345;
const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
const key = s => s.pegs.map(p => p.join('.')).join('|');
const legalMoves = s => { const m = []; for (let f = 0; f < 3; f++) for (let t = 0; t < 3; t++) if (H.canMove(s, f, t)) m.push([f, t]); return m; };

// Distance from every state to the goal, by breadth-first search backwards from the solved tower.
// Moves are reversible, so searching forwards from the goal finds the same distances.
const distances = n => {
  const goal = {n, pegs: [[], [], Array.from({length: n}, (_, i) => n - i)]};
  const dist = new Map([[key(goal), 0]]); let frontier = [goal];
  while (frontier.length) {
    const next = [];
    for (const s of frontier) for (const [f, t] of legalMoves(s)) {
      const r = H.move(s, f, t).state, k = key(r);
      if (!dist.has(k)) { dist.set(k, dist.get(key(s)) + 1); next.push(r); }
    }
    frontier = next;
  }
  return dist;
};

if (suites.includes('rules')) {
  section('rules');
  for (let n = H.FIRST; n <= H.LAST; n++) {
    const s = H.fresh(n);
    check(s.pegs[0].length === n && s.pegs[0][0] === n && s.pegs[0][n - 1] === 1, `${n} discs start largest at the bottom of peg 0`);
    check(H.par(n) === 2 ** n - 1, `par for ${n} is 2^n-1`);
    check(!H.solved(s), `${n}: a fresh tower is not solved`);
  }
  const s = H.fresh(3);
  check(!H.canMove(s, 1, 0), 'cannot take from an empty peg');
  check(!H.canMove(s, 0, 0), 'cannot move to the same peg');
  const a = H.move(s, 0, 1);
  check(a.ok && a.disc === 1 && a.state.pegs[1][0] === 1 && s.pegs[0].length === 3, 'a move returns a new state and leaves the old one alone');
  check(!H.canMove(a.state, 0, 1), 'a larger disc never rests on a smaller one');
  check(H.canMove(a.state, 1, 0) && H.canMove(a.state, 1, 2) && H.canMove(a.state, 0, 2), 'smaller on larger or on empty is fine');
  check(!H.move(a.state, 0, 1).ok && H.move(a.state, 0, 1).state === a.state, 'a refused move changes nothing');
  check(!H.canMove(s, 0, 3) && !H.canMove(s, -1, 1), 'pegs outside 0..2 are refused');
  check(H.solved({n: 2, pegs: [[], [], [2, 1]]}), 'solved means every disc on the right peg');
  check(!H.solved({n: 2, pegs: [[], [2, 1], []]}), 'the middle peg is not the goal');
}

if (suites.includes('bfs')) {
  section('bfs: par is the fewest possible');
  for (let n = 1; n <= 8; n++) {
    const d = distances(n);
    check(d.size === 3 ** n, `${n} discs: ${3 ** n} reachable positions (got ${d.size})`);
    const start = key(H.fresh(n));
    check(d.get(start) === H.par(n), `${n} discs: shortest from the start is ${H.par(n)} (got ${d.get(start)})`);
  }
}

if (suites.includes('hint')) {
  section('hint: plan is a shortest way home from any position');
  for (let n = 1; n <= 8; n++) {
    const d = distances(n);
    let bad = 0, checked = 0, badFirst = 0;
    // every position for small n, a large random sample for the bigger boards
    const states = [];
    const total = 3 ** n;
    if (total <= 3 ** 7) {
      for (let c = 0; c < total; c++) {
        const where = []; let x = c; for (let i = 0; i < n; i++) { where.push(x % 3); x = Math.floor(x / 3); }
        states.push(where);
      }
    } else for (let i = 0; i < 4000; i++) states.push(Array.from({length: n}, () => Math.floor(rnd() * 3)));
    for (const where of states) {
      const pegs = [[], [], []];
      for (let disc = n; disc >= 1; disc--) pegs[where[disc - 1]].push(disc);
      const s = {n, pegs};
      const p = H.plan(s);
      let t = s, ok = true;
      for (const [f, to] of p) { const r = H.move(t, f, to); if (!r.ok) { ok = false; break; } t = r.state; }
      checked++;
      if (!ok || !H.solved(t) || p.length !== d.get(key(s))) bad++;
      const h = H.hint(s);
      if ((p.length === 0) !== (h === null) || (h && (h[0] !== p[0][0] || h[1] !== p[0][1]))) badFirst++;
    }
    check(bad === 0, `${n} discs: plan legal, solving and optimal on ${checked} positions`, `${bad} wrong`);
    check(badFirst === 0, `${n} discs: hint is the plan's first move, null only when solved`, `${badFirst} wrong`);
  }
  // following hints alone from random wandering always finishes in the stated distance
  for (let i = 0; i < 200; i++) {
    const n = 3 + Math.floor(rnd() * 6);
    let s = H.fresh(n);
    for (let k = Math.floor(rnd() * 60); k > 0; k--) { const m = legalMoves(s); const [f, t] = m[Math.floor(rnd() * m.length)]; s = H.move(s, f, t).state; }
    const want = H.plan(s).length; let steps = 0;
    while (!H.solved(s) && steps < 2000) { const [f, t] = H.hint(s); s = H.move(s, f, t).state; steps++; }
    check(H.solved(s) && steps === want, `following Show me from a wandered ${n}-disc position takes exactly ${want} moves`, `took ${steps}`);
  }
}

if (suites.includes('save')) {
  section('save');
  for (let i = 0; i < 100; i++) {
    const n = 3 + Math.floor(rnd() * 6);
    let s = H.fresh(n); const hist = [];
    for (let k = Math.floor(rnd() * 40); k > 0; k--) { const m = legalMoves(s); const mv = m[Math.floor(rnd() * m.length)]; hist.push(mv); s = H.move(s, mv[0], mv[1]).state; }
    const back = H.strToHist(H.histToStr(hist));
    const r = H.replay(n, back);
    check(r && key(r) === key(s), `a ${hist.length}-move game round-trips through its save string`);
  }
  check(H.strToHist('0') === null && H.strToHist('03') === null && H.strToHist('ab') === null && H.strToHist(7) === null, 'garbled save strings are refused');
  check(H.replay(3, [[1, 0]]) === null, 'a save holding an illegal move is refused');
  check(H.medal(3, 7) === 'gold' && H.medal(3, 8) === 'silver' && H.medal(3, 11) === 'silver' && H.medal(3, 12) === 'bronze', 'medals: par is gold, within half again is silver');
  check(H.medal(8, 255) === 'gold' && H.medal(8, 383) === 'silver' && H.medal(8, 384) === 'bronze', 'medal thresholds at 8 discs');
}

if (suites.includes('notes')) {
  section('notes: the biggest disc is always lowest');
  for (let n = H.FIRST; n <= H.LAST; n++) {
    const notes = []; for (let d = 1; d <= n; d++) notes.push(H.semitone(n, d));
    check(H.semitone(n, n) === 0, `${n}: the largest disc is the root`);
    check(notes.every((v, i) => i === 0 || v < notes[i - 1]), `${n}: smaller discs ring higher`);
    check(new Set(notes).size === n, `${n}: no two discs share a note`);
  }
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
