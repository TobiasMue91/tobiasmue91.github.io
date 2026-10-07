#!/usr/bin/env node
// Test suite for games/deep_miner.html (Wick).
//
// Runs the page's DOM-free <script id="core"> block in Node. The page promises that the mine is fair
// and the lamp is honest: a seed is the same mine everywhere, every relic can be reached, a sale pays
// exactly what the pack held, the light shrinks as the oil fails and the lamp going out costs half the
// pack and nothing more, saves carry on identically, and a player with a person's pace gets from the
// first copper to the Deep Heart in a believable hour. No browser, no server.
//
//   node test/deep_miner.mjs

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(HERE, '..', 'games', 'deep_miner.html'), 'utf8');
const src = html.match(/<script id="core">([\s\S]*?)<\/script>/)[1];
const Core = vm.runInNewContext(src + ';Core', {btoa, atob});

let fails = 0, n = 0;
const ok = (c, m) => { n++; if (!c) { fails++; console.log('FAIL', m); } };
const run = (s, secs, dir, dt = 1 / 30) => { const ev = []; for (let t = 0; t < secs; t += dt) Core.step(s, dt, dir, ev); return ev; };
const cellsOf = (s, f) => { const r = []; for (let y = 0; y < Core.H; y++) for (let x = 0; x < Core.W; x++) if (f(s.kind[Core.idx(x, y)], s.aux[Core.idx(x, y)], x, y)) r.push([x, y]); return r; };

// the mine is a function of its seed
{
  const a = Core.create({seed: 42}), b = Core.create({seed: 42}), c = Core.create({seed: 43});
  ok(Buffer.compare(Buffer.from(a.kind), Buffer.from(b.kind)) === 0 && Buffer.compare(Buffer.from(a.aux), Buffer.from(b.aux)) === 0, 'same seed, same mine');
  ok(Buffer.compare(Buffer.from(a.kind), Buffer.from(c.kind)) !== 0, 'another seed, another mine');
}
for (let seed = 1; seed <= 60; seed++) {
  const s = Core.create({seed});
  const relics = cellsOf(s, k => k === Core.RELIC);
  ok(relics.length === 16, 'sixteen relics, seed ' + seed + ' got ' + relics.length);
  const ids = relics.map(([x, y]) => s.aux[Core.idx(x, y)]).sort((p, q) => p - q);
  ok(ids.every((v, i) => v === i), 'each relic once');
  ok(s.kind[Core.idx(Core.SHAFT, Core.HEART_Y)] === Core.RELIC && s.aux[Core.idx(Core.SHAFT, Core.HEART_Y)] === 15, 'the Heart sits at the bottom of the shaft');
  // relics 3z..3z+2 live in zone z
  ok(relics.every(([x, y]) => { const id = s.aux[Core.idx(x, y)]; return id === 15 || Core.zoneAt(y) === Math.floor(id / 3); }), 'relics lie in their own zone');
  // every ore is one its zone can hold, and the first strike is near the shaft
  ok(cellsOf(s, k => k === Core.ORE).every(([x, y]) => [-1, 0, 1].some(d => Core.ORES[s.aux[Core.idx(x, y)]].w[Math.max(0, Math.min(4, Core.zoneAt(y) + d))] > 0) || y < 9), 'ores belong to their zone');
  ok(cellsOf(s, (k, a, x, y) => k === Core.ORE && a === 0 && y <= 8 && Math.abs(x - Core.SHAFT) <= 3).length >= 6, 'copper within reach of the first dive');
  ok(cellsOf(s, (k, a, x, y) => k === Core.LAVA && Core.zoneAt(y) < 2).length === 0, 'no lava before the Ember Reach');
  ok(s.kind[Core.idx(Core.SHAFT, 1)] !== Core.LAVA && cellsOf(s, (k, a, x, y) => y === 0 && k !== Core.AIR).length === 0, 'the surface is open air');
}

// digging takes the time it says and no longer, and a better pick is faster
for (const [z, y] of [[0, 3], [2, 130], [4, 270]]) {
  for (const lv of [0, 3, 7]) {
    const s = Core.create({seed: 5, up: {pick: lv, oil: 7}}); s.y = y; s.x = 3; s.fromX = 3; s.fromY = y; s.kind.fill(Core.ROCK); s.kind[Core.idx(3, y)] = Core.AIR;
    const want = Core.digTime(s, Core.idx(3, y + 1)); let t = 0;
    const ev = []; while (s.kind[Core.idx(3, y + 1)] !== Core.AIR && t < 60) { Core.step(s, 1 / 60, [0, 1], ev); t += 1 / 60; }
    ok(Math.abs(t - want) < 0.05, `dig time zone ${z} pick ${lv}: ${t.toFixed(2)} vs ${want.toFixed(2)}`);
    ok(ev.some(e => e.t === 'break'), 'a break is announced');
  }
}
{
  const t = lv => { const s = Core.create({seed: 5, up: {pick: lv}}); return Core.digTime(s, Core.idx(7, 200)); };
  ok(t(0) > t(1) && t(1) > t(4) && t(4) > t(7), 'every pick level digs faster');
}

// the pack: ore goes in until it is full, then spills; a sale pays exactly what was in it
{
  const s = Core.create({seed: 9}); s.kind.fill(Core.ROCK);
  for (let i = 0; i < 10; i++) { s.kind[Core.idx(7, 1 + i)] = Core.ORE; s.aux[Core.idx(7, 1 + i)] = i % 3; }
  const ev = run(s, 25, [0, 1]);
  ok(ev.filter(e => e.t === 'got').length === 6 && ev.filter(e => e.t === 'full').length >= 1, 'a pack of six takes six and spills the rest');
  ok(Core.bagCount(s) === 6, 'bag count');
  const worth = s.bag.reduce((a, c, i) => a + c * Core.ORES[i].value, 0);
  const cash0 = s.cash; const h = Core.haul(s); ok(h.length === 1 && h[0].t === 'haul', 'hauling announces itself');
  const evs = run(s, 12, null); const sold = evs.find(e => e.t === 'sold');
  ok(sold && sold.total === worth && s.cash === cash0 + worth && Core.bagCount(s) === 0, 'sale pays exactly the pack: ' + (sold && sold.total) + ' vs ' + worth);
  ok(s.y === 0 && s.oil === Core.cap(s, 'oil'), 'the surface refills the lamp');
  ok(sold.items.reduce((a, i) => a + i.value, 0) === sold.total, 'itemised lines add up');
}

// the lamp: it burns while you are down, and the light shrinks as it fails
{
  const s = Core.create({seed: 3}); s.y = 40; s.fromY = 40; s.x = 7; s.fromX = 7; s.kind[Core.idx(7, 40)] = Core.AIR;
  let prev = 99; const rs = [];
  for (let f = 1; f >= 0; f -= 0.05) { s.oil = Core.cap(s, 'oil') * f; rs.push(Core.lightRadius(s)); }
  ok(rs.every((r, i) => i === 0 || r <= rs[i - 1] + 1e-9), 'light never grows as oil falls');
  ok(rs[0] === Core.lvl(s, 'glass') && rs[rs.length - 1] < rs[0] * 0.6 && rs[rs.length - 1] > 0, 'full light at a full tank, a small glow at the end');
  s.oil = 50; for (let i = 0; i < 10; i++) Core.step(s, 0.1, null); ok(Math.abs(s.oil - (50 - Core.IDLE)) < 1e-6, 'the lamp burns at its idle rate');
  const t = Core.create({seed: 3}); for (let i = 0; i < 50; i++) Core.step(t, 0.1, null); ok(t.oil === Core.cap(t, 'oil'), 'no burning on the surface');
}
{
  // lamp out: half the pack is left behind, the rest is sold, and you are on the surface with a full tank
  const s = Core.create({seed: 3}); s.y = 100; s.fromY = 100; s.kind[Core.idx(7, 100)] = Core.AIR; s.bag[0] = 3; s.bag[1] = 3; s.oil = 0.2;
  const ev = run(s, 30, null);
  ok(ev.some(e => e.t === 'out'), 'the lamp going out is announced');
  const sold = ev.find(e => e.t === 'sold');
  ok(sold && sold.rescued && sold.items.reduce((a, i) => a + i.n, 0) === 2 && s.y === 0, 'half the pack (rounded down) is sold, the rest stays below');
  ok(s.oil === Core.cap(s, 'oil'), 'and the tank is full again');
}
{
  // hauling from deep with too little oil fails the same way; with enough it does not
  const mk = oil => { const s = Core.create({seed: 3}); s.y = 280; s.fromY = 280; s.kind[Core.idx(7, 280)] = Core.AIR; s.bag[5] = 2; s.oil = oil; return s; };
  const dur = 0.9 + Core.depthM(280) / 110, need = dur * Core.IDLE;
  const a = mk(need + 2); Core.haul(a); const ea = run(a, dur + 2, null); ok(ea.find(e => e.t === 'sold') && !ea.find(e => e.t === 'sold').rescued, 'enough oil to be hauled home');
  const b = mk(need * 0.5); Core.haul(b); const eb = run(b, dur + 2, null); ok(eb.find(e => e.t === 'sold') && eb.find(e => e.t === 'sold').rescued, 'too little oil to be hauled home');
}

// moving and digging obey the walls, lava costs oil, relics are kept
{
  const s = Core.create({seed: 3}); run(s, 3, [-1, 0]); ok(s.x >= 0, 'cannot walk off the left edge'); run(s, 5, [1, 0]); ok(s.x <= Core.W - 1, 'nor the right');
  const t = Core.create({seed: 3}); t.y = 120; t.fromY = 120; t.x = 3; t.fromX = 3; t.kind.fill(Core.ROCK); t.kind[Core.idx(3, 120)] = Core.AIR; t.kind[Core.idx(3, 121)] = Core.LAVA; t.oil = 50;
  const ev = run(t, 6, [0, 1]); ok(ev.some(e => e.t === 'lava') && t.oil < 50 - 10, 'lava burns the oil');
  const r = Core.create({seed: 3}); r.y = 20; r.fromY = 20; r.x = 3; r.fromX = 3; r.kind.fill(Core.ROCK); r.kind[Core.idx(3, 20)] = Core.AIR; r.kind[Core.idx(3, 21)] = Core.RELIC; r.aux[Core.idx(3, 21)] = 1;
  const e2 = run(r, 6, [0, 1]); ok(e2.some(e => e.t === 'relic' && e.id === 1 && e.first) && r.relics[1], 'a relic is found once and kept');
  const h = Core.create({seed: 3}); h.y = 295; h.fromY = 295; h.x = 7; h.fromX = 7; h.kind[Core.idx(7, 295)] = Core.AIR; h.oil = 600; h.up.oil = 7;
  const e3 = run(h, 30, [0, 1]); ok(e3.some(e => e.t === 'heart') && h.won, 'the Deep Heart ends the descent');
}

// the shop
{
  const s = Core.create({seed: 3}); s.cash = 1e6;
  for (const k of Core.TRACKS) {
    let prevV = Core.lvl(s, k);
    for (let i = 0; i < 7; i++) { const p = Core.price(s, k), c = s.cash; ok(Core.buy(s, k) && s.cash === c - p, k + ' level bought at its price'); ok(Core.lvl(s, k) > prevV, k + ' improves'); prevV = Core.lvl(s, k); }
    ok(Core.price(s, k) === null && !Core.buy(s, k), k + ' stops at its top');
  }
  const p = Core.create({seed: 3}); ok(!Core.buy(p, 'pick') && p.up.pick === 0 && p.cash === 0, 'no buying on credit');
  const prices = Core.TRACKS.map(k => Core.UP[k].cost.every((c, i, a) => i === 0 || c > a[i - 1]));
  ok(prices.every(Boolean), 'each price climbs');
  const q = Core.create({seed: 3}); q.cash = Math.min(...Core.TRACKS.map(k => Core.price(q, k))); ok(Core.TRACKS.some(k => Core.price(q, k) <= q.cash), 'the cheapest first upgrade is a single trip away');
  const first = Core.create({seed: 3}); first.bag[0] = Core.cap(first, 'pack'); const cheapest = Math.min(...Core.TRACKS.map(k => Core.price(first, k)));
  ok(first.bag[0] * Core.ORES[0].value >= cheapest, 'one full pack of copper pays for the first upgrade');
}

// saves carry on identically; bad saves are refused or healed
{
  const s = Core.create({seed: 77, up: {pick: 2, glass: 1, oil: 5}}); s.cash = 123;
  const ev = []; for (let i = 0; i < 900; i++) Core.step(s, 1 / 30, i % 90 < 60 ? [0, 1] : [1, 0], ev);
  const saved = JSON.parse(JSON.stringify(Core.pack(s))), t = Core.unpack(saved);
  ok(t && Buffer.compare(Buffer.from(t.kind), Buffer.from(s.kind)) === 0, 'the mine comes back cell for cell');
  ok(t.x === s.x && t.y === s.y && t.cash === 123 && t.up.pick === 2 && Core.bagCount(t) === Core.bagCount(s) && Math.abs(t.oil - s.oil) < 0.06, 'and so does the player');
  for (let i = 0; i < 600; i++) { Core.step(s, 1 / 30, [0, 1]); Core.step(t, 1 / 30, [0, 1]); }
  ok(Buffer.compare(Buffer.from(t.kind), Buffer.from(s.kind)) === 0 && t.y === s.y && t.x === s.x, 'a loaded game digs the same way');
  ok(JSON.stringify(Core.pack(Core.unpack(Core.pack(s)))) === JSON.stringify(Core.pack(s)), 'pack/unpack is stable');
  for (const bad of [null, 5, {}, {v: 2}, {v: 1, seed: 'x', up: 'no', dug: 7, bag: 'z', x: 99, y: -4, oil: 'a', cash: -5}, {v: 1, seed: 1, up: [99, -1, 2.5, 'x'], bag: [999, 999], oil: 1e9, x: 3, y: 5, dug: '!!'}]) {
    const u = Core.unpack(bad);
    if (u) { ok(u.up.pick >= 0 && u.up.pick <= 7 && u.cash >= 0 && Core.bagCount(u) <= Core.cap(u, 'pack') && u.oil <= Core.cap(u, 'oil') && u.x >= 0 && u.x < Core.W && u.y >= 0 && u.kind[Core.idx(u.x, u.y)] === Core.AIR, 'a damaged save is healed'); }
  }
}
{
  const s = Core.create({seed: 5}); s.relics[3] = s.relics[15] = true; s.cash = 99; s.up.pick = 4; s.won = true;
  const c = Core.charter(s, 9);
  ok(c.relics[3] && c.relics[15] && c.cash === 0 && c.up.pick === 0 && c.charters === 1 && c.seed === 9 && !c.won && c.best === 0, 'a charter keeps relics and resets the rest');
  ok(Core.mult(c) > Core.mult(Core.create({seed: 1})), 'and pays better');
}

// a player at a person's pace: buys the cheapest upgrade, digs toward what it sees, hauls when it should
function play(seed, opt = {}) {
  const think = 0.25, maxT = (opt.mins || 160) * 60;
  const s = Core.create({seed}); let t = 0, dir = null, nextThink = 0, trips = 0, sweep = 1, lock = null, atSurface = false;
  const ore = (x, y) => s.kind[Core.idx(x, y)] === Core.ORE;
  const zoneAt = []; let zones = [];
  while (t < maxT && !s.won) {
    const ev = [];
    if (s.y === 0 && s.mode === 'dive' && !atSurface) {
      atSurface = true;
      for (;;) { let best = null; for (const k of Core.TRACKS) { const p = Core.price(s, k); if (p !== null && p <= s.cash && (!best || p < best.p)) best = {k, p}; } if (!best) break; Core.buy(s, best.k); }
      t += 3;
    }
    if (s.y > 0) atSurface = false;
    if (t >= nextThink && s.mode === 'dive') {
      nextThink = t + think;
      const reserve = (0.9 + Core.depthM(s.y) / 110) * Core.IDLE * 1.5 + 4;
      const full = Core.bagCount(s) >= Core.cap(s, 'pack');
      if (s.y > 0 && (full || s.oil < reserve + 2)) { Core.haul(s); dir = null; trips++; }
      else {
        const R = Math.ceil(Core.lightRadius(s)); let bestD = 1e9, tgt = lock && ore(lock[0], lock[1]) && lock[1] >= s.y ? lock : null;
        if (!tgt) for (let y = Math.max(1, s.y - R); y <= Math.min(Core.H - 1, s.y + R); y++) for (let x = Math.max(0, s.x - R); x <= Math.min(Core.W - 1, s.x + R); x++) {
          if (!ore(x, y) || y < s.y || (x - s.x) ** 2 + (y - s.y) ** 2 > R * R) continue;
          const d = Math.abs(x - s.x) + Math.abs(y - s.y) * 1.2 - Core.ORES[s.aux[Core.idx(x, y)]].value / 40; if (d < bestD) { bestD = d; tgt = [x, y]; }
        }
        lock = tgt;
        if (s.y >= 296) tgt = [Core.SHAFT, Core.HEART_Y];
        if (tgt) { const dx = tgt[0] - s.x, dy = tgt[1] - s.y; dir = Math.abs(dx) > Math.abs(dy) ? [Math.sign(dx), 0] : (dy ? [0, Math.sign(dy)] : [Math.sign(dx) || 1, 0]); }
        else dir = [0, 1];
        const maxY = Math.floor(Core.cap(s, 'oil') * 0.38 * 2.4);
        if (s.y > maxY && !tgt) { if (s.x + sweep < 0 || s.x + sweep >= Core.W) sweep = -sweep; dir = [sweep, 0]; }
        if (dir[0] && (s.x + dir[0] < 0 || s.x + dir[0] >= Core.W)) dir = [0, 1];
      }
    }
    if (opt.trace && Math.floor(t * 30) % 900 === 0 && t > 1200 && t < 4000) console.log(t.toFixed(0), s.x, s.y, s.oil.toFixed(0), dir, s.mode, trips, Core.bagCount(s), s.cash);
    Core.step(s, 1 / 30, s.mode === 'dive' ? dir : null, ev); t += 1 / 30;
    for (const e of ev) if (e.t === 'zone') zones[e.z] = t / 60;
  }
  if (opt.trace) console.log(t.toFixed(0), s.x, s.y, s.oil.toFixed(0), dir, s.mode, trips, Core.bagCount(s), JSON.stringify(s.up));
  return {won: s.won, mins: t / 60, trips, zones, relics: s.relics.filter(Boolean).length, s};
}
{
  const res = [];
  for (let seed = 1; seed <= 8; seed++) res.push(play(seed, process.env.TRACE == seed ? {trace: 1, mins: 70} : {}));
  const won = res.filter(r => r.won);
  ok(won.length >= 7, 'a careful player reaches the Heart on nearly every seed (' + won.length + '/8)');
  ok(won.every(r => r.mins > 25 && r.mins < 120), 'in a believable time: ' + won.map(r => r.mins.toFixed(0)).join(', ') + ' min');
  ok(won.every(r => r.zones.slice(1).every((z, i) => z >= (r.zones[i] || 0))), 'zones arrive in order');
  ok(won.every(r => r.zones[1] > 1.5), 'no one is below the clay in the first minute and a half');
  if (process.env.VERBOSE) console.log(res.map(r => `${r.won} ${r.mins.toFixed(1)}m trips ${r.trips} zones ${r.zones.map(z => z && z.toFixed(0)).join('/')}`).join('\n'));
  // someone who never digs never gets anywhere; a digger with no lamp sense loses packs
  const idle = Core.create({seed: 1}); run(idle, 600, null); ok(idle.y === 0 && idle.cash === 0, 'standing still earns nothing');
  const blind = Core.create({seed: 2}); const evb = run(blind, 600, [0, 1]); ok(evb.some(e => e.t === 'out'), 'digging straight down with no turning back runs the lamp out');
}

console.log(fails ? `${fails} of ${n} checks failed` : `ok: ${n} checks`);
process.exit(fails ? 1 : 0);
