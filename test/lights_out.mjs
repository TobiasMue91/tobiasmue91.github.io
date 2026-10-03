#!/usr/bin/env node
// Test suite for games/lights_out.html (Bedtime).
//
// Runs the page's DOM-free <script id="core"> block in Node. The page's one promise is the par it
// shows: the fewest presses that put a block to sleep. A solver that is almost right gives a par
// that is one too high on a few boards, and nobody playing can tell. No browser, no server.
//
//   node test/lights_out.mjs                  # everything
//   node test/lights_out.mjs solver levels    # named suites only
//   node test/lights_out.mjs --page=path.html # run against another copy of the page
//
// Suites: solver, levels, tonight, record.

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name, dflt) => { const a = args.find(x => x.startsWith(`--${name}=`)); return a ? a.split('=')[1] : dflt; };
const PAGE = opt('page', join(HERE, '..', 'games', 'lights_out.html'));
const ALL = ['solver', 'levels', 'tonight', 'record'];
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
vm.runInContext(core[1] + '\nthis.B = BEDTIME;', ctx);
const B = ctx.B;

// Every press subset of a board, the fewest presses that make each light pattern. Written the
// plain way: no algebra, just trying them all.
function bruteTable(w, h, mask) {
  const cells = mask.map((m, i) => m ? i : -1).filter(i => i >= 0), n = cells.length, best = new Map();
  for (let s = 0; s < (1 << n); s++) {
    const l = new Array(w * h).fill(0); let k = 0;
    for (let b = 0; b < n; b++) if (s >> b & 1) { k++; for (const j of B.reach(w, h, mask, cells[b])) l[j] ^= 1; }
    const key = l.join('');
    if (!best.has(key) || best.get(key) > k) best.set(key, k);
  }
  return best;
}
function clears(w, h, mask, lights, sol) {
  let l = lights.slice();
  for (const i of sol) { if (!mask[i]) return false; l = B.press({w, h, mask, lights: l}, i); }
  return B.dark(l);
}

if (suites.includes('solver')) {
  section('solver: fewest presses, against trying every press');
  const boards = [[3, 3, 'rect'], [4, 4, 'rect'], [4, 3, 'rect'], [5, 3, 'rect'], [4, 4, 'gable'], [4, 4, 'door'], [3, 5, 'tower'], [4, 4, 'wings'], [4, 4, 'stepped']];
  for (const [w, h, shape] of boards) {
    const mask = B.SHAPES[shape](w, h), table = bruteTable(w, h, mask);
    let bad = 0, n = 0;
    const R = B.rng(B.hash(shape + w + h));
    // every reachable pattern for small boards, a sample of reachable and random ones for larger
    const keys = [...table.keys()];
    const sample = keys.length <= 4096 ? keys : Array.from({length: 3000}, () => keys[Math.floor(R() * keys.length)]);
    for (const key of sample) {
      const l = key.split('').map(Number), s = B.solve(w, h, mask, l); n++;
      if (!s || s.length !== table.get(key) || !clears(w, h, mask, l, s)) { bad++; if (bad < 3) fail(`${w}x${h} ${shape} ${key}`, `solver ${s && s.length}, brute ${table.get(key)}`); }
    }
    for (let t = 0; t < 400; t++) {
      const l = mask.map(m => m && R() < 0.5 ? 1 : 0), key = l.join(''), s = B.solve(w, h, mask, l);
      if (table.has(key) ? !(s && s.length === table.get(key)) : s !== null) { bad++; if (bad < 3) fail(`${w}x${h} ${shape} random ${key}`, `solver ${s && s.length}, brute ${table.get(key)}`); }
    }
    check(!bad, `${w}x${h} ${shape}: ${n} reachable patterns and 400 random ones agree with brute force`);
  }
  // 5x5 has two quiet patterns; its solutions come in fours. Check minimality against them directly.
  const mask = B.SHAPES.rect(5, 5), R = B.rng(5); let bad = 0;
  for (let t = 0; t < 2000; t++) {
    const pr = mask.map(() => R() < 0.4 ? 1 : 0), l = new Array(25).fill(0);
    pr.forEach((p, i) => { if (p) for (const j of B.reach(5, 5, mask, i)) l[j] ^= 1; });
    const s = B.solve(5, 5, mask, l);
    if (!s || !clears(5, 5, mask, l, s) || s.length > pr.reduce((a, b) => a + b, 0)) bad++;
  }
  check(!bad, '5x5: 2000 boards cleared by the solution, never longer than the presses that made them');
  check(B.solve(5, 5, mask, [1].concat(new Array(24).fill(0))) === null, '5x5: a lone corner light is unsolvable and says so');
}

if (suites.includes('levels')) {
  section('levels: every block is fair and its par is true');
  let lastSize = 0, bad = 0;
  for (let n = 1; n <= 120; n++) {
    const a = B.level(n), b = B.level(n), sp = B.spec(n);
    if (JSON.stringify(a) !== JSON.stringify(b)) { bad++; fail(`level ${n} is not the same twice`); }
    const s = B.solve(a.w, a.h, a.mask, a.lights);
    if (!s || s.length !== a.par) { bad++; fail(`level ${n}: par ${a.par}, solver ${s && s.length}`); }
    if (a.par !== sp.par) { bad++; fail(`level ${n}: wanted par ${sp.par}, got ${a.par}`); }
    if (!clears(a.w, a.h, a.mask, a.lights, a.solution)) { bad++; fail(`level ${n}: stored solution does not clear it`); }
    if (a.lights.some((v, i) => v && !a.mask[i])) { bad++; fail(`level ${n}: a light in the wall`); }
    if (a.w * a.h < lastSize) { bad++; fail(`level ${n}: blocks shrink`); }
    lastSize = a.w * a.h;
  }
  check(!bad, '120 levels: deterministic, solvable, par as designed and equal to the true minimum, never shrinking');
  const one = B.level(1);
  check(one.par === 1 && one.solution[0] === 4, 'level 1 is one press, in the middle, so the cross is the first thing a player sees');
  let pars = []; for (let n = 1; n <= 60; n++) pars.push(B.level(n).par);
  check(pars.every((p, i) => !i || p >= pars[i - 1] - 3), 'par never drops by more than the step to a bigger block');
}

if (suites.includes('tonight')) {
  section('tonight: the same block for everyone, fair every night');
  let bad = 0, shapes = new Set(), d = '2026-01-01';
  for (let k = 0; k < 400; k++, d = B.nextDay(d)) {
    const a = B.daily(d), b = B.daily(d);
    if (JSON.stringify(a) !== JSON.stringify(b)) { bad++; fail(`${d} differs`); }
    const s = B.solve(a.w, a.h, a.mask, a.lights);
    if (!s || s.length !== a.par || a.par < 6) { bad++; fail(`${d}: par ${a.par}, solver ${s && s.length}`); }
    shapes.add(a.shape);
  }
  check(!bad, '400 nights: deterministic and solvable at their par');
  check(shapes.size >= 4, 'tonight\'s blocks come in at least four outlines');
  check(B.nextDay('2026-03-28') === '2026-03-29' && B.nextDay('2026-12-31') === '2027-01-01' && B.nextDay('2028-02-28') === '2028-02-29', 'next day across clock changes, years and leap days');
}

if (suites.includes('record')) {
  section('record: moons and streaks');
  check(B.moons(5, 5, false) === 3 && B.moons(4, 5, false) === 3 && B.moons(7, 5, false) === 2 && B.moons(8, 5, false) === 1, 'three moons at par, two within two, one beyond');
  check(B.moons(5, 5, true) === 2 && B.moons(9, 5, true) === 1, 'a hint caps a block at two moons');
  check(B.streakAfter('', 0, '2026-10-03') === 1, 'first night starts a streak of one');
  check(B.streakAfter('2026-10-02', 4, '2026-10-03') === 5, 'the next night adds one');
  check(B.streakAfter('2026-10-03', 5, '2026-10-03') === 5, 'the same night twice counts once');
  check(B.streakAfter('2026-09-30', 5, '2026-10-03') === 1, 'a missed night starts over');
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
