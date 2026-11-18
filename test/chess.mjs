#!/usr/bin/env node
// Test suite for games/chess.html.
//
// Runs the page's DOM-free <script id="core"> block in Node: the rules of chess, notation, the end of a game and the
// opponents' search. The page only animates what the core returns (and its Web Worker is built from the same script
// text), so a castling or en-passant rule that is slightly off looks right on screen and plays wrong.
//
//   node test/chess.mjs                 # everything (about a minute)
//   node test/chess.mjs rules notation  # named suites only
//   node test/chess.mjs --games=4       # more games in the skill suite (default 2 per pairing)
//
// Suites:
//   rules    - perft of six published positions (start, Kiwipete, positions 3 to 6) to depth 3-4; FEN round trips;
//              castling out of, through and into check; en passant only straight after the double step; make/unmake
//              restores board, hash and rights over hundreds of random games; the incremental hash equals a fresh one
//   notation - SAN of every legal move parses back to the same move; disambiguation by file, rank and square;
//              check and mate marks; promotions; PGN of a replayed game
//   end      - checkmate, stalemate, threefold repetition, the fifty-move rule, insufficient material (and the
//              material that is sufficient)
//   search   - mates in one and two found by every opponent; a hanging queen is taken; every returned move is legal;
//              the worker request (`handle`) answers in white's view
//   skill    - the opponents are ordered: the Club Player beats the Beginner, the Tournament player beats Casual

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (n, d) => { const a = args.find(x => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const PAGE = opt('page', join(HERE, '..', 'games', 'chess.html'));
const GAMES = Math.round(+opt('games', 2));
const ALL = ['rules', 'notation', 'end', 'search', 'skill'];
const picked = args.filter(a => !a.startsWith('--'));
const suites = picked.length ? picked : ALL;

let failures = 0, passes = 0;
const fail = (what, detail) => { failures++; console.log(`  FAIL  ${what}${detail ? '\n          ' + detail : ''}`); };
const pass = what => { passes++; if (process.env.VERBOSE) console.log(`  ok    ${what}`); };
const check = (ok, what, detail) => ok ? pass(what) : fail(what, detail);
const eq = (a, b, what) => check(JSON.stringify(a) === JSON.stringify(b), what, `got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`);
const section = n => console.log(`\n=== ${n} ===`);

const html = readFileSync(PAGE, 'utf8');
const m = html.match(/<script id="core">([\s\S]*?)<\/script>/);
if (!m) { console.log('no <script id="core"> in', PAGE); process.exit(1); }
const ctx = {};
vm.createContext(ctx);
vm.runInContext(m[1] + ';this.C = ChessCore;', ctx);
const C = ctx.C;
const rnd = C.rng(12345);

function randomGame(maxPly, seed) {
  const r = C.rng(seed), p = new C.Position();
  const moves = [];
  for (let i = 0; i < maxPly; i++) {
    const l = p.legal();
    if (!l.length || p.status().over) break;
    const mv = l[Math.floor(r() * l.length)];
    moves.push(p.san(mv)); p.make(mv);
  }
  return {p, moves};
}

if (suites.includes('rules')) {
  section('rules');
  const PERFT = [
    [C.START, [20, 400, 8902, 197281]],
    ['r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', [48, 2039, 97862]],
    ['8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1', [14, 191, 2812, 43238]],
    ['r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1', [6, 264, 9467]],
    ['rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8', [44, 1486, 62379]],
    ['r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10', [46, 2079, 89890]]
  ];
  for (const [fen, counts] of PERFT) {
    const p = new C.Position(fen);
    counts.forEach((n, i) => eq(p.perft(i + 1), n, `perft ${i + 1} of ${fen.split(' ')[0].slice(0, 20)}…`));
    eq(p.fen(), fen, 'FEN round trip ' + fen.slice(0, 20));
  }
  // castling
  const cas = fen => new C.Position(fen).legal().filter(x => C.mFlags(x) & C.F_CASTLE).map(x => C.sqName(C.mTo(x))).sort();
  eq(cas('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1'), ['c1', 'g1'], 'both castles free');
  eq(cas('r3k2r/8/8/8/8/8/8/R3K2R w - - 0 1'), [], 'no castling without rights');
  eq(cas('r3k2r/8/8/8/4r3/8/8/R3K2R w KQkq - 0 1'), [], 'no castling out of check');
  eq(cas('r3k2r/8/8/8/5r2/8/8/R3K2R w KQkq - 0 1'), ['c1'], 'no castling through an attacked square');
  eq(cas('r3k2r/8/8/8/6r1/8/8/R3K2R w KQkq - 0 1'), ['c1'], 'no castling into check');
  eq(cas('r3k2r/8/8/8/1r6/8/8/R3K2R w KQkq - 0 1'), ['c1', 'g1'], 'b1 attacked does not stop the long castle');
  eq(cas('r3k2r/8/8/8/8/8/8/RN2K2R w KQkq - 0 1'), ['g1'], 'a piece between king and rook blocks');
  const pr = new C.Position('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
  pr.make(pr.parseSan('Rxa8'));
  check(!pr.fen().split(' ')[2].includes('q'), 'capturing a rook removes that castle', pr.fen());
  // en passant
  const ep = new C.Position('4k3/8/8/8/1p6/8/P7/4K3 w - - 0 1');
  ep.make(ep.parseSan('a4'));
  check(!!ep.parseSan('bxa3'), 'en passant straight after the double step');
  ep.make(ep.parseSan('Kd7')) || ep.make(ep.parseSan('Kd8'));
  const ep2 = C.replay('4k3/8/8/8/1p6/8/P7/4K3 w - - 0 1', ['a4', 'Kd7', 'Kd2']);
  check(ep2 && !ep2.parseSan('bxa3'), 'en passant not a move later');
  const epPin = new C.Position('8/8/8/K1pP3r/8/8/8/7k w - c6 0 1');
  check(!epPin.parseSan('dxc6'), 'en passant that exposes the king along the rank is illegal');
  // make/unmake and the hash over random games
  let restoreOk = true, hashOk = true, detail = '';
  for (let g = 0; g < 200 && restoreOk && hashOk; g++) {
    const {p} = randomGame(120, 1000 + g);
    const fen = p.fen(), lo = p.lo, hi = p.hi;
    for (const mv of p.legal()) {
      p.make(mv);
      const fresh = new C.Position(p.fen());
      if (fresh.lo !== p.lo || fresh.hi !== p.hi) { hashOk = false; detail = p.fen(); }
      p.unmake();
      if (p.fen() !== fen || p.lo !== lo || p.hi !== hi) { restoreOk = false; detail = fen + ' ' + p.uci(mv); break; }
    }
  }
  check(restoreOk, 'make then unmake restores the position (200 random games)', detail);
  check(hashOk, 'the incremental hash equals the hash of a freshly loaded FEN', detail);
}

if (suites.includes('notation')) {
  section('notation');
  let ok = true, detail = '';
  for (let g = 0; g < 120 && ok; g++) {
    const r = C.rng(50 + g), p = new C.Position();
    for (let i = 0; i < 100 && ok; i++) {
      const l = p.legal();
      if (!l.length) break;
      for (const mv of l) { const s = p.san(mv, l); if (p.parseSan(s) !== mv) { ok = false; detail = p.fen() + ' ' + s; break; } }
      p.make(l[Math.floor(r() * l.length)]);
    }
  }
  check(ok, 'every legal SAN parses back to its own move (120 random games)', detail);
  const sans = fen => new C.Position(fen).legal().map(x => new C.Position(fen).san(x)).sort();
  const d1 = sans('4k3/8/8/8/8/8/R6R/4K3 w - - 0 1').filter(s => s.startsWith('R') && s.includes('d2'));
  eq(d1, ['Rad2', 'Rhd2'], 'two rooks on one rank: by file');
  const d2 = sans('4k3/R7/8/8/8/8/8/R3K3 w - - 0 1').filter(s => s.includes('a4'));
  eq(d2, ['R1a4', 'R7a4'], 'two rooks on one file: by rank');
  const d3 = sans('7k/8/8/8/2Q1Q3/8/2Q5/4K3 w - - 0 1').filter(s => s.includes('d3'));
  eq(d3, ['Q2d3', 'Qc4d3', 'Qed3'], 'three queens: by rank, by file, and by square where both are shared');
  const mate = new C.Position('6k1/5ppp/8/8/8/8/8/3R2K1 w - - 0 1');
  eq(mate.san(mate.parseSan('Rd8')), 'Rd8#', 'mate is marked #');
  const chk = new C.Position('6k1/8/8/8/8/8/8/3R2K1 w - - 0 1');
  eq(chk.san(chk.parseSan('Rd8')), 'Rd8+', 'check is marked +');
  const promo = new C.Position('1n2k3/P7/8/8/8/8/8/4K3 w - - 0 1');
  eq(promo.legal().map(x => promo.san(x)).filter(s => s.startsWith('a')).sort(), ['a8=B', 'a8=N', 'a8=Q', 'a8=R', 'axb8=B', 'axb8=N', 'axb8=Q+', 'axb8=R+'].sort(), 'promotions, with and without capture (the knight on b8 blocks the check)');
  eq(promo.uci(promo.parseSan('a8=N')), 'a7a8n', 'under-promotion keeps its piece');
  check(!!promo.parseSan('a7a8q') && !!promo.parseSan('0-0') === false, 'coordinates parse; castling without rights does not');
  const p = C.replay(C.START, ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6']);
  const text = C.pgn(C.START, ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6'], '*', {White: 'You', Black: 'Club Player'});
  check(p && text.includes('1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 *') && text.includes('[White "You"]'), 'PGN of a replayed game', text);
  check(C.replay(C.START, ['e4', 'e4']) === null, 'an illegal move stops a replay');
}

if (suites.includes('end')) {
  section('end');
  const st = (fen, sans) => (sans ? C.replay(fen, sans) : new C.Position(fen)).status();
  const fm = C.replay(C.START, ['f3', 'e5', 'g4', 'Qh4#']).status();
  eq([fm.over, fm.result, fm.reason, fm.winner], [true, '0-1', 'checkmate', 1], "fool's mate");
  const sm = st('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');
  eq([sm.result, sm.reason], ['1/2-1/2', 'stalemate'], 'stalemate');
  const rep = C.replay(C.START, ['Nf3', 'Nf6', 'Ng1', 'Ng8', 'Nf3', 'Nf6', 'Ng1', 'Ng8']).status();
  eq(rep.reason, 'repetition', 'the third occurrence draws');
  const rep2 = C.replay(C.START, ['Nf3', 'Nf6', 'Ng1', 'Ng8', 'Nf3', 'Nf6', 'Ng1']).status();
  check(!rep2.over, 'the second occurrence does not');
  eq(st('4k3/8/8/8/8/8/R7/4K3 w - - 99 80', ['Ra3']).reason, 'fifty', 'a hundred plies without capture or pawn move');
  check(!st('4k3/8/8/8/8/8/P7/4K3 w - - 99 80', ['a3']).over, 'a pawn move resets the count');
  eq(st('4k3/8/8/8/8/8/8/4K3 w - - 0 1').reason, 'material', 'king against king');
  eq(st('4k3/8/8/8/8/8/8/2N1K3 w - - 0 1').reason, 'material', 'king and knight');
  eq(st('4k3/8/8/8/8/8/8/2B1K3 w - - 0 1').reason, 'material', 'king and bishop');
  eq(st('5bk1/8/8/8/8/8/8/2B1K3 w - - 0 1').reason, 'material', 'bishops on squares of one colour');
  check(!st('2b1k3/8/8/8/8/8/8/2B1K3 w - - 0 1').over, 'bishops on both colours can still mate');
  check(!st('4k3/8/8/8/8/8/8/1NN1K3 w - - 0 1').over && !st('4k3/8/8/8/8/8/P7/4K3 w - - 0 1').over && !st('4k3/8/8/8/8/8/8/R3K3 w - - 0 1').over, 'two knights, a pawn or a rook are not a dead draw');
}

if (suites.includes('search')) {
  section('search');
  const M1 = ['6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1', 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 0 1', '6k1/8/6K1/8/8/8/8/R7 w - - 0 1'];
  for (const fen of M1) for (let l = 1; l <= 5; l++) {
    const p = new C.Position(fen), r = C.choose(p, l, 7, null);
    p.make(r.move);
    eq(p.status().reason, 'checkmate', `level ${l} mates in one: ${fen.slice(0, 18)}…`);
  }
  const M2 = 'r2qkb1r/pp2nppp/3p4/2pNN1B1/2BnP3/3P4/PPP2PPP/R2bK2R w KQkq - 1 1';
  const t = C.think(new C.Position(M2), {nodes: 400000});
  check(t.mate > 0 && t.mate <= 2, 'mate in two is seen as mate', JSON.stringify({mate: t.mate, score: t.score}));
  const free = new C.Position('4k3/8/8/3q4/8/8/3R4/4K3 w - - 0 1');
  for (const l of [3, 4, 5]) eq(free.san(C.choose(free, l, 1, null).move), 'Rxd5', `level ${l} takes a hanging queen`);
  let legalOk = true;
  for (let g = 0; g < 12; g++) {
    const {p, moves} = randomGame(20 + g * 3, 900 + g);
    if (p.status().over) continue;
    for (let l = 1; l <= 3; l++) { const r = C.choose(p, l, g, moves); if (!p.legal().includes(r.move)) legalOk = false; }
    const r4 = C.think(p, {nodes: 20000});
    if (!p.legal().includes(r4.move)) legalOk = false;
  }
  check(legalOk, 'every opponent returns a legal move from random positions');
  const h = C.handle({id: 1, kind: 'eval', fen: '4k3/8/8/8/8/8/8/Q3K3 b - - 0 1', sans: [], nodes: 20000});
  check(h.score > 500, 'evaluation is reported from white\'s view when Black is to move', JSON.stringify(h));
  const hm = C.handle({id: 2, kind: 'move', fen: C.START, sans: ['e4'], level: 4, seed: 1});
  check(!!C.replay(C.START, ['e4', hm.san]), 'a move request answers with a legal SAN', JSON.stringify(hm));
}

if (suites.includes('skill')) {
  section('skill');
  // fixed node budgets, no clock, so the result does not depend on the machine
  const L = C.LEVELS;
  const saveT = L.map(x => x.time);
  L.forEach(x => { x.time = 0; });
  L[3].nodes = 60000;
  function play(white, black, seed) {
    const p = new C.Position(), sans = [];
    for (let i = 0; i < 300; i++) {
      const st = p.status();
      if (st.over) return st.winner;
      const lv = p.turn ? black : white;
      const r = C.choose(p, lv, seed * 1000 + i, sans);
      sans.push(p.san(r.move)); p.make(r.move);
    }
    return -1;
  }
  for (const [weak, strong] of [[1, 3], [2, 4]]) {
    let sw = 0, ww = 0;
    for (let g = 0; g < GAMES * 2; g++) {
      const strongWhite = g % 2 === 0;
      const w = play(strongWhite ? strong : weak, strongWhite ? weak : strong, 77 + g);
      if (w === -1) continue;
      if ((w === 0) === strongWhite) sw++; else ww++;
    }
    check(sw > ww && ww === 0, `the ${L[strong - 1].name} beats the ${L[weak - 1].name}`, `${sw} wins against ${ww}`);
    console.log(`  ${L[strong - 1].name} ${sw} - ${ww} ${L[weak - 1].name} (${GAMES * 2} games)`);
  }
  L.forEach((x, i) => { x.time = saveT[i]; });
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
