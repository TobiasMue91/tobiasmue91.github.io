#!/usr/bin/env node
// Test suite for games/ludo.html.
//
// Runs the page's DOM-free <script id="core"> block in Node: the board, the rules and the computer player.
// The page only animates what the core returns, so a rule that is slightly off (a six that lets nothing out,
// a capture on a safe star, a pawn that overshoots home, a bonus roll that never comes) looks right on screen.
//
//   node test/ludo.mjs                 # everything
//   node test/ludo.mjs rules play      # named suites only
//   node test/ludo.mjs --games=3000    # more simulated games (default 1000)
//
// Suites:
//   board  - 52 distinct track squares, each a step from the next; lanes and starts where they belong; 4-fold symmetry
//   rules  - stacked positions: a six to leave, exact roll home, captures, safe squares, bonus rolls, three sixes
//   play   - whole games: every move legal, every pawn always somewhere, games end, the first home wins
//   save   - a game saved at any moment as JSON carries on roll for roll
//   skill  - the computer player beats one that moves any legal pawn at random

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (n, d) => { const a = args.find(x => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const PAGE = opt('page', join(HERE, '..', 'games', 'ludo.html'));
const GAMES = Math.round(+opt('games', 1000));
const ALL = ['board', 'rules', 'play', 'save', 'skill'];
const picked = args.filter(a => !a.startsWith('--'));
const suites = picked.length ? picked : ALL;

let failures = 0, passes = 0;
const fail = (what, detail) => { failures++; console.log(`  FAIL  ${what}${detail ? '\n          ' + detail : ''}`); };
const pass = what => { passes++; if (process.env.VERBOSE) console.log(`  ok    ${what}`); };
const check = (ok, what, detail) => ok ? pass(what) : fail(what, detail);
const eq = (a, b, what) => check(JSON.stringify(a) === JSON.stringify(b), what, `got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`);
const section = n => console.log(`\n=== ${n} ===`);

const HTML = readFileSync(PAGE, 'utf8');
const core = HTML.match(/<script id="core">([\s\S]*?)<\/script>/);
if (!core) { console.log('no <script id="core"> block in ' + PAGE); process.exit(1); }
const ctx = vm.createContext({});
vm.runInContext(core[1] + '\nthis.LUDO = LUDO;', ctx);
const L = ctx.LUDO;
const J = x => JSON.parse(JSON.stringify(x));
const FOUR = ['human', 'bot', 'bot', 'bot'];

// A position built by hand; the die is forced so a rule can be checked on one roll.
function pos(tok, {turn = 0, die = 6, seats = FOUR, sixes = 0} = {}) {
  const g = L.newGame(seats, 1);
  g.tok = J(tok); g.turn = turn; g.die = die; g.sixes = sixes; g.phase = 'move';
  return g;
}
// Force the next roll to come up d by searching for an rng state that gives it.
function rig(g, d) {
  for (let s = 0; ; s++) { const t = {rng: s}; if (1 + Math.floor(L.rand(t) * 6) === d) { g.rng = s; return g; } }
}
const Y = [-1, -1, -1, -1];

if (suites.includes('board')) {
  section('board');
  const T = L.TRACK_XY;
  eq(T.length, 52, 'the track has 52 squares');
  eq(new Set(T.map(String)).size, 52, 'all 52 are distinct');
  check(T.every((p, i) => { const q = T[(i + 1) % 52]; return Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]) === 1 || (Math.abs(p[0] - q[0]) === 1 && Math.abs(p[1] - q[1]) === 1); }), 'each square is a step from the next');
  check(T.every(([c, r]) => (c >= 6 && c <= 8) || (r >= 6 && r <= 8)), 'the track stays on the cross');
  for (let s = 0; s < 4; s++) {
    eq(L.xy(s, 0), T[13 * s], `seat ${s} starts on square ${13 * s}`);
    const lane = [51, 52, 53, 54, 55].map(p => L.xy(s, p));
    check(lane.every(([c, r]) => (c === 7 || r === 7) && !T.some(t => t[0] === c && t[1] === r)), `seat ${s}'s lane lies off the track, on the middle row`);
    const last = L.xy(s, 50), first = L.xy(s, 51);
    check(Math.abs(last[0] - first[0]) + Math.abs(last[1] - first[1]) === 1, `seat ${s} turns into its lane from the square beside it`);
  }
  check(T.every((p, i) => String(L.rot(p, 1)) === String(T[(i + 13) % 52])), 'the board is the same seen from every seat');
  check(L.SAFE.every(c => c % 13 === 0 || c % 13 === 8), 'safe squares are the starts and the stars');
}

if (suites.includes('rules')) {
  section('rules');
  let g = pos([Y, Y, Y, Y], {die: 5});
  eq(L.legal(g), [], 'without a six nothing leaves the yard');
  g = pos([Y, Y, Y, Y], {die: 6});
  eq(L.legal(g), [0, 1, 2, 3], 'a six lets any pawn out');
  L.move(g, 2);
  eq(g.tok[0], [-1, -1, 0, -1], 'a pawn let out stands on its start square');
  eq([g.turn, g.phase], [0, 'roll'], 'a six rolls again');

  g = pos([[52, -1, -1, -1], Y, Y, Y], {die: 5});
  eq(L.legal(g), [], 'a pawn may not overshoot home');
  g = pos([[52, -1, -1, -1], Y, Y, Y], {die: 4});
  const ev = L.move(g, 0);
  check(ev.home && g.tok[0][0] === 56, 'the exact roll takes it home');
  eq([g.turn, g.phase], [0, 'roll'], 'reaching home rolls again');

  // Capture: red at 10, green two squares behind in its own count; green rolls 2.
  const greenAt = c => (c - 13 + 52) % 52;
  g = pos([[10, -1, -1, -1], [greenAt(8), -1, -1, -1], Y, Y], {turn: 1, die: 2});
  const cap = L.move(g, 0);
  eq(cap.caught, [[0, 0]], 'landing on a rival sends it home');
  eq(g.tok[0][0], -1, 'the captured pawn is back in its yard');
  eq([g.turn, g.phase], [1, 'roll'], 'a capture rolls again');

  g = pos([[8, -1, -1, -1], [greenAt(6), -1, -1, -1], Y, Y], {turn: 1, die: 2});
  eq(L.move(g, 0).caught, [], 'nobody is captured on a star');
  eq(g.turn, 2, 'and the turn passes');
  g = pos([[0, -1, -1, -1], Y, Y, [(0 - 39 + 52) % 52 - 3, -1, -1, -1]], {turn: 3, die: 3});
  eq(L.move(g, 0).caught, [], 'nobody is captured on a start square');

  g = pos([[5, 9, -1, -1], Y, Y, Y], {die: 4});
  L.move(g, 0);
  eq(g.tok[0], [9, 9, -1, -1], 'two of one colour may share a square');

  g = pos([[20, -1, -1, -1], Y, Y, [(20 - 39 + 52) % 52, (20 - 39 + 52) % 52, -1, -1]], {die: 0});
  g.phase = 'move'; g.die = 0;
  g.tok[0][0] = 17; g.die = 3;
  eq(L.move(g, 0).caught.length, 2, 'a pair of rivals on a plain square both go home');

  // Rolling: three sixes in a row lose the turn.
  g = L.newGame(FOUR, 1); g.tok[0] = [10, -1, -1, -1]; g.sixes = 2;
  rig(g, 6);
  const r3 = L.roll(g);
  check(r3.pass && r3.reason === 'three' && g.turn === 1, 'the third six in a row passes the turn');
  g = L.newGame(FOUR, 1); rig(g, 4);
  const rb = L.roll(g);
  check(rb.pass && g.turn === 1 && g.phase === 'roll', 'no legal move passes the turn');
  g = L.newGame(FOUR, 1); g.tok[0] = [10, -1, -1, -1]; rig(g, 3);
  L.roll(g); L.move(g, 0);
  eq(g.turn, 1, 'an ordinary move passes the turn');
  g = L.newGame(['human', null, 'bot', null], 1); g.tok[0] = [10, -1, -1, -1]; rig(g, 3);
  L.roll(g); L.move(g, 0);
  eq(g.turn, 2, 'empty seats are skipped');

  g = pos([[56, 56, 56, 53], Y, Y, Y], {die: 3});
  const w = L.move(g, 3);
  check(w.won && g.phase === 'over' && g.winner === 0 && g.places[0] === 0, 'the first seat home with all four wins');
  let threw = false; try { L.move(g, 0); } catch (e) { threw = true; }
  check(threw, 'nothing moves after the game is over');
  g = pos([Y, Y, Y, Y], {die: 3}); threw = false; try { L.move(g, 0); } catch (e) { threw = true; }
  check(threw, 'an illegal move is refused');
}

// Plays one game; returns stats. pickFor(seat, g) chooses a token.
function playGame(seed, pickFor, seats = FOUR, onStep) {
  const g = L.newGame(seats, seed);
  let steps = 0;
  while (g.phase !== 'over' && steps < 20000) {
    steps++;
    if (g.phase === 'roll') L.roll(g);
    else L.move(g, pickFor(g.turn, g));
    if (onStep && onStep(g) === false) break;
  }
  return {g, steps};
}

if (suites.includes('play')) {
  section('play');
  let bad = 0, long = 0, illegal = 0, winners = [0, 0, 0, 0];
  const setups = [FOUR, ['human', null, 'bot', null], ['bot', 'bot', 'bot', null]];
  for (let i = 0; i < GAMES; i++) {
    const seats = setups[i % 3];
    const {g, steps} = playGame(i + 1, (s, g) => {
      const m = L.legal(g);
      const t = i % 2 ? L.bot(g) : m[(i * 7 + g.rolls) % m.length];
      if (m.indexOf(t) < 0) illegal++;
      return t;
    }, seats, g => {
      for (let s = 0; s < 4; s++) {
        if (!seats[s]) continue;
        if (g.tok[s].length !== 4 || g.tok[s].some(p => !(p === -1 || (p >= 0 && p <= 56) ) || !Number.isInteger(p))) bad++;
      }
      // No square of the shared track that isn't safe holds two colours.
      const at = {};
      seats.forEach((on, s) => on && g.tok[s].forEach(p => { const c = L.cell(s, p); if (c >= 0) (at[c] = at[c] || new Set()).add(s); }));
      for (const c in at) if (at[c].size > 1 && L.SAFE.indexOf(+c) < 0) bad++;
    });
    if (g.phase !== 'over') long++; else winners[g.winner]++;
    if (g.phase === 'over' && !g.tok[g.winner].every(p => p === 56)) bad++;
    if (g.phase === 'over' && new Set(g.places).size !== seats.filter(Boolean).length) bad++;
  }
  eq(illegal, 0, 'the bot only picks legal pawns');
  eq(bad, 0, `every pawn is always somewhere legal and two colours only share safe squares (${GAMES} games)`);
  eq(long, 0, 'every game ends');
  check(winners.filter(Boolean).length >= 3, 'every seat can win', JSON.stringify(winners));
}

if (suites.includes('save')) {
  section('save');
  let diverged = 0;
  for (let i = 0; i < 200; i++) {
    const a = L.newGame(FOUR, 1000 + i);
    const cut = 20 + (i * 13) % 300;
    let n = 0;
    while (a.phase !== 'over' && n < cut) { n++; a.phase === 'roll' ? L.roll(a) : L.move(a, L.bot(a)); }
    const b = JSON.parse(JSON.stringify(a));
    while (a.phase !== 'over') { a.phase === 'roll' ? L.roll(a) : L.move(a, L.bot(a)); b.phase === 'roll' ? L.roll(b) : L.move(b, L.bot(b)); if (JSON.stringify(a) !== JSON.stringify(b)) { diverged++; break; } }
  }
  eq(diverged, 0, 'a game saved as JSON at any moment carries on identically');
}

if (suites.includes('skill')) {
  section('skill');
  let wins = 0;
  const N = Math.max(400, GAMES);
  for (let i = 0; i < N; i++) {
    const {g} = playGame(5000 + i, (s, g) => { if (s !== 0) return L.bot(g); const m = L.legal(g); return m[Math.floor(L.rand({rng: g.rolls * 31 + i}) * m.length)]; }, ['human', null, 'bot', null]);
    if (g.winner === 2) wins++;
  }
  check(wins / N > 0.62, `the computer beats a random mover head to head (${(100 * wins / N).toFixed(1)}%)`);
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
