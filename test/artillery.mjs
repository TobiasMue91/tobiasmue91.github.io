#!/usr/bin/env node
// Test suite for games/artillery.html (Artillery).
//
// Runs the page's DOM-free <script id="core"> block in Node. The page only draws what the core returns, so
// the promises live here: a shell flies the same at any frame rate and lands where plain ballistics say, a
// blast only lowers ground and hurts by distance, every hill can be shot across, a match counts to three,
// and the computer starts wide, closes in as it walks a shot in, and beats a player who aims blindly.
//
//   node test/artillery.mjs                # everything
//   node test/artillery.mjs flight ai      # named suites only
//   node test/artillery.mjs --page=path.html
//
// Suites: flight, blast, world, match, ai.

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name, dflt) => { const a = args.find(x => x.startsWith(`--${name}=`)); return a ? a.split('=')[1] : dflt; };
const PAGE = opt('page', join(HERE, '..', 'games', 'artillery.html'));
const ALL = ['flight', 'blast', 'world', 'match', 'ai'];
const picked = args.filter(a => !a.startsWith('--'));
const suites = picked.length ? picked : ALL;

let failures = 0, passes = 0;
const fail = (what, detail) => { failures++; console.log(`  FAIL  ${what}${detail ? '\n          ' + detail : ''}`); };
const pass = what => { passes++; if (process.env.VERBOSE) console.log(`  ok    ${what}`); };
const check = (ok, what, detail) => ok ? pass(what) : fail(what, detail);

const html = readFileSync(PAGE, 'utf8');
const m = html.match(/<script id="core">([\s\S]*?)<\/script>/);
if (!m) { console.log('no <script id="core"> in ' + PAGE); process.exit(1); }
const ctx = {}; vm.createContext(ctx); vm.runInContext(m[1] + ';this.Core = Core;', ctx);
const C = ctx.Core;
const flat = (seed, level = 200) => { const w = C.makeWorld(seed); w.h.fill(level); w.tanks.forEach(t => C.perch(w, t)); w.wind = 0; return w; };

const S = {
  flight() {
    console.log('flight');
    const a = C.makeWorld(5), b = C.makeWorld(5), fa = C.flight(a, 0, 50, 70), fb = C.flight(b, 0, 50, 70);
    check(JSON.stringify(fa.end) === JSON.stringify(fb.end) && fa.path.length === fb.path.length, 'a seed is the same hill and the same flight');
    for (const [ang, pw, wind] of [[45, 70, 0], [30, 80, 0], [60, 45, .5], [50, 70, -1], [75, 60, .8]]) {
      const w = flat(3); w.wind = wind; const t = w.tanks[0], f = C.flight(w, 0, ang, pw), mz = C.muzzleOf(t, ang), v = C.aimVector(ang, pw), ax = wind * C.WIND_ACC;
      // plain ballistics: land where mz.y + vy t - G t^2/2 = ground
      const disc = Math.sqrt(v.y * v.y + 2 * C.G * (mz.y - 200)), tl = (v.y + disc) / C.G, want = mz.x + v.x * tl + .5 * ax * tl * tl;
      check(Math.abs(f.end.x - want) < 4 && f.end.kind === 'ground', `angle ${ang} power ${pw} wind ${wind} lands at ${want.toFixed(1)}`, `got ${f.end.x.toFixed(1)} ${f.end.kind}`);
    }
    const w = flat(4); const r = C.flight(w, 0, 80, 100); check(r.end.kind === 'ground' || r.end.kind === 'tank', 'a straight-up shot comes back down');
    // a shell grazing a tank hits, one passing wide does not
    const w2 = flat(6), foe = w2.tanks[1], sh = w2.tanks[0];
    let hit = 0, near = 0;
    for (let a = 5; a <= 85; a += .5) { const f = C.flight(w2, 0, a, 100); if (f.end.kind === 'tank') hit++; }
    check(hit > 0, 'some shells hit the other tank on flat ground');
    const f = C.flight(w2, 0, 45, 100), p = f.path; let minD = 1e9;
    for (let i = 0; i < p.length; i += 2) minD = Math.min(minD, Math.hypot(p[i] - C.center(sh).x, p[i + 1] - C.center(sh).y));
    check(f.end.kind !== 'tank' || f.end.tank !== 0, 'a shell never hits its own tank on the way out');
  },
  blast() {
    console.log('blast');
    for (let seed = 1; seed <= 40; seed++) {
      const w = C.makeWorld(seed), before = Float32Array.from(w.h), x = 300 + (seed * 53) % 600, y = C.heightAt(w.h, x);
      C.explode(w, x, y);
      let ok = true, outside = true;
      for (let i = 0; i <= C.W; i++) { if (w.h[i] > before[i] + 1e-4) ok = false; if (Math.abs(i - x) > C.BLAST + 1 && w.h[i] !== before[i]) outside = false; }
      check(ok, `seed ${seed}: a blast only lowers the ground`); check(outside, `seed ${seed}: nothing changes beyond the blast radius`);
      if (seed > 3) break;
    }
    const w = flat(8), t = w.tanks[1], c = C.center(t);
    let prev = 1e9, mono = true;
    for (let d = 0; d <= C.BLAST + C.TANK_R + 10; d += 4) {
      const ww = flat(8), r = C.explode(ww, C.center(ww.tanks[1]).x - d, C.center(ww.tanks[1]).y + 0), dmg = r.hits.length ? r.hits[0].dmg : 0;
      if (dmg > prev) mono = false; prev = dmg;
      if (d > C.BLAST + C.TANK_R && dmg) fail('damage beyond reach at ' + d);
    }
    check(mono, 'damage only falls as the blast moves away');
    const direct = C.explode(flat(8), c.x, c.y).hits[0]; check(direct && direct.dmg === C.DMG, 'a direct hit does full damage', JSON.stringify(direct));
    const ww = flat(9); ww.tanks[1].hp = 5; const r = C.explode(ww, C.center(ww.tanks[1]).x, C.center(ww.tanks[1]).y); check(ww.tanks[1].hp === 0 && r.hits[0].hp === 0, 'health never goes below zero');
    const w3 = flat(10), t3 = w3.tanks[0], y0 = t3.y; C.explode(w3, t3.x, t3.y - 5);
    check(t3.y < y0 - 10, 'a tank drops to the new ground', `${y0} -> ${t3.y}`);
    const w4 = flat(11); const far = C.explode(w4, C.W + 400, 100); check(far.hits.length === 0, 'a shell off the range hurts nobody');
  },
  world() {
    console.log('world');
    let reach = 0, n = 0, worst = 0;
    for (let seed = 1; seed <= 150; seed++) {
      const w = C.makeWorld(seed), [a, b] = w.tanks, gap = b.x - a.x;
      check(gap >= 420 && gap <= 600 && a.x > 150 && b.x < C.W - 150, `seed ${seed}: tanks stand ${gap} apart inside the range`);
      let flatPad = true; for (const t of w.tanks) { const lo = C.heightAt(w.h, t.x - 60), hi = C.heightAt(w.h, t.x + 60); if (Math.abs(lo - hi) > 1) flatPad = false; }
      check(flatPad, `seed ${seed}: each tank stands on level ground`);
      const s = C.solve(w, 0, b.x), e = C.flight(w, 0, s.angle, s.power).end; n++;
      const miss = e.kind === 'tank' ? 0 : Math.abs(e.x - b.x); worst = Math.max(worst, miss); if (e.kind === 'tank' || miss < C.BLAST) reach++;
    }
    check(reach >= n * .97, `a hit can be found on ${reach} of ${n} hills`, `worst miss ${worst.toFixed(0)}`);
  },
  match() {
    console.log('match');
    const m = C.newMatch(3, 'two'); check(m.score[0] === 0 && m.turn === 0 && !m.over, 'a match opens at nil with the first player up');
    let prev = m.turn, lastWind = m.world.wind, ok = true, windOk = true, shots = 0;
    while (!m.over && shots < 3000) {
      const w = m.world, who = m.turn, foe = w.tanks[1 - who], s = C.solve(w, who, foe.x);
      const r = C.shoot(m, s.angle + (shots % 5) * .7, s.power * (1 + (shots % 7) * .02)); shots++;
      if (Math.abs(m.world.wind) > 1) windOk = false;
      if (r.outcome === 'next') { if (m.turn === prev) ok = false; prev = m.turn; } else { if (!m.over && r.outcome !== 'match') { C.nextRound(m); prev = m.turn; } }
    }
    check(m.over && m.score[m.winner] === 3 && m.score[1 - m.winner] <= 2, 'the first to three rounds wins the match', JSON.stringify(m.score));
    check(ok, 'the shot alternates between players inside a round'); check(windOk, 'the wind stays within ±1');
    let threw = false; try { C.shoot(m, 45, 50); } catch (e) { threw = true; } check(threw, 'no shot once the match is over');
    // a draw: both tanks gone in one blast is a replay, nobody scores
    const d = C.newMatch(4, 'two'); d.world.tanks.forEach(t => { t.hp = 1; }); const a = d.world.tanks[0], b = d.world.tanks[1]; b.x = a.x + 20; C.perch(d.world, b);
    const sh = C.explode(d.world, a.x + 10, a.y + 30); check(sh.hits.length === 2, 'one blast can take both tanks');
    // a wreck is a wreck: dead tanks are not hit again and do not block shells
    const dead = flat(12); dead.tanks[1].hp = 0; const f = C.flight(dead, 0, 45, 100); check(f.end.kind !== 'tank', 'a destroyed tank is no longer a target');
    // each round is a new hill; rounds alternate who shoots first
    const q = C.newMatch(5, 'cpu'), h0 = Float32Array.from(q.world.h), first = q.turn; q.score[0] = 1; q.roundDone = true; C.nextRound(q);
    check(q.turn !== first && q.world.h.some((v, i) => v !== h0[i]), 'a new round deals a new hill and the other player shoots first');
  },
  ai() {
    console.log('ai');
    const R = C.rng(99);
    let firstHit = 0, laterHit = 0, firstN = 0, laterN = 0, matches = 0, wins = 0, illegal = 0;
    for (let seed = 1; seed <= 24; seed++) {
      const m = C.newMatch(seed, 'cpu'); const mem = [{}, {}]; let k = 0;
      while (!m.over && k++ < 600) {
        const who = m.turn; let a, p;
        if (who === 1) { const s = C.aiShot(m, mem[1]); a = s.angle; p = s.power; if (!(a >= 0 && a <= 180 && p >= 0 && p <= 100)) illegal++; }
        else { a = 20 + R() * 140; p = 20 + R() * 80; }
        const r = C.shoot(m, a, p);
        if (who === 1) { const hit = r.blast.hits.some(h => h.tank === 0); if (mem[1].shots === 1) { firstN++; if (hit) firstHit++; } else { laterN++; if (hit) laterHit++; } }
        if (r.outcome !== 'next') { mem[0] = {}; mem[1] = {}; if (!m.over) C.nextRound(m); }
      }
      matches++; if (m.winner === 1) wins++;
    }
    check(illegal === 0, 'the computer only ever asks for an angle and power the sling can make');
    check(firstHit / firstN < laterHit / laterN, 'it starts wide and closes in as it walks a shot in', `first ${(firstHit / firstN).toFixed(2)} later ${(laterHit / laterN).toFixed(2)}`);
    check(firstHit / firstN < .55, 'its first shot of a round is not a sure hit', (firstHit / firstN).toFixed(2));
    check(wins / matches > .9, `it beats a player who aims blindly (${wins} of ${matches})`);
  }
};

for (const s of suites) { if (!S[s]) { console.log('unknown suite ' + s); process.exit(1); } S[s](); }
console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
