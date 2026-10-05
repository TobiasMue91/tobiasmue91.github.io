#!/usr/bin/env node
// Test suite for games/stack_tower.html (Stack Tower).
//
// Runs the page's DOM-free <script id="core"> block in Node. The game's one promise is that the cut is
// honest: what overhangs is sliced off, what lands within the tolerance snaps, and a tap at a given
// moment lands where the slab was. No browser, no server.
//
//   node test/stack_tower.mjs                 # everything
//   node test/stack_tower.mjs cut bots        # named suites only
//   node test/stack_tower.mjs --page=path.html
//
// Suites: path, cut, perfect, flow, bots.

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name, dflt) => { const a = args.find(x => x.startsWith(`--${name}=`)); return a ? a.split('=')[1] : dflt; };
const PAGE = opt('page', join(HERE, '..', 'games', 'stack_tower.html'));
const ALL = ['path', 'cut', 'perfect', 'flow', 'bots'];
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
vm.runInContext(core[1] + '\nthis.ST = STACK;', ctx);
const ST = ctx.ST;
const R = ST.RANGE, EPS = 1e-9;

// small seeded PRNG so every run is the same run
const rng = seed => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const gauss = r => { let u = 0, v = 0; while (!u) u = r(); v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const near = (a, b, e = 1e-9) => Math.abs(a - b) <= e;
const top = s => s.layers[s.layers.length - 1];
// put the slab at a chosen offset on its path and drop it there
const dropAt = (s, off) => { s.p = (off + R) % (4 * R); return ST.drop(s); };

if (suites.includes('path')) {
  section('path: the slab moves along a triangle wave');
  check(near(ST.tri(0), -R) && near(ST.tri(2 * R), R) && near(ST.tri(4 * R), -R), 'ends at -R, R, -R every half period');
  let ok = true;
  for (let p = -50; p < 80; p += 0.137) { const v = ST.tri(p); if (v < -R - EPS || v > R + EPS) ok = false; if (Math.abs(ST.tri(p + 0.01) - v) > 0.0100001) ok = false; }
  check(ok, 'always inside the swing and never faster than one unit per unit travelled');
  // one long step equals sixty short ones
  const a = ST.create(), b = ST.create();
  ST.advance(a, 1.7); for (let i = 0; i < 60; i++) ST.advance(b, 1.7 / 60);
  check(near(a.p, b.p, 1e-9) && near(ST.offset(a), ST.offset(b), 1e-9), 'a long frame moves the slab as far as sixty short ones');
  ST.advance(a, -1); check(near(a.p, 1.7 * a.speed), 'time never runs backwards');
  let mono = true; for (let n = 0; n < 200; n++) if (ST.speedFor(n + 1) < ST.speedFor(n)) mono = false;
  check(mono && ST.speedFor(0) < 6 && ST.speedFor(500) === 19, 'it starts gently, speeds up and tops out', `${ST.speedFor(0)} .. ${ST.speedFor(500)}`);
  // enters from alternating sides, on alternating axes
  const s = ST.create(); const axes = [], sides = [];
  for (let i = 0; i < 8; i++) { axes.push(s.axis); sides.push(Math.sign(ST.offset(s))); dropAt(s, 0); }
  check(axes.join('') === '01010101', 'it slides along x, then z, then x again', axes.join(''));
  check(sides.join(',') === '-1,-1,1,1,-1,-1,1,1', 'it enters from alternating sides', sides.join(','));
}

if (suites.includes('cut')) {
  section('cut: the overhang is sliced off, exactly');
  const r = rng(7); let bad = 0, count = 0, detail = '';
  for (let g = 0; g < 400; g++) {
    const s = ST.create();
    for (let k = 0; k < 30 && !s.over; k++) {
      const t = top(s), x = s.axis === 0;
      const size = x ? t.w : t.d, centre = x ? t.cx : t.cz;
      const off = (r() * 2 - 1) * R;
      const before = s.layers.length;
      const ev = dropAt(s, off); count++;
      if (ev.type === 'miss') {
        if (!(size - Math.abs(off) < ST.MIN) || s.layers.length !== before) { bad++; detail = 'miss without a miss'; }
        break;
      }
      if (ev.type === 'perfect') continue;
      const L = top(s), P = ev.piece;
      // brute force: intervals of the slab, the tower and the overlap
      const sl = centre + off - size / 2, sh = centre + off + size / 2, tl = centre - size / 2, th = centre + size / 2;
      const ol = Math.max(sl, tl), oh = Math.min(sh, th);
      const Lc = x ? L.cx : L.cz, Ls = x ? L.w : L.d, Pc = x ? P.cx : P.cz, Ps = x ? P.w : P.d;
      if (!near(Lc - Ls / 2, ol) || !near(Lc + Ls / 2, oh)) { bad++; detail = `layer [${Lc - Ls / 2},${Lc + Ls / 2}] vs overlap [${ol},${oh}]`; }
      // the piece is the rest of the slab: touches the layer, together they are the slab, and sit outside the tower
      const pl = Pc - Ps / 2, ph = Pc + Ps / 2;
      const touches = near(pl, oh) || near(ph, ol);
      if (!touches || !near(Ps + Ls, size) || Math.min(sl, pl) < Math.min(sl, tl) - EPS || !near(Math.min(pl, Lc - Ls / 2), sl) || !near(Math.max(ph, Lc + Ls / 2), sh)) { bad++; detail = 'piece does not complete the slab'; }
      // the other dimension is untouched, and the cut layer fits inside the one below
      const o = x ? [L.d, t.d, L.cz, t.cz, P.d, P.cz] : [L.w, t.w, L.cx, t.cx, P.w, P.cx];
      if (!near(o[0], o[1]) || !near(o[2], o[3]) || !near(o[4], o[1]) || !near(o[5], o[3])) { bad++; detail = 'cut spilled into the other axis'; }
      if (Lc - Ls / 2 < tl - EPS || Lc + Ls / 2 > th + EPS) { bad++; detail = 'layer overhangs the tower'; }
    }
  }
  check(bad === 0, `${count} random drops cut exactly as interval arithmetic says`, detail);
  // misses
  const narrow = () => { const g = ST.create(); g.layers[0].w = 2; return g; };
  const s = narrow(); const ev = dropAt(s, R);
  check(ev.type === 'miss' && s.over && s.n === 0 && s.layers.length === 1, 'a slab that misses the tower altogether ends the game and adds nothing');
  check(ev.piece && near(ev.piece.cx, R) && near(ev.piece.w, 2), 'and falls whole, where it was');
  check(ST.drop(s) === null, 'nothing happens after the game is over'); const p0 = s.p; ST.advance(s, 1); check(s.p === p0, 'and the slab stops');
  const s2 = ST.create(); s2.layers[0].w = 5; const e2 = dropAt(s2, 5 - ST.MIN + 0.01);
  check(e2.type === 'miss', 'a sliver thinner than the minimum is a miss');
  const s3 = ST.create(); s3.layers[0].w = 5; const e3 = dropAt(s3, 5 - ST.MIN - 0.01);
  check(e3.type === 'cut' && near(top(s3).w, ST.MIN + 0.01), 'one just above it carries on');
}

if (suites.includes('perfect')) {
  section('perfect: a drop that close snaps, and a run of them gives width back');
  for (const off of [0, ST.TOL - 1e-7, -ST.TOL + 1e-7, ST.TOL * 0.5]) {
    const s = ST.create(); s.layers[0].cx = 1.25;     // a tower that is not centred
    const ev = dropAt(s, off);
    check(ev.type === 'perfect' && near(top(s).cx, 1.25) && near(top(s).w, ST.BASE) && !ev.piece, `offset ${off} snaps exactly onto the tower`);
  }
  for (const off of [ST.TOL + 1e-6, -ST.TOL - 1e-6]) {
    const s = ST.create(); const ev = dropAt(s, off);
    check(ev.type === 'cut', `offset ${off} is a cut, not a perfect`);
  }
  // a cut slab: perfects only start giving width back after GROW_AT in a row
  const s = ST.create(); dropAt(s, 3);                                // width 7
  { const ev = dropAt(s, 0); check(ev.combo === 1 && ev.grown === 0, 'the first perfect gives nothing back'); }
  const t = ST.create(); dropAt(t, 3);                                // x cut: w = 7
  let combos = [], gs = [];
  for (let i = 0; i < 8; i++) { const ev = dropAt(t, 0); combos.push(ev.combo); gs.push(ev.grown); }
  check(combos.join() === '1,2,3,4,5,6,7,8', 'the run is counted', combos.join());
  // the slab that landed gains width along the axis it slid on, so only every other perfect shows it here
  check(gs.slice(0, ST.GROW_AT - 1).every(g => g === 0) && gs.slice(ST.GROW_AT - 1).some(g => g > 0), 'width comes back from the 4th perfect on', gs.join());
  // growth is capped at the starting size and never exceeds it
  const u = ST.create(); let max = 0;
  for (let i = 0; i < 40; i++) { dropAt(u, 0); max = Math.max(max, top(u).w, top(u).d); }
  check(max <= ST.BASE + EPS, 'a slab never grows past the one it began as');
  const v = ST.create(); dropAt(v, 3); dropAt(v, 0);                   // x cut to 7, z perfect
  const before = top(v).w; for (let i = 0; i < 6; i++) dropAt(v, 0);
  check(top(v).w > before || top(v).d >= ST.BASE - EPS, 'a run of perfects does win the lost width back');
  const k = ST.create(); for (let i = 0; i < 5; i++) dropAt(k, 0); dropAt(k, 2);
  check(k.combo === 0 && k.perfects === 5, 'a cut ends the run');
  check(k.n === 6, 'every placed slab counts one');
}

if (suites.includes('flow')) {
  section('flow: the tower and the sliding slab');
  const s = ST.create(), r = rng(3);
  let ok = true, detail = '';
  for (let k = 0; k < 60 && !s.over; k++) {
    ST.advance(s, 0.01 + r() * 0.4);
    const b = ST.block(s), t = top(s), o = ST.offset(s);
    if (s.axis === 0 ? !(near(b.cx, t.cx + o) && near(b.cz, t.cz)) : !(near(b.cz, t.cz + o) && near(b.cx, t.cx))) { ok = false; detail = 'slab off its line'; }
    if (!near(b.w, t.w) || !near(b.d, t.d)) { ok = false; detail = 'slab is not the size of the top slab'; }
    ST.drop(s);
  }
  check(ok, 'the slab always slides on the tower\'s centre line, at the size of the top slab', detail);
  check(s.layers.length === s.n + 1, 'layers = base + slabs placed');
  // a game replayed from the same taps ends the same
  const taps = Array.from({length: 40}, (_, i) => ((i * 37) % 100) / 100 * 2 - 1);
  const play = () => { const g = ST.create(); for (const t of taps) { if (g.over) break; dropAt(g, t * 6); } return JSON.stringify(g.layers) + g.n; };
  check(play() === play(), 'the same taps build the same tower');
}

if (suites.includes('bots')) {
  section('bots: people with a reaction time');
  // A player aims at the moment the slab is over the tower and taps with some timing error (ms), always
  // within the same frame budget a person has. Better timing must build higher, and every game must end.
  function play(sigmaMs, seed) {
    const r = rng(seed), s = ST.create(); let guard = 0;
    while (!s.over && guard++ < 2000) {
      // next time the slab crosses the centre line (offset 0), rising or falling
      const P = 4 * R, m = ((s.p % P) + P) % P;
      let target = m <= R ? R : m <= 3 * R ? 3 * R : 5 * R; target += s.p - m;
      const err = gauss(r) * sigmaMs / 1000 * s.speed;
      const p = Math.max(s.p, target + err);
      s.p = p; ST.drop(s);
    }
    return s;
  }
  const games = 300, res = {};
  for (const [name, ms] of [['sharp', 25], ['good', 55], ['average', 95], ['loose', 180]]) {
    const ns = [], pf = [];
    for (let g = 0; g < games; g++) { const s = play(ms, 1000 + g); ns.push(s.n); pf.push(s.perfects / Math.max(1, s.n)); }
    ns.sort((a, b) => a - b);
    res[name] = { med: ns[games >> 1], mean: ns.reduce((a, b) => a + b) / games, max: ns[games - 1], pf: pf.reduce((a, b) => a + b) / games };
    if (process.env.VERBOSE) console.log(`   ${name.padEnd(8)} median ${res[name].med}  mean ${res[name].mean.toFixed(1)}  best ${res[name].max}  perfect ${(res[name].pf * 100).toFixed(0)}%`);
  }
  check(res.sharp.mean > res.good.mean && res.good.mean > res.average.mean && res.average.mean > res.loose.mean, 'better timing builds higher, in order');
  check(res.sharp.med >= 60, 'a sharp player gets well into the night', `median ${res.sharp.med}`);
  check(res.good.med >= 20 && res.good.med <= 90, 'a good player gets somewhere real', `median ${res.good.med}`);
  check(res.average.med >= 10 && res.average.med <= 45, 'an average player gets a handful of floors', `median ${res.average.med}`);
  check(res.loose.med >= 4 && res.loose.med <= 25, 'a loose player still places a few', `median ${res.loose.med}`);
  check(res.sharp.pf > 0.5 && res.loose.pf < 0.25, 'perfects follow skill', `${res.sharp.pf.toFixed(2)} / ${res.loose.pf.toFixed(2)}`);
  // a player who never taps places nothing, and one who taps at the worst moment ends at once
  const idle = ST.create(); ST.advance(idle, 600); check(idle.n === 0 && !idle.over, 'standing still builds nothing and costs nothing');
  const worst = ST.create(); worst.layers[0].w = 2; dropAt(worst, R); check(worst.over && worst.n === 0, 'tapping with the slab far off a narrow tower ends it at nothing');
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
