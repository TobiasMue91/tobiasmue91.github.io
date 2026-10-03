#!/usr/bin/env node
// Test suite for games/emoji_match_three.html (Moodswing).
//
// Runs the page's DOM-free <script id="core"> block in Node: the deal, the matching rules, the specials and their
// combinations, the clouds, the goals and the levels. The page only animates the events the core returns, so two
// promises can only be checked here: that every rule does what the board shows, and that the event stream describes
// the board exactly - a piece the page never moved, or one it moved to the wrong cell, would look like a glitch that
// nobody can reproduce.
//
//   node test/emoji_match_three.mjs                 # everything except the slow level calibration
//   node test/emoji_match_three.mjs rules events    # named suites only
//   node test/emoji_match_three.mjs levels --full   # every level, the way the TABLE in the core was measured
//   node test/emoji_match_three.mjs --page=path.html
//
// Suites:
//   deal    - every level's opening board: no line already made, moves to make, holes empty, clouds where lines cross
//   rules   - stacked boards: threes, fours, fives, Ls and Ts, what each special clears, every combination, refusals
//   clouds  - layers come off one per clear, the goal counts hits, storms take two
//   events  - random games replayed from their events alone end on exactly the core's board, after every move
//   play    - invariants over thousands of moves: full board, unique pieces, no line left standing, a move always open
//   save    - a game saved at any moment and loaded again carries on move for move
//   finale  - moves left at a win are paid out and the board is left calm
//   levels  - a bot with a person's habit of missing things wins each level about as often as its TABLE entry says

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (n, d) => { const a = args.find(x => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const FULL = args.includes('--full');
const PAGE = opt('page', join(HERE, '..', 'games', 'emoji_match_three.html'));
const ALL = ['deal', 'rules', 'clouds', 'events', 'play', 'save', 'finale', 'levels'];
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
vm.runInContext(core[1] + '\nthis.MS = MS;', ctx);
const MS = ctx.MS;
const {W, H, N} = MS;
const J = x => JSON.parse(JSON.stringify(x));
function mulberry(a) { return () => { let t = (a = (a + 0x6D2B79F5) | 0); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// A stacked board: a filler of moods c, d and e that holds no line, with pieces placed on it by cell. A piece is a
// letter a-f (moods 0-5); a capital is striped across, a trailing '|' striped down, a trailing '*' a burst, R a ring.
const FILL = ['cdecdecd', 'decdecde', 'ecdecdec', 'cdecdecd', 'decdecde', 'ecdecdec', 'cdecdecd', 'decdecde'];
const at = (x, y) => y * W + x;
function parse(t) {
  if (t === 'R') return {m: MS.RING, sp: 'r'};
  const m = t.toLowerCase().charCodeAt(0) - 97;
  return {m, sp: t[1] === '|' ? 'v' : t[1] === '*' ? 'b' : t[0] !== t[0].toLowerCase() ? 'h' : null};
}
function board(place = {}, extra = {}) {
  const st = MS.start(1, 0);
  st.colors = 6; st.moves = 30; st.r = 12345;
  st.goals = extra.goals || [{t: 'm', m: 5, n: 99, left: 99}];
  st.mask = new Array(N).fill(true);
  st.clouds = new Array(N).fill(0);
  st.cells = FILL.join('').split('').map(c => ({...parse(c), id: st.id++}));
  for (const [k, t] of Object.entries(place)) { const [x, y] = k.split(',').map(Number); st.cells[at(x, y)] = {...parse(t), id: st.id++}; }
  for (const [k, l] of Object.entries(extra.clouds || {})) { const [x, y] = k.split(',').map(Number); st.clouds[at(x, y)] = l; }
  return st;
}
const firstClear = ev => ev && ev.find(e => e.e === 'clear');
const has = (c1, cells) => c1 && cells.every(i => c1.cleared.some(c => c.i === i));
const row = y => Array.from({length: W}, (_, k) => at(k, y)), col = x => Array.from({length: H}, (_, k) => at(x, k));
const square = (x, y, r) => { const o = []; for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (x + dx >= 0 && y + dy >= 0 && x + dx < W && y + dy < H) o.push(at(x + dx, y + dy)); return o; };

// ---------------------------------------------------------------- deal
if (suites.includes('deal')) {
  section('deal');
  let bad = 0;
  for (let n = 1; n <= MS.LEVELS + 5; n++) {
    const lv = MS.level(n);
    for (let a = 0; a < 3; a++) {
      const st = MS.start(n, a);
      if (MS.groups(st).length) { bad++; fail(`level ${n} attempt ${a}: the deal already holds a line`); }
      if (MS.findMoves(st).length < 3) { bad++; fail(`level ${n} attempt ${a}: fewer than three moves open`); }
      for (let i = 0; i < N; i++) if (!st.mask[i] && (st.cells[i] || st.clouds[i])) { bad++; fail(`level ${n}: something in hole ${i}`); }
      for (let i = 0; i < N; i++) if (st.mask[i] && !st.cells[i]) { bad++; fail(`level ${n}: empty cell ${i}`); }
      for (const p of st.cells) if (p && p.m >= st.colors) { bad++; fail(`level ${n}: mood ${p.m} with only ${st.colors} colours`); }
    }
    for (const g of lv.goals) {
      if (g.t === 'm' && g.m >= lv.colors) fail(`level ${n}: goal asks for mood ${g.m}, only ${lv.colors} on the board`);
      if (g.t === 'c') check(g.n === lv.cloudMap.reduce((s, v) => s + v, 0) && g.n > 0, `level ${n}: the cloud goal counts every layer`, `goal ${g.n}`);
    }
    // a cloud only where a line of three can cross it both ways
    const mask = MS.MASKS[lv.mask];
    const ok = (x, y) => x >= 0 && y >= 0 && x < W && y < H && mask[y][x] === '#';
    const run = (x, y, dx, dy) => [-2, -1, 0].some(s => [0, 1, 2].every(k => ok(x + (s + k) * dx, y + (s + k) * dy)));
    lv.cloudMap.forEach((l, i) => { if (l && !(run(i % W, i / W | 0, 1, 0) && run(i % W, i / W | 0, 0, 1))) fail(`level ${n}: cloud at ${i} that no line can cross`); });
    check(lv.stars[0] < lv.stars[1] && lv.stars[1] < lv.stars[2], `level ${n}: star marks rise`, lv.stars.join(','));
  }
  eq(J(MS.start(7, 3).cells), J(MS.start(7, 3).cells), 'same level and attempt, same deal');
  check(JSON.stringify(MS.start(7, 3).cells) !== JSON.stringify(MS.start(7, 4).cells), 'a new attempt deals a new board');
  eq(MS.level(MS.LEVELS + 1).moves, MS.level(MS.TUTOR + 1).moves, 'past the last level the designs come round again');
  check(!bad, 'every opening board is playable');
}

// ---------------------------------------------------------------- rules
if (suites.includes('rules')) {
  section('rules');
  const THREE = {'0,0': 'a', '1,0': 'a', '3,0': 'a'};          // swap (2,0) with (3,0) makes a a a
  let st = board(THREE), ev = MS.play(st, at(2, 0), at(3, 0)), c1 = firstClear(ev);
  eq(c1 && c1.cleared.map(c => c.i).sort((a, b) => a - b), [0, 1, 2], 'three in a row clear');
  eq(st.moves, 29, 'a move is spent');
  check(c1 && !c1.made.length, 'three make no special');
  st = board();
  const before = J(st);
  eq(MS.play(st, at(0, 0), at(1, 0)), null, 'a swap that makes no line is refused');
  eq(J(st), before, '...and leaves the board and the moves alone');
  eq(MS.play(st, at(0, 0), at(2, 0)), null, 'pieces that do not touch cannot swap');
  st = board({'0,0': 'a', '1,0': 'a', '3,0': 'a', '2,1': 'a'}); ev = MS.play(st, at(2, 0), at(2, 1)); c1 = firstClear(ev);
  eq(c1 && c1.made.map(m => [m.i, m.sp, m.m]), [[at(2, 0), 'h', 0]], 'four across make a piece striped across, where the swap landed');
  st = board({'0,0': 'a', '0,1': 'a', '0,3': 'a', '1,2': 'a'}); ev = MS.play(st, at(0, 2), at(1, 2)); c1 = firstClear(ev);
  eq(c1 && c1.made.map(m => [m.i, m.sp]), [[at(0, 2), 'v']], 'four down make a piece striped down');
  st = board({'0,0': 'a', '1,0': 'a', '3,0': 'a', '4,0': 'a', '2,1': 'a'}); ev = MS.play(st, at(2, 0), at(2, 1)); c1 = firstClear(ev);
  eq(c1 && c1.made.map(m => [m.i, m.sp, m.m]), [[at(2, 0), 'r', MS.RING]], 'five in a line make a mood ring');
  st = board({'0,0': 'a', '1,0': 'a', '3,0': 'a', '2,1': 'a', '2,2': 'a'}); ev = MS.play(st, at(2, 0), at(3, 0)); c1 = firstClear(ev);
  eq(c1 && c1.made.map(m => [m.i, m.sp]), [[at(2, 0), 'b']], 'an L makes a burst at its corner');
  st = board({'0,0': 'a', '1,0': 'a', '3,0': 'a', '1,1': 'a', '1,2': 'a'}); ev = MS.play(st, at(2, 0), at(3, 0)); c1 = firstClear(ev);
  eq(c1 && c1.made.map(m => m.sp), ['b'], 'a T makes a burst');
  // what each special clears when it is caught in a line
  st = board({...THREE, '1,0': 'A'}); ev = MS.play(st, at(2, 0), at(3, 0)); c1 = firstClear(ev);
  check(c1 && c1.fires.some(f => f.sp === 'h') && has(c1, row(0)), 'striped across clears its whole row');
  st = board({...THREE, '1,0': 'a|'}); ev = MS.play(st, at(2, 0), at(3, 0)); c1 = firstClear(ev);
  check(has(c1, col(1)), 'striped down clears its whole column');
  st = board({...THREE, '1,0': 'a*'}); ev = MS.play(st, at(2, 0), at(3, 0)); c1 = firstClear(ev);
  check(has(c1, square(1, 0, 1)), 'a burst clears the 3x3 round it');
  st = board({...THREE, '1,0': 'A', '5,0': 'b|'}); ev = MS.play(st, at(2, 0), at(3, 0)); c1 = firstClear(ev);
  check(has(c1, col(5)), 'a special caught by another goes off too');
  // the ring
  const B = {'5,6': 'b', '7,7': 'b', '3,1': 'b'};
  st = board({'0,4': 'R', '1,4': 'b', ...B}); ev = MS.play(st, at(0, 4), at(1, 4)); c1 = firstClear(ev);
  check(has(c1, [at(1, 4), at(5, 6), at(7, 7), at(3, 1)]), 'a ring swapped with a mood clears every piece of it');
  check(c1 && c1.cleared.some(c => c.i === at(0, 4)) && c1.cleared.length === 5, '...and the ring goes with them, nothing else', c1 && String(c1.cleared.length));
  st = board({'0,4': 'R', '1,4': 'R'}); ev = MS.play(st, at(0, 4), at(1, 4));
  eq(firstClear(ev).cleared.length, N, 'two rings clear the whole board');
  st = board({'0,4': 'R', '1,4': 'B', ...B}); ev = MS.play(st, at(0, 4), at(1, 4)); c1 = firstClear(ev);
  check(c1 && c1.fires.filter(f => f.sp === 'h' || f.sp === 'v').length >= 4, 'a ring with a striped piece stripes the whole mood and sets it all off', c1 && JSON.stringify(c1.fires.map(f => f.sp)));
  st = board({'0,4': 'R', '1,4': 'b*', ...B}); ev = MS.play(st, at(0, 4), at(1, 4)); c1 = firstClear(ev);
  check(c1 && c1.fires.filter(f => f.sp === 'b').length >= 4, 'a ring with a burst makes the whole mood burst');
  // two specials meet where the moved piece lands
  st = board({'2,3': 'A', '3,3': 'B'}); ev = MS.play(st, at(2, 3), at(3, 3)); c1 = firstClear(ev);
  check(has(c1, [...row(3), ...col(3)]), 'two striped pieces clear a row and a column');
  st = board({'2,3': 'a*', '3,3': 'b*'}); ev = MS.play(st, at(2, 3), at(3, 3)); c1 = firstClear(ev);
  check(has(c1, square(3, 3, 2)), 'two bursts clear the 5x5 round the landing cell');
  st = board({'2,3': 'A', '3,3': 'b*'}); ev = MS.play(st, at(2, 3), at(3, 3)); c1 = firstClear(ev);
  check(has(c1, [2, 3, 4].flatMap(k => [...row(k), ...col(k)])), 'a striped piece with a burst clears three rows and three columns');
  check(MS.valid(board({'4,6': 'A', '5,6': 'b|'}), at(4, 6), at(5, 6)), 'two specials may always swap, line or not');
  check(MS.valid(board({'4,6': 'R', '5,6': 'c'}), at(4, 6), at(5, 6)), 'a ring may always swap');
  // goals
  st = board({...THREE, '1,0': 'A', '6,5': 'a'}, {goals: [{t: 'm', m: 0, n: 30, left: 30}]}); ev = MS.play(st, at(2, 0), at(3, 0));
  const nA = ev.filter(e => e.e === 'clear').flatMap(e => e.cleared).filter(c => c.m === 0).length;
  eq(30 - st.goals[0].left, nA, 'the mood goal counts every piece of its mood cleared, specials too');
  // points: more for every wave of a cascade
  st = board(THREE); ev = MS.play(st, at(2, 0), at(3, 0));
  eq(firstClear(ev).pts, 3 * MS.PTS.piece, 'a plain three is worth three pieces');
}

// ---------------------------------------------------------------- clouds
if (suites.includes('clouds')) {
  section('clouds');
  const st = board({'0,0': 'a', '1,0': 'a', '3,0': 'a'}, {clouds: {'0,0': 1, '1,0': 2, '5,5': 1}, goals: [{t: 'c', n: 4, left: 4}]});
  const ev = MS.play(st, at(2, 0), at(3, 0)), c1 = firstClear(ev);
  eq(c1.hits.map(h => [h.i, h.left]).sort(), [[at(0, 0), 0], [at(1, 0), 1]].sort(), 'a clear takes one layer off each cloud it touches');
  eq(st.goals[0].left, 2, 'the cloud goal counts layers, not clouds');
  eq(st.clouds[at(5, 5)], 1, 'clouds away from the line are untouched');
  eq(st.clouds[at(1, 0)], 1, 'a storm becomes a white cloud after one clear and stays over its cell');
}

// ---------------------------------------------------------------- events
// Replays a move from its events onto a board of ids, the way the page does, and compares with the core.
function replay(before, ev) {
  const cell = before.cells.map(p => p && p.id);
  for (const e of ev) {
    if (e.e === 'swap') { const t = cell[e.a]; cell[e.a] = cell[e.b]; cell[e.b] = t; }
    else if (e.e === 'clear') {
      for (const c of e.cleared) { if (cell[c.i] !== c.id) return `clear: cell ${c.i} holds ${cell[c.i]}, event says ${c.id}`; cell[c.i] = null; }
      for (const m of e.made) { if (cell[m.i] !== null) return `made: cell ${m.i} not empty`; cell[m.i] = m.id; }
    } else if (e.e === 'fall') {
      const moved = new Map();
      for (const m of e.moves) { if (cell[m.from] !== m.id) return `fall: ${m.id} is not at ${m.from}`; moved.set(m.id, m.to); cell[m.from] = null; }
      for (const [id, to] of moved) { if (cell[to] !== null) return `fall: ${to} taken`; cell[to] = id; }
      for (const s of e.spawns) { if (cell[s.to] !== null) return `spawn: ${s.to} taken`; cell[s.to] = s.id; }
    } else if (e.e === 'shuffle') { for (let i = 0; i < N; i++) if (cell[i] !== null) cell[i] = null; for (const o of e.to) cell[o.to] = o.id; }
    else if (e.e === 'light') { if (cell[e.i] !== e.id) return `light: ${e.i}`; }
  }
  return cell;
}
if (suites.includes('events')) {
  section('events');
  let moves = 0, bad = 0;
  for (let game = 0; game < (FULL ? 400 : 120); game++) {
    const rng = mulberry(game * 7 + 1), n = 1 + game % 40;
    const st = MS.start(n, game);
    while (!st.over) {
      const ms = MS.findMoves(st), [a, b] = ms[Math.floor(rng() * ms.length)];
      const before = J(st), ev = MS.play(st, a, b);
      const cell = replay(before, ev);
      moves++;
      if (typeof cell === 'string') { bad++; if (bad < 5) fail(`level ${n} move ${moves}: ${cell}`); continue; }
      const want = st.cells.map(p => p && p.id);
      if (JSON.stringify(cell) !== JSON.stringify(want)) { bad++; if (bad < 5) fail(`level ${n}: replayed board differs from the core's`); }
    }
    if (st.over === 'win') {
      const before = J(st), ev = MS.finale(st), cell = replay(before, ev);
      if (typeof cell === 'string' || JSON.stringify(cell) !== JSON.stringify(st.cells.map(p => p && p.id))) { bad++; fail(`level ${n}: finale replay differs: ${cell}`); }
    }
  }
  check(!bad, `${moves} moves replayed from their events alone end on the core's board`);
}

// ---------------------------------------------------------------- play
if (suites.includes('play')) {
  section('play');
  let moves = 0, shuffles = 0, specials = {h: 0, v: 0, b: 0, r: 0}, problems = [];
  for (let game = 0; game < (FULL ? 600 : 200); game++) {
    const rng = mulberry(game + 99), n = 1 + game % MS.LEVELS;
    const st = MS.start(n, game);
    let lastScore = 0, lastGoals = st.goals.map(g => g.left);
    while (!st.over) {
      const ms = MS.findMoves(st);
      if (!ms.length) { problems.push(`level ${n}: no move open and the game is not over`); break; }
      const [a, b] = ms[Math.floor(rng() * ms.length)];
      const mv = st.moves, ev = MS.play(st, a, b);
      moves++;
      if (!ev) { problems.push(`level ${n}: a move findMoves offered was refused`); break; }
      if (st.moves !== mv - 1) problems.push(`level ${n}: a move did not cost exactly one`);
      for (const e of ev) { if (e.e === 'shuffle') shuffles++; if (e.e === 'clear') for (const m of e.made) specials[m.sp]++; }
      const ids = st.cells.filter(Boolean).map(p => p.id);
      if (new Set(ids).size !== ids.length) problems.push(`level ${n}: a piece is in two places`);
      for (let i = 0; i < N; i++) if (st.mask[i] !== !!st.cells[i]) problems.push(`level ${n}: cell ${i} ${st.mask[i] ? 'empty' : 'filled in a hole'}`);
      if (MS.groups(st).length) problems.push(`level ${n}: a line was left standing after the move settled`);
      if (st.score < lastScore) problems.push(`level ${n}: the score went down`);
      st.goals.forEach((g, k) => { if (g.left > lastGoals[k]) problems.push(`level ${n}: a goal went back up`); });
      if (!st.over && !MS.findMoves(st).length) problems.push(`level ${n}: left with no move open`);
      if (st.over === 'win' && st.goals.some(g => g.left > 0)) problems.push(`level ${n}: won with a goal unmet`);
      if (st.over === 'lose' && (st.moves !== 0 || st.goals.every(g => g.left <= 0))) problems.push(`level ${n}: lost wrongly`);
      lastScore = st.score; lastGoals = st.goals.map(g => g.left);
    }
  }
  check(!problems.length, `${moves} random moves keep every invariant`, problems.slice(0, 5).join('\n          '));
  check(specials.h > 0 && specials.v > 0 && specials.b > 0 && specials.r > 0, 'random play makes every kind of special', JSON.stringify(specials));
  console.log(`  ${moves} moves, ${shuffles} shuffles, specials made ${JSON.stringify(specials)}`);
}

// ---------------------------------------------------------------- save
if (suites.includes('save')) {
  section('save');
  let bad = 0;
  for (let game = 0; game < 60; game++) {
    const n = 1 + game % 30, a = MS.start(n, game), rng = mulberry(game);
    const cut = 1 + Math.floor(rng() * 8);
    for (let k = 0; k < cut && !a.over; k++) { const ms = MS.findMoves(a); MS.play(a, ...ms[Math.floor(rng() * ms.length)]); }
    if (a.over) continue;
    const b = JSON.parse(JSON.stringify(a));
    while (!a.over) {
      const ms = MS.findMoves(a), mv = ms[Math.floor(rng() * ms.length)];
      const ea = JSON.stringify(MS.play(a, ...mv)), eb = JSON.stringify(MS.play(b, ...mv));
      if (ea !== eb) { bad++; break; }
    }
    if (JSON.stringify(a) !== JSON.stringify(b)) bad++;
  }
  check(!bad, 'a game saved as JSON mid-level carries on move for move', `${bad} diverged`);
}

// ---------------------------------------------------------------- finale
if (suites.includes('finale')) {
  section('finale');
  let wins = 0, bad = [];
  for (let game = 0; game < 80; game++) {
    const st = MS.start(1 + game % 8, game), rng = mulberry(game + 5);
    while (!st.over) {
      // play greedily for the goal so most games win with moves to spare
      let best = null, bv = -1;
      for (const mv of MS.findMoves(st)) { const c = MS.clone(st); MS.play(c, ...mv); const v = st.goals.reduce((s, g, k) => s + g.left - c.goals[k].left, 0) + rng(); if (v > bv) { bv = v; best = mv; } }
      MS.play(st, ...best);
    }
    if (st.over !== 'win') continue;
    wins++;
    const left = st.moves, sc = st.score, ev = MS.finale(st);
    if (st.moves !== 0) bad.push('moves left after the finale');
    if (st.score < sc + left * MS.PTS.finale) bad.push('the finale paid less than its moves');
    if (st.cells.some(p => p && p.sp)) bad.push('a special was left on the board');
    if (MS.groups(st).length) bad.push('a line was left standing');
    if (ev.filter(e => e.e === 'light').length !== left) bad.push('not every move left lit a piece');
    if (MS.starsOf(st) < 1) bad.push('a win without a star');
  }
  check(wins > 40, 'a goal-minded player wins the tutorial levels', `${wins} of 80`);
  check(!bad.length, 'every finale pays out every move and leaves the board calm', bad.slice(0, 3).join('; '));
}

// ---------------------------------------------------------------- levels
// The bot the TABLE was measured with: on each move it plays the best move it can see (score plus goal progress,
// one move ahead) 85% of the time and any open move otherwise, like a person who sometimes misses the obvious one.
function bot(st, skill, rng) {
  const value = (c) => { let v = c.score - st.score; c.goals.forEach((g, k) => { v += (st.goals[k].left - Math.max(0, g.left)) * 120; }); if (c.over === 'win') v += 1e6; return v; };
  while (!st.over) {
    const ms = MS.findMoves(st);
    let best, bv = -1;
    if (rng() > skill) best = ms[Math.floor(rng() * ms.length)];
    else for (const [a, b] of ms) { const c = MS.clone(st); MS.play(c, a, b); const v = value(c) + rng() * 5; if (v > bv) { bv = v; best = [a, b]; } }
    MS.play(st, best[0], best[1]);
  }
  if (st.over === 'win') MS.finale(st);
  return st;
}
if (suites.includes('levels')) {
  section('levels');
  const R = FULL ? 24 : 10, list = [];
  for (let n = 1; n <= MS.LEVELS; n++) if (FULL || n % 6 === 1 || n <= 3) list.push(n);
  const target = n => n <= MS.TUTOR ? 0.95 : Math.max(0.45, Math.min(0.95, 0.9 - 0.3 * Math.min(1, (n - MS.TUTOR) / 50) + (n % 5 === 1 ? 0.08 : 0) - (n % 5 === 0 ? 0.15 : 0)));
  const off = [];
  for (const n of list) {
    let w = 0; const sc = [];
    for (let a = 0; a < R; a++) { const st = MS.start(n, 1000 + a); bot(st, 0.85, mulberry(a * 31 + n)); if (st.over === 'win') { w++; sc.push(st.score); } }
    const rate = w / R, slack = FULL ? 0.12 : 0.3;
    if (rate < target(n) - slack - (n <= MS.TUTOR ? 0.1 : 0)) off.push(`level ${n}: won ${w}/${R}, wants about ${Math.round(target(n) * 100)}%`);
    if (process.env.VERBOSE) console.log(`  level ${n}: ${w}/${R}`);
  }
  check(!off.length, `${list.length} levels are about as hard as their TABLE entry says`, off.join('\n          '));
  // the first levels are for learning: a careless player still wins them
  let easy = 0; for (let a = 0; a < 10; a++) { const st = MS.start(1, 500 + a); bot(st, 0.4, mulberry(a)); if (st.over === 'win') easy++; }
  check(easy >= 8, 'level 1 is won even by a player who mostly moves at random', `${easy}/10`);
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
