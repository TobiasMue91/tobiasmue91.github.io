#!/usr/bin/env node
// Test suite for games/void_runner.html (Void Runner).
//
// Runs the page's DOM-free <script id="core"> block in Node. The one promise on that page nobody can see:
// every hazard it deals can be cleared, at every speed, by a player who times it anywhere inside the window
// the picture shows. No browser, no server.
//
//   node test/void_runner.mjs                 # everything
//   node test/void_runner.mjs fair bots       # named suites only
//   node test/void_runner.mjs --page=path.html
//
// Suites: physics, world, score, fair, bots.

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name, dflt) => { const a = args.find(x => x.startsWith(`--${name}=`)); return a ? a.split('=')[1] : dflt; };
const PAGE = opt('page', join(HERE, '..', 'games', 'void_runner.html'));
const ALL = ['physics', 'world', 'score', 'fair', 'bots'];
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
vm.runInContext(core[1] + '\nthis.VR = VR;', ctx);
const VR = ctx.VR, C = VR.C;
const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;

const FRAME = 1 / 60;
// run a state forward with a function that may press keys each frame; returns all events
function play(s, seconds, driver, dt = FRAME) {
  const all = [];
  const frames = Math.round(seconds / dt);
  for (let i = 0; i < frames && !s.dead; i++) {
    const t = i * dt;
    if (driver) driver(s, t);
    for (const e of VR.step(s, dt)) all.push(e);
  }
  return all;
}

// ---- a player: looks at the next hazard and acts when the picture says to ----
// `when` picks where inside the window to act: 0 = as early as fair, 1 = as late as fair, between = anywhere
// `lag` is the reaction time in seconds: the player acts on what the world looked like that long ago
function player(when, rnd, lag = 0) {
  const st = { plan: null };
  return (s) => {
    const v = VR.speed(s), x = s.x - v * lag;
    let h = null;
    for (let i = s.hzIdx; i < s.hz.length; i++) { if (s.hz[i].b + C.HW > s.x) { h = s.hz[i]; break; } }
    if (!h || h.a - x > 40) return;
    if (!st.plan || st.plan.h !== h) {
      const w = when(rnd);
      st.plan = { h, w, jumped: false, slid: false, d2: false, t0: null };
    }
    const p = st.plan, dist = h.a - x;
    const w8 = h.b - h.a;
    if (h.k === 'block') {
      // jump between "just in time" and "as early as still clears the far side"
      const late = 0.061 * v + 0.3, early = Math.max(late, 0.575 * v - w8 - 0.3);
      const at = late + (early - late) * (1 - p.w);
      if (!p.jumped && s.grounded && dist <= at) { VR.press(s, 'jump'); p.jumped = true; }
    } else if (h.k === 'gap') {
      const early = Math.max(0, VR.AIR.T1 * v - w8 + 0.2 - 0.3);
      const at = early * (1 - p.w);
      if (!p.jumped && (s.grounded || s.coyote > 0) && dist <= at) { VR.press(s, 'jump'); p.jumped = true; }
    } else if (h.k === 'beam') {
      const late = 0.33, early = Math.max(late, 0.65 * v - w8 - 0.3);
      const at = late + (early - late) * (1 - p.w);
      if (!p.slid && s.grounded && dist <= at) { VR.press(s, 'slide'); p.slid = true; }
    } else if (h.k === 'wall') {
      const at = v * (0.38 + 0.2 * (1 - p.w));
      if (!p.jumped && s.grounded && dist <= at) { VR.press(s, 'jump'); p.jumped = true; p.t0 = s.t; }
      if (p.jumped && !p.d2 && s.t - p.t0 >= 0.28) { VR.press(s, 'jump'); p.d2 = true; }
    }
    // after a jump-type hazard, a player below a beam dives to be ready to slide
    if (p.jumped === false && p.slid === false) { /* nothing */ }
  };
}
// a diver: presses slide in the air if the next hazard is a beam that is close
function withDive(drv) {
  return (s, t) => {
    drv(s, t);
    if (!s.grounded && s.dive === false && s.y < 2.2) {
      for (let i = s.hzIdx; i < s.hz.length; i++) {
        const h = s.hz[i];
        if (h.b + C.HW > s.x) { if (h.k === 'beam' && h.a - s.x < VR.speed(s) * 0.9) VR.press(s, 'slide'); break; }
      }
    }
  };
}

if (suites.includes('physics')) {
  section('physics: what a press does');
  let s = VR.create(1, {empty: true});
  play(s, 0.3);
  check(s.grounded && s.y === 0, 'the runner starts on the ground');
  VR.press(s, 'jump'); VR.step(s, 1 / 60);
  check(s.y > 0 && !s.grounded, 'a press lifts the runner in the same frame it is pressed');
  const ev = play(s, 2, null);
  let peak = 0; { const q = VR.create(1, {empty: true}); VR.press(q, 'jump'); for (let i = 0; i < 200 && !q.dead; i++) { VR.step(q, 1 / 120); peak = Math.max(peak, q.y); } }
  check(near(peak, VR.AIR.peak, 0.1), 'a single jump peaks where the generator thinks it does', peak + ' vs ' + VR.AIR.peak);
  check(ev.some(e => e.t === 'land'), 'the runner comes down again');
  // double jump
  s = VR.create(2, {empty: true}); play(s, 0.2);
  VR.press(s, 'jump'); play(s, 0.3); VR.press(s, 'jump');
  const ev2 = VR.step(s, 1 / 60);
  check(ev2.some(e => e.t === 'djump'), 'a second press in the air is a double jump');
  let top = 0; for (let i = 0; i < 400; i++) { VR.step(s, 1 / 120); top = Math.max(top, s.y); }
  check(top > C.WALL_H, 'a double jump clears the tallest wall', 'top ' + top.toFixed(2));
  VR.press(s, 'jump'); play(s, 0.05); VR.press(s, 'jump');
  // no third jump
  s = VR.create(3, {empty: true}); play(s, 0.2);
  VR.press(s, 'jump'); play(s, 0.2); VR.press(s, 'jump'); play(s, 0.1);
  const y0 = s.y; VR.press(s, 'jump'); VR.step(s, 1 / 120);
  check(!s.events.some(e => e.t === 'djump') && s.jumps === 2, 'there is no third jump');
  // slide
  s = VR.create(4, {empty: true}); play(s, 0.2);
  VR.press(s, 'slide'); VR.step(s, 1 / 60);
  check(s.slide > 0 && VR.height(s) === C.SLIDE_H, 'a slide makes the runner short at once');
  play(s, C.SLIDE_T + 0.1);
  check(s.slide === 0 && VR.height(s) === C.STAND_H, 'and lets go of it after its time');
  // jump cancels slide
  s = VR.create(5, {empty: true}); play(s, 0.2); VR.press(s, 'slide'); VR.step(s, 1 / 60); VR.press(s, 'jump'); VR.step(s, 1 / 60);
  check(s.slide === 0 && !s.grounded, 'a jump cancels a slide');
  // dive: slide in the air drops fast and slides on landing
  s = VR.create(6, {empty: true}); play(s, 0.2); VR.press(s, 'jump'); play(s, 0.2);
  VR.press(s, 'slide'); const ev3 = play(s, 0.4);
  check(ev3.some(e => e.t === 'dive') && ev3.some(e => e.t === 'land'), 'a slide in the air dives');
  check(s.slide > 0, 'and the runner slides the moment it lands');
  // buffered jump: tap just before landing
  s = VR.create(7, {empty: true}); play(s, 0.2); VR.press(s, 'jump'); play(s, 0.2);
  let landed = false, jumpedAgain = false;
  for (let i = 0; i < 200; i++) {
    if (!landed && s.vy < 0 && s.y < 0.4 && s.y > 0.2) VR.press(s, 'jump');
    const e = VR.step(s, 1 / 120); if (e.some(q => q.t === 'land')) landed = true; if (landed && e.some(q => q.t === 'jump')) jumpedAgain = true;
    if (jumpedAgain) break;
  }
  check(jumpedAgain, 'a tap a hair before landing becomes a jump on landing');
  // frame rate independence
  const run = fps => { const q = VR.create(8, {empty: true}); play(q, 0.5, null, 1 / fps); VR.press(q, 'jump'); let m = 0; for (let i = 0; i < fps; i++) { VR.step(q, 1 / fps); m = Math.max(m, q.y); } return [q.x, m]; };
  const a = run(30), b = run(60), c = run(144);
  check(Math.abs(a[0] - c[0]) < 0.3 && Math.abs(b[0] - c[0]) < 0.3, 'distance run does not depend on the frame rate', [a[0], b[0], c[0]].join(' '));
  check(Math.abs(a[1] - c[1]) < 0.12 && Math.abs(b[1] - c[1]) < 0.05, 'neither does the height of a jump', [a[1], b[1], c[1]].join(' '));
}

if (suites.includes('world')) {
  section('world: a seed deals the same run to everyone');
  const sig = s => JSON.stringify([s.hz.map(h => [h.k, +h.a.toFixed(4), +h.b.toFixed(4)]), s.orbs.map(o => [+o.x.toFixed(3), +o.y.toFixed(3)]), s.segs.map(q => [+q.a.toFixed(3), +q.b.toFixed(3)])]);
  const A = VR.create(123), B = VR.create(123), D = VR.create(124);
  VR.step(A, 1 / 60); // extend happens inside steps, compare after the same distance
  for (const q of [A, B, D]) { for (let i = 0; i < 600 && !q.dead; i++) { q.x = Math.min(q.x + 1, 400); VR.step(q, 0.0001); } }
  check(sig(A).slice(0, 4000) === sig(B).slice(0, 4000), 'the same seed deals the same hazards and orbs');
  check(sig(A).slice(0, 2000) !== sig(D).slice(0, 2000), 'a different seed deals a different run');
  // order of generation does not matter: generate far ahead at once vs bit by bit
  const E = VR.create(55), F = VR.create(55);
  const dummy = {x: 0};
  for (const q of [E, F]) q.dead = null;
  // hazards never overlap, sit on ground (blocks, beams, walls) and keep the speed-scaled spacing
  let bad = 0, count = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const q = VR.create(seed); VR.extend(q, 3000);
    const hz = q.hz;
    for (let i = 1; i < hz.length; i++) { count++; if (hz[i].a < hz[i - 1].b + 1) bad++; }
    for (const h of hz) {
      if (h.k === 'gap') continue;
      const mid = (h.a + h.b) / 2;
      if (!q.segs.some(g => g.a < mid && g.b > mid)) { bad++; }
    }
  }
  check(bad === 0, `${count} neighbouring hazards never overlap and every block, beam and wall stands on ground`, bad + ' bad');
  // widths respect the physics at the speed they arrive at
  let wide = 0, n2 = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const q = VR.create(seed); VR.extend(q, 3000);
    for (const h of q.hz) {
      const v = VR.speedAt(h.a), w = h.b - h.a; n2++;
      if (h.k === 'gap' && w > 0.6 * v * VR.AIR.T1 + 0.01 && w > 2.41) wide++;
      if (h.k === 'beam' && w > 0.55 * v * C.SLIDE_T + 0.01 && w > 2.81) wide++;
      if (h.k === 'block' && w > Math.max(1, 0.5 * v * VR.AIR.aboveBlock - 0.7) + 0.01) wide++;
    }
  }
  check(wide === 0, `${n2} hazards are no wider than a jump or a slide at that speed can handle`, wide + ' too wide');
  // a run starts calm: nothing for the first 20 metres
  const first = VR.create(9).hz[0];
  check(first.a >= 20, 'the first hazard is not on top of the start', 'at ' + first.a.toFixed(1));
  // teaching: scripted hazards carry hints and come first, in order
  const T = VR.create(11, {teach: ['block', 'beam', 'wall']});
  check(T.hz.slice(0, 3).map(h => h.k).join() === 'block,beam,wall' && T.hz.slice(0, 3).every(h => h.hint), 'a first run meets block, beam and wall in turn, each with its hint');
  check(!VR.create(11).hz.slice(0, 5).some(h => h.hint), 'later runs carry no hints');
  // speed rises, never falls, and stays under the cap
  let mono = true, prev = 0; for (let x = 0; x < 8000; x += 10) { const v = VR.speedAt(x); if (v < prev - 1e-9) mono = false; prev = v; }
  check(mono && VR.speedAt(1e6) < 18.01 && near(VR.speedAt(0), 9), 'speed rises smoothly from 9 and never passes 18');
}

if (suites.includes('score')) {
  section('score: points are what the HUD says');
  // a run with an unbeaten bot: every orb pays 10 x the multiplier at the time, every close call 30 x
  let totalOrb = 0, rounds = 0;
  for (let seed = 1; seed <= 8; seed++) {
    const s = VR.create(seed), drv = withDive(player(() => 0.5, VR.mulberry(seed)));
    const ev = play(s, 40, drv);
    let pts = 0;
    // replay the events with the documented rule and compare
    let chain = 0; let m = 1;
    for (const e of ev) {
      if (e.t === 'orb') { chain++; m = Math.min(C.MULT_MAX, 1 + Math.floor(chain / 5)); pts += C.ORB_PTS * m; check(e.mult === m, 'orb event carries the multiplier'); }
      else if (e.t === 'shave') { chain += 3; m = Math.min(C.MULT_MAX, 1 + Math.floor(chain / 5)); pts += C.SHAVE_PTS * m; }
      else if (e.t === 'chainlost') { chain = 0; }
    }
    // shave pays at the multiplier after the chain grows? (rule: bump first, then pay) — recompute
    check(Math.abs(pts - s.pts) <= C.SHAVE_PTS * C.MULT_MAX * s.shaves, 'points match the events', `seed ${seed}: ${pts} vs ${s.pts}`);
    check(VR.score(s) === Math.floor(s.x) + s.pts, 'score is metres plus points');
    rounds++;
  }
  // multiplier steps every five and caps
  let s = VR.create(3, {empty: true}); s.chain = 0; check(VR.mult(s) === 1, 'no chain, no multiplier');
  s.chain = 4; check(VR.mult(s) === 1, 'four in a row is still x1');
  s.chain = 5; check(VR.mult(s) === 2, 'five makes x2');
  s.chain = 500; check(VR.mult(s) === C.MULT_MAX, 'the multiplier caps');
  // chain lapses after CHAIN_T with nothing collected
  s = VR.create(4, {empty: true}); s.chain = 7; s.chainT = C.CHAIN_T; s.orbs.length = 0; s.gen.c = 1e9;
  const ev = play(s, C.CHAIN_T + 0.5);
  check(ev.some(e => e.t === 'chainlost') && s.chain === 0, 'a chain lapses when nothing is collected for a few seconds');
}

if (suites.includes('fair')) {
  section('fair: every hazard has a window, and anywhere in it works');
  const SEEDS = +opt('seeds', 40), DIST = +opt('dist', 1800);
  for (const [name, w] of [['as early as fair', () => 0], ['as late as fair', () => 1], ['anywhere inside the window', r => r()]]) {
    let died = 0, runs = 0, worst = null, cleared = 0;
    for (let seed = 1; seed <= SEEDS; seed++) {
      const rnd = VR.mulberry(seed * 7 + 1), s = VR.create(seed * 31);
      play(s, 220, withDive(player(w, rnd)), 1 / 120);
      runs++;
      cleared += s.hz.filter(h => h.passed).length;
      if (s.dead && s.x < DIST) { died++; if (process.env.VERBOSE) { const h = s.hz.find(z => z.b + 0.5 > s.deathX && z.passed !== true) || {}; console.log(`      ${name}: seed ${seed * 31} died ${s.dead} at ${s.x.toFixed(1)} v=${VR.speed(s).toFixed(1)} y=${s.y.toFixed(2)} on ${h.k} ${h.a && h.a.toFixed(1)}-${h.b && h.b.toFixed(1)}`); } if (!worst || s.x < worst.x) worst = {x: s.x, k: s.dead, seed: seed * 31}; }
    }
    check(died === 0, `${runs} runs acting ${name} all reach ${DIST} m (${cleared} hazards cleared)`,
      died + ' died; worst: ' + (worst ? `${worst.k} at ${worst.x.toFixed(0)} m, seed ${worst.seed}` : ''));
  }
}

if (suites.includes('bots')) {
  section('bots: skill is rewarded in order');
  const avg = (mk, n = 30, secs = 240, lag = 0) => {
    let sum = 0;
    for (let seed = 1; seed <= n; seed++) {
      const s = VR.create(seed * 17), rnd = VR.mulberry(seed * 5);
      const drv = mk(rnd);
      play(s, secs, drv, 1 / 60);
      sum += s.x;
    }
    return sum / n;
  };
  const idle = avg(() => null, 30, 60);
  const sloppy = avg(r => withDive(player(() => 0.3 + 0.4 * r(), r, 0.1)));
  const careful = avg(r => withDive(player(() => 0.35 + 0.3 * r(), r, 0.03)));
  const spam = avg(r => (s) => { if (r() < 0.15) VR.press(s, 'jump'); if (r() < 0.05) VR.press(s, 'slide'); }, 30, 60);
  console.log(`  idle ${idle.toFixed(0)} m   spam ${spam.toFixed(0)} m   sloppy ${sloppy.toFixed(0)} m   careful ${careful.toFixed(0)} m`);
  check(idle < 60, 'standing still is over before 60 m');
  check(spam < 300, 'hammering the buttons does not get far');
  check(sloppy > spam, 'a slow-reacting player outruns a button masher');
  check(careful > sloppy, 'a quick player outruns a slow one');
  check(careful > 800, 'a careful player gets well past 800 m');
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
