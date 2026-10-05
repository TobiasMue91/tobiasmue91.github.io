#!/usr/bin/env node
// Test suite for games/checkers.html.
//
// Runs the page's DOM-free <script id="core"> block in Node: the rules of American checkers, the record of a
// game and the computer's search. The page only animates what the core returns, so a jump rule that is slightly
// off looks right on screen and plays wrong.
//
//   node test/checkers.mjs                 # everything
//   node test/checkers.mjs rules search    # named suites only
//   node test/checkers.mjs --games=20      # more simulated games (default 10)
//
// Suites:
//   rules   - perft: the number of games of n plies from the start is a published sequence; every position of
//             hundreds of random games gives the same moves as a generator written the other way round;
//             stacked positions for compulsory jumps, chains, crowning, kings and the end of a game
//   record  - a game is its list of moves: replaying it gives the same board; draws by repetition and by the
//             40-move rule; a blocked side loses
//   search  - alpha-beta returns what plain minimax does; a win in one is never missed
//   skill   - every opponent only plays legal moves; the three are ordered by playing strength

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (n, d) => { const a = args.find(x => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const PAGE = opt('page', join(HERE, '..', 'games', 'checkers.html'));
const GAMES = Math.round(+opt('games', 10));
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
const ctx = vm.createContext({Date});
vm.runInContext(core[1] + '\nthis.CHECKERS = CHECKERS;', ctx);
const C = ctx.CHECKERS;

const rngFor = seed => C.mulberry32(seed);
const sq = (r, c) => r * 8 + c;
const board = (red, white) => {   // lists of [r, c, 'm'|'k']
  const b = new Int8Array(64);
  for (const [r, c, k] of red) b[sq(r, c)] = k === 'k' ? 2 : 1;
  for (const [r, c, k] of white) b[sq(r, c)] = k === 'k' ? -2 : -1;
  return b;
};
const strs = (b, p) => C.genMoves(b, p).map(C.moveStr).sort();
const perft = (b, p, d) => d === 0 ? 1 : C.genMoves(b, p).reduce((n, m) => n + perft(C.apply(b, m), -p, d - 1), 0);

// A move generator written the other way round: it jumps on a copy of the board, removing each victim at once
// (so a piece can never be jumped twice, and the mover's own start square is free) and tries steps only if no
// piece anywhere can jump.
function refMoves(b, p) {
  const jumpsFrom = (bd, r, c, king, start, path, caps, out) => {
    let found = false;
    const dirs = [];
    for (const dr of [-1, 1]) for (const dc of [-1, 1]) if (king || dr === (p === 1 ? -1 : 1)) dirs.push([dr, dc]);
    for (const [dr, dc] of dirs) {
      const r1 = r + dr, c1 = c + dc, r2 = r + 2 * dr, c2 = c + 2 * dc;
      if (r2 < 0 || r2 > 7 || c2 < 0 || c2 > 7) continue;
      if (bd[r1 * 8 + c1] * p >= 0 || bd[r2 * 8 + c2] !== 0) continue;
      found = true;
      const nb = Array.from(bd); nb[r1 * 8 + c1] = 0;
      const np = path.concat(r2 * 8 + c2), nc = caps.concat(r1 * 8 + c1);
      const crowns = !king && r2 === (p === 1 ? 0 : 7);
      if (crowns) out.push(start + '-' + np.join('-'));
      else jumpsFrom(nb, r2, c2, king, start, np, nc, out);
    }
    if (!found && path.length) out.push(start + '-' + path.join('-'));
  };
  const jumps = [], steps = [];
  for (let s = 0; s < 64; s++) {
    if (b[s] * p <= 0) continue;
    const king = Math.abs(b[s]) === 2, bd = Array.from(b); bd[s] = 0;
    jumpsFrom(bd, s >> 3, s & 7, king, s, [], [], jumps);
    for (const dr of [-1, 1]) for (const dc of [-1, 1]) {
      if (!king && dr !== (p === 1 ? -1 : 1)) continue;
      const r = (s >> 3) + dr, c = (s & 7) + dc;
      if (r >= 0 && r < 8 && c >= 0 && c < 8 && b[r * 8 + c] === 0) steps.push(s + '-' + (r * 8 + c));
    }
  }
  return (jumps.length ? jumps : steps).sort();
}

function randomGame(rng, maxPlies = 200, visit) {
  const g = C.newGame();
  while (g.ply < maxPlies && !C.status(g).over) {
    visit && visit(g);
    const ms = C.legal(g);
    C.play(g, ms[Math.floor(rng() * ms.length)]);
  }
  return g;
}

if (suites.includes('rules')) {
  section('rules');
  const want = [7, 49, 302, 1469, 7361, 36768, 179740];   // published: American checkers from the standard start
  eq(want.map((_, i) => perft(C.initialBoard(), 1, i + 1)), want, 'perft 1-7 from the start position');

  let seen = 0, bad = 0, ex = '';
  for (let s = 1; s <= 150; s++) randomGame(rngFor(s), 200, g => {
    seen++;
    const a = strs(g.b, g.turn).join(), b = refMoves(g.b, g.turn).join();
    if (a !== b && !bad++) ex = `seed ${s} ply ${g.ply}: ${a} vs ${b}`;
  });
  check(bad === 0, `the reference generator agrees on ${seen} positions`, ex);

  // jumping is compulsory
  let b = board([[5, 2]], [[4, 3], [1, 0]]);
  eq(strs(b, 1), ['42-28'], 'a jump is the only legal move when one exists');
  // a man does not jump backwards, a king does
  b = board([[3, 2]], [[4, 3]]);
  check(C.genMoves(b, 1).every(m => m.caps.length === 0), 'a man cannot jump backwards');
  b = board([[3, 2, 'k']], [[4, 3]]);
  eq(strs(b, 1), ['26-44'], 'a king jumps backwards');
  // a chain must be carried on, and offers every branch
  b = board([[7, 0]], [[6, 1], [4, 3]]);
  eq(strs(b, 1), [`56-${sq(5, 2)}-${sq(3, 4)}`], 'a chain is one move, carried to its end');
  b = board([[6, 3]], [[5, 2], [5, 4]]);
  eq(C.genMoves(b, 1).length, 2, 'two different chains from one piece are two moves');
  // a man that crowns mid-chain stops there
  b = board([[2, 1]], [[1, 2], [1, 4]]);
  const m = C.genMoves(b, 1);
  check(m.length === 1 && m[0].crown && m[0].path.length === 1, 'a man crowned by a jump stops, even with a jump left');
  // a king may go round in a loop but never jumps the same piece twice
  b = board([[7, 0, 'k']], [[6, 1], [4, 3], [4, 5], [6, 5], [2, 1]]);
  for (const mv of C.genMoves(b, 1)) check(new Set(mv.caps).size === mv.caps.length, 'no piece is jumped twice');
  // chain may pass over its own start square
  b = board([[5, 2, 'k']], [[4, 3], [2, 3], [2, 1], [4, 1]]);
  check(C.genMoves(b, 1).some(mv => mv.caps.length === 4), 'a king can loop four pieces and land on its start square');
  // crowning
  b = board([[1, 0]], [[7, 7]]);
  const cm = C.genMoves(b, 1).find(x => x.path[0] === sq(0, 1));
  check(cm && cm.crown && C.apply(b, cm)[sq(0, 1)] === 2, 'a man reaching the far row is crowned');
  // a lost side
  b = board([[0, 1, 'k']], [[7, 0], [7, 2]]);
  const g = C.newGame(); g.b = b; g.turn = -1;
  eq(C.status(g), {over: true, winner: 1, why: 'blocked'}, 'a side with no legal move loses');
  g.b = board([[0, 1, 'k']], []);
  eq(C.status(g).why, 'gone', 'a side with no pieces loses');
}

if (suites.includes('record')) {
  section('record');
  let bad = 0;
  for (let s = 1; s <= 60; s++) {
    const g = randomGame(rngFor(s * 7), 160), h = C.fromLog(g.log);
    if (!h || Array.from(h.b).join() !== Array.from(g.b).join() || h.turn !== g.turn || h.np !== g.np) bad++;
  }
  check(bad === 0, 'replaying a record gives the same board, turn and draw count in 60 games');
  const g0 = C.newGame();
  check(C.fromLog(['0-1']) === null && C.find(g0, '40-33') !== null, 'an illegal move in a record is refused');
  // repetition: two kings dance
  const g = C.newGame();
  g.b = board([[7, 0, 'k'], [7, 2]], [[0, 7, 'k']]); g.hist = Object.create(null); g.hist[C.boardKey(g.b, 1)] = 1;
  const dance = ['56-49', '7-14', '49-56', '14-7'];
  let over = null;
  for (let i = 0; i < 12 && !over; i++) {
    const m = C.find(g, dance[i % 4]);
    if (!m) break;
    C.play(g, m);
    const s = C.status(g); if (s.over) over = s;
  }
  eq(over && over.why, 'repeat', 'the same position three times is a draw');
  eq(over && over.winner, 0, 'and a draw has no winner');
  const k = C.newGame(); k.b = board([[7, 0, 'k']], [[0, 7, 'k']]); k.np = C.DRAW_PLIES;
  eq(C.status(k), {over: true, winner: 0, why: 'stale'}, 'forty moves each without a capture or a man moving is a draw');
  const man = C.newGame(); man.b = board([[5, 0], [7, 4, 'k']], [[0, 7, 'k']]); man.np = C.DRAW_PLIES - 1;
  C.play(man, C.find(man, '40-33'));
  eq(man.np, 0, 'a man moving resets the count');
}

// Plain minimax: no pruning, same horizon rule as the page (a pending jump is searched on).
function refMinimax(b, p, depth) {
  const ms = C.genMoves(b, p);
  if (!ms.length) return -C.WIN;
  if (depth <= 0 && ms[0].caps.length === 0) return p * C.evaluate(b);
  let best = -Infinity;
  for (const m of ms) best = Math.max(best, -refMinimax(C.apply(b, m), -p, depth - 1));
  return best;
}
const clamp = v => Math.abs(v) > C.WIN / 2 ? Math.sign(v) * C.WIN : v;

if (suites.includes('search')) {
  section('search');
  let bad = 0, n = 0, ex = '';
  for (let s = 1; s <= 40; s++) randomGame(rngFor(s * 13), 90, g => {
    if (g.ply % 7 !== 3) return;
    n++;
    const d = 1 + (n % 4);
    const a = clamp(C.negamax(g.b, g.turn, d, -C.INF, C.INF, 0, null)), r = clamp(refMinimax(g.b, g.turn, d));
    if (a !== r && !bad++) ex = `seed ${s} ply ${g.ply} depth ${d}: ${a} vs ${r}`;
  });
  check(bad === 0, `alpha-beta equals plain minimax on ${n} positions`, ex);

  // a win in one is never missed: red jumps the last white piece
  const g = C.newGame(); g.b = board([[5, 2], [7, 0]], [[4, 3], [0, 5]]);
  for (const lv of ['easy', 'medium', 'hard']) {
    let all = true;
    for (let s = 1; s <= 10; s++) {
      const gg = C.newGame(); gg.b = board([[5, 2], [7, 0]], [[4, 3]]);
      const m = C.choose(gg, lv, rngFor(s), {ms: Infinity, depth: 3});
      if (!m || m.caps.length !== 1) all = false;
    }
    check(all, `${lv} takes the last piece`);
  }
  // a man one step from the far row with the road clear is crowned rather than left
  const w = C.newGame(); w.b = board([[1, 2], [7, 0]], [[0, 7, 'k'], [3, 6]]);
  const wm = C.choose(w, 'hard', rngFor(3), {ms: Infinity, depth: 4});
  check(wm && wm.crown, 'the strong player crowns a free man');
}

function match(lvRed, lvWhite, seed, depthOf) {
  const g = C.newGame(), rng = rngFor(seed);
  while (g.ply < 180 && !C.status(g).over) {
    const lv = g.turn === 1 ? lvRed : lvWhite;
    const m = C.choose(g, lv, rng, {ms: Infinity, depth: depthOf[lv]});
    if (!m || !C.find(g, C.moveStr(m))) return {illegal: true};
    C.play(g, m);
  }
  const s = C.status(g);
  return {score: s.over ? s.winner : 0};   // from red's side
}

if (suites.includes('skill')) {
  section('skill');
  const depthOf = {easy: 2, medium: 4, hard: 6};
  const duel = (a, b) => {
    let pts = 0, illegal = 0;
    for (let i = 0; i < GAMES; i++) {
      const asRed = i % 2 === 0;
      const r = match(asRed ? a : b, asRed ? b : a, 100 + i, depthOf);
      if (r.illegal) { illegal++; continue; }
      pts += 0.5 + 0.5 * (asRed ? r.score : -r.score);
    }
    return {pts: pts / GAMES, illegal};
  };
  const hv = duel('hard', 'easy'), mv = duel('medium', 'easy'), hm = duel('hard', 'medium');
  check(hv.illegal + mv.illegal + hm.illegal === 0, 'every computer move is legal');
  check(hv.pts >= 0.8, `hard beats easy (scores ${hv.pts.toFixed(2)})`);
  check(mv.pts >= 0.65, `medium beats easy (scores ${mv.pts.toFixed(2)})`);
  check(hm.pts >= 0.5, `hard does not lose to medium (scores ${hm.pts.toFixed(2)})`);
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
