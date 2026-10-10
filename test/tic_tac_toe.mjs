#!/usr/bin/env node
// Test suite for games/tic_tac_toe_mp.html (Margins).
//
// Runs the page's DOM-free <script id="core"> block in Node. Two phones replay one record string and
// must agree on the board and the score, so the rules and the record are what this checks:
// every classic position against a win check written the other way round, the Vanishing rule (the
// oldest mark goes before the new one is judged), what canAppend lets through, and a computer that
// never misses a win or a block and, at full strength, never loses a classic game.
//
//   node test/tic_tac_toe.mjs              # everything
//   node test/tic_tac_toe.mjs rules cpu    # named suites only
//
// Suites: rules, vanish, record, cpu.

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name, dflt) => { const a = args.find(x => x.startsWith(`--${name}=`)); return a ? a.split('=')[1] : dflt; };
const PAGE = opt('page', join(HERE, '..', 'games', 'tic_tac_toe_mp.html'));
const ALL = ['rules', 'vanish', 'record', 'cpu'];
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
vm.runInContext(core[1] + '\nthis.T = TTT;', ctx);
const T = ctx.T;

function rng(seed) { let a = seed >>> 0 || 1; return () => { a ^= a << 13; a >>>= 0; a ^= a >> 17; a ^= a << 5; a >>>= 0; return a / 4294967296; }; }

// three in a row, written as coordinates rather than a table of lines
function refWinner(cells) {
  const at = (r, c) => cells[r * 3 + c];
  const same = (a, b, c) => a && a === b && b === c;
  for (let k = 0; k < 3; k++) {
    if (same(at(k, 0), at(k, 1), at(k, 2))) return at(k, 0);
    if (same(at(0, k), at(1, k), at(2, k))) return at(0, k);
  }
  if (same(at(0, 0), at(1, 1), at(2, 2))) return at(1, 1);
  if (same(at(0, 2), at(1, 1), at(2, 0))) return at(1, 1);
  return null;
}

if (suites.includes('rules')) {
  section('rules: every classic game');
  let games = 0, wins = {x: 0, o: 0, draw: 0}, bad = 0;
  const walk = (s, cells) => {
    if (s.result) {
      games++; wins[s.result]++;
      const ref = refWinner(s.cells) || (s.cells.every(Boolean) ? 'draw' : null);
      if (ref !== s.result) bad++;
      return;
    }
    if (refWinner(s.cells)) { bad++; return; }
    for (const i of T.legal(s)) {
      if (T.play(s, i).cells[i] !== s.turn) bad++;
      walk(T.play(s, i));
    }
  };
  walk(T.fresh('c'));
  check(bad === 0, 'results agree with an independent win check', `${bad} disagreements`);
  // published counts: 255,168 games; 131,184 X wins, 77,904 O wins, 46,080 draws
  check(games === 255168 && wins.x === 131184 && wins.o === 77904 && wins.draw === 46080,
    'game tree matches the published counts', JSON.stringify({games, ...wins}));
  const s = T.play(T.fresh('c'), 4);
  check(T.play(s, 4) === null && T.play(s, 9) === null && T.play(s, -1) === null, 'occupied and off-board cells are refused');
}

if (suites.includes('vanish')) {
  section('vanish: three marks each');
  const r = rng(7);
  let bad = 0, rounds = 0, draws = 0;
  for (let n = 0; n < 4000; n++) {
    let s = T.fresh('v', n % 2 ? 'o' : 'x');
    const order = {x: [], o: []};
    while (!s.result) {
      const moves = T.legal(s), i = moves[Math.floor(r() * moves.length)], p = s.turn;
      const f = T.fading(s);
      const n2 = T.play(s, i);
      order[p].push(i); if (order[p].length > 3) { const g = order[p].shift(); if (g !== f || n2.gone !== g || n2.cells[g] !== '') bad++; }
      else if (f !== -1 || n2.gone !== -1) bad++;
      if (n2.q.x.length > 3 || n2.q.o.length > 3) bad++;
      if (n2.cells.filter(c => c === 'x').length !== n2.q.x.length) bad++;
      const ref = refWinner(n2.cells);
      if ((ref || null) !== (n2.result === 'draw' ? null : n2.result)) bad++;
      s = n2;
    }
    rounds++; if (s.result === 'draw') draws++;
  }
  check(bad === 0, 'the oldest mark goes first, before the win is judged, and nothing else moves', `${bad} errors`);
  check(draws / rounds < 0.05, 'random Vanishing rounds rarely run to the cap', `${draws}/${rounds}`);
  // the vanished mark cannot complete a line: X 0,1,(o) ... X places 2 while its 0 vanishes
  let s = T.fresh('v');
  for (const i of [0, 3, 1, 4, 8, 7]) s = T.play(s, i);  // X:0,1,8  O:3,4,7
  const n = T.play(s, 2);                                // X's 0 goes, so 0-1-2 is not a line
  check(n.result === null && n.cells[0] === '' && n.cells[2] === 'x', 'a mark that vanishes cannot count for the line it would make');
}

if (suites.includes('record')) {
  section('record: what both phones replay');
  const r = rng(11);
  let bad = 0;
  for (const rule of ['c', 'v']) for (let n = 0; n < 300; n++) {
    let g = '';
    for (let step = 0; step < 400; step++) {
      const m = T.match(g, rule);
      if (m.bad) { bad++; break; }
      let tok;
      if (m.winner) { if (!T.canAppend(g, rule, '/', 'x') || T.canAppend(g, rule, '|', 'x') || T.canAppend(g, rule, '4', m.state.turn)) bad++; tok = '/'; if (r() < .3) break; }
      else if (m.state.result) { if (!T.canAppend(g, rule, '|', 'o') || T.canAppend(g, rule, '0', 'x')) bad++; tok = '|'; }
      else {
        const p = m.state.turn, moves = T.legal(m.state);
        const i = moves[Math.floor(r() * moves.length)];
        if (T.canAppend(g, rule, String(i), T.other(p))) bad++;           // never on the other side's turn
        const taken = m.state.cells.findIndex(Boolean);
        if (taken >= 0 && T.canAppend(g, rule, String(taken), p)) bad++;  // never onto a mark
        if (T.canAppend(g, rule, '|', p) || T.canAppend(g, rule, '/', p)) bad++;
        tok = String(i);
      }
      g += tok;
      const after = T.match(g, rule);
      if (after.score.x > T.TARGET || after.score.o > T.TARGET) bad++;
    }
  }
  check(bad === 0, 'canAppend lets through exactly the legal token on each side\'s turn', `${bad} errors`);
  const m = T.match('03142|03142|03142|03142|03142', 'c');
  check(m.score.x === 3 && m.score.o === 2 && m.winner === 'x', 'the starter alternates and the match ends at three', JSON.stringify(m.score));
  check(T.match('0314|2', 'c').bad && T.match('44', 'c').bad, 'a record with an unfinished round or a double mark is marked bad');
  check(T.starter(0, 1) === 'o' && T.starter(1, 1) === 'x', 'a new match is opened by the other side');
}

if (suites.includes('cpu')) {
  section('cpu');
  // full strength never loses a classic game: try every reply the opponent has
  let lost = 0;
  const r = rng(3);
  const vs = (s, cpu) => {
    if (s.result) { if (s.result !== 'draw' && s.result !== cpu) lost++; return; }
    if (s.turn === cpu) vs(T.play(s, T.choose(s, r, 1)), cpu);
    else for (const i of T.legal(s)) vs(T.play(s, i), cpu);
  };
  vs(T.fresh('c', 'x'), 'x'); vs(T.fresh('c', 'x'), 'o');
  check(lost === 0, 'at full strength it never loses a classic game against any line of play', `${lost} losses`);
  // at play strength it never misses a win in one or leaves a loss in one it could block
  let missed = 0, tested = 0;
  for (const rule of ['c', 'v']) for (let n = 0; n < 400; n++) {
    let s = T.fresh(rule, n % 2 ? 'o' : 'x');
    for (let k = 0; k < 4 + (n % 7) && !s.result; k++) { const ms = T.legal(s); s = T.play(s, ms[Math.floor(r() * ms.length)]); }
    if (s.result) continue;
    tested++;
    const i = T.choose(s, r, 0.72), n2 = T.play(s, i);
    const canWin = T.legal(s).some(j => T.play(s, j).result === s.turn);
    if (canWin && n2.result !== s.turn) missed++;
    else if (!canWin && T.losesNext(n2) && T.legal(s).some(j => !T.losesNext(T.play(s, j)))) missed++;
  }
  check(missed === 0, 'it takes every win in one and blocks every loss in one it can', `${missed} of ${tested}`);
  // and it is beatable: a full-strength player against it wins some classic games
  let wins = 0;
  for (let n = 0; n < 300; n++) {
    let s = T.fresh('c', n % 2 ? 'o' : 'x');
    while (!s.result) s = T.play(s, T.choose(s, r, s.turn === 'x' ? 1 : 0.72));
    if (s.result === 'x') wins++;
  }
  check(wins > 15, 'a careful player beats it now and then', `${wins} of 300`);
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
