#!/usr/bin/env node
// Test suite for games/pong.html (Pong, table tennis against a club ladder).
//
// Runs the page's DOM-free <script id="core"> block in Node. The page promises that a ball is never
// lost through a bat at any frame rate, that where the ball meets the blade sets the angle and the
// rally sets the speed, that moving the bat as you hit puts curve on the ball and nothing else does,
// that the score and the serve follow table tennis (two serves each, one each from 10-10, two clear),
// and that the eight club players are ordered by strength while the best of them can still be beaten.
// No browser, no server.
//
//   node test/pong.mjs              all suites
//   node test/pong.mjs ladder       one or more by name: physics, rules, match, cpu, ladder, save

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(HERE, '..', 'games', 'pong.html'), 'utf8');
const src = html.match(/<script id="core">([\s\S]*?)<\/script>/)[1];
const Core = vm.runInNewContext(src + ';Core');
const {W, L, BR, BL, PLANE, MAXA, SERVE, ACC, MAX, RIVALS} = Core;

let fails = 0, n = 0;
const ok = (c, m) => { n++; if (!c) { fails++; console.log('  FAIL', m); } };
const want = process.argv.slice(2);
const suite = (name, fn) => { if (want.length && !want.includes(name)) return; const t = Date.now(); const f = fails; fn(); console.log(`${name}: ${fails === f ? 'ok' : 'FAILED'} (${Date.now() - t} ms)`); };

// A ball in flight toward side `to`, fired by hand.
function flying(s, {u = W / 2, v = L / 2, a = 0, spd = SERVE, to = 0, spin = 0} = {}) {
  const b = s.ball, d = to === 0 ? -1 : 1;
  s.phase = 'rally'; s.phaseT = 0; s.lastHit = 1 - to;
  Object.assign(b, {u, v, spd, spin, out: -1, vu: Math.sin(a) * spd, vv: Math.cos(a) * spd * d});
}
const run = (s, secs, dt, input = {}) => { const ev = []; for (let t = 0; t < secs - 1e-9 && s.phase !== 'over'; t += dt) ev.push(...Core.step(s, dt, input)); return ev; };
const human = (react, err, aim) => ({react, speed: 900, err, aim, spin: 0, reads: 1, home: 0.6});

suite('physics', () => {
  // No ball slips through a bat, at any frame rate: a bat waiting where the ball arrives always hits it.
  for (const dt of [1 / 30, 1 / 60, 1 / 144, 0.1]) for (let i = 0; i < 200; i++) {
    const r = Core.rng(i + 1), to = i % 2, spd = SERVE + r() * (MAX - SERVE), a = (r() - 0.5) * 2 * MAXA;
    const s = Core.create({seed: i + 1});
    flying(s, {u: 20 + r() * (W - 40), a, spd, to, spin: (r() - 0.5) * 200});
    const pr = Core.predict(s, to);
    const off = (r() - 0.5) * 2 * (BL / 2 - 0.5);
    s.bats[to].u = pr.u - off; s.bats[1 - to].u = W / 2;
    const ev = run(s, pr.t + 0.3, dt, {u: [s.bats[0].u, s.bats[1].u]});
    ok(ev.some(e => e.type === 'hit' && e.side === to), `bat waiting at the arrival hits (dt ${dt.toFixed(3)}, ${spd | 0} u/s)`);
    // and a bat a full blade away never does
    const t = Core.create({seed: i + 1});
    flying(t, {u: 20 + r() * (W - 40), a, spd, to});
    const pt = Core.predict(t, to);
    t.bats[to].u = pt.u + (pt.u > W / 2 ? -1 : 1) * (BL / 2 + BR + 2);
    const ev2 = run(t, pt.t + 0.5, dt, {u: [t.bats[0].u, t.bats[1].u]});
    ok(!ev2.some(e => e.type === 'hit') && ev2.some(e => e.type === 'pass' && e.side === to), 'a bat beside the ball lets it through');
  }

  // The ball stays between the side edges at every frame rate, and leaves only over an end.
  for (const dt of [1 / 30, 1 / 60, 1 / 144, 0.1]) for (let seed = 1; seed <= 6; seed++) {
    const s = Core.create({seed, bots: [RIVALS[seed % 8], RIVALS[(seed * 3) % 8]], to: 99});
    let inside = true, ends = true;
    for (let t = 0; t < 40; t += dt) {
      const ev = Core.step(s, dt);
      const b = s.ball;
      if (b.u < BR - 1e-9 || b.u > W - BR + 1e-9) inside = false;
      for (const e of ev) if (e.type === 'point' && b.v > -2 * BR && b.v < L + 2 * BR) ends = false;
    }
    ok(inside, `ball inside the side edges (dt ${dt.toFixed(3)}, seed ${seed})`);
    ok(ends, 'points only once the ball is over an end');
  }

  // Where it meets the blade sets the angle; each hit speeds the rally up, to a ceiling.
  for (let i = 0; i < 300; i++) {
    const r = Core.rng(1000 + i), to = i % 2, spd = SERVE + r() * (MAX - SERVE);
    const s = Core.create({seed: i + 1});
    flying(s, {u: W / 2, v: to ? L - 40 : 40, a: 0, spd, to});
    const off = (r() - 0.5) * 2;
    s.bats[to].u = W / 2 - off * BL / 2;
    let h = null;
    for (let t = 0; t < 0.4 && !h; t += 1 / 120) h = Core.step(s, 1 / 120, {u: [s.bats[0].u, s.bats[1].u]}).find(e => e.type === 'hit');
    ok(h && Math.abs(h.off - off) < 0.02, 'contact offset is where the ball met the blade');
    const b = s.ball, back = to ? -1 : 1;
    if (!h) continue;
    ok(Math.abs(b.spd - Math.min(MAX, spd * ACC)) < 1e-6, 'speed rises by ACC, capped at MAX');
    ok(Math.abs(Math.hypot(b.vu, b.vv) - b.spd) < 1e-6, 'velocity has the rally speed');
    ok(Math.sign(b.vv) === back, 'the ball goes back the way it came');
    if (Math.abs(h.off) > 0.05 && b.spin === 0) ok(Math.abs(Math.atan2(b.vu, Math.abs(b.vv)) - h.off * MAXA) < 0.02, 'angle = offset x MAXA');
    ok(b.spin === 0, 'a still bat puts no curve on the ball');
  }

  // Moving the bat as you hit curves the ball the way the bat moved; the speed holds and the angle stays playable.
  for (const dir of [-1, 1]) {
    const s = Core.create({seed: 3});
    flying(s, {u: W / 2, v: 40, a: 0, spd: 300, to: 0});
    s.bats[0].u = W / 2 - dir * 30;
    let hit = null; const pts = [];
    for (let t = 0; t < 1.2; t += 1 / 240) {
      const ev = Core.step(s, 1 / 240, {u: [s.bats[0].u + dir * 1.5, W / 2]});
      hit = hit || ev.find(e => e.type === 'hit');
      if (hit && s.phase === 'rally') pts.push({...s.ball});
    }
    ok(hit && Math.sign(hit.spin) === dir, `a bat moving ${dir > 0 ? 'right' : 'left'} spins the ball that way`);
    ok(pts.every(b => Math.abs(Math.hypot(b.vu, b.vv) - b.spd) < 1e-6), 'curve keeps the speed');
    ok(pts.every(b => Math.abs(b.vu) <= Math.tan(MAXA + 0.1) * Math.abs(b.vv) + 1e-6), 'curve never lays the ball flat');
    const bend = pts.slice(1, 40).map((b, i) => b.vu - pts[i].vu);
    ok(bend.filter(x => x !== 0).every(x => Math.sign(x) === dir || Math.abs(x) < 1e-9) || pts.some(b => b.u <= BR + 1 || b.u >= W - BR - 1), 'and keeps bending that way until a side edge');
  }

  // predict() is where the ball really arrives, with and without curve.
  for (let i = 0; i < 300; i++) {
    const r = Core.rng(77 + i), to = i % 2;
    const s = Core.create({seed: i + 1});
    flying(s, {u: 10 + r() * (W - 20), a: (r() - 0.5) * 2 * MAXA, spd: SERVE + r() * (MAX - SERVE), to, spin: i % 3 ? (r() - 0.5) * 280 : 0});
    const pr = Core.predict(s, to);
    s.bats[0].u = s.bats[1].u = -999; // out of the way
    s.bats.forEach(b => { b.max = 0; });
    const ev = run(s, pr.t + 0.2, 1 / 240, {u: [-999, -999]});
    const p = ev.find(e => e.type === 'pass');
    ok(p && Math.abs(p.u - pr.u) < 0.6, `predict() lands within 0.6 of the real crossing (${p && Math.abs(p.u - pr.u).toFixed(2)})`);
  }
});

suite('rules', () => {
  // Serve order against a reference that plays the rules out point by point.
  for (const to of [11, 21, 5]) for (const first of [0, 1]) {
    let server = first, inTurn = 0;
    for (let nPts = 0; nPts < 80; nPts++) {
      ok(Core.serverFor(first, nPts, to) === server, `server after ${nPts} points (to ${to}, first ${first})`);
      inTurn++;
      const deuce = nPts + 1 >= 2 * (to - 1);
      if (deuce || inTurn === 2) { server = 1 - server; inTurn = 0; }
    }
  }
  // A human server: launches on a tap after a quarter second, by itself after SERVE_AUTO, never while held.
  {
    const s = Core.create({seed: 1}); Core.step(s, 0.1, {serve: [true, false]});
    ok(s.phase === 'serve', 'a tap in the first quarter second does not serve');
    Core.step(s, 0.2, {serve: [true, false]}); ok(s.phase === 'rally', 'a tap after it does');
    const t = Core.create({seed: 1}); run(t, Core.SERVE_AUTO - 0.05, 1 / 60);
    ok(t.phase === 'serve', 'no serve before the ring closes'); run(t, 0.1, 1 / 60); ok(t.phase === 'rally', 'the ring closing serves');
    const u = Core.create({seed: 1}); run(u, 10, 1 / 60, {hold: true}); ok(u.phase === 'serve', 'a held serve waits');
    const v = Core.create({seed: 1}); Core.step(v, 0.3, {u: [40, 0]}); ok(Math.abs(v.ball.u - v.bats[0].u) < 1e-9, 'the ball rides the server\'s bat');
  }
  // Two clear: winners, and only winners, end a match.
  for (let i = 0; i < 400; i++) {
    const r = Core.rng(i + 9), s = Core.create({seed: i + 1});
    let a = 0, b = 0, ended = false;
    while (!ended && a + b < 200) {
      const w = r() < 0.5 ? 0 : 1;
      flying(s, {to: 1 - w, u: W / 2, v: w ? 30 : L - 30, spd: 500});
      s.bats[1 - w].u = 10; s.bats[1 - w].max = 0;
      const ev = run(s, 2.5, 1 / 60, {u: [s.bats[0].u, s.bats[1].u]});
      w ? b++ : a++;
      const pt = ev.find(e => e.type === 'point');
      ok(pt && pt.side === w && pt.score[0] === a && pt.score[1] === b, 'one point to the side that did not miss');
      const done = Math.max(a, b) >= 11 && Math.abs(a - b) >= 2;
      ok(pt && pt.match === done, `match ends exactly at ${a}-${b}? ${done}`);
      ended = done;
      s.bats.forEach(x => { x.max = Core.HUMAN; });
    }
    ok(s.phase === 'over' && s.winner === (a > b ? 0 : 1), 'the winner is the side with two clear');
  }
});

suite('match', () => {
  // Whole machine matches: every point is accounted for, rallies are counted from the hits, a seed is one match.
  const log = (seed, dt) => { const s = Core.create({seed, bots: [RIVALS[seed % 8], RIVALS[7 - (seed % 8)]]}); const ev = []; while (s.phase !== 'over' && s.t < 3600) for (const e of Core.step(s, dt)) ev.push(e); return {s, ev}; };
  for (let seed = 1; seed <= 24; seed++) {
    const {s, ev} = log(seed, 1 / 60);
    ok(s.phase === 'over', `match ${seed} finishes`);
    const pts = ev.filter(e => e.type === 'point');
    ok(pts.length === s.score[0] + s.score[1], 'one point event per point');
    let rally = 0, longest = 0, okR = true, okS = true, prev = [0, 0];
    for (const e of ev) {
      if (e.type === 'serve') rally = 0;
      if (e.type === 'hit') { rally++; longest = Math.max(longest, rally); if (e.rally !== rally) okR = false; }
      if (e.type === 'point') { if (e.rally !== rally) okR = false; const d = [e.score[0] - prev[0], e.score[1] - prev[1]]; if (d[e.side] !== 1 || d[1 - e.side] !== 0) okS = false; prev = e.score; }
    }
    ok(okR && longest === s.longest, 'rally counts are the hits since the serve');
    ok(okS, 'each point moves one score by one');
    const serves = ev.filter(e => e.type === 'serve');
    ok(serves.every((e, i) => e.side === Core.serverFor(0, i, 11)), 'each serve is made by the right player');
    const again = log(seed, 1 / 60);
    ok(JSON.stringify(again.ev) === JSON.stringify(ev), 'a seed plays the same match');
  }
});

suite('cpu', () => {
  // The machine never moves its bat faster than its stated speed, and rallies always end.
  for (let i = 0; i < 8; i++) {
    const s = Core.create({seed: i + 1, bots: [RIVALS[i], RIVALS[i]], to: 99});
    let fast = false, longest = 0, prev = s.bats.map(b => b.u);
    for (let t = 0; t < 300; t += 1 / 60) {
      Core.step(s, 1 / 60);
      s.bats.forEach((b, k) => { if (Math.abs(b.u - prev[k]) > RIVALS[i].speed / 60 + 1e-6) fast = true; prev[k] = b.u; });
      longest = Math.max(longest, s.rally);
    }
    ok(!fast, `${RIVALS[i].name} keeps to ${RIVALS[i].speed} u/s`);
    ok(longest < 60, `${RIVALS[i].name} against ${RIVALS[i].name}: every rally ends (longest ${longest})`);
    ok(s.score[0] + s.score[1] > 15, `${RIVALS[i].name} mirror match keeps scoring (${s.score})`);
  }
});

suite('ladder', () => {
  // Bots with a person's reaction time and aim play the ladder: the rungs get harder in order, Pip is a
  // gentle first match, and the champion can be beaten by a strong player.
  const N = 16;
  const rate = (h, r) => { let w = 0, mins = 0; for (let i = 1; i <= N; i++) { const s = Core.create({seed: i * 7919, bots: [h, r]}); while (s.phase !== 'over' && s.t < 3600) Core.step(s, 1 / 60); if (s.winner === 0) w++; mins += s.t / 60; } return {w: w / N, mins: mins / N}; };
  const good = human(0.22, 5.5, 0.4), novice = human(0.32, 11, 0), expert = human(0.18, 4, 0.6);
  const rows = RIVALS.map(r => rate(good, r));
  console.log('  good player vs ladder:', rows.map((x, i) => `${RIVALS[i].name} ${Math.round(x.w * 100)}%`).join(', '));
  for (let i = 1; i < rows.length; i++) ok(rows[i].w <= rows[i - 1].w + 0.2, `${RIVALS[i].name} is no easier than ${RIVALS[i - 1].name}`);
  ok(rows[0].w >= 0.9 && rows[1].w >= 0.75, 'a good player gets past the first two rungs');
  ok(rows[7].w <= 0.4, 'the champion beats a good player most of the time');
  ok(rows[0].w > rows[4].w && rows[4].w > rows[7].w || rows[7].w === 0, 'Pip, Bram, Vera in that order');
  ok(rate(novice, RIVALS[0]).w >= 0.6, 'a novice can beat Pip');
  const v = rate(expert, RIVALS[7]);
  ok(v.w >= 0.3, `an expert can beat Vera (${Math.round(v.w * 100)}%)`);
  ok(rows.every(x => x.mins < 7), `matches stay short (${rows.map(x => x.mins.toFixed(1)).join(', ')} min)`);
});

suite('save', () => {
  const c = Core.cleanSave;
  const d = c(null);
  ok(d.beaten === 0 && d.results.length === 0 && !d.muted, 'nothing gives a fresh club');
  for (const bad of [42, 'x', [], {beaten: 'lots'}, {beaten: -3}, {beaten: 1e9}, {beaten: NaN}, {muted: 'yes'}, {results: 'x'}, {best: Infinity}])
    { const o = c(bad); ok(o.beaten >= 0 && o.beaten <= RIVALS.length && Number.isInteger(o.beaten) && o.muted === false && Number.isFinite(o.best), `hostile save ${JSON.stringify(bad)}`); }
  const o = c({beaten: 3, results: [[11, 4], [11, 11], [13, 11], [12, 4]], best: 17.9, muted: true});
  ok(o.beaten === 3 && o.best === 17 && o.muted, 'a fair save keeps its numbers');
  ok(JSON.stringify(o.results) === '[[11,4],null,[13,11]]', `impossible results are dropped (${JSON.stringify(o.results)})`);
  ok(c({beaten: 2}).results.length === 2, 'every beaten rung has a result slot');
});

console.log(fails ? `\n${fails} of ${n} checks failed` : `\nall ${n} checks passed`);
process.exit(fails ? 1 : 0);
