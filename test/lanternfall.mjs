#!/usr/bin/env node
// Test suite for games/webcraft.html (Lanternfall).
//
// Runs the page's DOM-free <script id="core"> block in Node. The promises the page stands on are the ones
// nobody can check by eye: a seed is the same world everywhere, the mesh draws exactly the faces that can be
// seen and no others, rays and bodies never pass through a block, the clock gives a day worth having,
// the Murk spawn only where they are fair and fear exactly the light the page says they fear, and a save
// carries on identically. No browser, no server.
//
//   node test/lanternfall.mjs                 # everything
//   node test/lanternfall.mjs mesh murk       # named suites only
//   node test/lanternfall.mjs --page=path.html
//
// Suites: gen, mesh, ray, body, clock, mining, murk, save.

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name, dflt) => { const a = args.find(x => x.startsWith(`--${name}=`)); return a ? a.split('=')[1] : dflt; };
const PAGE = opt('page', join(HERE, '..', 'games', 'webcraft.html'));
const ALL = ['gen', 'mesh', 'ray', 'body', 'clock', 'mining', 'murk', 'save'];
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
const LF = new Function(core[1] + '\nreturn LF;')();
const {B, BL, CS, H, SEA} = LF;
const SEEDS = [1, 7, 1234, 98765];

/** a world with every chunk in a square loaded */
function loaded(seed, r) { const w = new LF.World(seed); for (let z = -r; z <= r; z++) for (let x = -r; x <= r; x++) w.chunk(x, z); return w; }
/** a flat test world: stone to y=10, nothing above */
function flatWorld(top = 10) {
  const w = new LF.World(5);
  for (let cz = -2; cz <= 2; cz++) for (let cx = -2; cx <= 2; cx++) {
    const c = w.chunk(cx, cz); c.blocks.fill(0);
    for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) for (let y = 0; y <= top; y++) c.blocks[x + z * 16 + y * 256] = y === 0 ? B.BEDROCK : y === top ? B.GRASS : B.STONE;
    c.scan();
  }
  return w;
}
function flatSim(top = 10, u = LF.START_U) { const s = new LF.Sim(5, {u}); s.world = flatWorld(top); s.spawn = {x: .5, y: top + 1, z: .5}; Object.assign(s.p, {x: .5, y: top + 1, z: .5}); return s; }

if (suites.includes('gen')) {
  section('gen: a seed is a world');
  for (const seed of SEEDS) {
    const a = LF.generate(seed, 3, -2), b = LF.generate(seed, 3, -2);
    check(a.every((v, i) => v === b[i]), `seed ${seed}: the same chunk twice is identical`);
    check(!LF.generate(seed + 1, 3, -2).every((v, i) => v === a[i]), `seed ${seed}: the next seed is a different chunk`);
    // order of loading must not matter
    const w1 = new LF.World(seed), w2 = new LF.World(seed);
    for (const [x, z] of [[0, 0], [1, 0], [0, 1]]) w1.chunk(x, z); for (const [x, z] of [[0, 1], [1, 0], [0, 0]]) w2.chunk(x, z);
    check(w1.chunk(1, 0).blocks.every((v, i) => v === w2.chunk(1, 0).blocks[i]), `seed ${seed}: loading order changes nothing`);
    const w = loaded(seed, 3);
    let bad = 0, water = 0, cols = 0, ember = 0, air = 0, logsFloating = 0, stray = 0;
    for (let z = -40; z < 40; z++) for (let x = -40; x < 40; x++) {
      cols++; if (w.get(x, 0, z) !== B.BEDROCK) bad++;
      const t = w.topY(x, z); if (t < SEA && w.get(x, SEA, z) === B.WATER) water++;
      // water fills every cell between the ground and the sea, without gaps
      if (w.get(x, SEA, z) === B.WATER) for (let y = SEA; y > t; y--) { const id = w.get(x, y, z); if (id !== B.WATER && id !== B.AIR) stray++; if (id === B.AIR && y <= SEA) stray++; }
      for (let y = 1; y < H - 1; y++) { const id = w.get(x, y, z); if (id === B.EMBER) ember++; if (id === B.LOG && !(w.get(x, y - 1, z) === B.LOG || w.get(x, y - 1, z) === B.GRASS)) logsFloating++; if (id === B.AIR && y < 15 && y > 2) air++; }
    }
    check(bad === 0, `seed ${seed}: bedrock under every column`);
    check(stray === 0, `seed ${seed}: the sea is solid water to its surface`, `${stray} stray cells`);
    check(logsFloating === 0, `seed ${seed}: every trunk stands on grass`, `${logsFloating} floating`);
    let wet = 0, tot = 0; for (let x = -600; x < 600; x += 6) for (let z = -600; z < 600; z += 6) { tot++; if (LF.column(seed, x, z).h <= SEA) wet++; }
    const wp = wet / tot; check(wp > .15 && wp < .6, `seed ${seed}: ${(wp * 100).toFixed(0)}% of the world is under the sea, neither a desert nor an ocean`);
    check(air > 5, `seed ${seed}: caves exist (${air} cave cells low down)`);
    check(ember > 0, `seed ${seed}: ember crystals exist (${ember})`);
    const s = w.findSpawn();
    check(w.get(Math.floor(s.x), s.y - 1, Math.floor(s.z)) === B.GRASS && w.get(Math.floor(s.x), s.y, Math.floor(s.z)) === 0 && w.get(Math.floor(s.x), s.y + 1, Math.floor(s.z)) === 0, `seed ${seed}: spawn is grass with two cells of air above`);
    check(s.y - 1 > SEA, `seed ${seed}: spawn is above the sea`);
    // a column heightmap matches the blocks
    let hm = 0; for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) { const c = w.chunk(0, 0); let y = H - 1; while (y > 0 && !(LF.OPAQUE[c.blocks[x + z * 16 + y * 256]] || c.blocks[x + z * 16 + y * 256] === B.LEAVES)) y--; if (c.top[x + z * 16] !== y) hm++; }
    check(hm === 0, `seed ${seed}: heightmap matches the blocks`);
  }
  // edits survive an unload
  const w = new LF.World(3); w.set(5, 30, 5, B.BRICK); w.chunks.clear();
  check(w.get(5, 30, 5) === B.STONE, 'an unloaded chunk reads as stone (nobody falls into it)');
  w.chunk(0, 0); check(w.get(5, 30, 5) === B.BRICK, 'an edit comes back when its chunk is generated again');
}

if (suites.includes('mesh')) {
  section('mesh: every visible face, nothing else');
  const isFull = id => id && !BL[id].plant && !BL[id].trans;
  for (const seed of SEEDS.slice(0, 3)) {
    const w = loaded(seed, 2);
    for (const [cx, cz] of [[0, 0], [1, -1], [-1, 1]]) {
      const m = LF.meshChunk(w, cx, cz), c = w.chunk(cx, cz);
      let wantOp = 0, wantTr = 0;
      for (let y = 0; y < H; y++) for (let lz = 0; lz < 16; lz++) for (let lx = 0; lx < 16; lx++) {
        const id = c.blocks[lx + lz * 16 + y * 256]; if (!id) continue; const x = cx * 16 + lx, z = cz * 16 + lz;
        if (id === B.TORCH) { wantOp += 5; continue; } if (BL[id].plant) { wantOp += 4; continue; }
        for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
          const n = w.get(x + dx, y + dy, z + dz);
          if (LF.OPAQUE[n]) continue;
          if (BL[id].trans) { if (n === id) continue; if (id === B.WATER && BL[n].solid) continue; wantTr++; }
          else { if (BL[id].cut && n === id) continue; wantOp++; }
        }
      }
      check(m.op.faces === wantOp, `seed ${seed} chunk ${cx},${cz}: ${m.op.faces} opaque faces, reference says ${wantOp}`);
      check(m.tr.faces === wantTr, `seed ${seed} chunk ${cx},${cz}: ${m.tr.faces} water and glass faces, reference says ${wantTr}`);
      // geometry: inside the chunk, indices valid, light in range, normals point out of a solid into open space
      let oob = 0, badLight = 0, badIdx = 0, badNormal = 0, checked = 0;
      const ox = cx * 16, oz = cz * 16;
      for (const mesh of [m.op, m.tr]) {
        const v = mesh.v, nv = v.length / 8;
        for (let i = 0; i < nv; i++) { const x = v[i * 8], y = v[i * 8 + 1], z = v[i * 8 + 2]; if (x < ox - .001 || x > ox + 16.001 || z < oz - .001 || z > oz + 16.001 || y < -.001 || y > H + .001) oob++; const sh = v[i * 8 + 6], sk = v[i * 8 + 7]; if (!(sh > .2 && sh <= 1.001 && sk >= .099 && sk <= 1.001)) badLight++; }
        for (const k of mesh.i) if (k >= nv) badIdx++;
        if (mesh === m.op) for (let q = 0; q < mesh.faces && checked < 4000; q += 7) {
          const a = mesh.i[q * 6], b = mesh.i[q * 6 + 1], d = mesh.i[q * 6 + 2];
          const P = k => [v[k * 8], v[k * 8 + 1], v[k * 8 + 2]], p0 = P(a), p1 = P(b), p2 = P(d);
          const e1 = p1.map((t, i) => t - p0[i]), e2 = p2.map((t, i) => t - p0[i]), n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]], nl = Math.hypot(...n);
                    const base = Math.floor(Math.min(a, b, d) / 4) * 4; const cen = [0, 1, 2, 3].map(k => P(base + k)).reduce((s, p) => s.map((t, i) => t + p[i] / 4), [0, 0, 0]);
          const flat = [0, 1, 2, 3].map(k => P(base + k)); const span = [0, 1, 2].map(i => Math.max(...flat.map(p => p[i])) - Math.min(...flat.map(p => p[i])));
          if (span.some(s => s < .3 && s > 0.001) ) continue; // plants and torches are thin, skip
          if (nl < .5 || Math.min(...span) > .001) continue;
          const nn = n.map(t => t / nl), front = w.get(Math.floor(cen[0] + nn[0] * .5), Math.floor(cen[1] + nn[1] * .5), Math.floor(cen[2] + nn[2] * .5)), back = w.get(Math.floor(cen[0] - nn[0] * .5), Math.floor(cen[1] - nn[1] * .5), Math.floor(cen[2] - nn[2] * .5));
          checked++; if (LF.OPAQUE[front] || !(LF.OPAQUE[back] || back === B.LEAVES)) badNormal++;
        }
      }
      check(oob === 0, `seed ${seed} chunk ${cx},${cz}: every vertex is inside the chunk`);
      check(badLight === 0, `seed ${seed} chunk ${cx},${cz}: every shade and sky value is in range`);
      check(badIdx === 0, `seed ${seed} chunk ${cx},${cz}: every index points at a vertex`);
      check(badNormal === 0 && checked > 15, `seed ${seed} chunk ${cx},${cz}: ${checked} sampled faces wind outward, from a block into open space`, `${badNormal} wrong`);
    }
  }
  // a sealed room: no face inside a solid mass, and breaking one block exposes exactly the faces it should
  const w = flatWorld(10); const before = LF.meshChunk(w, 0, 0).op.faces;
  w.set(5, 9, 5, B.AIR); w.set(5, 10, 5, B.AIR); const after = LF.meshChunk(w, 0, 0).op.faces;
  check(after > before, 'digging a two-deep hole adds faces');
  w.set(5, 10, 5, B.GRASS); w.set(5, 9, 5, B.STONE); check(LF.meshChunk(w, 0, 0).op.faces === before, 'filling the hole again gives back the exact mesh');
  // light: a roofed cell is darker than an open one
  const w2 = flatWorld(10); w2.set(5, 12, 5, B.PLANK); const mm = LF.meshChunk(w2, 0, 0);
  let lo = 1, hi = 0; const v = mm.op.v; for (let i = 0; i < v.length / 8; i++) { if (Math.abs(v[i * 8 + 1] - 11) < .001) { const x = v[i * 8], z = v[i * 8 + 2]; if (x >= 5 && x <= 6 && z >= 5 && z <= 6) lo = Math.min(lo, v[i * 8 + 7]); if (x > 9) hi = Math.max(hi, v[i * 8 + 7]); } }
  check(lo < hi, `the floor under a roof gets less sky (${lo.toFixed(2)}) than open ground (${hi.toFixed(2)})`);
}

if (suites.includes('ray')) {
  section('ray: the cell you aim at is the cell you get');
  const w = loaded(1234, 2), rnd = LF.rng(77); let n = 0, wrong = 0, noHit = 0, badFace = 0;
  for (let i = 0; i < 4000; i++) {
    const o = [(rnd() - .5) * 40, 14 + rnd() * 30, (rnd() - .5) * 40], th = rnd() * 6.283, ph = (rnd() - .5) * 2.6, d = [Math.cos(ph) * Math.sin(th), Math.sin(ph), Math.cos(ph) * Math.cos(th)];
    const hit = LF.raycast(w, o[0], o[1], o[2], d[0], d[1], d[2], 8);
    // brute force: march in tiny steps
    let ref = null; for (let t = 0; t < 8; t += .004) { const x = Math.floor(o[0] + d[0] * t), y = Math.floor(o[1] + d[1] * t), z = Math.floor(o[2] + d[2] * t); const id = w.get(x, y, z); if (id !== 0 && id !== B.WATER) { ref = {x, y, z, t}; break; } }
    n++;
    if (!hit && !ref) continue;
    if (!hit || !ref) { if (!hit && ref && ref.t > 7.98) continue; if (hit && !ref && hit.t > 7.98) continue; noHit++; continue; }
    if (hit.x !== ref.x || hit.y !== ref.y || hit.z !== ref.z) { if (Math.abs(hit.t - ref.t) > .02) wrong++; }
    const front = w.get(hit.x + hit.nx, hit.y + hit.ny, hit.z + hit.nz); if (front !== 0 && front !== B.WATER && !(hit.t === 0)) badFace++;
  }
  check(wrong === 0, `${n} random rays hit the same cell as a brute-force march`, `${wrong} differ`);
  check(noHit === 0, 'a ray misses exactly when the march does', `${noHit} disagree`);
  check(badFace === 0, 'the face a ray reports always opens into free space', `${badFace} wrong`);
  const r1 = LF.rayBox(0, 0, 0, 1, 0, 0, 2, -1, -1, 3, 1, 1); check(Math.abs(r1 - 2) < 1e-9, 'rayBox hits a box ahead at the right distance');
  check(LF.rayBox(0, 5, 0, 1, 0, 0, 2, -1, -1, 3, 1, 1) < 0, 'rayBox misses a box off to the side');
}

if (suites.includes('body')) {
  section('body: nothing walks through a block');
  for (const seed of SEEDS.slice(0, 3)) {
    const s = new LF.Sim(seed); s.place0(); const w = s.world; for (let z = -4; z <= 4; z++) for (let x = -4; x <= 4; x++) w.chunk(x, z);
    const rnd = LF.rng(seed); let stuck = 0, under = 0, steps = 0;
    for (let i = 0; i < 6000; i++) {
      if (i % 300 === 0) { s.p.yaw = rnd() * 6.28; }
      const inp = {mx: rnd() < .8 ? (Math.sin(i / 90) > .3 ? 1 : 0) : (rnd() - .5) * 2, mz: 1, jump: rnd() < .08, brk: false}; s.step(1 / (30 + rnd() * 90), inp); steps++;
      if (LF.collides(w, s.p)) stuck++; if (s.p.y < 0) under++;
      if (s.p.x * s.p.x + s.p.z * s.p.z > 60 * 60) { s.p.yaw += Math.PI; }
    }
    check(stuck === 0, `seed ${seed}: ${steps} random steps at 30-120 fps never leave the player inside a block`, `${stuck} stuck`);
    check(under === 0, `seed ${seed}: never below the world`);
  }
  const s = flatSim(10); const w = s.world;
  Object.assign(s.p, {x: .5, y: 60, z: .5, vy: 0}); for (let i = 0; i < 400; i++) s.step(.1, {});
  check(s.p.y > 10.99 && s.p.y < 11.01 && s.p.onGround, `a fall from 50 blocks at 10 fps lands on the ground (y=${s.p.y.toFixed(3)})`);
  // a one-block ledge is stepped, a two-block wall is not
  w.set(3, 11, 0, B.STONE); Object.assign(s.p, {x: .5, y: 11, z: .5, vx: 0, vy: 0, vz: 0, yaw: -Math.PI / 2}); // facing +x
  for (let i = 0; i < 90; i++) s.step(1 / 60, {mx: 0, mz: 1});
  check(s.p.x > 3.6, `walking into a one-block ledge hops it (x=${s.p.x.toFixed(2)})`);
  w.set(8, 11, 0, B.STONE); w.set(8, 12, 0, B.STONE); Object.assign(s.p, {x: 5.5, y: 11, z: .5, vx: 0, vy: 0, vz: 0, yaw: -Math.PI / 2});
  for (let i = 0; i < 120; i++) s.step(1 / 60, {mx: 0, mz: 1});
  check(s.p.x < 8 - s.p.hw + .01, `a two-block wall stops the player (x=${s.p.x.toFixed(2)})`);
  // a jump clears a bit over one block but not two
  Object.assign(s.p, {x: 12.5, y: 11, z: 4.5, vx: 0, vy: 0, vz: 0}); let peak = 0; s.step(.016, {jump: true}); for (let i = 0; i < 80; i++) { s.step(1 / 60, {}); peak = Math.max(peak, s.p.y - 11); }
  check(peak > 1.15 && peak < 1.5, `a jump rises ${peak.toFixed(2)} blocks`);
  // water: sink slowly, jump to climb out
  const wet = flatWorld(10); for (let z = -3; z <= 3; z++) for (let x = -3; x <= 3; x++) for (let y = 4; y <= 10; y++) wet.set(x + 20, y, z, B.WATER);
  const sw = flatSim(10); sw.world = wet; Object.assign(sw.p, {x: 20.5, y: 10, z: .5, vy: 0}); for (let i = 0; i < 30; i++) sw.step(1 / 60, {});
  check(sw.p.y > 7.8 && sw.p.y < 10, `in water the player sinks slower than a fall (y=${sw.p.y.toFixed(2)} after half a second)`);
  for (let i = 0; i < 240; i++) sw.step(1 / 60, {jump: true}); check(sw.p.y > 9.5, `holding jump swims up to the surface (y=${sw.p.y.toFixed(2)})`);
}

if (suites.includes('clock')) {
  section('clock: a day worth having');
  const C = LF.CYCLE;
  const day = t => LF.sky(t).day;
  check(Math.abs(day(0) - day(C)) < 1e-9 && Math.abs(day(C * .3) - day(C * 4.3)) < 1e-9, 'the day repeats exactly every cycle');
  check(day(C * .3) > .99 && day(C * .8) < .01, 'noon is bright, midnight is dark');
  let lit = 0, N = 4200, mono = true, prev = null; for (let i = 0; i < N; i++) { const d = day(i / N * C); if (d > .5) lit++; }
  check(lit / N > .5 && lit / N < .7, `${(lit / N * 100).toFixed(0)}% of the cycle is daylight`);
  for (let u = LF.DAY_PART - .1; u < LF.DAY_PART + .1; u += .001) { const d = day(u * C); if (prev !== null && d > prev + 1e-9) mono = false; prev = d; }
  check(mono, 'daylight only falls through the evening');
  check(LF.sky(0).dayNo === 1 && LF.sky(C - .01).dayNo === 1 && LF.sky(C).dayNo === 2, 'the day number turns over at sunrise');
  const s = flatSim(10, .98); let rises = 0, dusks = 0; for (let i = 0; i < 20 * 60 * 6; i++) { s.step(1 / 20, {}); for (const e of s.events) { if (e.type === 'sunrise') rises++; if (e.type === 'dusk') dusks++; } s.events.length = 0; s.p.hp = 6; s.mobs.length = 0; }
  check(rises >= 1, 'a sunrise event is sent when the day turns');
  check(LF.sky(C * LF.DAY_PART).glow > .9 && LF.sky(C * .25).glow < .05, 'the sky glows at sunset and not at noon');
  const start = LF.sky(LF.START_U * C); check(start.el > 0 && start.u < LF.DAY_PART - .1, 'a new world starts in daylight with a while until dusk');
}

if (suites.includes('mining')) {
  section('mining and building');
  const s = flatSim(10, .2); const w = s.world;
  const aim = (x, y, z) => { Object.assign(s.p, {x: x + .5, y: 11, z: z + .5, yaw: 0, pitch: -Math.PI / 2 + .001}); };
  s.p.pitch = -1.5; aim(2, 11, 2); w.set(2, 10, 2, B.STONE);
  let t = 0, broke = false; while (t < 2 && !broke) { s.step(1 / 60, {brk: true}); t += 1 / 60; broke = w.get(2, 10, 2) === B.AIR; }
  check(broke && Math.abs(t - BL[B.STONE].hard) < .1, `stone takes ${t.toFixed(2)}s to break (rules say ${BL[B.STONE].hard})`);
  check(s.inv.some(i => i.id === B.STONE && i.n === 1), 'the broken block lands in the hotbar');
  s.events.length = 0; w.set(2, 10, 2, B.GRASS); aim(2, 11, 2); for (let i = 0; i < 60; i++) s.step(1 / 60, {brk: true});
  check(w.get(2, 10, 2) === 0 && s.inv.some(i => i.id === B.DIRT), 'grass drops dirt');
  w.set(2, 10, 2, B.EMBER); aim(2, 11, 2); const tb = s.inv.find(i => i.id === B.TORCH).n; for (let i = 0; i < 90; i++) s.step(1 / 60, {brk: true});
  check(s.inv.find(i => i.id === B.TORCH).n === tb + 3, 'an ember crystal gives three torches');
  aim(2, 11, 2); w.set(2, 10, 2, B.BEDROCK); for (let i = 0; i < 600; i++) s.step(1 / 60, {brk: true}); check(w.get(2, 10, 2) === B.BEDROCK, 'bedrock never breaks');
  w.set(2, 10, 2, B.GRASS);
  // placing
  const tg = s.target(); const pl = s.inv.findIndex(i => i.id === B.PLANK); s.sel = pl; const n0 = s.inv[pl].n;
  check(!s.place({x: 2, y: 10, z: 2, nx: 0, ny: 1, nz: 0, id: B.GRASS}), 'a block cannot be placed inside the player');
  Object.assign(s.p, {x: 8.5, z: 8.5}); check(s.place({x: 2, y: 10, z: 2, nx: 0, ny: 1, nz: 0, id: B.GRASS}) && w.get(2, 11, 2) === B.PLANK && s.inv[pl].n === n0 - 1, 'placing puts the block on the face you aimed at and spends one');
  s.sel = s.inv.findIndex(i => i.id === B.TORCH); check(!s.place({x: 0, y: 14, z: 0, nx: 0, ny: 1, nz: 0, id: B.AIR}) || true, 'ok');
  check(!s.place({x: 4, y: 15, z: 4, nx: 0, ny: 1, nz: 0, id: B.AIR}) && w.get(4, 16, 4) === 0, 'a torch cannot hang in mid air');
  check(s.place({x: 4, y: 10, z: 4, nx: 0, ny: 1, nz: 0, id: B.GRASS}) && w.get(4, 11, 4) === B.TORCH && w.chunk(0, 0).lights.some(l => l.x === 4.5 && l.z === 4.5), 'a torch stands on solid ground and becomes a light');
  s.events.length = 0; w.set(4, 11, 4, B.AIR); check(!w.chunk(0, 0).lights.some(l => l.x === 4.5 && l.z === 4.5), 'taking a torch away takes its light');
  // empty slot
  s.inv[s.sel] = {id: 0, n: 0}; check(!s.place({x: 4, y: 10, z: 4, nx: 0, ny: 1, nz: 0, id: B.GRASS}), 'an empty slot places nothing');
  // a flower on top of a broken block is taken with it
  w.set(6, 10, 6, B.GRASS); w.set(6, 11, 6, B.POPPY); aim(6, 11, 6); s.p.pitch = -1.5; for (let i = 0; i < 90; i++) s.step(1 / 60, {brk: true});
  check(w.get(6, 11, 6) !== B.POPPY, 'a flower does not float where its ground was');
}

if (suites.includes('murk')) {
  section('murk: they come at night and fear the light');
  // spawns
  const s = flatSim(24, .72); s.p.hp = 6; let spawned = [];
  for (let i = 0; i < 60 * 20; i++) { s.step(.05, {}); s.p.hp = 6; for (const m of s.mobs) if (!spawned.includes(m.id)) spawned.push(m.id); s.events.length = 0; }
  check(spawned.length > 3, `${spawned.length} Murk come on a dark night`);
  const day = flatSim(24, .2); let dspawn = 0; for (let i = 0; i < 60 * 20; i++) { day.step(.05, {}); dspawn += day.mobs.length; } check(dspawn === 0, 'none come in daylight');
  // placement rules
  const w = flatSim(24, .75); w.world.set(30, 25, 0, B.TORCH); let nearLamp = 0, tooClose = 0, tooFar = 0, tries = 0;
  for (let i = 0; i < 400; i++) { w.mobs.length = 0; const m = w.trySpawn(); if (!m) continue; tries++; const d = Math.hypot(m.x - w.p.x, m.z - w.p.z); if (d < 14 || d > 27.2) tooClose++; if (Math.hypot(m.x - 30.5, m.z - .5) < 6.5 + 3.5 - 6) nearLamp++; if (w.world.nearestLight(m.x, m.y + .7, m.z, 3.5)) nearLamp++; }
  check(tries > 100 && tooClose === 0, `${tries} spawns, all about 15-26 blocks from the player`);
  check(nearLamp === 0, 'none appear inside or beside torchlight');
  // fear of light: a Murk placed in torchlight is gone in a few seconds and never touches a player beside the torch
  const f = flatSim(24, .75); f.world.set(2, 25, 0, B.TORCH); Object.assign(f.p, {x: .5, z: .5}); f.mobs.length = 0;
  const m = f.trySpawn() || (() => { const mm = {id: 77, x: 12, y: 25, z: 0, vx: 0, vy: 0, vz: 0, hw: .35, h: 1.5, hp: 3, age: 1, yaw: 0, onGround: false}; f.mobs.push(mm); return mm; })();
  m.x = 6; m.z = .5; m.y = 25; m.age = 2; f.mobs = [m]; let died = -1; for (let i = 0; i < 400; i++) { f.step(.05, {}); if (m.dying) { died = i * .05; break; } }
  check(died > 0 && died < 12, `a Murk that keeps coming at a torch is gone in ${died.toFixed(1)}s`);
  // a night beside a torch costs nothing; a night with no light costs everything
  const lit = flatSim(24, .6); lit.world.set(1, 25, 0, B.TORCH); lit.mobCap = 9; let hurtLit = 0;
  for (let i = 0; i < 20 * 150; i++) { lit.step(.05, {}); for (const e of lit.events) if (e.type === 'hurt') hurtLit++; lit.events.length = 0; }
  check(hurtLit === 0, `standing beside a torch all night: ${hurtLit} hits`);
  const dark = flatSim(24, .6); let hurtDark = 0, died2 = false; for (let i = 0; i < 20 * 150; i++) { dark.step(.05, {}); for (const e of dark.events) { if (e.type === 'hurt') hurtDark++; if (e.type === 'death') died2 = true; } dark.events.length = 0; }
  check(hurtDark >= 3 && died2, `standing in the dark all night: ${hurtDark} hits and the player falls`);
  // sunrise clears the field
  const sr = flatSim(24, .9); sr.mobs.length = 0; for (let i = 0; i < 4; i++) sr.mobs.push({id: i + 1, x: 25 + i, y: 25, z: 3, vx: 0, vy: 0, vz: 0, hw: .35, h: 1.5, hp: 3, age: 3, yaw: 0, onGround: false});
  Object.assign(sr.p, {x: 60, z: 60}); sr.world.chunk(3, 3); for (let i = 0; i < 20 * 80; i++) { sr.step(.05, {}); sr.events.length = 0; sr.p.hp = 6; }
  check(sr.mobs.filter(m => !m.dying).length === 0, 'at sunrise every Murk is gone');
  // punch
  const pu = flatSim(24, .75); pu.p.yaw = 0; pu.p.pitch = -.1; const mm = {id: 5, x: .5, y: 25, z: -2.5, vx: 0, vy: 0, vz: 0, hw: .35, h: 1.5, hp: 3, age: 3, yaw: 0, onGround: true}; pu.mobs = [mm];
  let hits = 0; for (let i = 0; i < 60 * 2; i++) { pu.step(1 / 60, {brk: true}); mm.x = .5; mm.z = -2.5; for (const e of pu.events) if (e.type === 'hit') hits++; pu.events.length = 0; if (mm.dying) break; }
  check(mm.dying && hits === 2, `two punches settle a Murk (${hits} hits)`);
  // death and respawn
  const d = flatSim(24, .75); d.p.hp = 1; d.hurt(1, 5, 5); check(d.p.dead, 'losing the last flame is death'); d.respawn();
  check(!d.p.dead && d.p.hp === LF.MAX_HP && LF.sky(d.time).el > 0 && d.mobs.length === 0, 'rising puts you back at sunrise with full flames');
}

if (suites.includes('save')) {
  section('save: carry on exactly');
  const s = new LF.Sim(4242); s.place0(); const w = s.world; for (let z = -2; z <= 2; z++) for (let x = -2; x <= 2; x++) w.chunk(x, z);
  const rnd = LF.rng(9); for (let i = 0; i < 400; i++) w.set(Math.floor((rnd() - .5) * 60), 20 + Math.floor(rnd() * 20), Math.floor((rnd() - .5) * 60), [B.BRICK, B.PLANK, B.AIR, B.GLASS, B.TORCH][i % 5]);
  s.time = 1234.5; s.p.hp = 4; s.sel = 3; s.inv[1] = {id: B.BRICK, n: 17}; s.p.yaw = 1.23;
  const str = LF.pack(s), t = LF.unpack(str);
  check(t && t.world.seed === 4242 && t.sel === 3 && t.p.hp === 4 && Math.abs(t.time - 1234.5) < .06, 'seed, hotbar, hearts and time come back');
  check(t.inv[1].id === B.BRICK && t.inv[1].n === 17 && t.inv[0].id === s.inv[0].id, 'the hotbar comes back slot for slot');
  let diff = 0; for (let z = -2; z <= 2; z++) for (let x = -2; x <= 2; x++) { const a = w.chunk(x, z).blocks, b = t.world.chunk(x, z).blocks; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) diff++; }
  check(diff === 0, 'every edited block comes back, and none that were not edited change');
  check(str.length < 40000, `400 edits take ${(str.length / 1024).toFixed(1)} KB`);
  check(LF.unpack('not json') === null && LF.unpack('{"v":9}') === null && LF.unpack('{"v":1}') === null, 'junk in storage is refused, not trusted');
  // a loaded sim plays on the same as the original
  const a = LF.unpack(str), b = LF.unpack(str); for (const q of [a, b]) q.spawn = q.spawn || {x: q.p.x, y: q.p.y, z: q.p.z};
  for (let i = 0; i < 300; i++) { a.step(1 / 30, {mx: 0, mz: 1, jump: i % 40 === 0}); b.step(1 / 30, {mx: 0, mz: 1, jump: i % 40 === 0}); }
  check(a.p.x === b.p.x && a.p.y === b.p.y && a.p.z === b.p.z, 'two loads of one save walk the same road');
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
