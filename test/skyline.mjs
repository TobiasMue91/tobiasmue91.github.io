#!/usr/bin/env node
// Test suite for games/skyline.html (Skyline).
//
// Runs the page's DOM-free <script id="core"> (SkyCore): the stacking rules, the city plots and the
// economy. What breaks there still looks fine on screen - a cut that loses a sliver of slab, a perfect
// window that is never reachable, a plot order that puts a new tower behind an old one - so:
//
//   wave     the slab's triangle-wave swing, axis alternation, speed ramp
//   drop     every drop on thousands of random towers: placed + sliced-off = slab in hand, the placed
//            floor lies inside the one below, perfects snap, growth only on a long chain and never past
//            the lot, a miss only when nothing overlaps
//   city     plots are unique and every new plot stands on the frontmost diagonal (nothing older can hide it)
//   economy  permit costs rise and stop at max, rent and its offline cap
//   pacing   bots with human timing error: how high they build, how often they hit perfect, how many runs
//            the first permit takes. Prints a table; fails when the game drifts out of its intended band.
//
//   node test/skyline.mjs              # everything
//   node test/skyline.mjs drop pacing  # named suites only
//   node test/skyline.mjs --page=x.html

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name, dflt) => { const a = args.find(x => x.startsWith(`--${name}=`)); return a ? a.split('=')[1] : dflt; };
const PAGE = opt('page', join(HERE, '..', 'games', 'skyline.html'));
const ALL = ['wave', 'drop', 'city', 'economy', 'pacing'];
const picked = args.filter(a => !a.startsWith('--'));
const suites = picked.length ? picked : ALL;

let failures = 0, passes = 0;
const fail = (what, detail) => { failures++; console.log(`  FAIL  ${what}${detail ? '\n          ' + detail : ''}`); };
const pass = what => { passes++; if (process.env.VERBOSE) console.log(`  ok    ${what}`); };
const check = (ok, what, detail) => ok ? pass(what) : fail(what, detail);
const section = name => console.log(`\n=== ${name} ===`);
const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;

const HTML = readFileSync(PAGE, 'utf8');
const m = HTML.match(/<script id="core">([\s\S]*?)<\/script>/);
if (!m) { console.log('no <script id="core"> in ' + PAGE); process.exit(1); }
const sandbox = {module: {}};
vm.runInNewContext(m[1], sandbox);
const C = sandbox.module.exports;

let seed = 12345;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());

// a player who taps when the slab passes the centre, off by a normal timing error of sigma seconds
function play(up, sigma, cap = 400) {
  const s = C.newRun(up), log = [];
  while (!s.over && s.floors.length < cap) {
    const v = C.speedAt(s.floors.length, s.p);
    const pass = rnd() < .5 ? C.RANGE : 3 * C.RANGE; // first or second crossing of the centre
    s.phase = pass + gauss() * sigma * v;
    const top = s.floors[s.floors.length - 1], mv = C.mover(s);
    const r = C.drop(s);
    log.push({r, top, mv});
  }
  return {s, log};
}

if (suites.includes('wave')) {
  section('wave');
  check(near(C.offset(0), -C.RANGE), 'swing starts at -RANGE');
  check(near(C.offset(C.RANGE), 0), 'centre after RANGE units');
  check(near(C.offset(2 * C.RANGE), C.RANGE), 'far end after 2 RANGE');
  check(near(C.offset(3 * C.RANGE), 0), 'back through the centre');
  check(near(C.offset(4 * C.RANGE), -C.RANGE), 'period 4 RANGE');
  let cont = true;
  for (let ph = 0; ph < 4000; ph += 0.37) if (Math.abs(C.offset(ph + .37) - C.offset(ph)) > .37 + 1e-9) cont = false;
  check(cont, 'swing is continuous, never jumps');
  check(C.axisOf(1) !== C.axisOf(2) && C.axisOf(2) !== C.axisOf(3), 'axes alternate');
  const p = C.params({});
  let mono = true;
  for (let n = 1; n < 200; n++) if (C.speedAt(n + 1, p) < C.speedAt(n, p)) mono = false;
  check(mono, 'speed never drops as the tower rises');
  check(C.speedAt(400, p) <= 300, 'speed is capped');
  const s = C.newRun({}); C.step(s, 1);
  check(near(s.phase, C.speedAt(1, s.p)), 'step advances the swing by speed x dt');
}

if (suites.includes('drop')) {
  section('drop');
  let bad = [], perfects = 0, cuts = 0, misses = 0, grows = 0;
  for (let g = 0; g < 3000; g++) {
    const up = {foundation: g % 6, laser: g % 5, rebar: g % 4};
    const {s, log} = play(up, .01 + rnd() * .06, 200);
    for (const {r, top, mv} of log) {
      const ax = mv.axis, dim = ax === 'x' ? 'w' : 'd', other = ax === 'x' ? 'd' : 'w', oax = ax === 'x' ? 'z' : 'x';
      if (r.kind === 'miss') {
        misses++;
        if (Math.abs(mv[ax] - top[ax]) < top[dim] - 1e-9) bad.push('miss with overlap');
        continue;
      }
      const P = r.placed;
      if (!near(P[other], top[other]) || !near(P[oax], top[oax])) bad.push('cross-axis changed');
      if (r.kind === 'perfect') {
        perfects++;
        if (Math.abs(mv[ax] - top[ax]) > s.p.tol + 1e-9) bad.push('perfect outside tolerance');
        if (!near(P[ax], top[ax])) bad.push('perfect did not snap');
        if (r.grew) {
          grows++;
          if (r.streak < s.p.regrowAt) bad.push('grew on a short chain');
          if (P[dim] > s.p.size + 1e-9) bad.push('grew past the lot');
        } else if (!near(P[dim], top[dim])) bad.push('perfect changed size');
      } else {
        cuts++;
        if (Math.abs(mv[ax] - top[ax]) <= s.p.tol) bad.push('cut inside tolerance');
        const D = r.debris;
        if (!near(P[dim] + D[dim], mv[dim])) bad.push('placed + debris != slab');
        const lo = Math.min(P[ax] - P[dim] / 2, D[ax] - D[dim] / 2), hi = Math.max(P[ax] + P[dim] / 2, D[ax] + D[dim] / 2);
        if (!near(lo, mv[ax] - mv[dim] / 2, 1e-6) || !near(hi, mv[ax] + mv[dim] / 2, 1e-6)) bad.push('pieces do not tile the slab');
        if (P[ax] - P[dim] / 2 < top[ax] - top[dim] / 2 - 1e-6 || P[ax] + P[dim] / 2 > top[ax] + top[dim] / 2 + 1e-6) bad.push('placed overhangs the floor below');
      }
    }
    if (s.streak !== 0 && log[log.length - 1].r.kind === 'miss') bad.push('streak survives a miss');
  }
  check(bad.length === 0, `${perfects} perfects, ${cuts} cuts, ${grows} growths, ${misses} misses all consistent`, [...new Set(bad)].join(', '));
  const s = C.newRun({}); s.over = true;
  check(C.drop(s) === null, 'no drop after the tower is over');
}

if (suites.includes('city')) {
  section('city');
  const seen = new Set(); let maxDiag = -1, ok = true, uniq = true;
  for (let i = 0; i < 500; i++) {
    const q = C.plotPos(i), key = q.x + ',' + q.z;
    if (seen.has(key)) uniq = false; seen.add(key);
    if (q.diag < maxDiag) ok = false;
    maxDiag = Math.max(maxDiag, q.diag);
    if (q.x + q.z !== q.diag * C.SPACING) ok = false;
  }
  check(uniq, 'plots are unique');
  check(ok, 'every new plot is on the frontmost diagonal');
}

if (suites.includes('economy')) {
  section('economy');
  let rising = true, capped = true;
  for (const u of C.UPGRADES) {
    for (let l = 0; l + 1 < u.max; l++) if (!(C.cost(u.id, l + 1) > C.cost(u.id, l))) rising = false;
    if (C.cost(u.id, u.max) !== Infinity) capped = false;
  }
  check(rising, 'permit costs rise'); check(capped, 'no permit past its max');
  const L = C.levels({foundation: 99, laser: -3, junk: 4});
  check(L.foundation === 5 && L.laser === 0 && !('junk' in L), 'levels are clamped and cleaned');
  const towers = [{f: new Array(11)}, {f: new Array(21)}];
  check(C.rentPerHour(towers, {}) === 60, 'rent is 2 per floor per hour', C.rentPerHour(towers, {}));
  check(C.offlineRent(towers, {}, 3.6e6) === 60, 'an hour away pays an hour');
  check(C.offlineRent(towers, {}, 1e12) === 60 * C.RENT_CAP_H, 'offline rent is capped');
  check(C.offlineRent(towers, {}, -5) === 0, 'a clock running backwards pays nothing');
}

if (suites.includes('pacing')) {
  section('pacing');
  const row = (label, up, sigma, n = 400) => {
    const H = [], P = [];
    for (let i = 0; i < n; i++) { const {s} = play(up, sigma); H.push(s.floors.length - 1); P.push(s.perfects / Math.max(1, s.floors.length - 1)); }
    H.sort((a, b) => a - b);
    const med = H[n >> 1], p90 = H[Math.floor(n * .9)], pr = P.reduce((a, b) => a + b, 0) / n;
    console.log(`  ${label.padEnd(30)} median ${String(med).padStart(4)}  p90 ${String(p90).padStart(4)}  perfect ${(pr * 100).toFixed(0).padStart(3)}%`);
    return {med, p90, pr};
  };
  const casual = row('casual (60 ms error)', {}, .06);
  const decent = row('decent (35 ms)', {}, .035);
  const sharp = row('sharp (18 ms)', {}, .018);
  const maxed = row('decent, all permits', {foundation: 5, laser: 4, damper: 5, rebar: 3}, .035);
  check(casual.med >= 6 && casual.med <= 25, 'a casual first tower is 6-25 floors', casual.med);
  check(decent.med >= 15 && decent.med <= 60, 'a decent player builds 15-60 floors', decent.med);
  check(sharp.med > decent.med * 1.5, 'skill pays: a sharp player builds much higher');
  check(maxed.med > decent.med * 1.25, 'permits matter');
  check(decent.pr > .08 && decent.pr < .6, 'perfects are earned, not constant', decent.pr);
  // runs until the first permit
  let runs = 0, money = 0;
  while (money < C.cost('foundation', 0) && runs < 50) { money += play({}, .045).s.earned; runs++; }
  check(runs >= 1 && runs <= 4, 'the first permit comes within 1-4 runs', runs);
  console.log(`  first permit after ${runs} run(s)`);
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
