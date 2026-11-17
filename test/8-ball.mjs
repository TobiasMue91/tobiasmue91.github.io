#!/usr/bin/env node
// Test suite for games/8-ball.html.
//
// Runs the page's DOM-free <script id="core"> block in Node: table geometry, ball physics, the rules of
// eight-ball and the house players. Pool lives or dies on a few quiet promises: a ball that rolls comes to rest,
// a stun shot stops the cue ball dead, draw comes back and follow goes on, a collision never makes energy, the
// aim guide names the ball the cue ball will really hit and sends the object ball where it really goes, and the
// referee calls scratches, misses, wrong balls, no-rail fouls and the eight the way the rules say. The house
// players are played against each other and ordered by strength, and their fouls are counted by cause so a
// cause that should be rare (a scratch on a plain pot) shows up as a number. No browser, no server.
//
//   node test/8-ball.mjs                 all suites
//   node test/8-ball.mjs physics rules   named suites: geometry physics guide rules save ai

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(HERE, '..', 'games', '8-ball.html'), 'utf8');
const src = html.match(/<script id="core">([\s\S]*?)<\/script>/)[1];
const Core = vm.runInThisContext(src + ';Core');
const {L, W, R, D} = Core;

let fails = 0, n = 0;
const ok = (c, m) => { n++; if (!c) { fails++; console.log('FAIL', m); } else if (process.env.VERBOSE) console.log('  ok', m); };
const want = process.argv.slice(2);
const suites = {};
const suite = (name, fn) => { suites[name] = fn; };

// a table with only the listed balls on it: [[n, x, y], ...]
function table(list, o = {}) {
  const s = Core.newGame({seed: o.seed || 1});
  s.balls.forEach(b => { b.on = false; b.pocket = 0; });
  for (const [k, x, y] of list) { const b = s.balls[k]; b.on = true; b.pocket = -1; b.x = x; b.y = y; }
  s.broken = o.broken !== false; s.phase = 'aim'; s.inHand = null; s.turn = o.turn || 0; s.groups = o.groups || [null, null];
  return s;
}
const shot = (s, a, p, sx = 0, sy = 0) => { Core.shoot(s, {a, p, sx, sy}); return Core.runOut(s); };
const angleTo = (s, from, x, y) => Math.atan2(y - s.balls[from].y, x - s.balls[from].x);
const energy = s => s.balls.reduce((e, b) => e + (b.on ? b.vx * b.vx + b.vy * b.vy + 0.4 * R * R * (b.wx * b.wx + b.wy * b.wy + b.wz * b.wz) : 0), 0);

suite('geometry', () => {
  ok(Core.pockets.length === 6, 'six pockets');
  ok(Core.pockets.filter(p => p.kind === 'corner').length === 4, 'four of them corners');
  // nowhere on the bed is a pocket
  let stray = 0;
  for (let x = R; x <= L - R; x += 20) for (let y = R; y <= W - R; y += 20) if (Core.pocketAt(x, y) >= 0) stray++;
  ok(stray === 0, 'no point a ball can rest on counts as potted');
  ok(Core.pocketAt(-5, -5) === 0 && Core.pocketAt(L + 5, W + 5) === 5, 'the corners swallow what reaches them');
  ok(Core.pocketAt(L / 2, -30) === 1 && Core.pocketAt(L / 2, W + 30) === 4, 'so do the sides');
  const s = Core.newGame({seed: 3});
  const on = s.balls.filter(b => b.on);
  ok(on.length === 16, 'sixteen balls racked');
  let overlap = 0;
  for (let i = 0; i < 16; i++) for (let j = i + 1; j < 16; j++) if (Math.hypot(on[i].x - on[j].x, on[i].y - on[j].y) < D - 0.01) overlap++;
  ok(overlap === 0, 'the rack does not overlap');
  const apex = on.filter(b => b.n).reduce((m, b) => b.x < m.x ? b : m);
  ok(Math.abs(apex.x - Core.FOOT) < 1 && Math.abs(apex.y - W / 2) < 1, 'the apex sits on the foot spot');
  ok(s.balls[8].x > apex.x + 2 * D * .85 && Math.abs(s.balls[8].y - W / 2) < 1, 'the eight in the middle of the third row');
  const backs = on.filter(b => b.n && b.x > apex.x + 4 * D * .85 && Math.abs(b.y - W / 2) > 1.9 * D);
  ok(backs.length === 2 && Core.groupOf(backs[0].n) !== Core.groupOf(backs[1].n), 'a solid and a stripe in the back corners');
});

suite('physics', () => {
  // a rolling ball comes to rest, and does not wander off its line
  for (const p of [0.08, 0.15, 0.25]) {
    const s = table([[0, 300, 635]]), ev = shot(s, 0, p);
    ok(!Core.moving(s.balls[0]) && ev.t < 30, `a lone ball at power ${p} comes to rest (${ev.t.toFixed(1)} s)`);
    ok(Math.abs(s.balls[0].y - 635) < 0.5, 'and rolls straight');
  }
  // a hard shot gets round the table and still stops
  { const s = table([[0, 300, 300]]), ev = shot(s, 0.6, 1); ok(!Core.moving(s.balls[0]) && ev.t < 30 && s.balls[0].on !== undefined, 'a full-power shot round the cushions stops within 30 s'); }
  // stun, draw, follow: a short straight shot
  // the cue ball's speed half a second after a short straight hit
  const run = sy => { const s = table([[0, 1030, 635], [1, 1150, 635]]); Core.shoot(s, {a: 0, p: 0.42, sx: 0, sy}); let t = 0; while (t < 0.6 && Core.step(s)) t += Core.DT; return s.balls[0].vx; };
  const stun = run(0), draw = run(-1), follow = run(0.8);
  ok(Math.abs(stun) < 80, `a centre hit at this range stuns the cue ball nearly dead (${stun.toFixed(0)} mm/s)`);
  ok(draw < -300, `draw brings it back (${draw.toFixed(0)} mm/s)`);
  ok(follow > 300, `follow carries it on (${follow.toFixed(0)} mm/s)`);
  // a full hit passes everything on: the object ball takes nearly all the speed
  { const s = table([[0, 700, 635], [1, 760, 635]]); Core.shoot(s, {a: 0, p: .3}); for (let i = 0; i < 40; i++) Core.step(s);
    ok(s.balls[1].vx > 0.9 * Math.hypot(s.balls[0].vx, s.balls[0].vy) * 5, 'a full hit hands the speed to the object ball'); }
  // collisions never make energy
  let worst = 0;
  for (let seed = 1; seed <= 12; seed++) {
    const s = Core.newGame({seed}); Core.shoot(s, {a: (seed - 6) * 0.002, p: 1});
    let e = energy(s); const e0 = e;
    for (let i = 0; i < 6000; i++) { if (!Core.step(s)) break; const e2 = energy(s); worst = Math.max(worst, (e2 - e) / e0); e = e2; }
  }
  ok(worst < 1e-4, `energy never grows from one step to the next (worst ${(worst * 100).toFixed(4)} % of the break)`);
  // breaks leave nothing overlapping and nothing off the table
  let bad = 0, pots = 0, scr = 0, deadest = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const s = Core.newGame({seed}), p0 = s.balls.map(b => [b.x, b.y]), ev = shot(s, (seed % 7 - 3) * 0.003, 1, 0, -0.1);
    deadest = Math.max(deadest, s.balls.filter((b, i) => i && b.on && Math.hypot(b.x - p0[i][0], b.y - p0[i][1]) < D).length);
    pots += ev.pots.filter(k => k).length; if (ev.cueOff) scr++;
    const on = s.balls.filter(b => b.on);
    for (const b of on) if (b.x < -40 || b.x > L + 40 || b.y < -40 || b.y > W + 40) bad++;   // hanging in a jaw is allowed
    for (let i = 0; i < on.length; i++) for (let j = i + 1; j < on.length; j++) if (Math.hypot(on[i].x - on[j].x, on[i].y - on[j].y) < D - 0.5) bad++;
  }
  ok(bad === 0, 'after forty breaks nothing overlaps or leaves the table');
  ok(pots / 40 > 0.5 && pots / 40 < 3, `a break pots about a ball (${(pots / 40).toFixed(2)} per break)`);
  ok(scr <= 6, `and rarely scratches (${scr} of 40)`);
  // a ball pressed against two others shares its push between them: no break leaves the rack standing
  ok(deadest <= 4, `every break opens the rack (at most ${deadest} balls stay within a diameter of their spot)`);
  // no tunnelling: at full power the cue ball still meets a ball in its way
  for (const off of [0, 20, 40, 52]) { const s = table([[0, 200, 635], [5, 2300, 635 + off]]); const ev = shot(s, 0, 1); ok(ev.first === 5, `full power does not jump a ball ${off} mm off the line`); }
  // english: right side throws the ball to its own right off a cushion
  const eng = sx => { const s = table([[0, 800, 600]]); Core.shoot(s, {a: -Math.PI / 2, p: .3, sx}); let t = 0; while (Core.step(s) && t < .6) t += Core.DT; return s.balls[0].vx; };
  ok(eng(1) < -50 && eng(-1) > 50 && Math.abs(eng(0)) < 1, 'right english comes off the rail to the ball’s right, left to its left');
  // straight-in pots into a corner, from cut angles a player would try
  for (const cut of [0, 20, 40, 55]) {
    let made = 0;
    for (let k = 0; k < 10; k++) {
      const bx = 900 + k * 30, by = 420, ap = {x: 6, y: 6};
      let dx = ap.x - bx, dy = ap.y - by; const dl = Math.hypot(dx, dy); dx /= dl; dy /= dl;
      const gx = bx - dx * D, gy = by - dy * D, c = -cut * Math.PI / 180, ux = dx * Math.cos(c) - dy * Math.sin(c), uy = dx * Math.sin(c) + dy * Math.cos(c);
      const s = table([[0, gx - ux * 500, gy - uy * 500], [3, bx, by]]);
      const ev = shot(s, angleTo(s, 0, gx, gy), 0.62);
      if (ev.pots.indexOf(3) >= 0) made++;
    }
    ok(made === 10, `a ghost-ball aim pots a ${cut}° cut every time (${made}/10)`);
  }
  // a ball rolled at the jaw rather than the mouth stays out
  { const s = table([[3, 900, 40]]); const b = s.balls[3]; b.vx = 1500; b.vy = -10; s.ev = {first: -1, rail: false, railSet: {}, railBalls: 0, pots: [], log: [], t: 0};
    while (b.on && b.x < L / 2 + 300 && Core.step(s)); ok(b.on, 'a ball running along the rail past the side pocket at a shallow angle does not drop'); }
});

suite('guide', () => {
  // the aim guide names the ball the cue ball really meets, and the object ball really leaves along its line
  let named = 0, total = 0, worst = 0;
  for (let seed = 1; seed <= 30; seed++) {
    const s = Core.newGame({seed}); shot(s, (seed % 5 - 2) * 0.004, 1); Core.judge(s);
    if (!s.balls[0].on) continue;
    s.phase = 'aim'; s.inHand = null;
    for (let k = 0; k < 8; k++) {
      const a = (seed * 0.37 + k * 0.79) % (Math.PI * 2);
      const tr = Core.trace(s, s.balls[0].x, s.balls[0].y, a);
      if (tr.kind !== 'ball') continue;
      const t = Core.clone(s); Core.shoot(t, {a, p: 0.3});
      // run until the first contact, then a moment more, and compare the object ball's heading
      let steps = 0; while (t.ev.first < 0 && steps < 20000 && Core.step(t)) steps++;
      for (let i = 0; i < 3; i++) Core.step(t);
      total++;
      if (t.ev.first === tr.n) {
        named++;
        const b = t.balls[tr.n], h = Math.atan2(b.vy, b.vx), want = Math.atan2(tr.ony, tr.onx);
        let d = Math.abs(h - want); if (d > Math.PI) d = 2 * Math.PI - d;
        if (Math.hypot(b.vx, b.vy) > 30 && t.ev.contacts === 1 && !t.ev.log.some(e => e.k === 'rail')) worst = Math.max(worst, d);
      }
    }
  }
  ok(total > 60 && named === total, `the guide names the first ball hit (${named}/${total})`);
  ok(worst < 0.01, `and the object ball leaves along the guide line (worst ${(worst * 180 / Math.PI).toFixed(2)}°)`);
});

suite('rules', () => {
  const judge = (s, a, p, sx, sy) => { shot(s, a, p, sx, sy); return Core.judge(s); };
  // scratch
  { const s = table([[0, 1000, 635], [3, 1300, 635], [8, 2000, 300], [12, 600, 200]], {groups: ['solids', 'stripes']});
    s.balls[3].x = 2000; s.balls[3].y = 900;
    const r = judge(s, angleTo(s, 0, 6, 6), 0.5);
    ok(r.foul === 'scratch' && s.turn === 1 && s.inHand === 'anywhere' && s.balls[0].on, 'a scratch gives the other player ball in hand anywhere'); }
  // miss
  { const s = table([[0, 1000, 635], [3, 2000, 200], [8, 2000, 1000], [12, 600, 1000]], {groups: ['solids', 'stripes']});
    const r = judge(s, Math.PI / 2, 0.05); ok(r.foul === 'miss' && s.turn === 1 && s.inHand === 'anywhere', 'hitting nothing is a foul'); }
  // wrong ball first
  { const s = table([[0, 1000, 635], [3, 2000, 200], [12, 1400, 635], [8, 2200, 1000]], {groups: ['solids', 'stripes']});
    const r = judge(s, 0, 0.3); ok(r.foul === 'wrong' && s.turn === 1, 'hitting the other group first is a foul'); }
  { const s = table([[0, 1000, 635], [3, 2000, 200], [8, 1400, 635], [12, 2200, 1000]], {groups: [null, null]});
    const r = judge(s, 0, 0.3); ok(r.foul === 'wrong', 'on an open table the eight is not a legal first ball'); }
  // no rail
  { const s = table([[0, 1000, 635], [3, 1200, 635], [8, 2200, 1000], [12, 600, 1000]], {groups: ['solids', 'stripes']});
    const r = judge(s, 0, 0.1); ok(r.foul === 'rail' && s.turn === 1, 'a contact that sends nothing to a rail is a foul'); }
  // a fair miss passes the turn without ball in hand
  { const s = table([[0, 1000, 635], [3, 1300, 635], [8, 2200, 1000], [12, 600, 1000]], {groups: ['solids', 'stripes']});
    const r = judge(s, 0.05, 0.4); ok(!r.foul && !r.keep && s.turn === 1 && !s.inHand, 'a fair shot that pots nothing passes the turn'); }
  // groups on an open table
  { const s = table([[0, 1500, 900], [11, 1100, 500], [3, 2000, 300], [8, 2200, 1000]], {groups: [null, null]});
    const ob = s.balls[11], ap = {x: 6, y: 6}; let dx = ap.x - ob.x, dy = ap.y - ob.y; const dl = Math.hypot(dx, dy); dx /= dl; dy /= dl;
    const r = judge(s, angleTo(s, 0, ob.x - dx * D, ob.y - dy * D), 0.5);
    ok(r.pots.indexOf(11) >= 0 && r.assigned === 'stripes' && s.groups[0] === 'stripes' && s.groups[1] === 'solids' && r.keep && s.turn === 0, 'potting a stripe on an open table claims stripes and keeps the table'); }
  // the break never assigns, and a break scratch is ball in hand behind the line
  { let saw = false, scratch = false;
    for (let seed = 1; seed <= 60 && !(saw && scratch); seed++) {
      const s = Core.newGame({seed}); const r = judge(s, (seed % 9 - 4) * 0.004, 1, 0, seed % 3 ? -0.1 : 0.6);
      if (r.pots.some(k => k && k !== 8)) { saw = true; ok(s.groups[0] === null && s.groups[1] === null, 'the break leaves the table open'); }
      if (r.foul === 'scratch') { scratch = true; ok(s.inHand === 'kitchen' && s.balls[0].x <= Core.HEAD, 'a scratch on the break is ball in hand behind the head string'); }
    }
    ok(saw, 'some break pots a ball'); }
  // the eight
  const eightShot = (groups, others, sx = 0, scratchToo = false) => {
    const s = table([[0, 1500, 900], [8, 1100, 500], ...others], {groups});
    const ob = s.balls[8], ap = {x: 6, y: 6}; let dx = ap.x - ob.x, dy = ap.y - ob.y; const dl = Math.hypot(dx, dy); dx /= dl; dy /= dl;
    shot(s, angleTo(s, 0, ob.x - dx * D, ob.y - dy * D), 0.5, sx, 0);
    if (scratchToo) s.ev.cueOff = true, s.ev.pots.push(0);
    const r = Core.judge(s); return {s, r};
  };
  { const {s} = eightShot(['solids', 'stripes'], [[12, 2300, 1100]]); ok(s.phase === 'over' && s.winner === 0 && s.reason === 'eight', 'the eight after clearing your group wins'); }
  { const {s} = eightShot(['solids', 'stripes'], [[3, 2300, 1100]]); ok(s.phase === 'over' && s.winner === 1, 'the eight with your balls still up loses'); }
  { const {s} = eightShot([null, null], [[3, 2300, 1100], [12, 2300, 200]]); ok(s.phase === 'over' && s.winner === 1, 'the eight on an open table loses'); }
  { const {s} = eightShot(['solids', 'stripes'], [[12, 2300, 1100]], 0, true); ok(s.phase === 'over' && s.winner === 1 && s.reason === 'eight-foul', 'the eight with a scratch loses'); }
  // eight on the break is spotted
  { let found = false;
    for (let seed = 1; seed <= 400 && !found; seed++) {
      const s = Core.newGame({seed}); shot(s, (seed % 11 - 5) * 0.003, 1, 0, -0.1);
      if (s.ev.pots.indexOf(8) >= 0 && !s.ev.cueOff) { found = true; const r = Core.judge(s); ok(r.respot && s.balls[8].on && s.phase === 'aim', 'the eight on the break comes back to the foot spot'); }
    }
    if (!found) ok(true, 'no break in 400 potted the eight (rule not exercised)'); }
  // ball in hand: placement refuses overlaps and the kitchen line
  { const s = table([[0, 500, 500], [3, 600, 600]]); s.inHand = 'kitchen';
    ok(!Core.canPlace(s, 600, 600 + D * .9), 'the cue ball cannot be placed on a ball');
    ok(!Core.canPlace(s, Core.HEAD + 50, 300), 'or past the head string with ball in hand behind it');
    s.inHand = 'anywhere'; ok(Core.canPlace(s, Core.HEAD + 50, 300), 'but anywhere free with ball in hand anywhere');
    const [x, y] = Core.nearestFree(s, 600, 600); ok(Math.hypot(x - 600, y - 600) >= D - 0.01, 'the nearest free spot clears the ball'); }
});

suite('save', () => {
  const s = Core.newGame({seed: 42}); shot(s, 0.002, 1); Core.judge(s);
  const t = Core.load(Core.save(s));
  ok(t && t.balls.every((b, i) => b.on === s.balls[i].on && Math.abs(b.x - s.balls[i].x) < .1 && Math.abs(b.y - s.balls[i].y) < .1), 'a save restores every ball');
  ok(t.turn === s.turn && JSON.stringify(t.groups) === JSON.stringify(s.groups) && t.inHand === s.inHand && t.broken === s.broken, 'and the turn, groups and ball in hand');
  ok(Core.load('nonsense') === null && Core.load('{"v":1}') === null, 'garbage loads as nothing');
  const f = JSON.parse(Core.save(s)); f.groups = ['plaids', null]; ok(Core.load(JSON.stringify(f)) === null, 'a forged group is refused');
  const g = JSON.parse(Core.save(s)); g.balls[8][3] = 0; ok(Core.load(JSON.stringify(g)) === null, 'a game without the eight is refused');
});

suite('ai', () => {
  const play = (A, B, seed) => {
    const s = Core.newGame({seed}); s.turn = seed % 2; const lv = [A, B], fouls = {}, pots = [0, 0], tries = [0, 0];
    let guard = 0;
    while (s.phase !== 'over' && guard++ < 250) {
      if (s.inHand) { const [x, y] = Core.planPlacement(s, lv[s.turn]); ok(Core.place(s, x, y) || Core.canPlace(s, s.balls[0].x, s.balls[0].y), 'the house places the cue ball legally'); }
      const who = s.turn, pl = Core.plan(s, lv[who]);
      shot(s, pl.shot.a, pl.shot.p, pl.shot.sx, pl.shot.sy);
      const r = Core.judge(s);
      if (pl.intent.kind === 'pot') { tries[who]++; if (r.pots.indexOf(pl.intent.n) >= 0) pots[who]++; }
      if (r.foul) { const k = lv[who] + ':' + r.foul; fouls[k] = (fouls[k] || 0) + 1; }
    }
    return {winner: s.winner, shots: s.shots, fouls, pots, tries, stuck: s.phase !== 'over'};
  };
  const tally = (A, B, games) => {
    const out = {wins: [0, 0], shots: 0, fouls: {}, pots: [0, 0], tries: [0, 0], stuck: 0};
    for (let g = 0; g < games; g++) {
      const r = play(A, B, 1000 + g); if (r.stuck) out.stuck++; else out.wins[r.winner]++;
      out.shots += r.shots; for (const k in r.fouls) out.fouls[k] = (out.fouls[k] || 0) + r.fouls[k];
      for (const i of [0, 1]) { out.pots[i] += r.pots[i]; out.tries[i] += r.tries[i]; }
    }
    return out;
  };
  const a = tally('shark', 'barfly', 8);
  ok(a.stuck === 0, 'every game ends');
  ok(a.wins[0] >= 6, `the Shark beats the Barfly (${a.wins[0]}–${a.wins[1]})`);
  const b = tally('regular', 'barfly', 8);
  ok(b.wins[0] >= 5, `the Regular beats the Barfly (${b.wins[0]}–${b.wins[1]})`);
  const rate = (t, i) => t.pots[i] / Math.max(1, t.tries[i]);
  ok(rate(a, 0) > rate(a, 1), `the Shark pots more of what it tries than the Barfly (${rate(a, 0).toFixed(2)} vs ${rate(a, 1).toFixed(2)})`);
  // the thing every pool player hates most: scratching on a plain pot. Count it by cause
  const all = {}; for (const t of [a, b]) for (const k in t.fouls) all[k] = (all[k] || 0) + t.fouls[k];
  const shots = a.shots + b.shots, scratches = Object.entries(all).filter(([k]) => k.endsWith('scratch')).reduce((s, [, v]) => s + v, 0);
  console.log('   house fouls by cause over', shots, 'shots:', JSON.stringify(all));
  ok(scratches / shots < 0.08, `scratches stay rare (${(100 * scratches / shots).toFixed(1)} % of shots)`);
  ok(shots / 16 > 12 && shots / 16 < 60, `a game lasts a sensible number of shots (${(shots / 16).toFixed(1)})`);
});

for (const [name, fn] of Object.entries(suites)) {
  if (want.length && !want.includes(name)) continue;
  const before = fails; const t0 = Date.now();
  fn();
  console.log(`${fails === before ? 'pass' : 'FAIL'}  ${name}  (${Date.now() - t0} ms)`);
}
console.log(`${n - fails}/${n} assertions passed`);
process.exit(fails ? 1 : 0);
