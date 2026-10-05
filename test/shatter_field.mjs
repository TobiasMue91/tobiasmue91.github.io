#!/usr/bin/env node
// Test suite for games/asteroids_3d.html (Shatter Field).
//
// Runs the page's DOM-free <script id="core"> block in Node. The page only draws what the core returns,
// so the promises that matter live here: a bolt hits what its path crosses and nothing else, a rock
// breaks into pieces that carry its momentum, the warning arrows name exactly the rocks that will hit,
// every field comes round the same for the same seed, and bots with a person's reflexes are ordered by skill.
// No browser, no server.
//
//   node test/shatter_field.mjs                 # everything
//   node test/shatter_field.mjs hits bots       # named suites only
//   node test/shatter_field.mjs --page=path.html
//
// Suites: hits, split, warn, assist, rules, seed, bots.

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name, dflt) => { const a = args.find(x => x.startsWith(`--${name}=`)); return a ? a.split('=')[1] : dflt; };
const PAGE = opt('page', join(HERE, '..', 'games', 'asteroids_3d.html'));
const ALL = ['hits', 'split', 'warn', 'assist', 'rules', 'seed', 'bots'];
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
vm.runInContext(core[1] + '\nthis.F = FIELD;', ctx);
const F = ctx.F;

const rnd = F.rng(12345);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = a => Math.hypot(a[0], a[1], a[2]);
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const unit = () => { const z = rnd() * 2 - 1, a = rnd() * 6.283, q = Math.sqrt(1 - z * z); return [q * Math.cos(a), z, q * Math.sin(a)]; };
const rock = (S, size, p, v) => { const k = { id: S.nextId++, size, r: F.SIZE[size].r, p, v, seed: 1, rx: 0, ry: 0, wx: 0, wy: 0, born: 0 }; S.rocks.push(k); return k; };
const empty = (seed = 1) => { const S = F.newGame(seed); S.rocks.length = 0; return S; };
const run = (S, secs, dt = 1 / 60, input = {}) => { for (let t = 0; t < secs; t += dt) { F.step(S, dt, input); } return S; };

if (suites.includes('hits')) {
  section('hits: a bolt touches what its path crosses');
  // swept sphere vs fine sampling along the segment
  let bad = 0;
  for (let i = 0; i < 20000; i++) {
    const p0 = add([0, 0, 0], unit(), rnd() * 30), p1 = add(p0, unit(), rnd() * 10), c = add([0, 0, 0], unit(), rnd() * 30), r = 0.5 + rnd() * 4;
    let brute = false;
    for (let k = 0; k <= 400; k++) { const q = add(p0, sub(p1, p0), k / 400); if (len(sub(q, c)) <= r + 1e-9) { brute = true; break; } }
    const got = F.segHit(p0, p1, c, r) >= 0;
    if (brute && !got) bad++;
    else if (got && !brute) { // allow only a hair of tolerance for the sampled version
      const d = len(sub(c, p0)); if (!(d > r)) bad++; else { let min = 1e9; for (let k = 0; k <= 4000; k++) min = Math.min(min, len(sub(add(p0, sub(p1, p0), k / 4000), c))); if (min > r + 0.02) bad++; }
    }
  }
  check(bad === 0, 'swept sphere agrees with brute force on 20000 segments', `${bad} disagreements`);

  // a bolt fired straight at a lone rock in range always breaks it; one fired well wide never does
  let missed = 0, wrongly = 0;
  for (let i = 0; i < 300; i++) {
    const S = empty(i + 1); S.assist = 0;
    const dir = unit(); const yaw = Math.atan2(dir[0], dir[2]), pitch = Math.asin(dir[1]);
    S.aim.yaw = yaw; S.aim.pitch = Math.max(-1.4, Math.min(1.4, pitch));
    const b = F.basis(S.aim); const d = 40 + rnd() * 50;
    rock(S, 3, [b.f[0] * d, b.f[1] * d, b.f[2] * d], [0, 0, 0]);
    run(S, 1.1, 1 / 60, { fire: true });
    if (S.kills === 0) missed++;
    const S2 = empty(i + 1); S2.assist = 0; S2.aim.yaw = yaw; S2.aim.pitch = S.aim.pitch;
    const k = rock(S2, 3, add([0, 0, 0], F.basis(S2.aim).r, d * 0.3), [0, 0, 0]); k.p = add(add([0, 0, 0], F.basis(S2.aim).f, d), F.basis(S2.aim).r, 14);
    run(S2, 1.1, 1 / 60, { fire: true });
    if (S2.kills > 0) wrongly++;
  }
  check(missed === 0, 'a rock dead ahead is always hit', `${missed} of 300 missed`);
  check(wrongly === 0, 'a rock 14 units off the line is never hit', `${wrongly} of 300 hit`);

  // a bolt cannot tunnel through a rock however long the frame
  let tunnelled = 0;
  for (const dt of [1 / 240, 1 / 60, 1 / 30, 1 / 15]) {
    const S = empty(5); S.assist = 0; rock(S, 1, [0, 0, 50], [0, 0, 0]);
    run(S, 1.1, dt, { fire: true });
    if (S.kills === 0) tunnelled++;
  }
  check(tunnelled === 0, 'the smallest rock is hit at 240, 60, 30 and 15 frames per second', `${tunnelled} frame rates tunnelled`);
}

if (suites.includes('split')) {
  section('split: pieces carry the rock’s momentum');
  let bad = 0, sizes = 0, n = 0;
  for (let i = 0; i < 400; i++) {
    const size = 2 + (i % 2);
    const S = empty(i + 3); S.assist = 0; rock(S, size, [0, 0, 55], [0, 0, -2 + rnd()]);
    const v0 = S.rocks[0].v.slice();
    for (let t = 0; t < 2 && S.kills === 0; t += 1 / 120) F.step(S, 1 / 120, { fire: true });
    if (S.kills !== 1) { bad++; continue; }
    n++;
    const kids = S.rocks;
    if (kids.length !== 2 || kids.some(c => c.size !== size - 1)) { sizes++; continue; }
    const m = [(kids[0].v[0] + kids[1].v[0]) / 2 - v0[0], (kids[0].v[1] + kids[1].v[1]) / 2 - v0[1], (kids[0].v[2] + kids[1].v[2]) / 2 - v0[2]];
    if (len(m) > 1e-6) bad++;
    if (len(sub(kids[0].v, kids[1].v)) < 4) bad++; // and they really do part
  }
  check(bad === 0, 'a split sends two pieces opposite ways: their mean velocity is the parent’s', `${bad} splits drifted`);
  check(sizes === 0, 'a large rock gives two medium ones, a medium two small', `${sizes} wrong`);
  const S = empty(9); S.assist = 0; rock(S, 1, [0, 0, 50], [0, 0, 0]);
  run(S, 1.2, 1 / 60, { fire: true });
  check(S.rocks.length === 0 && S.kills === 1, 'the smallest rock crumbles to nothing', `${S.rocks.length} left`);
}

if (suites.includes('warn')) {
  section('warn: the arrows name exactly the rocks that will hit');
  let bad = 0, n = 0;
  for (let i = 0; i < 400; i++) {
    const S = empty(i + 11); S.invuln = 0;
    for (let j = 0; j < 4; j++) { const p = add([0, 0, 0], unit(), 40 + rnd() * 40); const t = add([0, 0, 0], unit(), rnd() * 9); rock(S, 1 + (j % 3), p, add([0, 0, 0], sub(t, p), (5 + rnd() * 6) / len(sub(t, p)))); }
    const named = new Set(F.threats(S, 30).map(x => x.id));
    // ground truth: advance in small steps with the ship untouchable by timing, recording who ever reaches it
    const T = JSON.parse(JSON.stringify(S)); const hit = new Set(); let gone = false;
    for (let t = 0; t < 30; t += 1 / 120) {
      for (const k of T.rocks) { k.p = add(k.p, k.v, 1 / 120); if (len(k.p) < k.r + F.SHIP_R) hit.add(k.id); }
    }
    for (const k of S.rocks) { n++; if (named.has(k.id) !== hit.has(k.id)) { // allow razor-thin grazes
        const a = F.approach(k); if (Math.abs(a.d - (k.r + F.SHIP_R)) > 0.15) bad++; } }
  }
  check(bad === 0, 'threats() equals a brute-force run on 1600 rocks', `${bad} of ${n} differ`);
  const S = empty(2); rock(S, 3, [0, 0, 60], [0, 0, -6]); rock(S, 3, [60, 0, 0], [0, 0, 0]);
  const th = F.threats(S, 30);
  check(th.length === 1 && th[0].rock.p[2] === 60, 'a rock that is not moving is never a threat');
  const S3 = empty(2); rock(S3, 2, [0, 0, 60], [0, 0, -6]); rock(S3, 2, [0, 40, 0], [0, -4, 0]);
  const t3 = F.threats(S3, 30); check(t3.length === 2 && t3[0].t < t3[1].t, 'the soonest threat is listed first');
}

if (suites.includes('assist')) {
  section('assist: a nudge toward a rock, never a steer');
  let worst = 0, off = 0;
  for (let i = 0; i < 2000; i++) {
    const S = empty(i + 1); S.aim.yaw = rnd() * 6 - 3; S.aim.pitch = rnd() - .5;
    const b = F.basis(S.aim); const d = 30 + rnd() * 80;
    const ang = rnd() * 0.25, q = unit();
    const side = sub(q, [b.f[0] * dot(q, b.f), b.f[1] * dot(q, b.f), b.f[2] * dot(q, b.f)]);
    const sl = len(side) || 1; const dir = add(b.f, side, Math.tan(ang) / sl);
    rock(S, 1 + (i % 3), [dir[0] * d, dir[1] * d, dir[2] * d], add([0, 0, 0], unit(), rnd() * 8));
    F.fire(S);
    const bolt = S.bolts[0]; const bd = bolt.v.map(x => x / len(bolt.v));
    // the bolt leaves from the gun, so judge the angle against the line from the gun to the sight point
    const toSight = sub(add([0, 0, 0], b.f, 70), bolt.p); const sd = toSight.map(x => x / len(toSight));
    const a = Math.acos(Math.min(1, dot(bd, sd))); worst = Math.max(worst, a);
  }
  check(worst <= F.ASSIST * 1.0 + 0.03, 'a bolt never leaves more than the assist cone from the sight line', `worst ${(worst * 57.3).toFixed(2)}°`);
  const S = empty(1); S.assist = 0; const b = F.basis(S.aim); rock(S, 3, [b.f[0] * 60 + 3, 0, b.f[2] * 60], [0, 0, 0]);
  F.fire(S); const bd = S.bolts[0].v; const toSight = sub([0, 0, 70], S.bolts[0].p);
  check(Math.acos(Math.min(1, dot(bd.map(x => x / len(bd)), toSight.map(x => x / len(toSight))))) < 1e-6, 'with assist off the bolt goes exactly where the sight points');
}

if (suites.includes('rules')) {
  section('rules: score, chain, hull, fields');
  const S = empty(4); S.assist = 0;
  rock(S, 1, [0, 0, 40], [0, 0, 0]); rock(S, 1, [0, 0, 80], [0, 0, 0]);
  run(S, 1.5, 1 / 60, { fire: true });
  check(S.score >= 100 && S.kills === 2, 'two small rocks in a row are both paid', `score ${S.score}`);
  check(F.multiplier(0) === 1 && F.multiplier(3) === 2 && F.multiplier(100) === 5, 'chain multiplier steps every three hits and stops at 5');
  const A = empty(5); A.assist = 0; rock(A, 1, [0, 0, 40], [0, 0, 0]); rock(A, 3, [60, 0, 0], [0, 0, 0]); run(A, 1, 1 / 60, { fire: true }); run(A, F.CHAIN_WINDOW + 0.3);
  check(A.chain === 0, 'a chain lapses when no bolt lands for a moment');
  const H = empty(6); rock(H, 3, [0, 0, 30], [0, 0, -10]); rock(H, 3, [90, 0, 0], [0, 0, 0]); run(H, 3);
  check(H.hull === F.MAX_HULL - 1 && H.invuln > 0, 'a rock that arrives costs one hull and grants a breath', `hull ${H.hull}`);
  const H2 = empty(6); rock(H2, 3, [0, 0, 30], [0, 0, -10]); rock(H2, 3, [0, 0, 31], [0, 0, -10]); rock(H2, 3, [90, 0, 0], [0, 0, 0]); run(H2, 4);
  check(H2.hull === F.MAX_HULL - 1, 'two rocks in one breath cost one hull, not two', `hull ${H2.hull}`);
  const O = empty(7); O.hull = 1; rock(O, 3, [0, 0, 30], [0, 0, -10]); run(O, 4);
  check(O.phase === 'over' && O.events.concat([]).length >= 0, 'the last hull ends the run');
  const C = empty(8); C.assist = 0; C.hull = 2; rock(C, 1, [0, 0, 40], [0, 0, 0]);
  let cleared = null; for (let t = 0; t < 3; t += 1 / 60) { F.step(C, 1 / 60, { fire: true }); for (const e of C.events) if (e.type === 'clear') cleared = e; }
  check(cleared && cleared.healed && C.hull === 3 && cleared.bonus === 250, 'clearing a field heals one hull and pays 250 × field if nothing touched you', JSON.stringify(cleared));
  run(C, F.CLEAR_PAUSE + 0.2);
  check(C.field === 2 && C.phase === 'play' && C.rocks.length === F.countFor(2), 'the next field opens after the pause with the right number of rocks');
  const W = empty(9); rock(W, 3, [0, 0, 109.5], [0, 0, 8]); run(W, 0.5);
  check(W.rocks.length === 1 && len(W.rocks[0].p) < F.WRAP_R, 'a rock that flies out comes round again from the far side');
  let ok = true; for (let f = 1; f < 40; f++) { check(F.speedFor(f + 1) >= F.speedFor(f) && F.countFor(f + 1) >= F.countFor(f), 'difficulty never eases ' + f); }
  check(F.speedFor(1) <= 6 && F.countFor(1) === 3, 'field 1 is slow and three rocks');
}

if (suites.includes('seed')) {
  section('seed: the same seed is the same game');
  const play = seed => { const S = F.newGame(seed); const trace = []; for (let i = 0; i < 1500; i++) { F.turn(S, Math.sin(i / 40) * 0.02, Math.cos(i / 55) * 0.004); F.step(S, 1 / 60, { fire: i % 3 === 0 }); } return JSON.stringify([S.score, S.kills, S.hull, S.field, S.rocks.map(k => k.p.map(x => +x.toFixed(4)))]); };
  check(play(77) === play(77), 'the same seed and the same hands play out identically');
  check(play(77) !== play(78), 'a different seed is a different night');
  const a = F.newGame(20250101), b = F.newGame(20250101);
  check(JSON.stringify(a.rocks) === JSON.stringify(b.rocks), 'a daily seed deals the same first field to everyone');
}

if (suites.includes('bots')) {
  section('bots: skill is rewarded');
  // a bot with a human reaction time: it sees the soonest threat, turns toward it at a limited rate, then fires
  function play(seed, { react, rate, jitter, accuracy, maxT = 600 }) {
    const S = F.newGame(seed); const r = F.rng(seed * 3 + 1); let target = null, tSince = 0, t = 0; let lastField = 1;
    while (S.phase !== 'over' && t < maxT) {
      const dt = 1 / 60; t += dt;
      // choose a rock: soonest closing, else nearest
      tSince += dt;
      if (!target || !S.rocks.includes(target) || tSince > 1.2) {
        if (tSince > react || !target || !S.rocks.includes(target)) {
          const th = F.threats(S, 12); let pick = th.length ? th[0].rock : null;
          if (!pick) { let bd = 1e9; for (const k of S.rocks) { const d = len(k.p); if (d < bd) { bd = d; pick = k; } } }
          target = pick; tSince = 0;
        }
      }
      let fireNow = false;
      if (target && S.rocks.includes(target)) {
        const d = len(target.p); const lead = add(target.p, target.v, d / F.BOLT_SPEED);
        const wy = Math.atan2(lead[0], lead[2]), wp = Math.asin(Math.max(-1, Math.min(1, lead[1] / len(lead))));
        let dy = wy - S.aim.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); const dp = wp - S.aim.pitch;
        const step = rate * dt; const my = Math.max(-step, Math.min(step, dy)), mp = Math.max(-step, Math.min(step, dp));
        F.turn(S, my + (r() - .5) * jitter, mp + (r() - .5) * jitter);
        fireNow = Math.hypot(dy, dp) < (0.03 + (1 - accuracy) * 0.12) && d < 125;
      }
      F.step(S, dt, { fire: fireNow });
      lastField = S.field;
    }
    return { field: S.field, score: S.score, over: S.phase === 'over', t };
  }
  const avg = (cfg, n = 6) => { let f = 0, s = 0; for (let i = 0; i < n; i++) { const o = play(900 + i, cfg); f += o.field; s += o.score; } return { field: f / n, score: s / n }; };
  const idle = (() => { let f = 0; for (let i = 0; i < 6; i++) { const S = F.newGame(900 + i); let t = 0; while (S.phase !== 'over' && t < 400) { F.step(S, 1 / 30); t += 1 / 30; } f += S.field; } return f / 6; })();
  const sharp = avg({ react: 0.25, rate: 4.0, jitter: 0.004, accuracy: 0.95 });
  const mid = avg({ react: 0.5, rate: 2.4, jitter: 0.01, accuracy: 0.7 });
  const poor = avg({ react: 0.9, rate: 1.2, jitter: 0.02, accuracy: 0.4 });
  console.log(`  idle field ${idle.toFixed(1)}   poor ${poor.field.toFixed(1)}   mid ${mid.field.toFixed(1)}   sharp ${sharp.field.toFixed(1)}`);
  check(idle <= 3.5, 'a player who never fires is gone by field 3', `reached ${idle.toFixed(1)}`);
  check(sharp.field > mid.field && mid.field > poor.field, 'sharper hands reach deeper fields', `${poor.field} / ${mid.field} / ${sharp.field}`);
  check(sharp.field >= 8, 'a sharp player passes field 8', `reached ${sharp.field}`);
  check(poor.field >= 2, 'even a poor player clears the first field', `reached ${poor.field}`);
}

console.log(`\n${failures ? 'FAILED' : 'passed'}: ${passes} checks ok, ${failures} failed`);
process.exit(failures ? 1 : 0);
