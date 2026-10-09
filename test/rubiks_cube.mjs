#!/usr/bin/env node
// Test suite for games/rubiks_cube.html (Rubik's Cube).
//
// Runs the page's DOM-free <script id="core"> block in Node. The cube's promises are the ones nobody can see from the page:
// that a turn moves exactly what a real turn moves, that a scramble is fair and never already solved, that the way home the Hint
// shows really leads home, that a finger dragged across a sticker turns the layer it dragged (whatever the view), and that
// saves trust nothing. Every move is judged against a second simulator written the other way round (real cos/sin on sticker
// centres) and against facts about the cube that are published (the order of R U is 105, of R U2 D' B D' is 1260).
//
//   node test/rubiks_cube.mjs                 # everything
//   node test/rubiks_cube.mjs moves gesture   # named suites only
//   node test/rubiks_cube.mjs page            # the real page in Chromium (needs playwright; skipped without it)
//   node test/rubiks_cube.mjs --page=path.html
//
// Suites: moves, scramble, run, gesture, saves, page.

import { readFileSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name, dflt) => { const a = args.find(x => x.startsWith(`--${name}=`)); return a ? a.split('=')[1] : dflt; };
const PAGE = opt('page', join(HERE, '..', 'games', 'rubiks_cube.html'));
const ALL = ['moves', 'scramble', 'run', 'gesture', 'saves', 'page'];
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
vm.runInContext(core[1] + '\nthis.C = CUBE;', ctx);
const C = ctx.C;

// a small seeded PRNG so every run is the same run
const rng = seed => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const LETTERS = [...'UDRLFBMES'];
const randomMove = (r, slices = true) => {
  const l = LETTERS[(r() * (slices ? 9 : 6)) | 0], m = ["", "'", '2'][(r() * 3) | 0];
  return C.parse(l + m);
};
const SOLVED_KEY = C.key(C.solved());

/* A second simulator, written the other way round: sticker centres (doubled, so integers) turned by real cosines and sines. */
function refStart() {
  const out = [];
  for (const s of C.solved()) out.push({ d: [2 * s.p[0] + s.n[0], 2 * s.p[1] + s.n[1], 2 * s.p[2] + s.n[2]], c: s.c });
  return out;
}
function refApply(st, m) {
  const k = ((m.q % 4) + 4) % 4, th = k * Math.PI / 2, cs = Math.round(Math.cos(th)), sn = Math.round(Math.sin(th));
  return st.map(s => {
    const d = s.d, a = m.a;
    const layer = Math.abs(d[a]) === 3 ? Math.sign(d[a]) : d[a] / 2;
    if (layer !== m.l) return s;
    const [x, y, z] = d;
    let r;
    if (a === 0) r = [x, cs * y - sn * z, sn * y + cs * z];
    else if (a === 1) r = [cs * x + sn * z, y, -sn * x + cs * z];
    else r = [cs * x - sn * y, sn * x + cs * y, z];
    return { d: r.map(v => v + 0), c: s.c };
  });
}
const refKey = st => st.map(s => s.d.join(',') + ':' + s.c).sort().join('|');
const coreKey = st => st.map(s => [2 * s.p[0] + s.n[0], 2 * s.p[1] + s.n[1], 2 * s.p[2] + s.n[2]].join(',') + ':' + s.c).sort().join('|');
const order = (alg, cap = 2000) => {
  const ms = C.parseAll(alg); let s = C.solved();
  for (let i = 1; i <= cap; i++) { s = C.applyAll(s, ms); if (C.key(s) === SOLVED_KEY) return i; }
  return -1;
};
const wrongStickers = st => { const f = C.facelets(st); let n = 0; for (let i = 0; i < 54; i++) if (f[i] !== (i / 9 | 0)) n++; return n; };

if (suites.includes('moves')) {
  section('moves: a turn moves what a real turn moves');
  const s0 = C.solved();
  check(s0.length === 54 && C.isSolved(s0), '54 stickers, solved to begin with');
  let counts = [0, 0, 0, 0, 0, 0]; for (const s of s0) counts[s.c]++;
  check(counts.every(n => n === 9), 'nine stickers of each colour');

  // against the float simulator, on random sequences with slices and half turns
  const r = rng(7); let bad = null;
  for (let t = 0; t < 400 && !bad; t++) {
    let a = C.solved(), b = refStart();
    for (let i = 0; i < 30; i++) {
      const m = randomMove(r); a = C.apply(a, m); b = refApply(b, m);
      if (coreKey(a) !== refKey(b)) { bad = `sequence ${t}, move ${i + 1} (${C.name(m)})`; break; }
    }
  }
  check(!bad, '12,000 random turns (faces, slices, half turns) agree with the float simulator', bad);

  // published facts
  check(order('R U') === 105, 'R U has order 105');
  check(order("R U2 D' B D'") === 1260, "R U2 D' B D' has order 1260");
  check(order("R U R' U'") === 6, "the sexy move has order 6");
  check(order('U') === 4 && order('U2') === 2 && order('M') === 4 && order('M2') === 2, 'a quarter turn has order 4, a half turn 2, for faces and slices');

  // what a turn does, by the net
  const f = C.facelets(C.apply(s0, C.parse('R')));
  check(f.slice(0, 9).join('') === '004004004', 'after R the top face has a green right-hand column (F goes to U)');
  check(f.slice(36, 45).join('') === '441441441', 'after R the front face has a yellow right-hand column (D goes to F)');
  const g = C.facelets(C.apply(s0, C.parse('U')));
  check(g.slice(36, 45).join('') === '222444444', 'after U the front face has a red top row (R comes round to F)');
  check(g.slice(27, 36).join('') === '444333333', 'after U the left face has a green top row (F goes to L)');
  const h = C.facelets(C.apply(s0, C.parse('F')));
  check(h.slice(0, 9).join('') === '000000333', 'after F the top face has an orange bottom row (L goes to U)');
  const dd = C.facelets(C.apply(s0, C.parse('D')));
  check(dd.slice(36, 45).join('') === '444444333', 'after D the front face has an orange bottom row (L comes round to F)');

  // turns undo, and a layer's four quarter turns are nothing
  let ok = true; const r2 = rng(11);
  for (let i = 0; i < 300; i++) {
    const m = randomMove(r2), s = C.applyAll(C.solved(), C.scrambleMoves(i, 12));
    if (C.key(C.apply(C.apply(s, m), C.invert(m))) !== C.key(s)) ok = false;
    if (C.key(C.applyAll(s, [m, m, m, m].map(x => C.mk ? x : { a: x.a, l: x.l, q: C.normQ(x.q) === 2 ? 2 : x.q }))) !== C.key(s) && C.normQ(m.q) !== 2) ok = false;
  }
  check(ok, 'a turn followed by its inverse changes nothing; four quarter turns of one layer change nothing');

  // a whole-cube rotation done with slices leaves every face one colour but is not the starting layout
  const rot = C.applyAll(s0, C.parseAll("R M' L'"));
  check(C.isSolved(rot) && C.key(rot) !== SOLVED_KEY, "R M' L' turns the whole cube: every face is still one colour, but the colours moved");
  check(!C.isSolved(C.apply(s0, C.parse('M'))), 'a lone middle slice is not solved');

  // notation
  let nok = true;
  for (const l of LETTERS) for (const m of ['', "'", '2']) { const t = l + m, p = C.parse(t); if (!p || C.name(p) !== t) nok = false; }
  check(nok, 'every move name parses and prints back the same');
  check(['X', 'R3', "R''", 'r', '', 'RR', "R'2"].every(t => C.parse(t) === null) && C.parseAll('R U x') === null, 'junk notation is refused');
  check(C.names(C.parseAll("R U R' U'")) === "R U R' U'", 'a sequence prints back as it was written');

  // layers turning mid-way land where the integer turn puts them
  let fok = true;
  for (let a = 0; a < 3; a++) for (let k = -3; k <= 4; k++) for (const v of [[1, 2, 3], [-1, 0, 1], [1.5, -0.5, 0.5]]) {
    const q = C.rotQ(v.map(Math.round), a, k), f2 = C.rotF(v.map(Math.round), a, k * Math.PI / 2).map(Math.round);
    if (q.join() !== f2.join()) fok = false;
  }
  check(fok, 'a layer caught at any angle (rotF) and a quarter turn (rotQ) agree at every multiple of 90 degrees, so a settled turn never jumps');
}

if (suites.includes('scramble')) {
  section('scramble: fair, the same for everyone, never already solved');
  const r = rng(3);
  for (const lv of C.LEVELS) {
    let ok = true, alwaysNew = true, noRep = true, noCancel = true, quarter = true;
    for (let i = 0; i < 400; i++) {
      const seed = (r() * 4294967296) >>> 0, ms = C.makeScramble(lv.id, seed), again = C.makeScramble(lv.id, seed);
      if (C.names(ms) !== C.names(again)) ok = false;
      if (ms.length !== lv.turns) ok = false;
      if (C.isSolved(C.applyAll(C.solved(), ms))) alwaysNew = false;
      for (let j = 1; j < ms.length; j++) {
        if (ms[j].a === ms[j - 1].a && ms[j].l === ms[j - 1].l) noRep = false;
        if (j > 1 && ms[j].a === ms[j - 2].a && ms[j].l === ms[j - 2].l && ms[j - 1].a === ms[j].a) noCancel = false;
      }
      if (ms.some(m => Math.abs(C.normQ(m.q)) !== 1 || C.name(m).length > 2 || 'UDRLFB'.indexOf(C.name(m)[0]) < 0)) quarter = false;
    }
    check(ok, `${lv.name}: ${lv.turns} turns, and the same seed is the same scramble`);
    check(alwaysNew, `${lv.name}: never already solved`);
    check(noRep && noCancel, `${lv.name}: no layer turned twice in a row, no U D U that is secretly shorter`);
    check(quarter, `${lv.name}: face quarter turns only`);
  }
  // Easy: no way home in three turns (measured by search from the solved cube), so four it is
  const seen = new Set([SOLVED_KEY]); let frontier = [C.solved()];
  for (let d = 0; d < 3; d++) { const nx = []; for (const s of frontier) for (const m of C.FACE_TURNS) { const t = C.apply(s, m), k = C.key(t); if (!seen.has(k)) { seen.add(k); nx.push(t); } } frontier = nx; }
  let near = 0, len4 = true;
  for (let i = 0; i < 1500; i++) { const g = C.newGame('easy', i * 7919 + 1); if (seen.has(C.key(g.cube))) near++; if (C.solution(g).length !== 4) len4 = false; }
  check(near === 0, `Easy: none of 1,500 scrambles is within three turns of solved (search found ${seen.size} positions that are)`);
  check(len4, 'Easy: the way home shown by the hint is exactly four turns');
  // Hard really is mixed
  const avg = id => { let t = 0; for (let i = 0; i < 200; i++) t += wrongStickers(C.newGame(id, i * 31 + 5).cube); return t / 200; };
  const e = avg('easy'), m = avg('medium'), h = avg('hard');
  check(e < m && m < h, `levels are ordered by how mixed they look: wrong stickers ${e.toFixed(1)} < ${m.toFixed(1)} < ${h.toFixed(1)}`);
  check(h > 36, `Hard looks like a real shuffle (${h.toFixed(1)} of 54 stickers out of place; a random cube has about 40)`);
  check(e > 12, `Easy is already visibly mixed (${e.toFixed(1)} of 54 stickers out of place after four turns)`);
  // all six faces get turned first, both ways
  const firsts = new Set(); for (let i = 0; i < 600; i++) firsts.add(C.name(C.makeScramble('medium', i)[0]));
  check(firsts.size === 12, 'any of the twelve face turns can start a scramble');
}

if (suites.includes('run')) {
  section('run: the clock-free rules, undo and the way home');
  const r = rng(21);
  let ok = true, finishes = true, undoOk = true, redOk = true;
  for (let t = 0; t < 600; t++) {
    const id = C.LEVELS[t % 3].id, g = C.newGame(id, (r() * 4294967296) >>> 0);
    const free = []; const n = (r() * 14) | 0;
    for (let i = 0; i < n; i++) { const m = randomMove(r); if (g.phase !== 'solved') { C.play(g, m); free.push(m); } }
    if (g.phase === 'solved') continue;
    // the stated reduction really is the same cube and never longer
    const all = g.scramble.concat(g.moves);
    if (C.key(C.applyAll(C.solved(), C.reduce(all))) !== C.key(g.cube) || C.reduce(all).length > all.length) redOk = false;
    // undo takes the last move back, to the cube as it was
    if (g.moves.length) {
      const before = C.key(g.cube), m = g.moves[g.moves.length - 1];
      const inv = C.undo(g);
      if (!inv || C.key(C.apply(g.cube, m)) !== before) undoOk = false;
      C.play(g, m);
    }
    // the way home leads home
    const sol = C.solution(g);
    let s = g.cube; for (const m of sol) s = C.apply(s, m);
    if (C.key(s) !== SOLVED_KEY) ok = false;
    for (const m of sol) C.play(g, m);
    if (g.phase !== 'solved') finishes = false;
  }
  check(ok, 'the solution (the reduced inverse of everything done) returns every one of 600 runs to the solved cube');
  check(finishes, 'playing that solution move by move ends in the solved phase');
  check(undoOk, 'undo takes back exactly the last move');
  check(redOk, 'reduce never lengthens and never changes the cube, even sliding past other layers on the same axis');

  const g = C.newGame('easy', 5);
  check(g.phase === 'ready' && g.moves.length === 0 && !g.assisted, 'a new run is ready, with no moves and no help used');
  check(C.undo(g) === null, 'undo with nothing to undo does nothing');
  C.play(g, C.parse('R')); check(g.phase === 'running' && g.moves.length === 1, 'the first move starts the run');
  C.undo(g); check(g.phase === 'ready', 'undoing the only move makes the run ready again');
  check(C.hint(g) && g.assisted, 'asking for a hint marks the run as helped');
  const sol = C.solution(g); for (const m of sol) C.play(g, m);
  check(g.phase === 'solved', 'following the hint to the end solves it');
  const n = g.moves.length; C.play(g, C.parse('R')); check(g.moves.length === n && g.phase === 'solved', 'nothing can be played after the solve');
  check(C.undo(g) === null, 'and nothing undone');
  check(C.hint(C.newGame('hard', 9)) !== null && C.hint(g) === null, 'a hint exists while there is a way home and not after');

  // a player who makes slice moves and rotates the whole cube is still solved when every face is one colour
  const g2 = C.newGame('easy', 12);
  for (const m of C.solution(g2)) C.play(g2, m);
  check(g2.phase === 'solved', 'solved by the book');
  const g3 = C.newGame('easy', 12);
  for (const m of C.solution(g3).concat(C.parseAll("R M' L'"))) C.play(g3, m);
  check(g3.phase === 'solved', "a solve finished with a whole-cube turn (R M' L') is still a solve");

  // difficulty is the length of the way home
  const len = id => { let t = 0; for (let i = 0; i < 100; i++) t += C.solution(C.newGame(id, i + 100)).length; return t / 100; };
  check(len('easy') === 4 && len('medium') > 6 && len('hard') > 18, `the way home is ${len('easy')}, ${len('medium').toFixed(1)}, ${len('hard').toFixed(1)} turns on average`);
}

if (suites.includes('gesture')) {
  section('gesture: the layer under the finger turns the way the finger moves');
  const r = rng(99), cam = { dist: 15, k: 80, cx: 200, cy: 300 };
  let trials = 0, badAxis = 0, badLayer = 0, badDir = 0, badLin = 0, minScore = 1, lowScore = 0;
  for (let t = 0; t < 6000; t++) {
    const yaw = (r() * 2 - 1) * Math.PI, pitch = (r() * 2 - 1) * 1.3, M = C.viewMat(yaw, pitch);
    const st = C.solved()[(r() * 54) | 0];
    const nv = C.mul(M, st.n), P = st.p.map((v, i) => v + st.n[i] * 0.5), pc = C.project(cam, M, P);
    const toEye = [-pc[3][0], -pc[3][1], cam.dist - pc[3][2]], len = Math.hypot(...toEye);
    if ((nv[0] * toEye[0] + nv[1] * toEye[1] + nv[2] * toEye[2]) / len < 0.35) continue; // only faces turned towards the player
    const phi = r() * Math.PI * 2, d = [Math.cos(phi) * 60, Math.sin(phi) * 60];
    const T = C.dragTurn(st, d, M, cam);
    trials++;
    if (!T) { badAxis++; continue; }
    if (st.n[T.a] !== 0) badAxis++;
    if (T.l !== st.p[T.a]) badLayer++;
    minScore = Math.min(minScore, T.score); if (T.score < 0.5) lowScore++;
    // brute force: turn the sticker a hair about each in-plane axis, see which way it moves on screen, and pick the axis that
    // follows the drag best; the core must have picked the same one
    let bestA = -1, bestC = -1, other = 0;
    for (let a = 0; a < 3; a++) {
      if (st.n[a] !== 0) continue;
      for (const sgn of [1, -1]) {
        const P2 = C.rotF(P, a, sgn * 1e-5), pc2 = C.project(cam, M, P2), mv = [pc2[0] - pc[0], pc2[1] - pc[1]], ml = Math.hypot(...mv);
        const c = (mv[0] * d[0] + mv[1] * d[1]) / (ml * 60);
        if (c > bestC) { bestC = c; bestA = a; }
      }
    }
    if (bestA !== T.a) badDir++;
    // a hair of the drag turns the sticker along the drag (never against it) in the straight line the core reports
    const th = C.dragAngle(T, [d[0] * 1e-6, d[1] * 1e-6]);
    const P2 = C.rotF(P, T.a, th), pc2 = C.project(cam, M, P2), mv = [pc2[0] - pc[0], pc2[1] - pc[1]], ml = Math.hypot(...mv);
    if (ml > 1e-12) {
      if ((mv[0] * d[0] + mv[1] * d[1]) < 0) badDir++;
      const vh = [T.v[0] / T.len, T.v[1] / T.len];
      if (Math.abs(Math.abs((mv[0] * vh[0] + mv[1] * vh[1]) / ml) - 1) > 1e-4) badLin++;
      // and the full drag, followed along that line, is the whole drag's length along it
      const full = C.dragAngle(T, d), want = (d[0] * vh[0] + d[1] * vh[1]);
      if (Math.abs(full * T.len - want) > 1e-6) badLin++;
    }
  }
  check(trials > 1000, `${trials} drags tried across random views`);
  check(badAxis === 0, 'the turn axis always lies in the face that was touched');
  check(badLayer === 0, 'the layer is always the one the touched cubie is in');
  check(badDir === 0, 'the axis is the one a brute-force search finds, and the touched sticker never moves against the finger');
  check(badLin === 0, 'the sticker moves along the screen direction the core reports (the finger can follow it 1:1)');
  check(lowScore / trials < 0.08, `a drag is rarely ambiguous between the two axes (${(100 * lowScore / trials).toFixed(1)}% of random drags, at faces turned well towards the player, are worse than 60 degrees off both)`);

  // the default view: a drag along a row of the front face turns that row; along a column turns the column
  const M = C.viewMat(-0.7, 0.42), front = { p: [0, 1, 1], n: [0, 0, 1], c: 4 };
  const pf = C.project(cam, M, [0, 1, 1.5]), right = C.project(cam, M, [1, 1, 1.5]), up = C.project(cam, M, [0, 2, 1.5]);
  const along = (a, b) => [b[0] - a[0], b[1] - a[1]];
  const T1 = C.dragTurn(front, along(pf, right), M, cam), T2 = C.dragTurn(front, along(pf, up), M, cam);
  check(T1.a === 1 && T1.l === 1, 'dragging along a row of the front face turns that row (the top layer)');
  check(T2.a === 0 && T2.l === 0, 'dragging up the middle column of the front face turns the middle slice');
  check(C.dragTurn(front, [0, 0], M, cam) === null, 'no movement picks nothing');

  // letting go: how far a layer settles
  const Q = Math.PI / 2;
  check(C.settle(0.2, 0) === 0 && C.settle(-0.2, 0) === 0, 'a small turn settles back');
  check(C.settle(1.0, 0) === 1 && C.settle(-1.0, 0) === -1, 'past the halfway point it settles forward, either way');
  check(C.settle(0.5, 6) === 1 && C.settle(0.5, -6) === 0 && C.settle(-0.5, -6) === -1, 'a flick carries it on');
  check(C.settle(3, 0) === 2 && C.settle(-3, 0) === -2 && C.settle(9, 99) === 2, 'at most a half turn from one drag');
  let mono = true, prev = -9; for (let t = -4; t <= 4; t += 0.01) { const q = C.settle(t, 0); if (q < prev) mono = false; prev = q; }
  check(mono, 'settling is monotone in the angle');
}

if (suites.includes('saves')) {
  section('saves: nothing is believed without checking');
  const g = C.newGame('medium', 424242);
  C.play(g, C.parse('R')); C.play(g, C.parse("U'")); C.play(g, C.parse('M2'));
  const o = JSON.parse(JSON.stringify(C.encodeGame(g, 12345.6)));
  const d = C.decodeGame(o);
  check(d && C.key(d.game.cube) === C.key(g.cube) && d.game.moves.length === 3 && d.ms === 12346 && d.game.phase === 'running', 'a run in progress comes back move for move, with its time');
  check(d && C.names(d.game.scramble) === C.names(g.scramble), 'and with the same scramble');
  const h = C.newGame('easy', 5); h.assisted = true; check(C.decodeGame(C.encodeGame(h, 0)).game.assisted, 'help is remembered');
  const bad = [null, undefined, 5, 'x', {}, { ...o, v: 2 }, { ...o, level: 'insane' }, { ...o, seed: -1 }, { ...o, seed: 1.5 }, { ...o, seed: '5' }, { ...o, seed: 4294967296 },
    { ...o, moves: 'R U x' }, { ...o, moves: 7 }, { ...o, t: -1 }, { ...o, t: NaN }, { ...o, t: 1e12 }, { ...o, t: 'soon' }, { ...o, moves: 'R '.repeat(700) }];
  check(bad.every(x => C.decodeGame(x) === null), `${bad.length} forged or broken saves are all refused`);
  // a save that replays to a solved cube is not a run in progress
  const w = C.newGame('easy', 5), won = C.names(C.solution(w));
  check(C.decodeGame({ v: 1, level: 'easy', seed: 5, moves: won, assisted: false, t: 1000 }) === null, 'a save that is already solved is refused');

  // records
  const empty = C.emptyStats();
  check(C.cleanStats(null).easy.best === null && C.cleanStats('x').hard.solves === 0, 'missing stats are empty ones');
  const junk = C.cleanStats({ easy: { best: -5, bestMoves: 'a', solves: 1.5 }, medium: { best: 1234, bestMoves: 30, solves: 4 }, hard: 7, extra: 1 });
  check(junk.easy.best === null && junk.easy.bestMoves === null && junk.easy.solves === 0 && junk.medium.best === 1234 && junk.hard.solves === 0 && !('extra' in junk), 'garbage stats are cleaned, good ones kept');
  let rec = C.record(empty, 'easy', 20000, 12, false);
  check(rec.newBest && rec.prev === null && rec.stats.easy.best === 20000 && rec.stats.easy.bestMoves === 12 && rec.stats.easy.solves === 1, 'a first solve is a first best');
  rec = C.record(rec.stats, 'easy', 25000, 9, false);
  check(!rec.newBest && rec.newBestMoves && rec.stats.easy.best === 20000 && rec.stats.easy.bestMoves === 9 && rec.stats.easy.solves === 2, 'a slower solve with fewer moves only improves the move record');
  rec = C.record(rec.stats, 'easy', 15000, 20, false);
  check(rec.newBest && rec.prev === 20000 && rec.stats.easy.best === 15000 && rec.stats.easy.bestMoves === 9, 'a faster solve is a new best and says what it beat');
  rec = C.record(rec.stats, 'easy', 1000, 4, true);
  check(!rec.newBest && !rec.newBestMoves && rec.stats.easy.best === 15000 && rec.stats.easy.bestMoves === 9 && rec.stats.easy.solves === 4, 'a helped solve counts as a solve and never as a record');
  check(C.record(rec.stats, 'nope', 1, 1, false).stats.easy.solves === 4, 'an unknown level changes nothing');
  check(['0.00', '1.23', '59.99', '1:00.00', '12:34.32'].join() === [0, 1234, 59990, 60000, 754321].map(C.fmt).join(), 'times print as 1.23 and 1:00.00');
  check(C.fmt(-5) === '0.00' && C.fmt(9) === '0.00' && C.fmt(10) === '0.01', 'times never go negative');
}

async function pageSuite() {
  section('page: the real page in Chromium');
  let chromium;
  try { ({ chromium } = await import('playwright')); } catch (e) { try { ({ chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs')); } catch (e2) { console.log('  skipped: playwright is not installed'); return; } }
  let browser;
  try { browser = await chromium.launch({ args: ['--no-sandbox'] }); } catch (e) { console.log('  skipped: no Chromium to launch'); return; }
  const url = pathToFileURL(PAGE).href;
  for (const [name, vp, touch] of [['desktop', { width: 1280, height: 800 }, false], ['phone', { width: 390, height: 844 }, true]]) {
    const context = await browser.newContext({ viewport: vp, hasTouch: touch, isMobile: touch });
    const p = await context.newPage(); const errs = [];
    p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); }); p.on('pageerror', e => errs.push(e.message));
    await p.goto(url); await p.waitForTimeout(700);
    const st = () => p.evaluate(() => ({ mode: __rubik.mode, moves: __rubik.game && __rubik.game.moves.length, phase: __rubik.game && __rubik.game.phase, turning: __rubik.turning }));
    check((await st()).mode === 'idle', `${name}: opens on a cube to play with`);
    // free play: drag a layer on the loose cube
    const drag = async (pred, dx, dy) => {
      const pt = await p.evaluate(src => { const f = eval(src); const h = __rubik.hits.filter(f)[0]; const q = h.q; return [(q[0][0] + q[2][0]) / 2, (q[0][1] + q[2][1]) / 2]; }, pred);
      await p.mouse.move(pt[0], pt[1]); await p.mouse.down();
      for (let i = 1; i <= 14; i++) { await p.mouse.move(pt[0] + dx * i / 14, pt[1] + dy * i / 14); await p.waitForTimeout(12); }
      await p.mouse.up(); await p.waitForTimeout(700);
    };
    await p.evaluate(() => { const s = __rubik.save; s.taught = false; });
    const before = await p.evaluate(() => CUBE.key(__rubik.st));
    await drag('x => x.n[2] === 1 && x.p[1] === 1 && x.p[0] === 0', 190, 0);
    const after = await p.evaluate(() => CUBE.key(__rubik.st));
    check(before !== after, `${name}: a drag across a face turns a layer`);
    // play: the clock starts on the first touch, not on Play
    await p.click('[data-level=easy]'); await p.click('#play'); await p.waitForTimeout(2600);
    let s = await st();
    check(s.mode === 'play' && s.phase === 'ready' && await p.evaluate(() => __rubik.elapsed()) === 0, `${name}: scrambled and waiting, the clock at zero`);
    check(await p.evaluate(() => CUBE.key(__rubik.st) === CUBE.key(__rubik.game.cube)), `${name}: the cube on screen is the cube the rules hold`);
    await p.waitForTimeout(400);
    check(await p.evaluate(() => __rubik.elapsed()) === 0, `${name}: the clock has not moved by itself`);
    await p.keyboard.press('r'); await p.waitForTimeout(500);
    s = await st(); check(s.moves === 1 && await p.evaluate(() => __rubik.elapsed()) > 0, `${name}: the first turn counts a move and starts the clock`);
    await p.click('#undo'); await p.waitForTimeout(500);
    s = await st(); check(s.moves === 0, `${name}: undo takes it back`);
    await p.click('#hint'); await p.waitForTimeout(300);
    check(await p.evaluate(() => __rubik.game.assisted), `${name}: a hint marks the run as helped`);
    // solve it by the notation the hint speaks
    const sol = await p.evaluate(() => CUBE.names(CUBE.solution(__rubik.game)));
    for (const t of sol.split(' ')) { const k = t[0].toLowerCase(); await p.keyboard.press((t.endsWith("'") ? 'Shift+' : '') + k); if (t.endsWith('2')) { await p.waitForTimeout(200); await p.keyboard.press(k); } await p.waitForTimeout(190); }
    await p.waitForTimeout(700);
    s = await st(); check(s.mode === 'solved' && s.phase === 'solved', `${name}: the last turn ends the run`);
    check(await p.evaluate(() => __rubik.save.stats.easy.solves) === 1 && await p.evaluate(() => __rubik.save.stats.easy.best) === null, `${name}: a helped solve is counted but sets no best`);
    // a saved run in progress comes back
    await p.click('#again'); await p.waitForTimeout(2600);
    await p.keyboard.press('u'); await p.waitForTimeout(500);
    const was = await p.evaluate(() => ({ k: CUBE.key(__rubik.game.cube), n: __rubik.game.moves.length }));
    await p.reload(); await p.waitForTimeout(800);
    const now = await p.evaluate(() => ({ mode: __rubik.mode, k: __rubik.game && CUBE.key(__rubik.game.cube), n: __rubik.game && __rubik.game.moves.length, ok: __rubik.game && CUBE.key(__rubik.st) === CUBE.key(__rubik.game.cube) }));
    check(now.mode === 'play' && now.k === was.k && now.n === was.n && now.ok, `${name}: a run in progress is still there after a reload`);
    check(errs.length === 0, `${name}: no console errors`, errs.join(' | '));
    await context.close();
  }
  // the old page's saved bests and settings carry over once, and never overwrite newer data
  {
    const old = JSON.stringify({ muted: true, difficulty: 'HARD', pb: { EASY: { time: 23450, moves: 7 }, MEDIUM: { time: null, moves: null }, HARD: { time: 181000, moves: 31 } } });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await context.addInitScript(o => { if (!localStorage.getItem('rubik.v2') && !sessionStorage.getItem('seeded')) { localStorage.setItem('rubiks_v3', o); sessionStorage.setItem('seeded', '1'); } }, old);
    const p = await context.newPage(); const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    await p.goto(url); await p.waitForTimeout(600);
    const s = await p.evaluate(() => ({ st: __rubik.save.stats, sound: __rubik.save.sound, level: __rubik.save.level }));
    check(s.st.easy.best === 23450 && s.st.easy.bestMoves === 7 && s.st.hard.best === 181000 && s.st.hard.bestMoves === 31 && s.st.medium.best === null, 'migration: the old page\'s bests carry over, and a null (Infinity) stays empty');
    check(s.sound === false && s.level === 'hard', 'migration: mute and the last level carry over');
    await p.evaluate(() => { __rubik.save.stats.easy.best = 1000; });
    await p.click('#sound'); await p.waitForTimeout(100);
    await p.reload(); await p.waitForTimeout(600);
    const eb = await p.evaluate(() => __rubik.save.stats.easy.best); check(eb === 1000, 'migration: once the new save exists the old one is not read again', 'easy best is ' + eb);
    check(errs.length === 0, 'migration: no errors', errs.join(' | '));
    await context.close();
  }
  await browser.close();
}

if (suites.includes('page')) await pageSuite();

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
