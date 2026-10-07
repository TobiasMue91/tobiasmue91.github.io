#!/usr/bin/env node
// Test suite for games/catchcircle.html (Catch Circle).
//
// Runs the page's DOM-free <script id="core"> block in Node. The page promises that a catch is judged
// honestly (the disc under your finger, never one beside it), that nothing leaves the field, that a
// ring that empties costs a life while a black disc only costs one if you touch it, that smaller
// discs pay more, and that a seed plays the same run. No browser, no server.
//
//   node test/catch_circle.mjs

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(HERE, '..', 'games', 'catchcircle.html'), 'utf8');
const src = html.match(/<script id="core">([\s\S]*?)<\/script>/)[1];
const Core = vm.runInNewContext(src + ';Core');

let fails = 0, n = 0;
const ok = (c, m) => { n++; if (!c) { fails++; console.log('FAIL', m); } };
const B = {x0: 10, y0: 90, x1: 380, y1: 830};
const mk = (seed, extra) => Core.create({seed, bounds: B, ...extra});
const run = (s, secs, dt = 1 / 60) => { const ev = []; for (let t = 0; t < secs && !s.over; t += dt) ev.push(...Core.step(s, dt)); return ev; };
const put = (s, o) => { const d = {id: s.nextId++, kind: 'c', tier: 1, color: 'blue', x: 200, y: 400, vx: 0, vy: 0, r: 30, life: 5, max: 5, age: 1, ...o}; s.discs.push(d); return d; };

// hit testing against brute force
for (let seed = 1; seed <= 40; seed++) {
  const s = mk(seed); s.caught = 30; run(s, 6);
  for (let i = 0; i < 200; i++) {
    const x = Math.random() * 400, y = Math.random() * 850;
    const got = Core.pick(s, x, y);
    const any = s.discs.filter(d => d.age >= Core.ARM && Math.hypot(d.x - x, d.y - y) <= d.r + Core.SLOP);
    ok((got === null) === (any.length === 0), 'pick agrees with brute force');
    if (got) ok(any.every(d => Math.hypot(d.x - x, d.y - y) - d.r >= Math.hypot(got.x - x, got.y - y) - got.r - 1e-9), 'pick takes the nearest edge');
  }
}
{ const s = mk(1); const d = put(s, {age: 0.05}); ok(Core.pick(s, d.x, d.y) === null, 'a disc still appearing cannot be caught'); }

// the field is never left, at any frame rate
for (const dt of [1 / 30, 1 / 60, 1 / 144, 0.2]) for (let seed = 1; seed <= 15; seed++) {
  const s = mk(seed, {demo: true}); const ev = [];
  for (let t = 0; t < 30; t += dt) { Core.step(s, dt); for (const d of s.discs) ok(d.x >= B.x0 + d.r - 1e-6 && d.x <= B.x1 - d.r + 1e-6 && d.y >= B.y0 + d.r - 1e-6 && d.y <= B.y1 - d.r + 1e-6, 'disc inside field'); }
}

// scoring: tiers, chain multiplier, centre bonus
{
  const pts = (tier, chain, off) => { const s = mk(2); s.chain = chain - 1; const d = put(s, {tier, r: 40}); const e = Core.tap(s, d.x + off, d.y)[0]; return e.pts; };
  ok(pts(0, 1, 0) === 38 && pts(0, 1, 30) === 25, 'small: 25, 37.5 rounds to 38 in the centre');
  ok(pts(1, 1, 30) === 15 && pts(2, 1, 30) === 10, 'blue 15, yellow 10');
  ok(pts(2, 5, 30) === 20 && pts(2, 25, 30) === 60 && pts(2, 99, 30) === 60, 'multiplier ×2 at 5, capped ×6');
}

// chain, miss, slip, black, lives
{
  const s = mk(3); const d = put(s); Core.tap(s, d.x, d.y); ok(s.chain === 1 && s.caught === 1, 'catch counts');
  const m = Core.tap(s, 5, 500); ok(m[0].type === 'miss' && s.chain === 0 && s.lives === 3, 'a miss breaks the chain, costs no life');
  const e = put(s, {life: 0.01, age: 1}); const ev = Core.step(s, 0.02);
  ok(ev.some(x => x.type === 'slip') && s.lives === 2 && s.chain === 0, 'an empty ring costs a life');
  const k = put(s, {kind: 'k', color: 'ink', life: 0.01}); const ev2 = Core.step(s, 0.02);
  ok(ev2.some(x => x.type === 'fade') && s.lives === 2, 'an untouched black disc is harmless');
  const k2 = put(s, {kind: 'k', color: 'ink', x: 100, y: 200}); const ev3 = Core.tap(s, 100, 200);
  ok(ev3[0].type === 'bomb' && s.lives === 1, 'touching black costs a life');
  const k3 = put(s, {kind: 'k', color: 'ink', x: 100, y: 200}); const ev4 = Core.tap(s, 100, 200);
  ok(s.over && ev4.some(x => x.type === 'over') && Core.tap(s, 1, 1).length === 0 && Core.step(s, .1).length === 0, 'game over is final');
}
{ const s = mk(4); s.lives = 2; s.caught = 19; const d = put(s); const ev = Core.tap(s, d.x, d.y); ok(ev.some(x => x.type === 'heal') && s.lives === 3, 'a life back every 20'); }

// ramp: the first discs are alone and unhurried, black waits until 10 catches
{
  const s = mk(5); let maxSeen = 0, black = false;
  for (let t = 0; t < 4 && !s.over; t += 1 / 60) { Core.step(s, 1 / 60); maxSeen = Math.max(maxSeen, s.discs.length); }
  ok(maxSeen === 1, 'one disc to start with');
  for (let seed = 1; seed < 200; seed++) { const g = mk(seed); g.caught = 9; for (let i = 0; i < 600; i++) { Core.step(g, 1 / 60); if (g.discs.some(d => d.kind === 'k')) black = true; g.lives = 3; if (g.discs.length) Core.tap(g, g.discs[0].x, g.discs[0].y); if (g.caught >= 10) break; } }
  ok(!black, 'no black disc before the tenth catch');
  const g = mk(6); g.caught = 10; run(g, 8); ok(g.blackSeen || g.over, 'the first black disc arrives at ten');
}

// determinism
{
  const play = seed => { const s = mk(seed); const log = []; for (let i = 0; i < 1500 && !s.over; i++) { Core.step(s, 1 / 60); const d = s.discs.find(d => d.age > 0.3 && d.kind === 'c'); if (d && i % 25 === 0) { Core.tap(s, d.x, d.y); } } return JSON.stringify([s.score, s.caught, s.lives, s.discs.map(d => [d.x.toFixed(3), d.y.toFixed(3)])]); };
  ok(play(7) === play(7) && play(7) !== play(8), 'a seed is the same run');
}

// bots: a careful player outlasts a random tapper, who outlasts one who never taps
{
  const bot = (seed, kind) => {
    const s = mk(seed); let nextAct = 0.4;
    for (let t = 0; t < 120 && !s.over; t += 1 / 60) {
      Core.step(s, 1 / 60);
      if (t < nextAct) continue;
      nextAct = t + 0.42;
      if (kind === 'careful') { const d = s.discs.filter(d => d.kind === 'c' && d.age > 0.25).sort((a, b) => a.life - b.life)[0]; if (d) Core.tap(s, d.x + d.vx * 0.1, d.y + d.vy * 0.1); }
      else if (kind === 'random') Core.tap(s, B.x0 + Math.random() * 370, B.y0 + Math.random() * 740);
    }
    return s;
  };
  const avg = (kind, f) => { let a = 0; for (let i = 1; i <= 12; i++) a += f(bot(i, kind)); return a / 12; };
  const c = avg('careful', s => s.score), r = avg('random', s => s.score), i = avg('idle', s => s.score);
  ok(c > 3 * r + 50 && i === 0, `careful ${c.toFixed(0)} > random ${r.toFixed(0)} > idle ${i}`);
  ok(avg('careful', s => s.lives) >= 1, 'a careful bot with a person\'s pace keeps playing');
  const idle = bot(1, 'idle'); ok(idle.over && idle.t < 30, 'a player who never taps is out within 30 seconds');
}

// resize keeps discs inside
{ const s = mk(9, {demo: true}); run(s, 3); Core.resize(s, {x0: 0, y0: 50, x1: 200, y1: 300}); ok(s.discs.every(d => d.x >= d.r && d.x <= Math.max(d.r, 200 - d.r) && d.y >= 50 + d.r), 'resize pulls discs back'); }

console.log(`${n - fails}/${n} checks passed`);
process.exit(fails ? 1 : 0);
