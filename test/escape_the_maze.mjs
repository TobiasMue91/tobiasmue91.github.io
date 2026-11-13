#!/usr/bin/env node
// Test suite for games/escape_the_maze.html.
//
// Runs the page's DOM-free <script id="core"> block in Node. The page builds its hedges, its map, its
// daylight and its shareable links from what the core generates, so a maze that is not fully connected,
// a gate on the wrong side, or a seed that no longer reproduces the same maze would break the game in ways
// a glance at one maze will not show. No browser, no server.
//
//   node test/escape_the_maze.mjs               # everything
//   node test/escape_the_maze.mjs maze seed     # named suites only
//   node test/escape_the_maze.mjs --page=x.html # run against another copy of the page
//
// Suites:
//   maze   every cell reachable, walls symmetric, outer ring closed except the one gate, start on the south
//          edge facing an open way, the gate on the perimeter and as far as any perimeter cell, shortest = BFS distance + 1
//   moves  canMove leaves the grid only through the gate; sight stops at walls
//   seed   the same seed gives the same maze; a golden hash of three seeds pins the generator, because a
//          changed generator silently changes every shared link and every level
//   walk   free walking on desktop: a walker pushed out of the hedges by collide never ends up inside one, never
//          leaves the hedge ring except through the gate, and can walk every corridor of the shortest way out
//   pace   an explorer bot that walks toward the light finishes every level well inside daylight at
//          human pace, and daylight grows with the levels

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name, dflt) => { const a = args.find(x => x.startsWith(`--${name}=`)); return a ? a.split('=')[1] : dflt; };
const PAGE = opt('page', join(HERE, '..', 'games', 'escape_the_maze.html'));
const ALL = ['maze', 'moves', 'seed', 'walk', 'pace'];
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
vm.runInContext(core[1] + '\nthis.M = MAZE;', ctx);
const M = ctx.M;

const SAMPLES = [];
for (let n = 1; n <= 11; n++) for (let k = 0; k < 6; k++) { const s = M.levelSize(n); SAMPLES.push({ name: `level ${n} #${k}`, m: M.generate(s, s, k ? `t${n}-${k}` : M.levelSeed(n)) }); }
SAMPLES.push({ name: 'daily', m: M.generate(12, 12, 'day-2026-11-13') });
SAMPLES.push({ name: 'shared 4x4', m: M.generate(4, 4, 'x') });
SAMPLES.push({ name: 'shared 20x20', m: M.generate(20, 20, 'big') });

if (suites.includes('maze')) {
  section('maze');
  for (const { name, m } of SAMPLES) {
    const dist = M.bfs(m, m.start.x, m.start.y);
    check([...dist].every(d => d >= 0), `${name}: every cell reachable`);
    let sym = true, ring = 0;
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) for (let d = 0; d < 4; d++) {
      const nx = x + M.DX[d], ny = y + M.DY[d];
      if (M.inside(m, nx, ny)) { if (M.open(m, x, y, d) !== M.open(m, nx, ny, (d + 2) & 3)) sym = false; }
      else if (M.open(m, x, y, d)) ring++;
    }
    check(sym, `${name}: walls agree from both sides`);
    check(ring === 1 && M.open(m, m.exit.x, m.exit.y, m.exit.dir), `${name}: outer ring closed except one gate`, `openings ${ring}`);
    const ex = m.exit, onEdge = (ex.dir === 0 && ex.y === 0) || (ex.dir === 2 && ex.y === m.h - 1) || (ex.dir === 1 && ex.x === m.w - 1) || (ex.dir === 3 && ex.x === 0);
    check(onEdge, `${name}: gate opens outward from a perimeter cell`);
    check(m.start.y === m.h - 1 && M.open(m, m.start.x, m.start.y, m.start.dir) && m.start.dir !== 2, `${name}: start on the south edge, facing an open way`);
    check(m.shortest === dist[ex.y * m.w + ex.x] + 1, `${name}: shortest is the BFS distance plus the step out`);
    const sp = M.shortestPath(m);
    check(sp.length === m.shortest, `${name}: shortestPath has one cell per step`, `${sp.length} vs ${m.shortest}`);
    let maxPerim = 0;
    for (let i = 0; i < m.w * m.h; i++) { const x = i % m.w, y = (i / m.w) | 0; if (x && y && x < m.w - 1 && y < m.h - 1) continue; if (y === m.h - 1 && Math.abs(x - m.start.x) < Math.ceil(m.w / 3)) continue; maxPerim = Math.max(maxPerim, dist[i]); }
    check(dist[ex.y * m.w + ex.x] === maxPerim, `${name}: gate is the farthest allowed perimeter cell`);
    check(m.shortest >= m.w, `${name}: the way out is never trivially short`, `${m.shortest} steps in ${m.w}x${m.h}`);
  }
}

if (suites.includes('moves')) {
  section('moves');
  for (const { name, m } of SAMPLES.slice(0, 20)) {
    let leaks = 0;
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) for (let d = 0; d < 4; d++) {
      if (!M.canMove(m, x, y, d)) continue;
      if (!M.open(m, x, y, d)) leaks++;
      if (!M.inside(m, x + M.DX[d], y + M.DY[d]) && !(x === m.exit.x && y === m.exit.y && d === m.exit.dir)) leaks++;
    }
    check(leaks === 0, `${name}: canMove only through open sides, off the grid only through the gate`);
    check(M.canMove(m, m.exit.x, m.exit.y, m.exit.dir), `${name}: the gate can be walked through`);
    let bad = 0;
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) for (const [cx, cy] of M.sight(m, x, y)) {
      if (cx !== x && cy !== y) bad++;
      const d = cx > x ? 1 : cx < x ? 3 : cy > y ? 2 : 0; let px = x, py = y;
      while (px !== cx || py !== cy) { if (!M.open(m, px, py, d)) { bad++; break; } px += M.DX[d]; py += M.DY[d]; }
    }
    check(bad === 0, `${name}: sight runs straight and stops at hedges`);
  }
}

if (suites.includes('seed')) {
  section('seed');
  const sig = m => M.hash(Array.from(m.walls).join(',') + '|' + m.exit.x + ',' + m.exit.y + ',' + m.exit.dir);
  for (const s of ['garden-1', 'day-2026-11-13', 'abc']) check(sig(M.generate(9, 9, s)) === sig(M.generate(9, 9, s)), `${s}: same seed, same maze`);
  check(sig(M.generate(9, 9, 'a')) !== sig(M.generate(9, 9, 'b')), 'different seeds, different mazes');
  const golden = { 'garden-1': 1081149750, 'garden-7': 2176765643, 'day-2026-11-13': 3477438750 };
  for (const [s, want] of Object.entries(golden)) {
    const n = s.startsWith('garden') ? +s.split('-')[1] : 0, size = n ? M.levelSize(n) : 12, got = sig(M.generate(size, size, s));
    check(got === want, `${s}: generator unchanged (shared links and levels stay the same)`, `got ${got}, want ${want} - if the change is deliberate, update the golden value and say so`);
  }
}

if (suites.includes('walk')) {
  section('walk');
  const C = 2.6, T = 0.5, R = 0.34;
  const inside = (rects, x, z, r) => rects.some(q => { const cx = Math.min(Math.max(x, q[0]), q[2]), cz = Math.min(Math.max(z, q[1]), q[3]); return (x - cx) ** 2 + (z - cz) ** 2 < (r - 1e-3) ** 2; });
  for (const { name, m } of SAMPLES.filter((_, i) => i % 6 === 0).concat(SAMPLES.slice(-3))) {
    const rects = M.wallRects(m, C, T), rnd = M.rng('walk' + name);
    let x = (m.start.x + 0.5) * C, z = (m.start.y + 0.5) * C, yaw = 0, bad = 0, escapes = 0, wrongExit = 0, steps = 0;
    for (let i = 0; i < 6000; i++) {
      if (rnd() < 0.05) yaw += (rnd() - 0.5) * 3; const sp = rnd() < 0.1 ? 0.3 : 0.09; // big lunges too
      const r = M.collide(rects, x + Math.sin(yaw) * sp, z - Math.cos(yaw) * sp, R); x = r[0]; z = r[1]; steps++;
      if (inside(rects, x, z, R)) bad++;
      const cx = Math.floor(x / C), cz = Math.floor(z / C);
      if (!M.inside(m, cx, cz)) { escapes++; const e = m.exit; if (!(cx === e.x + M.DX[e.dir] && cz === e.y + M.DY[e.dir])) wrongExit++;
        x = (m.start.x + 0.5) * C; z = (m.start.y + 0.5) * C; }
    }
    check(bad === 0, `${name}: a walker never ends up inside a hedge`, `${bad} of ${steps} frames`);
    check(wrongExit === 0, `${name}: the hedge ring is only left through the gate`, `${wrongExit} of ${escapes} escapes elsewhere`);
    // follow the shortest way through cell centres at walking speed; collision must never stop it
    const path = M.shortestPath(m).map(([cx, cz]) => [(cx + 0.5) * C, (cz + 0.5) * C]);
    path.push([(m.exit.x + 0.5 + M.DX[m.exit.dir]) * C, (m.exit.y + 0.5 + M.DY[m.exit.dir]) * C]);
    let px = path[0][0], pz = path[0][1], ok = true;
    for (let i = 1; i < path.length && ok; i++) {
      for (let f = 0; f < 200; f++) { const dx = path[i][0] - px, dz = path[i][1] - pz, d = Math.hypot(dx, dz); if (d < 0.05) break;
        const s = Math.min(0.1, d), r = M.collide(rects, px + dx / d * s, pz + dz / d * s, R); px = r[0]; pz = r[1]; }
      if (Math.hypot(path[i][0] - px, path[i][1] - pz) > 0.06) ok = false;
    }
    check(ok, `${name}: every corridor of the way out is wide enough to walk`);
  }
}

if (suites.includes('pace')) {
  section('pace');
  // walks with memory toward the beacon: at each cell prefer an unvisited neighbour closest to the gate,
  // back up along its own trail at dead ends. Seconds: 0.32 per step, 0.3 per quarter turn, 0.7 per junction.
  function explore(m, seed) {
    const r = M.rng(seed); let x = m.start.x, y = m.start.y, dir = m.start.dir, t = 0; const vis = new Set([x + ',' + y]), stack = [[x, y]];
    for (let it = 0; it < 20000; it++) {
      if (x === m.exit.x && y === m.exit.y) return t + 0.32;
      if (M.degree(m, x, y) > 2) t += 0.7;
      const opts = [0, 1, 2, 3].filter(d => M.canMove(m, x, y, d) && !vis.has((x + M.DX[d]) + ',' + (y + M.DY[d])));
      let d;
      if (opts.length) { opts.sort((a, b) => { const s = k => -((x + M.DX[k] - m.exit.x) ** 2 + (y + M.DY[k] - m.exit.y) ** 2) + r() * 6; return s(b) - s(a); }); d = opts[0]; stack.push([x + M.DX[d], y + M.DY[d]]); }
      else { stack.pop(); const [px, py] = stack[stack.length - 1]; d = [0, 1, 2, 3].find(k => x + M.DX[k] === px && y + M.DY[k] === py); }
      t += d === dir ? 0 : Math.abs(d - dir) === 2 ? 0.6 : 0.3; dir = d; x += M.DX[d]; y += M.DY[d]; vis.add(x + ',' + y); t += 0.32;
    }
    return Infinity;
  }
  let prev = 0;
  for (let n = 1; n <= 11; n++) {
    const s = M.levelSize(n), ratios = [];
    let light = 0;
    for (let k = 0; k < 24; k++) { const m = M.generate(s, s, k ? `p${n}-${k}` : M.levelSeed(n)); const L = M.daylight(m); light += L / 24; ratios.push(explore(m, k) / L); }
    ratios.sort((a, b) => a - b);
    check(ratios[ratios.length - 1] < 0.85, `level ${n}: the bot always beats sunset with time to spare for a human`, `worst ${ratios[ratios.length - 1].toFixed(2)} of daylight`);
    check(ratios[12] > 0.08, `level ${n}: daylight is not absurdly generous`, `median ${ratios[12].toFixed(2)}`);
    check(light > prev, `level ${n}: daylight grows`, `${light.toFixed(0)} s`);
    prev = light;
  }
  check(M.stars(10, 60) === 3 && M.stars(80, 60) === 2 && M.stars(95, 60) === 1, 'stars: by sunset 3, by 1.5x daylight 2, after that 1');
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
