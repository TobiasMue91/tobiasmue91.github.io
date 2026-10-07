#!/usr/bin/env node
// Test suite for games/qix.html (QIX).
//
// Runs the page's DOM-free <script id="core"> block in Node. The game's promises are that a claim is
// honest (what you enclose is claimed, what the Qix is in is not), that the line is only ever lost to
// something that really touched it, and that a stake can always be walked back. No browser, no server.
//
//   node test/qix.mjs                 # everything
//   node test/qix.mjs capture bots    # named suites only
//   node test/qix.mjs --page=path.html
//
// Suites: capture, play, danger, retreat, determinism, bots.

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name, dflt) => { const a = args.find(x => x.startsWith(`--${name}=`)); return a ? a.split('=')[1] : dflt; };
const PAGE = opt('page', join(HERE, '..', 'games', 'qix.html'));
const ALL = ['capture', 'play', 'danger', 'retreat', 'determinism', 'bots'];
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
vm.runInContext(core[1] + '\nthis.Q = QIX;', ctx);
const Q = ctx.Q;
const SHAPES = Object.keys(Q.SHAPES);

// -- helpers ----------------------------------------------------------------------------------------
const quiet = g => { g.sparx.length = 0; };                       // isolate a rule from the Sparx
const still = g => { g.spec.qixSpeed = 0; for (const q of g.qixes) { q.om = 0; q.omT = 1e9; q.wphiT = 1e9; q.wphi = 0; q.surge = 0; } };
const place = (g, k, x, y, th, len) => { const q = g.qixes[k]; q.x = x; q.y = y; q.th = th; q.len = q.nominal = len; };
const run = (g, secs, dir) => { if (dir !== undefined) Q.setDir(g, dir); for (let t = 0; t < secs * 120; t++) { Q.advance(g, 1 / 120); if (g.phase !== 'play') break; } };
const take = (g, type) => { const e = g.events.filter(x => x.type === type); g.events.length = 0; return e; };
const cellOf = (g, x, y) => y * g.w + x;
const countState = (g, s) => { let n = 0; for (let i = 0; i < g.n; i++) if (g.cells[i] === s) n++; return n; };
const hash = g => { let h = 2166136261; for (let i = 0; i < g.n; i++) h = Math.imul(h ^ g.cells[i], 16777619) >>> 0; for (const q of g.qixes) h = Math.imul(h ^ Math.round(q.x * 1000) ^ Math.round(q.y * 1000), 16777619) >>> 0; return (h ^ g.score ^ g.p.i * 7 ^ g.lives) >>> 0; };

// a bot that cuts straight lines from the rim and waits while a Qix is near the line
function ray(g, from, d) { const out = []; let x = Q.px(g, from) + Q.DX[d], y = Q.py(g, from) + Q.DY[d]; while (x >= 0 && y >= 0 && x < g.w && y < g.h && g.cells[cellOf(g, x, y)] === 0) { out.push([x, y]); x += Q.DX[d]; y += Q.DY[d]; } return out; }
function makeBot(g, seed, care) {
  const r = Q.rng(seed); let dir = -1, walk = (r() * 4) | 0, cool = 0;
  return () => {
    const p = g.p;
    if (p.drawing) { return dir; }
    if (cool-- > 0) return walk;
    let best = -1, bestRisk = -1;
    for (let d = 0; d < 4; d++) {
      if (!Q.probe(g, d, false) || Q.probe(g, d, false).kind !== 'start') continue;
      const cells = ray(g, p.i, d); if (cells.length < 3) continue;
      let risk = 99; for (const q of g.qixes) for (const [x, y] of cells) risk = Math.min(risk, Math.hypot(q.x - x, q.y - y) - q.len);
      const val = risk + cells.length * .02 + r();
      if (val > bestRisk) { bestRisk = val; best = d; }
    }
    if (best >= 0 && (!care || bestRisk > care)) { dir = best; return best; }
    cool = 20;
    for (let t = 0; t < 4; t++) { const m = Q.probe(g, walk, true); if (m && m.kind === 'rim') break; walk = (r() * 4) | 0; }
    return walk;
  };
}

// -- capture -----------------------------------------------------------------------------------------
if (suites.includes('capture')) {
  section('capture: what is claimed is exactly what the Qix cannot reach');
  let captures = 0, bad = 0, firstBad = '';
  for (let seed = 1; seed <= 80 && bad < 3; seed++) {
    const g = Q.create(SHAPES[seed % 3], seed), bot = makeBot(g, seed * 5, 0);
    g.p.shield = 1e9;
    let snap = null;
    for (let f = 0; f < 40 * 60 && g.phase === 'play'; f++) {
      Q.setDir(g, bot());
      for (let s = 0; s < 2; s++) {
        snap = { cells: g.cells.slice(), q: g.qixes.map(q => ({ x: q.x, y: q.y, th: q.th, len: q.len })) };
        Q.advance(g, 1 / 120);
        const caps = g.events.filter(e => e.type === 'capture');
        if (!caps.length) continue;
        captures++;
        const e = caps[0];
        // reference: flood from the Qix over the cells that were open, with the stake as a wall
        const seen = new Uint8Array(g.n), stack = [];
        for (const q of snap.q) Q.qixSamples(q, (x, y) => { const cx = Math.floor(x), cy = Math.floor(y); const i = cy * g.w + cx; if (snap.cells[i] === 0 && !seen[i]) { seen[i] = 1; stack.push(i); } });
        while (stack.length) {
          const c = stack.pop(), x = c % g.w, y = (c / g.w) | 0;
          for (let d = 0; d < 4; d++) { const nx = x + Q.DX[d], ny = y + Q.DY[d]; if (nx < 0 || ny < 0 || nx >= g.w || ny >= g.h) continue; const n = ny * g.w + nx; if (snap.cells[n] === 0 && !seen[n]) { seen[n] = 1; stack.push(n); } }
        }
        const expect = new Set(); for (let i = 0; i < g.n; i++) if ((snap.cells[i] === 0 && !seen[i]) || snap.cells[i] === 2) expect.add(i);
        const got = new Set(e.cells);
        let ok = expect.size === got.size; if (ok) for (const c of expect) if (!got.has(c)) { ok = false; break; }
        if (g.phase === 'play') { for (let i = 0; i < g.n; i++) { const want = snap.cells[i] === 1 || expect.has(i) ? 1 : 0; if (g.cells[i] !== want) { ok = false; break; } } }
        if (!ok) { bad++; if (!firstBad) firstBad = `seed ${seed}: expected ${expect.size} cells, core claimed ${got.size}`; }
        if (g.phase === 'play') {
          const rec = (countState(g, 1) - g.ring) / g.inner;
          if (Math.abs(rec - Q.pct(g)) > 1e-9) { bad++; firstBad = firstBad || `seed ${seed}: pct ${Q.pct(g)} but a recount says ${rec}`; }
        }
        g.events.length = 0;
        if (g.phase !== 'play') break;
      }
      g.events.length = 0;
    }
  }
  check(captures >= 100, 'enough captures were exercised', `${captures}`);
  check(bad === 0, `every capture claims exactly the unreachable pockets and the stake (${captures} checked)`, firstBad);

  const g = Q.create('square', 3); quiet(g); still(g); place(g, 0, 60, 40, 0.3, 6);
  run(g, .5, 3); // west along the bottom
  run(g, .05, 0);
  const up = run(g, 40 / 30, 0);
  check(g.p.drawing && g.p.trail.length > 30, 'a long stake draws', `${g.p.trail.length}`);
  run(g, 1.5, 3);                      // across to the west wall
  const ev = take(g, 'capture');
  check(ev.length === 1 && ev[0].cells.length > 500, 'closing at the west wall claims the strip on the Qix-free side', `${JSON.stringify(ev.map(e => e.n))}`);
  check(g.cells[cellOf(g, 60, 40)] === 0, 'the Qix\'s own pocket stays open');
  check(g.score > 0 && Q.pct(g) > 0 && Q.pct(g) < .5, 'score and percent moved', `${g.score} ${Q.pct(g)}`);
}

// -- play: invariants over many random games --------------------------------------------------------------
if (suites.includes('play')) {
  section('play: invariants while random players wander');
  let ticks = 0, bad = '';
  for (let seed = 1; seed <= 30 && !bad; seed++) {
    const g = Q.create(SHAPES[seed % 3], seed + 100), r = Q.rng(seed);
    let dir = 0, claimedBefore = g.claimed;
    for (let f = 0; f < 90 * 60 && g.phase === 'play' && !bad; f++) {
      if (f % 12 === 0 && r() < .6) dir = (r() * 5 | 0) - 1;
      Q.setDir(g, dir); Q.advance(g, 1 / 60); ticks++;
      for (const e of g.events) if (e.type === 'clear') { Q.nextLevel(g); claimedBefore = g.claimed; }
      g.events.length = 0;
      const p = g.p;
      if (countState(g, 2) !== p.trail.length) bad = `seed ${seed}: ${countState(g, 2)} stake cells but trail has ${p.trail.length}`;
      else if (p.drawing && g.cells[p.i] !== 2) bad = `seed ${seed}: the head is not on its stake`;
      else if (!p.drawing && (g.cells[p.i] !== 1)) bad = `seed ${seed}: the player stands on cell state ${g.cells[p.i]}`;
      else if (g.claimed < claimedBefore) bad = `seed ${seed}: claimed area shrank`;
      else {
        for (let i = 1; i < p.trail.length && !bad; i++) if (Math.abs(Q.px(g, p.trail[i]) - Q.px(g, p.trail[i - 1])) + Math.abs(Q.py(g, p.trail[i]) - Q.py(g, p.trail[i - 1])) !== 1) bad = `seed ${seed}: the stake is broken`;
        for (const s of g.sparx) if (!s.off && !Q.isRim(g, s.i)) bad = `seed ${seed}: a Sparx is off the rim`;
        for (const q of g.qixes) Q.qixSamples(q, (x, y) => { const cx = Math.floor(x), cy = Math.floor(y); if (cx < 0 || cy < 0 || cx >= g.w || cy >= g.h || g.cells[cy * g.w + cx] === 1) bad = `seed ${seed}: a Qix is inside claimed ground`; });
        if (g.lives < 0 || g.lives > 3) bad = `lives ${g.lives}`;
      }
      claimedBefore = g.claimed;
    }
  }
  check(!bad, `${ticks} frames: stake, head, rim, Qix and lives stay consistent`, bad);
}

// -- danger -------------------------------------------------------------------------------------------------
if (suites.includes('danger')) {
  section('danger: the line is lost only to what touches it');
  const setup = () => { const g = Q.create('square', 9); quiet(g); still(g); g.p.shield = 0; run(g, 8 / 30, 0); return g; };
  let g = setup(); const head = g.p.trail[g.p.trail.length - 1];
  place(g, 0, Q.px(g, head), Q.py(g, head) + 3, 0, 2);   // a Qix segment lying across the stake
  run(g, .05, -1);
  check(g.lives === 3 || g.lives === 2, 'sanity');
  g = setup(); const mid = g.p.trail[3];
  place(g, 0, Q.px(g, mid) + .5, Q.py(g, mid) + .5, 0, 4);
  run(g, .02, -1); let ev = take(g, 'death');
  check(ev.length === 1 && ev[0].cause === 'qix' && g.lives === 2, 'a Qix lying across the stake costs a life');
  check(countState(g, 2) === 0 && !g.p.drawing && g.p.i === g.p.origin, 'the stake is gone and the player is back at its start');
  g = setup();
  place(g, 0, Q.px(g, g.p.trail[3]) - 6.5, Q.py(g, g.p.trail[3]) + .5, Math.PI / 2, 3);
  run(g, .5, -1); ev = take(g, 'death');
  check(ev.length === 0, 'a Qix passing two cells beside the stake does not');
  g = setup(); g.p.shield = 3; g.sparx.push({ i: g.p.origin, prev: g.p.origin - 1, acc: 0, sleep: 0, off: 0 });
  run(g, .1, -1);
  check(g.lives === 3 && g.p.shield > 2, 'the grace after a death or a new level protects against a Sparx on the rim');
  place(g, 0, Q.px(g, g.p.trail[3]) + .5, Q.py(g, g.p.trail[3]) + .5, 0, 4); run(g, .05, -1);
  check(g.lives === 2, 'but never the line: grace would let a Qix sit on a stake that then becomes ground');
  // the fuse
  g = setup(); const n = g.p.trail.length;
  run(g, Q.STALL * .9, -1);
  check(take(g, 'death').length === 0 && g.p.fuse === 0, 'standing still just under the delay is safe');
  run(g, Q.STALL * .1 + (n - 1) / Q.FUSE_SPEED + .15, -1); ev = take(g, 'death');
  check(ev.length === 1 && ev[0].cause === 'fuse', 'standing still long enough lights the fuse and it reaches the player');
  g = setup(); run(g, Q.STALL + .15, -1); check(g.p.fuse > 0, 'fuse is lit after the delay');
  run(g, .25, 0); check(g.p.fuse === 0 || g.p.fuse < .1, 'moving again puts it out', `${g.p.fuse}`);
  // sparx
  g = Q.create('square', 4); still(g); g.sparx.length = 1; g.p.shield = 0;
  const s = g.sparx[0]; s.sleep = 0; s.i = g.p.i + 2; s.prev = s.i + 1; s.acc = 0;
  g.spec.chase = 1; run(g, 2, -1); ev = take(g, 'death');
  check(ev.length === 1 && ev[0].cause === 'sparx', 'a Sparx reaching the player on the rim costs a life');
  g = Q.create('square', 4); still(g); g.sparx.length = 1; g.p.shield = 0; g.sparx[0].sleep = 5;
  run(g, 1, -1); check(take(g, 'death').length === 0, 'a Sparx that has not woken up cannot hurt');
  // game over
  g = Q.create('square', 5); still(g); g.p.shield = 0;
  for (let k = 0; k < 3; k++) { g.p.shield = 0; run(g, 8 / 30, 0); const h = g.p.trail[2]; place(g, 0, Q.px(g, h) + .5, Q.py(g, h) + .5, 0, 4); run(g, .02, -1); still(g); g.p.shield = 0; }
  check(g.lives === 0 && g.phase === 'over' && take(g, 'over').length === 1, 'the third life ends the game');
}

// -- retreat ---------------------------------------------------------------------------------------------------
if (suites.includes('retreat')) {
  section('retreat: a stake can always be walked back');
  const g = Q.create('wide', 7); quiet(g); still(g);
  const before = g.cells.slice();
  run(g, 12 / 30 + .001, 0); const out = g.p.trail.length;
  check(out >= 11 && g.p.drawing, 'stepping into the dark starts a stake', `${out}`);
  run(g, 12 / 30 + .05, 2);
  check(!g.p.drawing && g.p.i === g.p.origin, 'walking back ends it at its start');
  check(g.cells.every((c, i) => c === before[i]), 'and leaves the board exactly as it was');
  check(take(g, 'capture').length === 0 && g.score === 0, 'with nothing claimed or scored');
  // a turn asked for slightly early is kept until the corner
  const h = Q.create('square', 8); quiet(h); still(h);
  run(h, 10 / 30, 3); const x0 = Q.px(h, h.p.i);
  Q.setDir(h, 3); run(h, 3 / 30, 3);
  check(Q.px(h, h.p.i) < x0, 'holding a direction walks the rim');
  // you cannot walk through solid ground
  const k = Q.create('square', 8); quiet(k); still(k);
  run(k, .3, 3); const y0 = Q.py(k, k.p.i);
  run(k, .3, 2); check(Q.py(k, k.p.i) === y0, 'the outer wall is a wall');
}

// -- determinism ---------------------------------------------------------------------------------------------------
if (suites.includes('determinism')) {
  section('determinism: a seed is the same night for everyone');
  const play = (seed, inputSeed) => { const g = Q.create('portrait', seed), r = Q.rng(inputSeed); let d = 0; for (let f = 0; f < 60 * 40 && g.phase === 'play'; f++) { if (f % 15 === 0) d = (r() * 5 | 0) - 1; Q.setDir(g, d); Q.advance(g, 1 / 60); g.events.length = 0; } return hash(g); };
  check(play(5, 1) === play(5, 1), 'same seed and same inputs give the same game');
  check(play(5, 1) !== play(6, 1), 'a different seed gives a different game');
  const a = Q.create('square', 11), b = Q.create('square', 11);
  check(JSON.stringify(a.qixes) === JSON.stringify(b.qixes), 'a seed places the Qix the same way');
  const frames = (g, dt) => { Q.setDir(g, 0); for (let t = 0; t < 2 / dt; t++) Q.advance(g, dt); return g.p.i; };
  const f1 = frames(Q.create('square', 12), 1 / 30), f2 = frames(Q.create('square', 12), 1 / 144);
  check(Math.abs(Q.py(Q.create('square', 12), f1) - Q.py(Q.create('square', 12), f2)) <= 2, 'the player walks as far at 30 fps as at 144 fps', `${f1} ${f2}`);
  for (let n = 1; n <= 12; n++) { const s = Q.levelSpec(n), t = Q.levelSpec(n + 1); if (!(t.qixSpeed >= s.qixSpeed && t.sparxSpeed >= s.sparxSpeed && t.qix >= s.qix && t.sparx >= s.sparx)) { fail(`level ${n + 1} is not harder than ${n}`); } }
  pass('every level asks at least as much as the one before');
}

// -- bots ------------------------------------------------------------------------------------------------------------
if (suites.includes('bots')) {
  section('bots: skill is rewarded, standing still is not');
  const trial = (mk, seeds, secs) => {
    let clears = 0, claimed = 0, score = 0;
    for (let seed = 1; seed <= seeds; seed++) {
      const g = Q.create(SHAPES[seed % 3], seed + 500), bot = mk(g, seed);
      for (let f = 0; f < secs * 60 && g.phase === 'play'; f++) { Q.setDir(g, bot()); Q.advance(g, 1 / 60); if (g.events.some(e => e.type === 'clear')) { clears++; } g.events.length = 0; }
      claimed += Q.pct(g); score += g.score;
    }
    return { clears: clears / seeds, claimed: claimed / seeds, score: score / seeds };
  };
  const idle = trial(() => () => -1, 12, 120);
  const dither = trial((g, s) => { const r = Q.rng(s); let d = 0, f = 0; return () => { if (f++ % 9 === 0) d = (r() * 4) | 0; return d; }; }, 12, 120);
  const careful = trial((g, s) => makeBot(g, s, 14), 12, 180);
  const bold = trial((g, s) => makeBot(g, s, -50), 12, 180);
  if (process.env.VERBOSE) console.log({ idle, dither, careful, bold });
  check(idle.clears === 0 && idle.score === 0, 'a player who never moves scores nothing and never clears');
  check(careful.clears >= .5, 'a player who cuts when the Qix is far clears the first painting', JSON.stringify(careful));
  check(careful.score > dither.score * 1.5, 'careful play out-scores flailing', `${careful.score} vs ${dither.score}`);
  check(careful.claimed >= bold.claimed - .05, 'looking before cutting does not claim less than cutting blind', `${careful.claimed} vs ${bold.claimed}`);
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
