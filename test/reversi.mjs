#!/usr/bin/env node
// Test suite for games/reversi.html.
//
// Runs the page's DOM-free <script id="core"> block in Node: the rules, the record of a game and the three
// opponents. The page only animates what the core returns, so a flip rule that is slightly off looks right on
// screen and plays wrong.
//
//   node test/reversi.mjs                 # everything
//   node test/reversi.mjs rules search    # named suites only
//   node test/reversi.mjs --games=60      # more simulated games (default 30)
//
// Suites:
//   rules   - perft: the number of games of n plies from the start is a published sequence; every move agrees with
//             a flip finder written the other way round; passes and the end of a game
//   record  - a game is its list of moves: replaying it gives the same board, an illegal move changes nothing
//   search  - alpha-beta returns what plain minimax does; the endgame solver returns the true final margin
//   skill   - every opponent only plays legal moves; the three are ordered by playing strength

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (n, d) => { const a = args.find(x => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const PAGE = opt('page', join(HERE, '..', 'games', 'reversi.html'));
const GAMES = Math.round(+opt('games', 30));
const ALL = ['rules', 'record', 'search', 'skill'];
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
vm.runInContext(core[1] + '\nthis.REVERSI = REVERSI;', ctx);
const R = ctx.REVERSI;

// A flip finder written the other way round: walk by (row, col) steps, not by the core's ray tables.
function refFlips(b, i, p) {
  if (b[i] !== 0) return null;
  const r0 = i >> 3, c0 = i & 7, out = [];
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    if (!dr && !dc) continue;
    const run = [];
    let r = r0 + dr, c = c0 + dc;
    while (r >= 0 && r < 8 && c >= 0 && c < 8 && b[r * 8 + c] === -p) { run.push(r * 8 + c); r += dr; c += dc; }
    if (run.length && r >= 0 && r < 8 && c >= 0 && c < 8 && b[r * 8 + c] === p) out.push(...run);
  }
  return out.length ? out.sort((a, b) => a - b) : null;
}
const copy = g => ({b: Int8Array.from(g.b), turn: g.turn, moves: g.moves.slice(), over: g.over});

if (suites.includes('rules')) {
  section('rules');
  // Published counts of distinct move sequences of n plies, passes not counted as plies (Othello perft).
  const known = [4, 12, 56, 244, 1396, 8200, 55092, 390216];
  const perft = (g, d) => {
    if (d === 0) return 1;
    let n = 0;
    for (const i of R.moves(g.b, g.turn)) { const h = copy(g); R.play(h, i); n += h.over && d > 1 ? 0 : perft(h, d - 1); }
    return n;
  };
  for (let d = 1; d <= 7; d++) eq(perft(R.newGame(), d), known[d - 1], `perft(${d})`);

  const rnd = R.mulberry(5);
  let checked = 0, passed = 0;
  for (let k = 0; k < 300; k++) {
    const g = R.newGame();
    while (!g.over) {
      const legal = R.moves(g.b, g.turn);
      const ref = [];
      for (let i = 0; i < 64; i++) if (refFlips(g.b, i, g.turn)) ref.push(i);
      if (JSON.stringify(legal) !== JSON.stringify(ref)) { fail('legal moves match the reference', `game ${k} move ${g.moves.length}`); break; }
      const i = legal[Math.floor(rnd() * legal.length)];
      const before = Int8Array.from(g.b), p = g.turn, want = refFlips(before, i, p);
      const res = R.play(g, i);
      const got = res.flips.slice().sort((a, b) => a - b);
      if (JSON.stringify(got) !== JSON.stringify(want)) { fail('flips match the reference', `game ${k} cell ${i}`); break; }
      // exactly those cells and the new stone changed
      let ok = g.b[i] === p;
      for (let c = 0; c < 64; c++) { if (c === i) continue; const flipped = want.includes(c); if (g.b[c] !== (flipped ? p : before[c])) ok = false; }
      if (!ok) { fail('only the flipped cells change', `game ${k} cell ${i}`); break; }
      // each line of the animation is a run outward from the new stone
      for (const l of res.lines) {
        const dr = Math.sign((l[0] >> 3) - (i >> 3)), dc = Math.sign((l[0] & 7) - (i & 7));
        l.forEach((c, n) => { if ((c >> 3) !== (i >> 3) + dr * (n + 1) || (c & 7) !== (i & 7) + dc * (n + 1)) ok = false; });
      }
      if (!ok) { fail('lines run outward from the stone', `game ${k}`); break; }
      if (res.passed) { passed++; if (!(g.turn === p && R.moves(g.b, -p).length === 0 && R.moves(g.b, p).length)) { fail('a pass keeps the turn with the side that can move', `game ${k}`); break; } }
      else if (!g.over && (g.turn !== -p || !R.moves(g.b, -p).length)) { fail('without a pass the other side moves', `game ${k}`); break; }
      checked++;
    }
    const c = R.count(g.b);
    if (g.over) {
      check(R.moves(g.b, 1).length === 0 && R.moves(g.b, -1).length === 0, 'a game is over only when neither side can move', `game ${k}`);
      check(c.ebony + c.ivory + c.empty === 64, 'discs add up', `game ${k}`);
      check(g.turn === 0, 'turn is 0 once over');
    }
  }
  pass(`${checked} moves checked against the reference`);

  // A pass: ebony to move has nothing, ivory moves again.
  const b = new Int8Array(64); b[0] = 1; b[1] = -1; b[2] = -1; b[9] = -1; // ebony A1; ivory B1 C1 B2
  const g = {b, turn: -1, moves: [], over: false};
  // ivory plays D1 flipping nothing? make a real one: ivory to play at 3? no flip -> illegal
  check(R.play(g, 3) === null, 'a move that flips nothing is refused');
  check(R.play(g, 0) === null, 'an occupied square is refused');
  // Construct: ebony row A1..: E . then ivory plays and ebony then has no move -> ivory goes again
  const b2 = new Int8Array(64); b2[0] = -1; b2[1] = 1; // ivory A1, ebony B1: ebony to play C? none; ivory plays C1 flips B1
  const g2 = {b: b2, turn: -1, moves: [], over: false};
  const r2 = R.play(g2, 2);
  check(r2 && r2.next === 0 && g2.over, 'when neither side can move the game ends');
  const b3 = new Int8Array(64); b3[0] = -1; b3[1] = 1; b3[2] = 1; b3[63] = 1; b3[62] = -1; b3[7] = 0;
  // ivory plays D1 (3): flips B1 C1; ebony keeps H8 and has a move? H8 with G8 ivory: ebony needs F8 -> legal.
  const g3 = {b: b3, turn: -1, moves: [], over: false};
  const r3 = R.play(g3, 3);
  check(r3 && r3.next === 1 && !r3.passed, 'the other side moves next when it can');
  // ebony lone stone, ivory to move with a capture while ebony then has none
  const b4 = new Int8Array(64); b4[0] = -1; b4[1] = 1; b4[10] = -1; b4[19] = -1; b4[63] = -1;
  const g4 = {b: b4, turn: -1, moves: [], over: false};
  const r4 = R.play(g4, 2);
  check(r4 && g4.over, 'taking the last opposing stone ends the game');
  const b5 = new Int8Array(64); b5[0] = -1; b5[1] = 1; b5[8] = 1; b5[16] = 0; b5[63] = 1; b5[62] = -1; b5[27] = 1; b5[28] = -1;
  const g5 = {b: b5, turn: -1, moves: [], over: false};
  const mv5 = R.moves(g5.b, -1);
  const r5 = R.play(g5, mv5[0]);
  check(r5 !== null && (r5.next === 1 || r5.next === -1 || r5.next === 0), 'a position built by hand plays');
  check(passed >= 3, 'random games contain passes to check', `${passed} found`);
}

if (suites.includes('record')) {
  section('record');
  const rnd = R.mulberry(9);
  for (let k = 0; k < 100; k++) {
    const g = R.newGame();
    const trace = [];
    while (!g.over) {
      const legal = R.moves(g.b, g.turn);
      const i = legal[Math.floor(rnd() * legal.length)];
      R.play(g, i);
      trace.push(Array.from(g.b).join(''));
    }
    const h = R.replay(g.moves);
    check(h && Array.from(h.b).join('') === Array.from(g.b).join('') && h.turn === g.turn && h.over === g.over, 'replaying the moves gives the same game', `game ${k}`);
    // any prefix replays to the board seen then
    const cut = Math.floor(rnd() * g.moves.length) + 1;
    const p = R.replay(g.moves.slice(0, cut));
    check(Array.from(p.b).join('') === trace[cut - 1], 'any prefix replays to the board seen then', `game ${k} cut ${cut}`);
  }
  const g = R.newGame(), snap = Array.from(g.b).join('');
  check(R.play(g, 0) === null && Array.from(g.b).join('') === snap && g.moves.length === 0 && g.turn === 1, 'an illegal move changes nothing');
  check(R.replay([19, 19]) === null, 'a record with an illegal move is refused');
  eq(R.count(g.b), {ebony: 2, ivory: 2, empty: 60}, 'opening count');
  eq(R.moves(g.b, 1), [19, 26, 37, 44], 'ebony opens with four moves');
}

if (suites.includes('search')) {
  section('search');
  const rnd = R.mulberry(21);
  // Plain minimax on the same evaluation: no pruning, no ordering.
  const mm = (b, p, depth, passed) => {
    if (depth === 0) return R.heuristic(b, p);
    const mv = R.moves(b, p);
    if (!mv.length) return passed ? R.exact(b, p) : -mm(b, -p, depth, true);
    let best = -Infinity;
    for (const i of mv) {
      const c = Int8Array.from(b);
      const g = {b: c, turn: p, moves: [], over: false}; R.play(g, i);
      best = Math.max(best, -mm(c, -p, depth - 1, false));
    }
    return best;
  };
  let n = 0;
  for (let k = 0; k < 40; k++) {
    const g = R.newGame();
    const plies = 6 + Math.floor(rnd() * 30);
    for (let s = 0; s < plies && !g.over; s++) { const l = R.moves(g.b, g.turn); R.play(g, l[Math.floor(rnd() * l.length)]); }
    if (g.over || g.turn === 0) continue;
    const ab = R.negamax(Int8Array.from(g.b), g.turn, 3, -Infinity, Infinity, false, {nodes: 0, limit: Infinity, abort: false});
    const plain = mm(Int8Array.from(g.b), g.turn, 3, false);
    check(ab === plain, 'alpha-beta equals minimax at depth 3', `ply ${plies}: ${ab} vs ${plain}`);
    n++;
  }
  pass(`${n} positions compared`);
  // Endgame: with few empties, the solver's best root move reaches the true final margin.
  for (let k = 0; k < 25; k++) {
    const g = R.newGame();
    while (!g.over && R.count(g.b).empty > 7) { const l = R.moves(g.b, g.turn); R.play(g, l[Math.floor(rnd() * l.length)]); }
    if (g.over) continue;
    const solved = R.negamax(Int8Array.from(g.b), g.turn, R.count(g.b).empty, -Infinity, Infinity, false, {nodes: 0, limit: Infinity, abort: false, exact: true});
    const brute = (b, p, passed) => {
      const mv = R.moves(b, p);
      if (!mv.length) return passed ? R.exact(b, p) : -brute(b, -p, true);
      let best = -Infinity;
      for (const i of mv) { const c = Int8Array.from(b); R.play({b: c, turn: p, moves: [], over: false}, i); best = Math.max(best, -brute(c, -p, false)); }
      return best;
    };
    eq(solved, brute(Int8Array.from(g.b), g.turn, false), `endgame margin with ${R.count(g.b).empty} empties`);
  }
}

if (suites.includes('skill')) {
  section('skill');
  const rnd = R.mulberry(33);
  const randomMover = () => (b, p) => { const l = R.moves(b, p); return l[Math.floor(rnd() * l.length)]; };
  const level = lv => (b, p) => R.choose(b, p, lv, rnd);
  // Plays n games with `a` and `b` alternating colours; returns a's score (win 1, draw .5).
  const duel = (a, b, n) => {
    let s = 0;
    for (let k = 0; k < n; k++) {
      const g = R.newGame(), side = k % 2 ? {1: b, [-1]: a} : {1: a, [-1]: b};
      while (!g.over) {
        const m = side[g.turn](g.b, g.turn);
        if (!R.moves(g.b, g.turn).includes(m)) { fail('opponent plays a legal move', `${m}`); return 0; }
        R.play(g, m);
      }
      const c = R.count(g.b), d = c.ebony - c.ivory, mine = k % 2 ? -d : d;
      s += mine > 0 ? 1 : mine === 0 ? .5 : 0;
    }
    return s / n;
  };
  const vsRandom = [0, 1, 2].map(lv => duel(level(lv), randomMover(), lv === 2 ? 4 : Math.max(GAMES, 30)));
  console.log('  vs random:', vsRandom.map(x => x.toFixed(2)).join(' '));
  check(vsRandom[0] > .8 && vsRandom[1] > .95 && vsRandom[2] === 1, 'every opponent beats a random mover');
  const rA = duel(level(1), level(0), Math.max(GAMES, 30));
  check(rA >= .8, 'Regular beats Apprentice', `score ${rA}`);
  const rW = duel(level(2), level(1), 6);
  check(rW >= .8, 'Waterman beats Regular', `score ${rW}`);
  // Waterman answers fast enough for a phone: at most a few hundred thousand nodes
  const g = R.newGame(); for (let k = 0; k < 14; k++) { const l = R.moves(g.b, g.turn); R.play(g, l[k % l.length]); }
  const t = Date.now(); R.choose(g.b, g.turn, 2, rnd);
  check(Date.now() - t < 3000, 'Waterman answers a middlegame position in under three seconds', `${Date.now() - t}ms`);
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
