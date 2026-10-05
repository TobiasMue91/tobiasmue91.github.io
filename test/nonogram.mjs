#!/usr/bin/env node
// Test suite for games/nonogram.html (Tesserae).
//
// Runs the page's DOM-free <script id="core"> block in Node. A nonogram makes one promise: every
// picture can be worked out by logic, no guessing, and the numbers on the wall are true of it. A
// picture with two answers, or a solver that is nearly right, looks exactly like a good one.
// No browser, no server.
//
//   node test/nonogram.mjs                  # everything
//   node test/nonogram.mjs lines pictures   # named suites only
//   node test/nonogram.mjs --page=path.html # run against another copy of the page
//
// Suites: lines, pictures, play, hints, saves.

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name, dflt) => { const a = args.find(x => x.startsWith(`--${name}=`)); return a ? a.split('=')[1] : dflt; };
const PAGE = opt('page', join(HERE, '..', 'games', 'nonogram.html'));
const ALL = ['lines', 'pictures', 'play', 'hints', 'saves'];
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
vm.runInContext(core[1] + '\nthis.T = TESS;', ctx);
const T = ctx.T;
const {BLANK, TILE, MARK} = T;

// Small deterministic generator, so a failure can be replayed.
function rng(seed) { let s = seed >>> 0 || 1; return () => (s = Math.imul(s ^ (s >>> 15), 2246822519) + 0x9e3779b9 >>> 0) / 4294967296; }

// Every line of length n that carries the clue, written the plain way.
function allLines(clue, n) {
  const out = [];
  for (let m = 0; m < (1 << n); m++) {
    const line = []; for (let i = 0; i < n; i++) line.push(m >> i & 1);
    if (JSON.stringify(T.runs(line, v => v === 1)) === JSON.stringify(clue)) out.push(line);
  }
  return out;
}

if (suites.includes('lines')) {
  section('lines: what one clue forces, against listing every way to lay it');
  const rnd = rng(7);
  let cases = 0, bad = 0, firstBad = '';
  for (let n = 1; n <= 9; n++) {
    for (let t = 0; t < 400; t++) {
      // a random line, its clue, and a random handful of its cells shown
      const truth = Array.from({length: n}, () => rnd() < 0.5 ? 1 : 0);
      let clue = T.runs(truth, v => v === 1);
      const known = truth.map(v => rnd() < 0.3 ? (v ? TILE : MARK) : BLANK);
      // sometimes break the knowledge, so contradictions are exercised too
      if (rnd() < 0.2) { const i = (rnd() * n) | 0; known[i] = known[i] === TILE ? MARK : TILE; }
      const fits = allLines(clue, n).filter(l => l.every((v, i) => known[i] === BLANK || (known[i] === TILE) === (v === 1)));
      const want = fits.length ? known.map((k, i) => fits.every(l => l[i] === 1) ? TILE : fits.every(l => l[i] === 0) ? MARK : BLANK) : null;
      const got = T.solveLine(clue, known);
      cases++;
      const same = want === null ? got === null : got && got.every((v, i) => v === want[i]);
      if (!same) { bad++; if (!firstBad) firstBad = `clue ${JSON.stringify(clue)} known ${known.join('')} want ${want && want.join('')} got ${got && got.join('')}`; }
    }
  }
  // the brute-force counter must itself see two pictures where there are two
  check(countSolutions(T.parse({id: 'a', name: 'a', set: 0, bg: '#000000', pal: {x: '#ffffff'}, rows: ['x.', '.x']})) === 2, 'the brute-force counter finds both pictures of an ambiguous 2x2');
  check(!bad, `solveLine agrees with brute force on ${cases} lines of 1-9 cells`, `${bad} differ, e.g. ${firstBad}`);
  check(JSON.stringify(T.solveLine([], [0, 0, 0])) === '[2,2,2]', 'an empty clue marks the whole line');
  check(JSON.stringify(T.solveLine([5], [0, 0, 0, 0, 0])) === '[1,1,1,1,1]', 'a 5 in five squares fills them');
  check(T.solveLine([3], [1, 2, 0, 0, 0]) === null, 'a clue that cannot fit what is known is a contradiction');
}

// Counts every picture with these clues, row by row, pruning on the columns.
function countSolutions(P, cap = 2) {
  const cands = P.rows.map(cl => allLines(cl, P.w));
  let found = 0;
  const colState = Array.from({length: P.w}, () => []);
  const colOk = () => {
    for (let c = 0; c < P.w; c++) {
      const col = colState[c], cl = P.cols[c];
      const rr = T.runs(col, v => v === 1);
      if (rr.length > cl.length) return false;
      for (let i = 0; i < rr.length - 1; i++) if (rr[i] !== cl[i]) return false;
      if (rr.length) {
        const last = rr.length - 1, open = col[col.length - 1] === 1;
        if (open ? rr[last] > cl[last] : rr[last] !== cl[last]) return false;
      }
      // enough rows left to finish the clue
      const used = rr.length, rest = cl.slice(used - (col.length && col[col.length - 1] === 1 ? 1 : 0));
      const need = rest.reduce((a, b) => a + b, 0) + Math.max(0, rest.length - 1);
      if (col.length + need - (col[col.length - 1] === 1 && rest.length ? rr[rr.length - 1] : 0) > P.h + 0 && rest.length) return false;
    }
    return true;
  };
  (function go(r) {
    if (found >= cap) return;
    if (r === P.h) { for (let c = 0; c < P.w; c++) if (JSON.stringify(T.runs(colState[c], v => v === 1)) !== JSON.stringify(P.cols[c])) return; found++; return; }
    for (const line of cands[r]) {
      for (let c = 0; c < P.w; c++) colState[c].push(line[c]);
      if (colOk()) go(r + 1);
      for (let c = 0; c < P.w; c++) colState[c].pop();
    }
  })(0);
  return found;
}

if (suites.includes('pictures')) {
  section('pictures: every one is fair');
  const ids = new Set(), names = new Set();
  for (const P of T.PUZZLES) {
    const tag = `${P.id} (${P.w}x${P.h})`;
    check(!ids.has(P.id) && !names.has(P.name), `${tag}: id and name are its own`);
    ids.add(P.id); names.add(P.name);
    check(P.w === P.h && P.w === T.SETS[P.set].size, `${tag}: is the size of its set`);
    let tiles = 0, noGlaze = 0;
    for (let i = 0; i < P.sol.length; i++) { if (P.sol[i]) { tiles++; if (!/^#[0-9a-f]{6}$/i.test(P.glaze[i] || '')) noGlaze++; } }
    check(noGlaze === 0, `${tag}: every tile has a glaze from its palette`);
    check(/^#[0-9a-f]{6}$/i.test(P.bg), `${tag}: has a background colour`);
    const fill = tiles / (P.w * P.h);
    check(fill > 0.3 && fill < 0.85, `${tag}: neither bare nor solid`, `${Math.round(fill * 100)}% tiles`);
    const longest = Math.max(...P.rows.map(a => a.length), ...P.cols.map(a => a.length));
    check(longest <= 5, `${tag}: no clue longer than five numbers (it must fit a phone)`, `${longest}`);
    const r = T.solve(P);
    check(r.solved && !r.contradiction, `${tag}: line logic alone finishes it, no guessing`);
    check(r.solved && r.g.every((v, i) => (v === TILE) === (P.sol[i] === 1)), `${tag}: and finishes on the picture`);
    if (P.w <= 10) check(countSolutions(P) === 1, `${tag}: brute force finds one picture for these numbers`);
  }
  for (let s = 0; s < T.SETS.length; s++) check(T.PUZZLES.some(p => p.set === s), `set ${T.SETS[s].name} has pictures`);
  check(T.PUZZLES.length >= 20, `at least twenty pictures (${T.PUZZLES.length})`);
}

if (suites.includes('play')) {
  section('play: the picture is the judge');
  const P = T.PUZZLES.find(p => p.id === 'heart');
  // a wrong tile cracks, becomes a mark, and costs a crack
  let S = T.newState(P);
  const wrong = P.sol.indexOf(0), right = P.sol.indexOf(1);
  let ev = T.place(P, S, wrong, TILE);
  check(ev.crack && S.g[wrong] === MARK && S.cracks === 1, 'a tile where none belongs cracks and is swapped for a mark');
  ev = T.place(P, S, right, MARK);
  check(ev.crack && ev.refused && S.g[right] === BLANK && S.cracks === 2, 'a mark where a tile belongs is refused and costs a crack');
  ev = T.place(P, S, right, TILE);
  check(!ev.crack && S.g[right] === TILE && S.cracks === 2, 'a right tile is laid and costs nothing');
  check(T.place(P, S, right, TILE).changed === false, 'laying a laid tile does nothing');

  // finishing a line marks what is left, once
  const Q = T.PUZZLES.find(p => p.id === 'pine');
  S = T.newState(Q);
  const mid = [0, 1, 2, 3, 4].map(r => r * 5 + 2);
  let finished = 0, autoMarks = 0;
  for (const i of mid) { const e = T.place(Q, S, i, TILE); finished += e.lines.length; autoMarks += e.auto.length; }
  check(finished >= 2, 'laying the last tile of a line reports the line', `${finished}`);
  check(autoMarks > 0 && S.g[0] === MARK, 'a finished line marks its leftover squares');
  check(T.place(Q, S, 2, BLANK).changed && T.lineDone(Q, S.g, 'c', 2) === false, 'taking a tile back reopens its line');

  // strokes
  check(T.strokeMode(BLANK, 'lay') === 'lay' && T.strokeMode(TILE, 'lay') === 'unlay' && T.strokeMode(MARK, 'lay') === 'lay', 'a lay stroke starting on a tile erases, otherwise lays');
  check(T.strokeMode(BLANK, 'mark') === 'mark' && T.strokeMode(MARK, 'mark') === 'unmark' && T.strokeMode(TILE, 'mark') === 'mark', 'a mark stroke starting on a mark clears, otherwise marks');
  const row = T.span(P, {r: 2, c: 0}, {r: 2, c: 4});
  check(row.join() === '10,11,12,13,14', 'span walks a row');
  check(T.span(P, {r: 4, c: 1}, {r: 0, c: 1}).join() === '21,16,11,6,1', 'span walks a column backwards');
  S = T.newState(P);
  T.place(P, S, 11, TILE); // a laid tile in the way
  let n = 0; for (const i of row) if (T.strokeStep(P, S, 'lay', i, i === row[0]).changed) n++;
  check(n === 4 && S.g.slice(10, 15).every(v => v === TILE), 'a lay stroke over a laid tile lays only the rest');
  S = T.newState(P); T.place(P, S, 0, MARK);
  check(!T.strokeStep(P, S, 'lay', 0, false).changed && S.g[0] === MARK && T.strokeStep(P, S, 'lay', 0, true).crack, 'a stroke steps over marks, a tap on one tries a tile');

  // whole pictures by a random player
  const rnd = rng(11);
  let badTiles = 0, badMarks = 0, creditsOk = true;
  for (const R of T.PUZZLES) {
    for (let game = 0; game < 4; game++) {
      const St = T.newState(R); let cracks = 0;
      for (let step = 0; step < R.w * R.h * 3 && !T.isSolved(R, St); step++) {
        const i = (rnd() * R.w * R.h) | 0, v = [TILE, MARK, BLANK][(rnd() * 3) | 0];
        const e = T.place(R, St, i, v);
        if (e.crack) cracks++;
        if (e.solved !== T.isSolved(R, St)) creditsOk = false;
      }
      for (let i = 0; i < St.g.length; i++) { if (St.g[i] === TILE && !R.sol[i]) badTiles++; if (St.g[i] === MARK && R.sol[i]) badMarks++; }
      if (cracks !== St.cracks) creditsOk = false;
    }
  }
  check(badTiles === 0 && badMarks === 0, 'a random player can never leave a wrong tile or a mark on a tile');
  check(creditsOk, 'every crack is counted once and `solved` is reported exactly when the last tile lands');
}

if (suites.includes('hints')) {
  section('hints: a hint is always true and always leads on');
  for (const P of T.PUZZLES) {
    const S = T.newState(P); let n = 0, ok = true, why = '', kinds = new Set();
    while (!T.isSolved(P, S) && n < 600) {
      const h = T.hint(P, S);
      if (!h) { ok = false; why = 'no hint but not solved'; break; }
      kinds.add(h.kind);
      const lineLen = h.axis === 'r' ? P.w : P.h, sum = h.clue.reduce((a, b) => a + b, 0) + Math.max(0, h.clue.length - 1);
      if (h.kind === 'full' && sum !== lineLen) { ok = false; why = 'full that is not full'; break; }
      if (h.kind === 'empty' && h.clue.length) { ok = false; why = 'empty that is not'; break; }
      if (!h.text) { ok = false; why = 'no words'; break; }
      for (const {i, v} of h.cells) {
        if ((v === TILE) !== (P.sol[i] === 1)) { ok = false; why = `hint says ${v} at ${i}`; }
        const e = T.place(P, S, i, v);
        if (e.crack) { ok = false; why = 'hint cell cracked'; }
      }
      if (!ok) break;
      n++;
    }
    check(ok && T.isSolved(P, S) && S.cracks === 0, `${P.id}: following hints alone solves it with no cracks`, why || `${n} hints`);
  }
  const P = T.PUZZLES.find(p => p.id === 'heart');
  const h = T.hint(P, T.newState(P));
  check(h && h.kind === 'full', 'the first hint of the first picture is a line that is simply full');
}

if (suites.includes('saves')) {
  section('saves, the daily picture, and the clock');
  const P = T.PUZZLES.find(p => p.id === 'owl');
  const S = T.newState(P);
  for (const x of T.hint(P, S).cells) T.place(P, S, x.i, x.v);
  S.cracks = 2;
  const back = T.unpack(P, JSON.parse(JSON.stringify(T.pack(S))));
  check(back.g.join('') === S.g.join('') && back.cracks === 2 && back.moves === S.moves, 'a save comes back cell for cell');
  const forged = {g: '1'.repeat(P.w * P.h), cracks: -5, moves: 'x'};
  const f = T.unpack(P, forged);
  check(f.g.every((v, i) => v === (P.sol[i] ? TILE : BLANK)) && f.cracks === 0 && f.moves === 0, 'a forged save keeps only what is true of the picture');
  check(T.unpack(P, null).g.every(v => v === 0) && T.unpack(P, {g: 'abc'}).g.every(v => v === 0), 'rubbish or a different size is an empty board');

  const ids = T.PUZZLES.map(p => p.id);
  check(T.dailyPick('2026-10-05', ids, {}) === T.dailyPick('2026-10-05', ids, {}), 'the daily picture is the same twice');
  const solved = Object.fromEntries(ids.slice(1).map(i => [i, 1]));
  check(T.dailyPick('2026-10-06', ids, solved) === ids[0], 'the daily picture is the one left unsolved');
  const seen = new Set(); for (let d = 1; d <= 120; d++) seen.add(T.dailyPick('2026-11-' + d, ids, {}));
  check(seen.size >= Math.floor(ids.length * 0.7), `a few months of days reach most pictures (${seen.size}/${ids.length})`);
  check(T.dailyPick('x', ids, Object.fromEntries(ids.map(i => [i, 1]))) !== undefined, 'with everything solved it still picks one');
  check(T.fmtTime(0) === '00:00' && T.fmtTime(61500) === '01:01' && T.fmtTime(3599000) === '59:59' && T.fmtTime(3600000) === '60:00', 'the clock reads minutes and seconds');
  check(T.roman(14) === 'XIV' && T.roman(9) === 'IX' && T.roman(23) === 'XXIII', 'panel numbers are Roman');
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
