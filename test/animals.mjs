#!/usr/bin/env node
// Test suite for games/animals.html (Dusk, a game for cats).
//
// Runs the page's DOM-free <script id="core"> block in Node. A cat cannot report a bug, so the promises
// are checked here: prey stay on the screen once they are on it and never jump, a paw on the prey is a
// catch and a paw beside it is not, a prey hiding in the grass cannot be caught but can be flushed, a near
// miss sends it running away from the paw, a cat that stops playing gets bolder prey, every hunt ends and
// ends on a catch for a cat that is still playing, keener cats catch more without a lazy cat going hungry,
// and the ledger of nights trusts nothing it reads. No browser, no server.
//
//   node test/animals.mjs            all suites
//   node test/animals.mjs paws cats  some of them

import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(HERE, '..', 'games', 'animals.html'), 'utf8');
const src = html.match(/<script id="core">([\s\S]*?)<\/script>/)[1];
const Core = vm.runInNewContext(src + ';Core');

let fails = 0, n = 0;
const ok = (c, m) => { n++; if (!c) { fails++; if (fails < 400) console.log('  FAIL', m); } };
const SIZES = [[390, 844], [844, 390], [768, 1024], [1280, 800]];
const mk = (seed, w, h, o) => Core.create({seed, w, h, length: 180, ...o});

// a cat: sees the prey with a delay, paws at where it saw it, now and then; it cannot see into the grass
function cat(s, {rt = 0.3, err = 50, rate = 0.5, seed = 1, dt = 1 / 60, max = 600, every} = {}) {
  let r = seed >>> 0 || 1;
  const R = () => { r ^= r << 13; r >>>= 0; r ^= r >> 17; r ^= r << 5; r >>>= 0; return r / 4294967296; };
  const seen = [], ev = []; let cool = 0;
  for (let t = 0; t < max && s.phase !== 'done'; t += dt) {
    const e = Core.step(s, dt); ev.push(...e);
    const p = s.prey;
    seen.push(p && !p.hidden && p.mode !== 'caught' && p.mode !== 'leave' && Core.inField(s, p.x, p.y, s.S) ? {x: p.x, y: p.y} : null);
    cool -= dt;
    const lag = seen[seen.length - 1 - Math.round(rt / dt)];
    if (lag && cool <= 0 && rate > 0 && R() < rate * dt) {
      const a = R() * Math.PI * 2, d = Math.sqrt(R()) * err;
      ev.push(...Core.touch(s, lag.x + Math.cos(a) * d, lag.y + Math.sin(a) * d, 'down')); cool = 0.35;
    }
    if (every) every(s, t);
  }
  return ev;
}

const suites = {
  // prey stay where a cat can reach them, and never jump
  field() {
    for (const [w, h] of SIZES) for (const dt of [1 / 30, 1 / 60, 1 / 144]) for (let seed = 1; seed <= 6; seed++) {
      for (const kinds of [['mouse'], ['moth'], ['hopper']]) {
        const s = mk(seed, w, h, {kinds}); const f = Core.field(s);
        let prev = null, out = 0, jumps = 0, away = 0;
        cat(s, {seed, dt, rate: 0.35, err: 140, max: 200, every(s) {
          const p = s.prey;
          if (!p) { prev = null; return; }
          if (prev && prev.id === p.id) {
            const d = Math.hypot(p.x - prev.x, p.y - prev.y), lim = Core.VMAX[p.kind] * s.S * dt + 1e-6;
            if (d > lim) jumps++;
          }
          if (p.inside && (p.x < f.x0 - 1e-6 || p.x > f.x1 + 1e-6 || p.y < f.y0 - 1e-6 || p.y > f.y1 + 1e-6)) out++;
          // coming out of cover it is briefly near the screen's edge, never for long
          away = !p.inside && !p.cover && p.mode !== 'leave' && p.mode !== 'caught' && p.age > 4 && !Core.inField(s, p.x, p.y, s.S * 0.4) ? away + dt : 0;
          if (away > 1) out++;
          prev = {id: p.id, x: p.x, y: p.y};
        }});
        ok(jumps === 0, `${kinds} ${w}x${h} dt ${dt.toFixed(3)} seed ${seed}: no jumps (${jumps})`);
        ok(out === 0, `${kinds} ${w}x${h} dt ${dt.toFixed(3)} seed ${seed}: stays on the field (${out})`);
      }
    }
    // a resize keeps prey on the new screen
    for (let seed = 1; seed <= 20; seed++) {
      const s = mk(seed, 1280, 800); cat(s, {seed, rate: 0, max: 7 + seed});
      Core.resize(s, 390, 844); Core.step(s, 0.5);
      const p = s.prey;
      if (p && p.inside) ok(Core.inField(s, p.x, p.y, 1), 'after a resize the prey is on the new field');
    }
  },

  // a paw on the prey catches it, a paw a hair beyond does not
  paws() {
    for (let seed = 1; seed <= 300; seed++) {
      const s = mk(seed, 390, 844, {kinds: [Core.KINDS[seed % 3]]});
      let tries = 0; while ((!s.prey || s.prey.hidden || !s.prey.inside) && tries++ < 3000) Core.step(s, 1 / 60);
      const p = s.prey; if (!p || p.hidden) continue;
      const a = (seed * 2.399) % (Math.PI * 2), reach = Core.reach(s, p);
      // walk out from the body along a ray until the distance to the body is just beyond reach
      let r = 0; while (Core.dist(s, p, p.x + Math.cos(a) * r, p.y + Math.sin(a) * r) <= reach + 0.5) r += 0.5;
      const s2 = structuredClone(s);
      const miss = Core.touch(s, p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, 'down');
      ok(!miss.some(e => e.type === 'catch'), 'a paw just beyond reach is not a catch');
      const hit = Core.touch(s2, s2.prey.x + Math.cos(a) * (r - 1.5), s2.prey.y + Math.sin(a) * (r - 1.5), 'down');
      ok(hit.some(e => e.type === 'catch') && s2.caught.length === 1, 'a paw just inside reach is a catch');
      ok(s2.prey.mode === 'caught', 'a caught prey stays put under the paw');
      ok(Core.touch(s2, s2.prey.x, s2.prey.y, 'down').every(e => e.type !== 'catch'), 'a caught prey is not caught twice');
    }
    // a swipe catches as a press does
    { const s = mk(5, 390, 844, {kinds: ['mouse']}); while (!s.prey || s.prey.hidden || !s.prey.inside) Core.step(s, 1 / 60);
      ok(Core.touch(s, s.prey.x, s.prey.y, 'move').some(e => e.type === 'catch'), 'a paw dragged across the prey catches it'); }
    // the reach is paw-sized on every screen: never under 40 px, never a quarter of a phone
    for (const [w, h] of SIZES) { const s = mk(1, w, h); for (const kind of Core.KINDS) { const r = Core.reach(s, {kind}); ok(r >= 40 && r <= 90, `${kind} reach ${r.toFixed(0)} px on ${w}x${h}`); } }
  },

  // grass hides, a paw flushes
  cover() {
    let hid = 0, flushed = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const s = mk(seed, 390, 844, {kinds: [seed % 2 ? 'mouse' : 'hopper']});
      for (let i = 0; i < 60 * 60 && !(s.prey && s.prey.hidden && s.prey.cover); i++) Core.step(s, 1 / 60);
      const p = s.prey; if (!p || !p.hidden || !p.cover) continue;
      hid++;
      const cv = p.cover, e1 = Core.touch(s, p.x, p.y, 'down');
      if (Math.hypot(p.x - cv.x, p.y - cv.y) < cv.r) {
        ok(!e1.some(e => e.type === 'catch'), 'a prey in the grass cannot be caught');
        ok(e1.some(e => e.type === 'flush'), 'a paw on the grass flushes what hides in it');
        ok(!p.hidden, 'a flushed prey is out in the open');
        const x0 = p.x, y0 = p.y; for (let i = 0; i < 30; i++) Core.step(s, 1 / 60);
        ok(Math.hypot(p.x - x0, p.y - y0) > s.S * 0.3, 'a flushed prey runs');
        flushed++;
      }
    }
    ok(hid > 100 && flushed > 60, `prey hide in the grass (${hid} hid, ${flushed} flushed)`);
  },

  // a near miss sends the prey away from the paw
  startle() {
    let tested = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const kind = Core.KINDS[seed % 3], s = mk(seed, 1280, 800, {kinds: [kind]});
      for (let i = 0; i < 600 && !(s.prey && s.prey.inside && !s.prey.hidden && s.prey.mode !== 'enter'); i++) Core.step(s, 1 / 60);
      const p = s.prey; if (!p || !p.inside || p.hidden) continue;
      for (let i = 0; i < 200 && (p.hop || p.v > 5); i++) Core.step(s, 1 / 60); // wait until it is still
      const f = Core.field(s); if (p.x < f.x0 + s.S * 1.2 || p.x > f.x1 - s.S * 1.2 || p.y < f.y0 + s.S * 1.2 || p.y > f.y1 - s.S * 1.2) continue;
      const a = seed * 1.7, d = Core.reach(s, p) + s.S * 0.5;
      const px = p.x + Math.cos(a) * d, py = p.y + Math.sin(a) * d;
      const e = Core.touch(s, px, py, 'down');
      ok(e.some(x => x.type === 'near'), `${kind}: a paw half a body length beyond reach startles it`);
      const d0 = Math.hypot(p.x - px, p.y - py);
      for (let i = 0; i < 40; i++) Core.step(s, 1 / 60);
      ok(Math.hypot(p.x - px, p.y - py) > d0 + s.S * 0.5, `${kind}: a startled prey ends up further from the paw`);
      tested++;
    }
    ok(tested > 100, `startles tested (${tested})`);
  },

  // a cat that stops playing gets bolder prey; a hunt always ends
  pace() {
    for (let seed = 1; seed <= 10; seed++) {
      const s = mk(seed, 390, 844);
      cat(s, {seed, rate: 0, max: 25});
      ok(s.bold > 0.9, `prey grow bold when nobody plays (${s.bold.toFixed(2)})`);
      Core.touch(s, 5, 400, 'down'); for (let i = 0; i < 120; i++) Core.step(s, 1 / 60);
      ok(s.bold < 0.2, 'and shy again when a paw appears');
    }
    // prey keep coming: an idle cat still sees one at least four fifths of the time
    for (let seed = 1; seed <= 10; seed++) {
      const s = mk(seed, 390, 844); let shown = 0, frames = 0;
      cat(s, {seed, rate: 0, max: 170, every(s) { frames++; const p = s.prey; if (p && !p.hidden && Core.inField(s, p.x, p.y, 0)) shown++; }});
      ok(shown / frames > 0.8, `something to watch ${Math.round(shown / frames * 100)}% of the time`);
    }
    // every hunt ends, and for a cat still playing it ends on a catch
    let onCatch = 0, ends = 0;
    for (let seed = 1; seed <= 40; seed++) for (const len of [180, 360]) {
      const s = mk(seed, seed % 2 ? 390 : 1280, seed % 2 ? 844 : 800, {length: len});
      const ev = cat(s, {seed, rate: 0.3, err: 70, max: len + 120});
      ok(s.phase === 'done', `the ${len}s hunt ends (seed ${seed})`);
      ok(s.t <= len + 0.01 && s.finaleT <= Core.FINALE_MAX + 6, `and not much after its time (${s.t.toFixed(1)} + ${s.finaleT.toFixed(1)})`);
      const last = ev.filter(e => e.type === 'catch' || e.type === 'end');
      ends++; if (last.length > 1 && last[last.length - 2].type === 'catch' && s.finalCatch) onCatch++;
    }
    ok(onCatch / ends >= 0.95, `a hunt ends on a catch (${onCatch}/${ends})`);
    // and nobody playing at all still ends it
    { const s = mk(3, 390, 844); cat(s, {rate: 0, max: 400}); ok(s.phase === 'done' && s.caught.length === 0, 'a hunt nobody plays ends empty'); }
  },

  // keener cats catch more; a lazy cat is not left hungry; nothing is trivial
  cats() {
    const avg = o => { let t = 0; for (let seed = 1; seed <= 16; seed++) { const s = mk(seed, seed % 2 ? 390 : 1024, seed % 2 ? 844 : 768); cat(s, {seed, max: 400, ...o}); t += s.caught.length; } return t / 16; };
    const lazy = avg({rate: 0.12, err: 90, rt: 0.45}), casual = avg({rate: 0.3, err: 70, rt: 0.35}), keen = avg({rate: 0.8, err: 45, rt: 0.25});
    console.log(`  catches per 3 min: lazy ${lazy.toFixed(1)}, casual ${casual.toFixed(1)}, keen ${keen.toFixed(1)}`);
    ok(lazy < casual && casual < keen, 'keener cats catch more');
    ok(lazy >= 5, 'a lazy cat still catches a few');
    ok(keen <= 40, 'a keen cat does not empty the field every few seconds');
    // a paw that lands at random catches rarely: a catch has to be aimed
    let rand = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const s = mk(seed, 1024, 768); let r = seed;
      const R = () => (r = (r * 16807) % 2147483647) / 2147483647;
      for (let t = 0; t < 180; t += 1 / 60) { Core.step(s, 1 / 60); if (R() < 0.5 / 60) Core.touch(s, R() * 1024, R() * 768, 'down'); }
      rand += s.caught.length;
    }
    ok(rand / 12 < casual / 2, `random paws catch far less than aimed ones (${(rand / 12).toFixed(1)})`);
  },

  // the same seed and the same paws are the same hunt
  seeds() {
    const trace = seed => { const s = mk(seed, 390, 844); const out = []; cat(s, {seed, max: 60, every(s, t) { if (Math.round(t * 60) % 30 === 0 && s.prey) out.push(s.prey.kind, s.prey.x.toFixed(3), s.prey.y.toFixed(3)); }}); return out.join() + s.caught.length; };
    for (let seed = 1; seed <= 5; seed++) ok(trace(seed) === trace(seed), 'a seed replays');
    ok(trace(1) !== trace(2), 'different seeds differ');
    // all three: never the same prey three times running
    const s = mk(9, 390, 844); const ks = []; let lastId = 0;
    cat(s, {rate: 1, err: 20, rt: 0.1, max: 400, every(s) { const p = s.prey; if (p && p.id !== lastId) { lastId = p.id; ks.push(p.kind); } }}); let run = 1, worst = 1;
    for (let i = 1; i < ks.length; i++) { run = ks[i] === ks[i - 1] ? run + 1 : 1; worst = Math.max(worst, run); }
    ok(ks.length > 20 && worst <= 2, `all three: no prey three times running (${ks.length} prey, worst run ${worst})`);
    ok(Core.KINDS.every(k => ks.includes(k)), 'all three: every prey comes out');
    // cover keeps the moon and the tally clear
    for (const [w, h] of SIZES) for (let seed = 1; seed <= 30; seed++) for (const c of Core.covers(seed, w, h, 100)) {
      ok(Math.hypot(c.x, c.y) > c.r + 80 && Math.hypot(c.x - w, c.y) > c.r + 100, 'grass stays off the moon and the tally');
    }
  },

  // the ledger of nights trusts nothing it reads
  ledger() {
    const b = Core.blank();
    ok(JSON.stringify(Core.clean(null)) === JSON.stringify(b) && JSON.stringify(Core.clean('x')) === JSON.stringify(b), 'junk is a blank ledger');
    const c = Core.clean({prey: 'dragon', len: 9999, sound: 'loud', hunts: -4, total: 1e99, best: NaN, nights: {'2026-10-01': {mouse: 3.7, moth: -1, hopper: 'x'}, 'bad': {mouse: 1}, '2026-10-02': {mouse: 0}, '2026-10-03': 5}});
    ok(c.prey === 'all' && c.len === 180 && c.sound === true, 'bad choices fall back to the defaults');
    ok(c.hunts === 0 && c.total === 1e8 && c.best === 0, 'numbers are clamped');
    ok(JSON.stringify(c.nights) === JSON.stringify({'2026-10-01': {mouse: 3, moth: 0, hopper: 0}}), 'nights are cleaned, empty ones dropped');
    const s = Core.blank();
    Core.record(s, [{kind: 'mouse'}, {kind: 'moth'}, {kind: 'mouse'}], new Date(2026, 0, 1, 23, 50));
    Core.record(s, [{kind: 'hopper'}], new Date(2026, 0, 1, 23, 59));
    Core.record(s, [], new Date(2025, 11, 30));
    ok(s.nights['2026-01-01'].mouse === 2 && s.nights['2026-01-01'].hopper === 1 && !s.nights['2025-12-30'], 'a night adds up, an empty night is not a night');
    ok(s.hunts === 3 && s.total === 4 && s.best === 3, 'hunts, total, best');
    const wk = Core.week(s, new Date(2026, 0, 3));
    ok(wk.length === 7 && wk[6].today && wk[6].key === '2026-01-03' && wk[0].key === '2025-12-28', 'the week runs back across the new year');
    ok(wk[4].n === 4 && wk.reduce((a, d) => a + d.n, 0) === 4, 'the week shows the right night');
    const wk2 = Core.week(s, new Date(2024, 2, 1));
    ok(wk2[0].key === '2024-02-24' && wk2[5].key === '2024-02-29', 'the week knows a leap day');
    for (let i = 0; i < 90; i++) Core.record(s, [{kind: 'moth'}], new Date(2026, 1, 1 + i));
    ok(Object.keys(s.nights).length === 60, 'the ledger keeps sixty nights');
    ok(JSON.stringify(Core.clean(JSON.parse(JSON.stringify(s)))) === JSON.stringify(s), 'a ledger survives storage');
  }
};

const pick = process.argv.slice(2);
for (const [name, fn] of Object.entries(suites)) {
  if (pick.length && !pick.includes(name)) continue;
  const f0 = fails, n0 = n, t0 = Date.now();
  fn();
  console.log(`${fails === f0 ? 'ok  ' : 'FAIL'} ${name.padEnd(8)} ${n - n0} checks, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}
console.log(fails ? `${fails} of ${n} checks failed` : `all ${n} checks passed`);
process.exit(fails ? 1 : 0);
